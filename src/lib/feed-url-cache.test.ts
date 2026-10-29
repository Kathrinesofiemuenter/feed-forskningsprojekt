import { expect, test } from "bun:test";
import { FeedUrlCache } from "./feed-url-cache";

test("advancing the feed keeps the active prefetched source unchanged", async () => {
  const cache = new FeedUrlCache();
  const requests: string[][] = [];
  const sign = async (paths: string[]) => {
    requests.push(paths);
    return Object.fromEntries(paths.map(path => [path, `${path}?signature=${requests.length}`]));
  };
  const first = await cache.resolve(["a", "b", "c", "d"], sign, 0);
  const next = await cache.resolve(["b", "c", "d", "e"], sign, 1000);
  expect(next.b).toBe(first.b);
  expect(requests).toEqual([["a", "b", "c", "d"], ["e"]]);
});

test("expired feed links are renewed before use", async () => {
  const cache = new FeedUrlCache();
  let version = 0;
  const sign = async () => ({ a: `signed-${++version}` });
  expect((await cache.resolve(["a"], sign, 0)).a).toBe("signed-1");
  expect((await cache.resolve(["a"], sign, 45 * 60 * 1000)).a).toBe("signed-2");
});