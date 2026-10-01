-- Close the anonymous download hole on the private videos bucket.
-- Participants keep "Signed-in users can view videos"; admins keep their own rules.
DROP POLICY IF EXISTS "Public can view videos" ON storage.objects;