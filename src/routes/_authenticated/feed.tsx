import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Shield, Loader2, Clapperboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FeedVideo } from "@/components/FeedVideo";
import { useCurrentUser, useSignOut } from "@/hooks/useCurrentUser";
import { fetchSurveyStatus } from "@/lib/survey-status";
import { SURVEY_THRESHOLD_SECONDS, buildPlaylist, localDate } from "@/lib/study";
import { FEED_WINDOW, retryDelay } from "@/lib/reliability";
import { signFeedUrls } from "@/lib/feed.functions";

const FLUSH_INTERVAL = 15;

export const Route = createFileRoute("/_authenticated/feed")({
  beforeLoad: async ({ context }) => {
    const [{ data: isAdmin }, status] = await Promise.all([
      supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" }),
      fetchSurveyStatus(context.user.id),
    ]);
    if (!isAdmin && status.due) throw redirect({ to: "/survey" });
    if (!isAdmin && status.memoDue) throw redirect({ to: "/memo" });
    return { surveyStatus: status, isAdmin: Boolean(isAdmin) };
  },
  component: FeedPage,
});

async function fetchFeed(userId: string) {
  const [{ data, error }, { data: views }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, storage_path")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    supabase.from("video_views").select("video_id").eq("user_id", userId).limit(10000),
  ]);
  if (error) throw error;
  const seen = new Set((views ?? []).map((v) => v.video_id));
  let pool = (data ?? []).filter((v) => !seen.has(v.id));
  // Everything watched: start a fresh round with all videos.
  if (pool.length === 0 && (data ?? []).length > 0) {
    await supabase.from("video_views").delete().eq("user_id", userId);
    pool = data ?? [];
  }
  // New random order every time the feed opens.
  const ordered = buildPlaylist(pool, `${userId}:${Date.now()}:${Math.random()}`);
  if (ordered.length === 0) return [];
  return ordered;
}

function FeedPage() {
  const { user, surveyStatus, isAdmin } = Route.useRouteContext();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { data: me } = useCurrentUser();
  const { data: videos, isLoading } = useQuery({
    queryKey: ["feed", user.id],
    queryFn: () => fetchFeed(user.id),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const [muted, setMuted] = useState(true);
  const [current, setCurrent] = useState(0);
  const feedRef = useRef<HTMLElement>(null);
  const nearby = videos?.slice(current, current + FEED_WINDOW) ?? [];
  const paths = nearby.map(v => v.storage_path);
  const { data: urls = {} } = useQuery({
    queryKey: ["feed-links", user.id, ...paths],
    queryFn: () => signFeedUrls({ data: { paths } }),
    enabled: paths.length > 0,
    staleTime: 45 * 60 * 1000,
    placeholderData: previous => previous,
    retry: 5,
    retryDelay: attempt => retryDelay(attempt),
  });
  const onActive = useCallback((i: number) => setCurrent(i), []);
  const recorded = useRef(new Set<string>());
  useEffect(() => {
    const v = videos?.[current];
    if (!v || recorded.current.has(v.id)) return;
    recorded.current.add(v.id);
    void supabase
      .from("video_views")
      .upsert({ user_id: user.id, video_id: v.id }, { onConflict: "user_id,video_id", ignoreDuplicates: true });
  }, [videos, current, user.id]);
  const [seconds, setSeconds] = useState(surveyStatus.secondsToday);
  const pending = useRef(0);
  const flushing = useRef(false);
  const submittedToday = useRef(surveyStatus.submittedToday);
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  // Redirect to the daily check-in the moment the local timer crosses 20 minutes.
  // Flush any un-synced seconds first so the survey page's server-side check agrees.
  useEffect(() => {
    if (
      seconds >= SURVEY_THRESHOLD_SECONDS &&
      !submittedToday.current &&
      !isAdminRef.current
    ) {
      submittedToday.current = true; // guard against re-entry while flushing
      const delta = pending.current;
      pending.current = 0;
      void (delta > 0
        ? supabase.rpc("add_feed_usage", { _date: localDate(), _seconds: delta })
        : Promise.resolve()
      ).then(() => navigate({ to: "/survey", replace: true }));
    }
  }, [seconds, navigate]);

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


  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-background"
      onPointerDown={() => setMuted(false)}
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-background via-background/50 to-transparent px-4 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto min-w-0">
          <p className="truncate text-sm font-black uppercase tracking-wide">@{me?.username ?? "…"}</p>

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
          Tryk for lyd
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
        <main ref={feedRef} className="snap-feed h-full w-full overflow-y-scroll">
          {videos.map((v, i) => (
            <div key={v.id} className="h-dvh w-full snap-start snap-always">
              {Math.abs(i - current) <= 2 && <FeedVideo
                src={urls[v.storage_path] ?? ""}
                title={v.title}
                index={i}
                total={videos.length}
                muted={muted}
                onToggleMute={() => setMuted(m => !m)}
                near={i >= current && i <= current + 1}
                eager={i === current}
                onActive={onActive}
                onSkip={() => {
                  const next = (i + 1) % videos.length;
                  feedRef.current?.children.item(next)?.scrollIntoView({ behavior: "instant", block: "start" });
                  setCurrent(next);
                }}
              />}
            </div>
          ))}
        </main>
      )}
    </div>
  );
}
