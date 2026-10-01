import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Play,
  Smartphone,
  Shuffle,
  Volume2,
  ClipboardList,
  Timer,
  Lock,
  ShieldCheck,
  UserCircle2,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Feed-forskningsprojekt – Short-video feed research" },
      {
        name: "description",
        content:
          "A short-video feed research study. Watch a personalised feed, then answer a quick daily mood check-in. Participants only.",
      },
      { property: "og:title", content: "Feed-forskningsprojekt – Short-video feed research" },
      {
        property: "og:description",
        content: "Watch a short-video feed, then complete a quick daily mood check-in.",
      },
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
    <main className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Play className="size-3.5 fill-current" />
          </span>
          Feed-forskningsprojekt
        </div>
        <Link
          to="/auth"
          className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent active:scale-95"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 pt-12">
        <div className="mx-auto max-w-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">Research feed</p>
          <h1 className="text-[2.6rem] font-black leading-[0.98] tracking-tight">
            Watch shorts.
            <br />
            Check in daily.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            A research study looking at how a short-video feed affects your mood. You'll scroll a personalised feed,
            then answer six quick questions about how you feel.
          </p>
          <Link
            to="/auth"
            className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98]"
          >
            Get started
            <ChevronRight className="size-5" />
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Participants only · Sign up with a username, no email needed
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 pt-16">
        <div className="mx-auto max-w-sm">
          <h2 className="text-xl font-bold tracking-tight">How it works</h2>
          <ol className="mt-5 space-y-4">
            <Step
              num={1}
              icon={<UserCircle2 className="size-5" />}
              title="Create your account"
              text="Pick a username and password. That's it — no email or personal details required."
            />
            <Step
              num={2}
              icon={<Smartphone className="size-5" />}
              title="Watch the feed"
              text="Swipe through short videos, one at a time. The order is randomised just for you."
            />
            <Step
              num={3}
              icon={<ClipboardList className="size-5" />}
              title="Answer the daily check-in"
              text="After 20 minutes of watching, six quick questions about how you feel right now."
            />
          </ol>
        </div>
      </section>

      {/* The feed */}
      <section className="relative z-10 px-6 pt-16">
        <div className="mx-auto max-w-sm">
          <SectionLabel>The feed</SectionLabel>
          <div className="mt-4 space-y-3">
            <Feature icon={<Smartphone className="size-5" />} title="Swipe to move">
              Full-screen vertical videos that snap one at a time, just like the short-video apps you know.
            </Feature>
            <Feature icon={<Shuffle className="size-5" />} title="Your own order">
              Videos are shuffled into a random order for each participant, and yours stays the same across sessions.
            </Feature>
            <Feature icon={<Volume2 className="size-5" />} title="Sound included">
              Videos play with sound. Tap the screen to turn sound on if it's muted.
            </Feature>
          </div>
        </div>
      </section>

      {/* The daily check-in */}
      <section className="relative z-10 px-6 pt-16">
        <div className="mx-auto max-w-sm">
          <SectionLabel>The daily check-in</SectionLabel>
          <div className="mt-4 space-y-3">
            <Feature icon={<Timer className="size-5" />} title="After 20 minutes">
              Once you've watched for 20 minutes total in a day, the check-in appears. This is counted once per
              calendar day and resets the next day.
            </Feature>
            <Feature icon={<ClipboardList className="size-5" />} title="Six quick questions">
              For each you answer how you feel right now, from 1 (Not at all) to 5 (Very much): happy, optimistic,
              lively, tense, nervous and anxious.
            </Feature>
            <Feature icon={<Lock className="size-5" />} title="Required to continue">
              You can't return to the feed until every question is answered. It's just one check-in per day.
            </Feature>
          </div>
        </div>
      </section>

      {/* What you're agreeing to */}
      <section className="relative z-10 px-6 pt-16">
        <div className="mx-auto max-w-sm">
          <SectionLabel>What you're agreeing to</SectionLabel>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <ul className="space-y-3 text-sm leading-relaxed text-card-foreground">
              <ConsentRow icon={<UserCircle2 className="size-4 shrink-0" />}>
                You take part using a username and password of your choice — no email address is needed.
              </ConsentRow>
              <ConsentRow icon={<Smartphone className="size-4 shrink-0" />}>
                You'll watch a personalised short-video feed in a random order set for you.
              </ConsentRow>
              <ConsentRow icon={<Timer className="size-4 shrink-0" />}>
                After 20 minutes of watching in a day, you'll answer the daily mood check-in before returning to the
                feed.
              </ConsentRow>
              <ConsentRow icon={<ShieldCheck className="size-4 shrink-0" />}>
                Your answers are saved under your username with the date and time you submitted them.
              </ConsentRow>
              <ConsentRow icon={<ShieldCheck className="size-4 shrink-0" />}>
                Your responses are used only for this study's research.
              </ConsentRow>
            </ul>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            By creating an account you confirm that you understand the above and agree to take part.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-16">
        <div className="mx-auto max-w-sm">
          <h2 className="text-2xl font-black leading-tight tracking-tight">Ready to take part?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your account with a username and start watching.
          </p>
          <Link
            to="/auth"
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98]"
          >
            Create account
            <ChevronRight className="size-5" />
          </Link>
          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
            Feed-forskningsprojekt · Research project
          </p>
        </div>
      </section>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{children}</p>
  );
}

function Step({
  num,
  icon,
  title,
  text,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {num}</p>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </li>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-2 pl-12 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function ConsentRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
