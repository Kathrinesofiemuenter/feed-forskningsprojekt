import { supabase } from "@/integrations/supabase/client";
import { SURVEY_THRESHOLD_SECONDS, localDate } from "./study";

export type SurveyStatus = {
  date: string;
  secondsToday: number;
  submittedToday: boolean;
  due: boolean;
};

export async function fetchSurveyStatus(userId: string): Promise<SurveyStatus> {
  const date = localDate();
  const [{ data: usage }, { data: response }] = await Promise.all([
    supabase
      .from("feed_usage")
      .select("seconds")
      .eq("user_id", userId)
      .eq("usage_date", date)
      .maybeSingle(),
    supabase
      .from("survey_responses")
      .select("id")
      .eq("user_id", userId)
      .eq("survey_date", date)
      .maybeSingle(),
  ]);
  const secondsToday = usage?.seconds ?? 0;
  const submittedToday = Boolean(response);
  return {
    date,
    secondsToday,
    submittedToday,
    due: secondsToday >= SURVEY_THRESHOLD_SECONDS && !submittedToday,
  };
}
