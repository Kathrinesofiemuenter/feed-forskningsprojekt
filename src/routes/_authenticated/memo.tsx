import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mic, Square, RotateCcw, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSurveyStatus } from "@/lib/survey-status";
import { fetchCurrentUser } from "@/hooks/useCurrentUser";
import { MEMO_MAX_SECONDS, MEMO_PROMPT, MEMO_SUBPROMPT, formatMinutes } from "@/lib/study";
import { enqueue, isNetworkError } from "@/lib/outbox";

export const Route = createFileRoute("/_authenticated/memo")({
  head: () => ({ meta: [{ title: "Stemmebesked – Feed-forskningsprojekt" }] }),
  beforeLoad: async ({ context }) => {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    if (isAdmin) throw redirect({ to: "/feed" });
    const status = await fetchSurveyStatus(context.user.id);
    if (status.due) throw redirect({ to: "/survey" });
    if (!status.memoDue) throw redirect({ to: "/feed" });
    return { surveyStatus: status };
  },
  component: MemoPage,
});

function pickMime(): string {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const m of opts) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

function MemoPage() {
  const { user, surveyStatus } = Route.useRouteContext();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const durationRef = useRef(0);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  function stop() {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        durationRef.current = Math.min(MEMO_MAX_SECONDS, Math.max(1, Math.floor((Date.now() - startRef.current) / 1000)));
        const b = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        setState("done");
      };
      recRef.current = rec;
      startRef.current = Date.now();
      setElapsed(0);
      rec.start();
      setState("recording");
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(Math.min(s, MEMO_MAX_SECONDS));
        if (s >= MEMO_MAX_SECONDS) stop();
      }, 250);
    } catch {
      toast.error("Kunne ikke få adgang til mikrofonen. Tillad mikrofonadgang og prøv igen.");
    }
  }

  function reset() {
    setBlob(null);
    setUrl(null);
    setElapsed(0);
    setState("idle");
  }

  async function submit() {
    if (!blob) return;
    setBusy(true);
    const me = await fetchCurrentUser().catch(() => null);
    const username = me?.username ?? (user.user_metadata?.["username"] as string | undefined);
    if (!username) { setBusy(false); navigate({ to: "/auth" }); return; }
    const type = blob.type || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    const path = `${user.id}/${surveyStatus.date}-${crypto.randomUUID()}.${ext}`;
    const row = {
      user_id: user.id,
      username,
      memo_date: surveyStatus.date,
      storage_path: path,
      duration_seconds: durationRef.current,
      mime_type: type,
    };
    const saveLocally = async () => {
      await enqueue({ kind: "memo", id: crypto.randomUUID(), userId: user.id, date: surveyStatus.date, path, blob, row });
      setBusy(false);
      toast.success("Ingen forbindelse – din stemmebesked er gemt på telefonen og sendes automatisk.");
      navigate({ to: "/feed", replace: true });
    };
    let upErr: { message?: string } | null = null;
    try {
      upErr = (await supabase.storage.from("voice-memos").upload(path, blob, { contentType: type })).error;
    } catch (e) {
      upErr = { message: String(e) };
    }
    if (upErr) {
      if (isNetworkError(upErr)) return saveLocally();
      setBusy(false); toast.error("Kunne ikke gemme stemmebeskeden. Prøv venligst igen."); return;
    }
    let error: { code?: string; message?: string } | null = null;
    try {
      ({ error } = await supabase.from("voice_memos").insert(row));
    } catch (e) {
      error = { message: String(e) };
    }
    if (error && error.code !== "23505" && isNetworkError(error)) return saveLocally();
    setBusy(false);
    if (error && error.code !== "23505") { toast.error("Kunne ikke gemme stemmebeskeden. Prøv venligst igen."); return; }
    toast.success("Tak! Din stemmebesked er gemt.");
    navigate({ to: "/feed", replace: true });
  }


  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        <Lock className="size-3.5" /> Daglig stemmebesked
      </div>
      <h1 className="text-3xl font-bold leading-tight">{MEMO_PROMPT}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{MEMO_SUBPROMPT}</p>

      <div className="mt-12 flex flex-col items-center gap-6">
        <div className="font-mono text-5xl font-bold tabular-nums">
          {formatMinutes(state === "recording" ? elapsed : state === "done" ? durationRef.current : 0)}
        </div>

        {state === "idle" && (
          <button type="button" onClick={start} aria-label="Start optagelse"
            className="flex size-28 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30 active:scale-95">
            <Mic className="size-12" />
          </button>
        )}
        {state === "recording" && (
          <button type="button" onClick={stop} aria-label="Stop optagelse"
            className="flex size-28 items-center justify-center rounded-full bg-destructive text-destructive-foreground active:scale-95">
            <Square className="size-10 fill-current" />
          </button>
        )}
        {state === "done" && url && (
          <>
            <audio controls src={url} className="w-full" />
            <button type="button" onClick={reset} disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-semibold">
              <RotateCcw className="size-4" /> Optag igen
            </button>
          </>
        )}
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground/80">Optag 1 minut stemmebesked</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto max-w-md">
          <button type="button" onClick={submit} disabled={state !== "done" || busy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none">
            {busy && <Loader2 className="size-4 animate-spin" />}
            {state === "done" ? "Indsend og vend tilbage til feedet" : "Optag en stemmebesked for at fortsætte"}
          </button>
        </div>
      </div>
    </main>
  );
}
