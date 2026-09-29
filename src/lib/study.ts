/** Cumulative feed seconds per calendar day that trigger the daily survey. */
export const SURVEY_THRESHOLD_SECONDS = 20 * 60;

export const SURVEY_ITEMS = [
  { key: "happy", word: "happy" },
  { key: "optimistic", word: "optimistic" },
  { key: "lively", word: "lively" },
  { key: "tense", word: "tense" },
  { key: "nervous", word: "nervous" },
  { key: "anxious", word: "anxious" },
] as const;

export type SurveyKey = (typeof SURVEY_ITEMS)[number]["key"];

export const LIKERT_LABELS: Record<number, string> = {
  1: "Not at all",
  2: "Slightly",
  3: "Moderately",
  4: "Quite a bit",
  5: "Very much",
};

/** Local calendar day as YYYY-MM-DD (participant's device time zone). */
export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic per-user shuffle: same participant always sees the same random order. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashString(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Build a randomized playlist where each video may appear up to `maxRepeats`
 * times in total and never twice in a row. Deterministic per seed.
 */
export function buildPlaylist<T extends { id: string }>(
  videos: T[],
  seed: string,
  maxRepeats = 10,
): T[] {
  if (videos.length === 0) return [];
  const pool: T[] = [];
  for (const v of videos) {
    for (let i = 0; i < maxRepeats; i++) pool.push(v);
  }
  const shuffled = seededShuffle(pool, seed);
  // Repair pass: swap any item that equals its predecessor with a later
  // non-conflicting item. With maxRepeats=10 and >=2 distinct videos a
  // valid arrangement always exists.
  for (let i = 1; i < shuffled.length; i++) {
    if (shuffled[i]!.id !== shuffled[i - 1]!.id) continue;
    let j = i + 1;
    while (
      j < shuffled.length &&
      (shuffled[j]!.id === shuffled[i - 1]!.id ||
        (j + 1 < shuffled.length && shuffled[j + 1]!.id === shuffled[i]!.id))
    ) {
      j++;
    }
    if (j < shuffled.length) {
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
  }
  // Single-video edge case: only one distinct video, so adjacency is
  // unavoidable; cap at one occurrence.
  if (new Set(videos.map((v) => v.id)).size === 1) return [videos[0]!];
  return shuffled;
}

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

export function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@participants.local`;
}

export function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
