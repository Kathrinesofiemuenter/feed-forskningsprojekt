GRANT SELECT, INSERT, DELETE ON public.video_views TO authenticated;
GRANT ALL ON public.video_views TO service_role;
CREATE TABLE public.video_watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  watched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.video_watch_events TO authenticated;
GRANT ALL ON public.video_watch_events TO service_role;
ALTER TABLE public.video_watch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own watch insert" ON public.video_watch_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin watch read" ON public.video_watch_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX ON public.video_watch_events (user_id, video_id);