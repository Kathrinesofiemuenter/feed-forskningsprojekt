/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { isTemporaryFailure, LOGIN_RETRY_WAITS_MS, FEED_WINDOW, retryDelay } from "./reliability";

describe("reliability policies", () => {
  test("storage 429 and temporary server errors retry", () => {
    expect(isTemporaryFailure({ statusCode: "429", message: "rate limit" })).toBe(true);
    expect(isTemporaryFailure({ status: 503 })).toBe(true);
    expect(isTemporaryFailure({ status: 403, message: "permission denied" })).toBe(false);
  });
  test("login waits exceed a two-minute burst, with seven retries", () => {
    expect(LOGIN_RETRY_WAITS_MS.length).toBe(7);
    expect(LOGIN_RETRY_WAITS_MS.reduce((a,b)=>a+b,0)).toBe(156000);
  });
  test("feed requests four nearby links, not all videos", () => {
    expect(FEED_WINDOW).toBe(4);
    expect(Array.from({ length: 901 }).slice(0, FEED_WINDOW).length).toBe(4);
  });
  test("delivery retries back off and stay bounded", () => {
    expect(retryDelay(0, () => 0)).toBe(3000);
    expect(retryDelay(8, () => 0)).toBe(120000);
  });
});
