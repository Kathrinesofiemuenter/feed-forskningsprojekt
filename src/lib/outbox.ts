import { supabase } from "@/integrations/supabase/client";
import { isTemporaryFailure, retryDelay } from "./reliability";

type Delivery = { attempts?: number; retryAt?: number; blocked?: boolean };
export type SurveyItem = Delivery & { kind: "survey"; id: string; userId: string; date: string; row: Record<string, unknown> };
export type MemoItem = Delivery & { kind: "memo"; id: string; userId: string; date: string; path: string; blob: Blob; row: Record<string, unknown> };
export type OutboxItem = SurveyItem | MemoItem;
const DB = "feed-outbox", STORE = "items";
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
    const transaction = db.transaction(STORE, mode);
    const request = fn(transaction.objectStore(STORE));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error ?? request.error); };
  });
}
const changed = () => window.dispatchEvent(new Event("outbox-change"));
export async function listOutbox(): Promise<OutboxItem[]> {
  if (typeof indexedDB === "undefined") return [];
  return tx("readonly", s => s.getAll() as IDBRequest<OutboxItem[]>);
}
export async function enqueue(item: OutboxItem) {
  await tx("readwrite", s => s.put(item));
  changed();
}
export async function hasPending(userId: string, kind: OutboxItem["kind"], date: string) {
  return (await listOutbox()).some(i => i.userId === userId && i.kind === kind && i.date === date);
}
export function isNetworkError(error: unknown) {
  return (typeof navigator !== "undefined" && !navigator.onLine) || isTemporaryFailure(error);
}
let flushing = false;
export async function flushOutbox() {
  if (flushing || typeof indexedDB === "undefined" || !navigator.onLine) return;
  flushing = true;
  const send = async () => {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    const items = (await listOutbox()).filter(i => i.userId === uid).sort((a,b) => a.kind === b.kind ? 0 : a.kind === "survey" ? -1 : 1);
    for (const item of items) {
      if (item.blocked || (item.retryAt ?? 0) > Date.now()) continue;
      // Never send a memo ahead of a still-pending survey for that day.
      if (item.kind === "memo" && await hasPending(uid, "survey", item.date)) continue;
      try {
        if (item.kind === "memo") {
          const up = await supabase.storage.from("voice-memos").upload(item.path, item.blob, { contentType: item.blob.type || "audio/webm", upsert: false });
          if (up.error && !/exists|duplicate/i.test(up.error.message)) throw up.error;
        }
        const table = item.kind === "memo" ? "voice_memos" : "survey_responses";
        const { error } = await supabase.from(table).insert(item.row as never);
        if (error && error.code !== "23505") throw error;
        await tx("readwrite", s => s.delete(item.id));
        changed();
      } catch (error) {
        const attempts = (item.attempts ?? 0) + 1;
        const status = Number((error as { status?: number; statusCode?: number })?.status ?? (error as { statusCode?: number })?.statusCode);
        const temporary = isNetworkError(error) || status === 401;
        await enqueue({ ...item, attempts, retryAt: Date.now() + retryDelay(attempts - 1), blocked: !temporary });
        if (status === 401) await supabase.auth.refreshSession();
        // Back off the entire queue during overload, not one request per item.
        if (temporary) break;
      }
    }
  };
  try {
    if (navigator.locks) await navigator.locks.request("feed-outbox-send", { ifAvailable: true }, lock => lock ? send() : Promise.resolve());
    else await send();
  } finally { flushing = false; changed(); }
}
export async function retryPending() {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  for (const item of await listOutbox()) if (item.userId === uid) await enqueue({ ...item, retryAt: 0, blocked: false });
  await flushOutbox();
}
export function startOutboxSync() {
  const run = () => { void flushOutbox().catch(() => undefined); };
  const onVis = () => { if (document.visibilityState === "visible") run(); };
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVis);
  const timer = setInterval(run, 5000);
  run();
  return () => { window.removeEventListener("online", run); document.removeEventListener("visibilitychange", onVis); clearInterval(timer); };
}
