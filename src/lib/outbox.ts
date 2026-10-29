// Offline outbox: survey answers and voice memos that could not be sent
// (weak/no connection) are kept in IndexedDB on the device and sent
// automatically when the connection returns.
import { supabase } from "@/integrations/supabase/client";

export type SurveyItem = {
  kind: "survey";
  id: string;
  userId: string;
  date: string;
  row: Record<string, unknown>;
};
export type MemoItem = {
  kind: "memo";
  id: string;
  userId: string;
  date: string;
  path: string;
  blob: Blob;
  row: Record<string, unknown>;
};
export type OutboxItem = SurveyItem | MemoItem;

const DB = "feed-outbox";
const STORE = "items";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const available = () => typeof indexedDB !== "undefined";

export async function listOutbox(): Promise<OutboxItem[]> {
  if (!available()) return [];
  try {
    return await tx("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);
  } catch {
    return [];
  }
}

export async function enqueue(item: OutboxItem) {
  await tx("readwrite", (s) => s.put(item));
  window.dispatchEvent(new Event("outbox-change"));
}

async function remove(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

export async function hasPending(userId: string, kind: OutboxItem["kind"], date: string) {
  const items = await listOutbox();
  return items.some((i) => i.userId === userId && i.kind === kind && i.date === date);
}

/** True when an error looks like a lost/weak connection rather than a real rejection. */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = String((error as { message?: string })?.message ?? error ?? "");
  return /failed to fetch|network|load failed|timeout|timed out|aborted|offline/i.test(msg);
}

let flushing = false;

/** Try to send everything waiting in the outbox. Safe to call often. */
export async function flushOutbox() {
  if (flushing || !available()) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    // Surveys first, so memos follow in the same order as on the phone.
    const items = (await listOutbox())
      .filter((i) => i.userId === uid)
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "survey" ? -1 : 1));
    for (const item of items) {
      try {
        if (item.kind === "memo") {
          const up = await supabase.storage
            .from("voice-memos")
            .upload(item.path, item.blob, { contentType: item.blob.type || "audio/webm", upsert: false });
          if (up.error && !/exists|duplicate/i.test(up.error.message)) {
            if (isNetworkError(up.error)) break;
            continue;
          }
          const { error } = await supabase.from("voice_memos").insert(item.row as never);
          if (error && error.code !== "23505") {
            if (isNetworkError(error)) break;
            continue;
          }
        } else {
          const { error } = await supabase.from("survey_responses").insert(item.row as never);
          if (error && error.code !== "23505") {
            if (isNetworkError(error)) break;
            continue;
          }
        }
        await remove(item.id);
      } catch (e) {
        if (isNetworkError(e)) break;
      }
    }
  } finally {
    flushing = false;
    window.dispatchEvent(new Event("outbox-change"));
  }
}

/** Start background sending: on reconnect, on return to the app, and every 30 s. Returns cleanup. */
export function startOutboxSync() {
  const run = () => void flushOutbox();
  const onVis = () => document.visibilityState === "visible" && run();
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVis);
  const t = setInterval(run, 30_000);
  run();
  return () => {
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVis);
    clearInterval(t);
  };
}
