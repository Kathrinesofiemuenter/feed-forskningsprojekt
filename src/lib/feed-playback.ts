export async function startFeedPlayback(media: Pick<HTMLMediaElement, "muted" | "play">, muted: boolean): Promise<boolean> {
  media.muted = muted;
  try {
    await media.play();
    return true;
  } catch {
    // Never trade audible playback for an automatic silent fallback.
    return false;
  }
}