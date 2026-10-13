CREATE TABLE public.video_views (
  user_id uuid NOT NULL,
  video_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_views TO authenticated;
GRANT ALL ON public.video_views TO service_role;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own views select" ON public.video_views FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "own views insert" ON public.video_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own views delete" ON public.video_views FOR DELETE TO authenticated USING (user_id = auth.uid());