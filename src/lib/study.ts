/** Cumulative feed seconds per calendar day that trigger the daily survey. */
export const SURVEY_THRESHOLD_SECONDS = 20 * 60;

export const SURVEY_ITEMS = [
  { key: "glad", label: "glad", question: "Vurder venligst, hvor glad du føler dig lige nu" },
  { key: "tilfreds", label: "tilfreds", question: "Vurder venligst, hvor tilfreds du føler dig lige nu" },
  { key: "haebefuld", label: "håbefuld", question: "Vurder venligst, hvor håbefuld du føler dig lige nu" },
  { key: "bekymret", label: "bekymret", question: "Vurder venligst, hvor bekymret du føler dig lige nu" },
  { key: "ensom", label: "ensom", question: "Vurder venligst, hvor ensom du føler dig lige nu" },
  { key: "irritabel", label: "irritabel", question: "Vurder venligst, hvor irritabel du føler dig lige nu" },
] as const;

export type SurveyKey = (typeof SURVEY_ITEMS)[number]["key"];

/** Answer scale: 1 (Slet ikke) to 5 (Ekstremt). */
export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;

export const LIKERT_LABELS: Record<number, string> = {
  1: "Slet ikke",
  2: "I lille grad",
  3: "I nogen grad",
  4: "I høj grad",
  5: "Ekstremt",
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
 * Build a randomized playlist where each video appears at most twice (never
 * more) and never twice in a row. Deterministic per seed, so a participant
 * always gets the same sequence.
 */
export function buildPlaylist<T extends { id: string }>(
  videos: T[],
  seed: string,
  maxRepeats = 2,
): T[] {
  if (videos.length === 0) return [];
  // With a single video, a second showing would have to be back-to-back.
  if (new Set(videos.map((v) => v.id)).size === 1) return [videos[0]!];

  const pool: T[] = [];
  for (let pass = 0; pass < maxRepeats; pass++) {
    const order = seededShuffle(videos, `${seed}:${pass}`);
    // Where two passes meet, the next one may start on the video the previous
    // one ended on; rotating it by one fixes that, since a pass has no
    // duplicates so its second item is always a different video.
    if (pool.length > 0 && order[0]!.id === pool[pool.length - 1]!.id && order.length > 1) {
      order.push(order.shift()!);
    }
    pool.push(...order);
  }
  return pool;
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
