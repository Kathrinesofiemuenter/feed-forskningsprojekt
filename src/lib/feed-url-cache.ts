type SignedLink = { url: string; expiresAt: number };

// Keep overlapping windows on the same media URL: changing a video's signed
// URL makes the browser discard its buffer and restart playback.
export class FeedUrlCache {
  private links = new Map<string, SignedLink>();

  async resolve(
    paths: string[],
    sign: (missing: string[]) => Promise<Record<string, string>>,
    now = Date.now(),
  ): Promise<Record<string, string>> {
    const missing = paths.filter(path => (this.links.get(path)?.expiresAt ?? 0) <= now);
    if (missing.length) {
      const signed = await sign(missing);
      for (const [path, url] of Object.entries(signed)) {
        const existing = this.links.get(path);
        if (!existing || existing.expiresAt <= now) {
          this.links.set(path, { url, expiresAt: now + 45 * 60 * 1000 });
        }
      }
    }
    const result: Record<string, string> = {};
    for (const path of paths) {
      const link = this.links.get(path);
      if (link && link.expiresAt > now) result[path] = link.url;
    }
    // Bound cached URLs as well as mounted media. Protect this window.
    for (const path of this.links.keys()) {
      if (this.links.size <= 12) break;
      if (!paths.includes(path)) this.links.delete(path);
    }
    return result;
  }
}