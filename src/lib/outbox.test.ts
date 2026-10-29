import { beforeEach, describe, expect, mock, test } from "bun:test";
import { indexedDB } from "fake-indexeddb";
let uid = "participant-a";
let uploads: string[] = [], inserts: string[] = [];
let uploadError: unknown = null, insertError: unknown = null;
mock.module("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: { user: { id: uid } } } }), refreshSession: async () => ({}) },
  storage: { from: () => ({ upload: async (path: string) => { uploads.push(path); return { error: uploadError }; } }) },
  from: (table: string) => ({ insert: async () => { inserts.push(table); return { error: insertError }; } }),
} }));
Object.assign(globalThis, { indexedDB, window: new EventTarget() });
Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
const { enqueue, listOutbox, flushOutbox, retryPending } = await import("./outbox");
async function reset() {
  await new Promise<void>((resolve,reject) => { const r = indexedDB.deleteDatabase("feed-outbox"); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
}
beforeEach(async () => { await reset(); uploads=[];inserts=[];uploadError=null;insertError=null;uid="participant-a"; });
const survey = () => ({ kind: "survey" as const, id:"survey",userId:"participant-a",date:"2026-10-29",row:{glad:3} });
const memo = () => ({ kind: "memo" as const, id:"memo",userId:"participant-a",date:"2026-10-29",row:{duration_seconds:60},path:"participant-a/test.webm",blob:new Blob(["audio"],{type:"audio/webm"}) });
describe("durable delivery", () => {
  test("enqueue resolves after durable commit", async () => { await enqueue(survey()); expect((await listOutbox())[0]?.row).toEqual({glad:3}); });
  test("429 audio stays on device and succeeds on retry", async () => {
    await enqueue(memo());uploadError={statusCode:"429",message:"Too many requests"};await flushOutbox();
    expect((await listOutbox())[0]?.blocked).toBe(false);expect((await listOutbox())[0]?.retryAt).toBeGreaterThan(Date.now());
    uploadError=null;await retryPending();expect(await listOutbox()).toHaveLength(0);expect(uploads).toHaveLength(2);
  });
  test("survey sends before audio and both leave queue",async()=>{await enqueue(memo());await enqueue(survey());await flushOutbox();expect(inserts).toEqual(["survey_responses","voice_memos"]);expect(await listOutbox()).toHaveLength(0);});
  test("failed survey prevents audio sending",async()=>{await enqueue(survey());await enqueue(memo());insertError={status:503,message:"Unavailable"};await flushOutbox();expect(uploads).toHaveLength(0);expect(await listOutbox()).toHaveLength(2);});
  test("another user's queue is never submitted",async()=>{await enqueue(memo());uid="participant-b";await flushOutbox();expect(uploads).toHaveLength(0);expect(await listOutbox()).toHaveLength(1);});
  test("duplicate upload and daily response are treated as delivered",async()=>{await enqueue(memo());uploadError={message:"The resource already exists"};insertError={code:"23505"};await flushOutbox();expect(await listOutbox()).toHaveLength(0);});
  test("permission rejection stays visible and retained",async()=>{await enqueue(memo());uploadError={statusCode:403,message:"permission denied"};await flushOutbox();expect((await listOutbox())[0]?.blocked).toBe(true);});
});
