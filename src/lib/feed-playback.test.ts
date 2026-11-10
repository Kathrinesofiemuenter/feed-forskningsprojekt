import { describe, expect, it } from "vitest";
import { startFeedPlayback, updateFeedSound } from "./feed-playback";

describe("feed sound preference", () => {
  it("starts consecutive videos with sound by default", async () => {
    for (let i = 0; i < 10; i++) {
      const media = { muted: true, play: async () => undefined };
      expect(await startFeedPlayback(media, false)).toBe(true);
      expect(media.muted).toBe(false);
    }
  });
  it("keeps explicit mute across consecutive videos", async () => {
    for (let i = 0; i < 10; i++) {
      const media = { muted: false, play: async () => undefined };
      await startFeedPlayback(media, true);
      expect(media.muted).toBe(true);
    }
  });
  it("does not silently mute when audible playback is blocked", async () => {
    let attempts = 0;
    const media = { muted: false, play: async () => { attempts++; throw new DOMException("Blocked", "NotAllowedError"); } };
    expect(await startFeedPlayback(media, false)).toBe(false);
    expect(media.muted).toBe(false);
    expect(attempts).toBe(1);
  });
  it("changes sound without resuming a deliberately paused video", async () => {
    let attempts = 0;
    const media = { muted: false, play: async () => { attempts++; } };
    expect(await updateFeedSound(media, true, true)).toBe(true);
    expect(media.muted).toBe(true);
    expect(attempts).toBe(0);
    await updateFeedSound(media, false, true);
    expect(media.muted).toBe(false);
    expect(attempts).toBe(0);
  });
});