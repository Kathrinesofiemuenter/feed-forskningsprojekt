DROP POLICY IF EXISTS "Users insert own memos" ON public.voice_memos;
CREATE POLICY "Users insert own memos" ON public.voice_memos FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND username = (SELECT p.username FROM public.profiles p WHERE p.id = auth.uid())
  AND split_part(storage_path, '/', 1) = auth.uid()::text
  AND storage_path NOT LIKE '%..%'
);
REVOKE UPDATE, DELETE ON public.voice_memos FROM anon, authenticated;
REVOKE ALL ON public.voice_memos FROM anon;