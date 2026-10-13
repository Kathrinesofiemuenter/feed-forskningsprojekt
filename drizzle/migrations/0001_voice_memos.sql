CREATE TABLE public.voice_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  memo_date date NOT NULL,
  storage_path text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 90),
  mime_type text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, memo_date)
);
GRANT SELECT, INSERT ON public.voice_memos TO authenticated;
GRANT ALL ON public.voice_memos TO service_role;
ALTER TABLE public.voice_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own memos" ON public.voice_memos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND username = (SELECT p.username FROM public.profiles p WHERE p.id = auth.uid()));
CREATE POLICY "Users read own memos" ON public.voice_memos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all memos" ON public.voice_memos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users upload own voice memos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-memos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins read voice memos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-memos' AND public.has_role(auth.uid(), 'admin'));