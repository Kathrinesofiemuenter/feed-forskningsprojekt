// Browser-only voice memo export: fetches the stored recording, decodes it with
// the Web Audio API and encodes it to MP3 with lamejs (pure JS, no worker/CDN).
// Must only be imported dynamically from client code.

export async function exportVoiceMemoAsMp3(
  signedUrl: string,
  username: string,
  localDate: string,
  onProgress?: (stage: "downloading" | "converting") => void,
): Promise<void> {
  onProgress?.("downloading");
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`Kunne ikke hente optagelsen (${res.status})`);
  const input = await res.arrayBuffer();

  onProgress?.("converting");
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const audio = await ctx.decodeAudioData(input);
  void ctx.close();

  // Mix down to mono 16-bit PCM.
  const len = audio.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i]! += d[i]! / audio.numberOfChannels;
  }
  const pcm = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]!));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const encoder = new Mp3Encoder(1, audio.sampleRate, 128);
  const parts: BlobPart[] = [];
  const block = 1152;
  for (let i = 0; i < len; i += block) {
    const buf = encoder.encodeBuffer(pcm.subarray(i, i + block));
    if (buf.length) parts.push(new Uint8Array(buf));
  }
  const end = encoder.flush();
  if (end.length) parts.push(new Uint8Array(end));

  const safeName = username.replace(/[^\w.-]+/g, "_") || "optagelse";
  const blob = new Blob(parts, { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}-${localDate}.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
