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

// A mute choice must not restart a video the participant deliberately paused.
export async function updateFeedSound(
  media: Pick<HTMLMediaElement, "muted" | "play">,
  muted: boolean,
  userPaused: boolean,
): Promise<boolean> {
  media.muted = muted;
  if (userPaused) return true;
  return startFeedPlayback(media, muted);
}