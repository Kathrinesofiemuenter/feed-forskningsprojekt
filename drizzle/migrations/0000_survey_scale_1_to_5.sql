-- Tighten daily check-in answers from 0–5 to 1–5 on public.survey_responses
ALTER TABLE public.survey_responses DROP CONSTRAINT survey_responses_glad_check;
ALTER TABLE public.survey_responses DROP CONSTRAINT survey_responses_tilfreds_check;
ALTER TABLE public.survey_responses DROP CONSTRAINT survey_responses_haebefuld_check;
ALTER TABLE public.survey_responses DROP CONSTRAINT survey_responses_bekymret_check;
ALTER TABLE public.survey_responses DROP CONSTRAINT survey_responses_ensom_check;
ALTER TABLE public.survey_responses DROP CONSTRAINT survey_responses_irritabel_check;

ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_glad_check CHECK (glad BETWEEN 1 AND 5);
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_tilfreds_check CHECK (tilfreds BETWEEN 1 AND 5);
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_haebefuld_check CHECK (haebefuld BETWEEN 1 AND 5);
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_bekymret_check CHECK (bekymret BETWEEN 1 AND 5);
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_ensom_check CHECK (ensom BETWEEN 1 AND 5);
ALTER TABLE public.survey_responses ADD CONSTRAINT survey_responses_irritabel_check CHECK (irritabel BETWEEN 1 AND 5);