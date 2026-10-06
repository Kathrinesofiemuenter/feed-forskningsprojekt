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

/** Upload with real progress reporting; retries once on network failure. */
export async function uploadVideoWithProgress(
  path: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Du er ikke logget ind.");
  const url = `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/object/videos/${encodeURIComponent(path)}`;
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string;

  const attempt = () =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", key);
      xhr.setRequestHeader("x-upsert", "true");
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
        reject(new Error(xhr.status === 413 ? "Filen er for stor (maks 200 MB)." : msg));
      };
      xhr.onerror = () => reject(new Error("network"));
      xhr.send(file);
    });

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
