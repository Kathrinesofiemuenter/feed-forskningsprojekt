import { supabase } from "@/integrations/supabase/client";

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

/** Upload with real progress reporting; retries once on network failure. */
export async function uploadVideoWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const url = `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/object/videos/${encodeURIComponent(path)}`;
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string;

  const attempt = async () => {
    const token = await freshToken();
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", key);
      xhr.setRequestHeader("Content-Type", guessVideoType(file));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let msg = `HTTP ${xhr.status}`;
        try {
          msg = JSON.parse(xhr.responseText).message ?? msg;
        } catch {}
        reject(new Error(xhr.status === 413 ? "Filen er for stor (maks 200 MB)." : friendlyError(msg)));
      };
      xhr.onerror = () => reject(new Error("network"));
      xhr.send(file);
    });
  };

  try {
    await attempt();
  } catch (e) {
    if ((e as Error).message !== "network") throw e;
    onProgress(0);
    await attempt().catch((e2: Error) => {
      throw new Error(e2.message === "network" ? "Forbindelsen blev afbrudt." : e2.message);
    });
  }
}
