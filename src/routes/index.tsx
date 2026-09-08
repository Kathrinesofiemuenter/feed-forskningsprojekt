import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shorts Study – Short-video feed research" },
      {
        name: "description",
        content: "Sign in with your participant username to watch the video feed and complete your daily check-in.",
      },
      { property: "og:title", content: "Shorts Study – Short-video feed research" },
      { property: "og:description", content: "Watch the feed, then complete a short daily mood check-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/feed", replace: true });
    });
  }, [navigate]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
      />
      <header className="relative z-10 flex w-full max-w-sm items-center gap-2 text-sm font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Play className="size-3.5 fill-current" />
        </span>
        Shorts Study
      </header>

      <section className="relative z-10 w-full max-w-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Research feed</p>
        <h1 className="text-4xl font-bold leading-[1.05]">
          Watch shorts.
          <br />
          Check in daily.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Scroll a personal short-video feed. After 20 minutes of watching in a day, you'll be asked six quick
          questions about how you feel right now.
        </p>
      </section>

      <div className="relative z-10 w-full max-w-sm space-y-3">
        <Link
          to="/auth"
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98]"
        >
          Sign in with your username
        </Link>
        <p className="text-center text-xs text-muted-foreground">Participants only. No email needed.</p>
      </div>
    </main>
  );
}
