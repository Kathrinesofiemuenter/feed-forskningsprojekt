import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|3gp)$/i;

export function isVideoFile(file: File) {
  return file.type.startsWith("video/") || VIDEO_EXT.test(file.name);
}

export function guessVideoType(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  return "video/mp4";
}

export const LOGIN_EXPIRED = "Dit login er udløbet – log ind igen.";

export function friendlyError(msg: string) {
  return /row-level security|unauthorized|jwt|exp/i.test(msg) ? LOGIN_EXPIRED : msg;
}

/** Renews the session so a slow batch never uses a stale login. */
export async function freshToken(): Promise<string> {
  const { data } = await supabase.auth.refreshSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(LOGIN_EXPIRED);
  return token;
}

export const UPLOAD_CANCELLED = "Upload stoppet.";

/**
 * Resumable chunked upload (TUS, 6 MB pieces). A dropped connection only
 * re-sends the current piece instead of restarting the whole file.
 */
export async function uploadVideoWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base = import.meta.env['VITE_SUPABASE_URL'] as string;
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string;
  let token = await freshToken();
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${base}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      chunkSize: 6 * 1024 * 1024,
      removeFingerprintOnSuccess: true,
      uploadDataDuringCreation: true,
      headers: { apikey: key, "x-upsert": "false" },
      metadata: {
        bucketName: "videos",
        objectName: path,
        contentType: guessVideoType(file),
        cacheControl: "3600",
      },
      onBeforeRequest: async (req) => {
        req.setHeader("Authorization", `Bearer ${token}`);
      },
      onShouldRetry: (err) => {
        const s = (err as tus.DetailedError).originalResponse?.getStatus();
        if (s === 401 || s === 403) {
          freshToken().then((t) => (token = t)).catch(() => {});
        }
        return !signal?.aborted && s !== 413;
      },
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onError: (err) => {
        if (signal?.aborted) return reject(new Error(UPLOAD_CANCELLED));
        const s = (err as tus.DetailedError).originalResponse?.getStatus();
        if (s === 413) return reject(new Error("Filen er for stor (maks 200 MB)."));
        reject(new Error(s ? friendlyError(err.message) : "Forbindelsen blev afbrudt."));
      },
      onSuccess: () => resolve(),
    });
    signal?.addEventListener("abort", () => {
      upload.abort(true).catch(() => {});
      reject(new Error(UPLOAD_CANCELLED));
    }, { once: true });
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
      upload.start();
    });
  });
}
