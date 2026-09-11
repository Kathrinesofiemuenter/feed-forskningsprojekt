import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { LogOut, Shield, Loader2, Clapperboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FeedVideo } from "@/components/FeedVideo";
import { useCurrentUser, useSignOut } from "@/hooks/useCurrentUser";
import { fetchSurveyStatus } from "@/lib/survey-status";
import { SURVEY_THRESHOLD_SECONDS, localDate, seededShuffle, formatMinutes } from "@/lib/study";

const FLUSH_INTERVAL = 15;

export const Route = createFileRoute("/_authenticated/feed")({
  beforeLoad: async ({ context }) => {
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: context.user.id,
      _role: "admin",
    });
    const status = await fetchSurveyStatus(context.user.id);
    if (!isAdmin && status.due) throw redirect({ to: "/survey" });
    return { surveyStatus: status, isAdmin: Boolean(isAdmin) };
  },
  component: FeedPage,
});

async function fetchFeed(userId: string) {
  const { data, error } = await supabase
    .from("videos")
    .select("id, title, storage_path")
    .eq("is_active", true)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  const ordered = seededShuffle(data ?? [], userId);
  if (ordered.length === 0) return [];
  const { data: signed, error: signErr } = await supabase.storage
    .from("videos")
    .createSignedUrls(
      ordered.map((v) => v.storage_path),
      60 * 60 * 6,
    );
  if (signErr) throw signErr;
  return ordered.map((v, i) => ({ ...v, url: signed?.[i]?.signedUrl ?? "" })).filter((v) => v.url);
}

function FeedPage() {
  const { user, surveyStatus, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { data: me } = useCurrentUser();
  const { data: videos, isLoading } = useQuery({
    queryKey: ["feed", user.id],
    queryFn: () => fetchFeed(user.id),
  });
  const [muted, setMuted] = useState(true);
  const [seconds, setSeconds] = useState(surveyStatus.secondsToday);
  const pending = useRef(0);
  const flushing = useRef(false);
  const submittedToday = useRef(surveyStatus.submittedToday);
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  useEffect(() => {
    let dateAtStart = localDate();

    const flush = async () => {
      if (flushing.current || pending.current === 0) return;
      const delta = pending.current;
      pending.current = 0;
      flushing.current = true;
      const { data: total, error } = await supabase.rpc("add_feed_usage", {
        _date: dateAtStart,
        _seconds: delta,
      });
      flushing.current = false;
      if (error) {
        pending.current += delta;
        return;
      }
      if (typeof total === "number") setSeconds(total);
      if (
        typeof total === "number" &&
        total >= SURVEY_THRESHOLD_SECONDS &&
        !submittedToday.current &&
        !isAdminRef.current
      ) {
        navigate({ to: "/survey", replace: true });
      }
    };

    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const today = localDate();
      if (today !== dateAtStart) {
        // Day rolled over: flush the old day, then reset counters for the new one.
        void flush().then(() => {
          dateAtStart = today;
          submittedToday.current = false;
          setSeconds(0);
        });
        return;
      }
      pending.current += 1;
      setSeconds((s) => s + 1);
      if (pending.current >= FLUSH_INTERVAL) void flush();
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
      void flush();
    };
  }, [navigate]);

  const progress = Math.min(1, seconds / SURVEY_THRESHOLD_SECONDS);

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-black"
      onPointerDown={() => setMuted(false)}
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black via-black/50 to-transparent px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto min-w-0">
          <p className="truncate text-sm font-black uppercase tracking-wide">@{me?.username ?? "…"}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Today {formatMinutes(seconds)}
            {surveyStatus.submittedToday ? " · done" : ""}
          </p>
          <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-foreground/20">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {me?.isAdmin && (
            <Link
              to="/admin"
              className="flex size-11 items-center justify-center rounded-full bg-foreground/10 backdrop-blur-md active:scale-90"
              aria-label="Admin"
            >
              <Shield className="size-5" />
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="flex size-11 items-center justify-center rounded-full bg-foreground/10 backdrop-blur-md active:scale-90"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      {muted && videos && videos.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/15 px-5 py-2.5 text-xs font-black uppercase tracking-[0.2em] backdrop-blur-md">
          Tap for sound
        </div>
      )}

      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !videos || videos.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <Clapperboard className="size-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold">No videos yet</h1>
          <p className="text-sm text-muted-foreground">
            The feed is empty. {me?.isAdmin ? "Upload some videos in the admin area." : "Please check back later."}
          </p>
          {me?.isAdmin && (
            <Link to="/admin" className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Manage videos
            </Link>
          )}
        </div>
      ) : (
        <main className="snap-feed h-full w-full overflow-y-scroll">
          {videos.map((v, i) => (
            <FeedVideo
              key={v.id}
              src={v.url}
              title={v.title}
              index={i}
              total={videos.length}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
            />
          ))}
        </main>
      )}
    </div>
  );
}
