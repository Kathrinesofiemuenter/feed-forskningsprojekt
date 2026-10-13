import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSurveyStatus } from "@/lib/survey-status";
import { fetchCurrentUser } from "@/hooks/useCurrentUser";
import { LIKERT_LABELS, LIKERT_MAX, LIKERT_MIN, SURVEY_ITEMS, type SurveyKey } from "@/lib/study";

export const Route = createFileRoute("/_authenticated/survey")({
  beforeLoad: async ({ context }) => {
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: context.user.id,
      _role: "admin",
    });
    if (isAdmin) throw redirect({ to: "/feed" });
    const status = await fetchSurveyStatus(context.user.id);
    if (!status.due) throw redirect({ to: status.memoDue ? "/memo" : "/feed" });
    return { surveyStatus: status };
  },
  component: SurveyPage,
});

function SurveyPage() {
  const { user, surveyStatus } = Route.useRouteContext();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Partial<Record<SurveyKey, number>>>({});
  const [busy, setBusy] = useState(false);

  const complete = SURVEY_ITEMS.every((item) => answers[item.key] !== undefined);
  const answered = SURVEY_ITEMS.filter((item) => answers[item.key] !== undefined).length;

  async function submit() {
    if (!complete) {
      toast.error("Svar venligst på alle spørgsmålene, før du fortsætter.");
      return;
    }
    setBusy(true);
    const me = await fetchCurrentUser();
    if (!me) {
      setBusy(false);
      navigate({ to: "/auth" });
      return;
    }
    const { error } = await supabase.from("survey_responses").insert({
      user_id: user.id,
      username: me.username,
      survey_date: surveyStatus.date,
      glad: answers.glad!,
      tilfreds: answers.tilfreds!,
      haebefuld: answers.haebefuld!,
      bekymret: answers.bekymret!,
      ensom: answers.ensom!,
      irritabel: answers.irritabel!,
      feed_seconds_at_submit: surveyStatus.secondsToday,
    });
    setBusy(false);
    if (error) {
      if (error.code === "23505") {
        navigate({ to: "/memo", replace: true });
        return;
      }
      toast.error("Kunne ikke gemme dine svar. Prøv venligst igen.");
      return;
    }
    toast.success("Tak! Din besvarelse er gemt.");
    navigate({ to: "/memo", replace: true });
  }

  const scale = Array.from({ length: LIKERT_MAX - LIKERT_MIN + 1 }, (_, i) => LIKERT_MIN + i);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        <Lock className="size-3.5" /> Daglig check-in
      </div>
      <h1 className="text-3xl font-bold leading-tight">Hvordan har du det lige nu?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Du har set 20 minutter i dag. Svar på alle seks spørgsmål for at vende tilbage til feedet.
      </p>

      <ol className="mt-8 space-y-8">
        {SURVEY_ITEMS.map((item, idx) => {
          const value = answers[item.key];
          return (
            <li key={item.key} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-base font-semibold">
                <span className="mr-2 text-muted-foreground">{idx + 1}.</span>
                {item.question}?
              </p>
              <div role="radiogroup" aria-label={item.label} className="mt-4 grid grid-cols-5 gap-1.5">
                {scale.map((n) => {
                  const selected = value === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${n} – ${LIKERT_LABELS[n]}`}
                      onClick={() => setAnswers((a) => ({ ...a, [item.key]: n }))}
                      className={`flex h-12 items-center justify-center rounded-xl text-base font-semibold transition active:scale-95 ${
                        selected
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                          : "bg-muted text-foreground hover:bg-accent"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>1 · Slet ikke</span>
                <span>5 · I meget høj grad</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background via-background/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={submit}
            disabled={!complete || busy}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {complete ? "Indsend og vend tilbage til feedet" : `Besvaret ${answered} af ${SURVEY_ITEMS.length}`}
          </button>
        </div>
      </div>
    </main>
  );
}
