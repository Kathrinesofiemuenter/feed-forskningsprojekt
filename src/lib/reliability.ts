export const LOGIN_RETRY_WAITS_MS = [2000, 5000, 9000, 15000, 25000, 40000, 60000];
export const FEED_WINDOW = 4;

export function isTemporaryFailure(error: unknown): boolean {
  const e = error as { status?: number | string; statusCode?: number | string; code?: string; message?: string } | null;
  const status = Number(e?.status ?? e?.statusCode);
  return status === 408 || status === 429 || status >= 500 ||
    /network|failed to fetch|load failed|timeout|timed out|aborted|offline|rate limit|too many|over_request_rate_limit/i.test(`${e?.code ?? ""} ${e?.message ?? error ?? ""}`);
}

export function retryDelay(attempt: number, random = Math.random): number {
  return Math.min(120000, 3000 * 2 ** Math.min(attempt, 6)) + Math.floor(random() * 5000);
}