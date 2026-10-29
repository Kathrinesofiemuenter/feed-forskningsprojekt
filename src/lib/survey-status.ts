import { supabase } from "@/integrations/supabase/client";
import { SURVEY_THRESHOLD_SECONDS, localDate } from "./study";
import { hasPending } from "./outbox";

export type SurveyStatus = {
  date: string;
  secondsToday: number;
  submittedToday: boolean;
  due: boolean;
  /** Voice memo is required after the survey, once per day. */
  memoDue: boolean;
};

export async function fetchSurveyStatus(userId: string): Promise<SurveyStatus> {
  const date = localDate();
  const [{ data: usage }, { data: response }, { data: memo }] = await Promise.all([
    supabase.from("feed_usage").select("seconds").eq("user_id", userId).eq("usage_date", date).maybeSingle(),
    supabase.from("survey_responses").select("id").eq("user_id", userId).eq("survey_date", date).maybeSingle(),
    supabase.from("voice_memos").select("id").eq("user_id", userId).eq("memo_date", date).maybeSingle(),
  ]);
  // Answers saved on the phone while offline count as sent.
  const [surveyPending, memoPending] = await Promise.all([
    hasPending(userId, "survey", date),
    hasPending(userId, "memo", date),
  ]);
  const secondsToday = usage?.seconds ?? 0;
  const submittedToday = Boolean(response) || surveyPending;
  return {
    date,
    secondsToday,
    submittedToday,
    due: secondsToday >= SURVEY_THRESHOLD_SECONDS && !submittedToday,
    memoDue: submittedToday && !memo && !memoPending,
  };
}
