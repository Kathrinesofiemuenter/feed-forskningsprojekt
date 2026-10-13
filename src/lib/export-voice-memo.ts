// Browser-only voice memo export: fetches the stored recording and converts it
// to MP3 with ffmpeg.wasm. Must only be imported dynamically from client code —
// it cannot run on the server.

export async function exportVoiceMemoAsMp3(
  signedUrl: string,
  username: string,
  localDate: string,
  onProgress?: (stage: "downloading" | "converting") => void,
): Promise<void> {
  onProgress?.("downloading");
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Kunne ikke hente optagelsen (${res.status})`);
  const input = new Uint8Array(await res.arrayBuffer());

  onProgress?.("converting");
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util"),
  ]);

  const ffmpeg = new FFmpeg();
  const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  await ffmpeg.writeFile("input.webm", await fetchFile(input));
  await ffmpeg.exec([
    "-i",
    "input.webm",
    "-vn",
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "4",
    "output.mp3",
  ]);
  const data = await ffmpeg.readFile("output.mp3");
  ffmpeg.terminate();

  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const safeName = username.replace(/[^\w.-]+/g, "_") || "optagelse";
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: "audio/mpeg",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}-${localDate}.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
