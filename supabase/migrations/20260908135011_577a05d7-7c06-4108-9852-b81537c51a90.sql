CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uname TEXT;
BEGIN
  uname := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'username'), ''), split_part(NEW.email, '@', 1));
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, uname);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Videos
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users see active videos" ON public.videos FOR SELECT TO authenticated USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert videos" ON public.videos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update videos" ON public.videos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete videos" ON public.videos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Feed usage (per user per local calendar day)
CREATE TABLE public.feed_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);
GRANT SELECT ON public.feed_usage TO authenticated;
GRANT ALL ON public.feed_usage TO service_role;
ALTER TABLE public.feed_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own usage" ON public.feed_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all usage" ON public.feed_usage FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.add_feed_usage(_date DATE, _seconds INTEGER)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _seconds < 0 OR _seconds > 120 THEN RAISE EXCEPTION 'Invalid increment'; END IF;
  INSERT INTO public.feed_usage (user_id, usage_date, seconds)
  VALUES (auth.uid(), _date, _seconds)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET seconds = public.feed_usage.seconds + EXCLUDED.seconds, updated_at = now()
  RETURNING seconds INTO total;
  RETURN total;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_feed_usage(DATE, INTEGER) TO authenticated;

-- Survey responses
CREATE TABLE public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  survey_date DATE NOT NULL,
  happy SMALLINT NOT NULL CHECK (happy BETWEEN 1 AND 5),
  optimistic SMALLINT NOT NULL CHECK (optimistic BETWEEN 1 AND 5),
  lively SMALLINT NOT NULL CHECK (lively BETWEEN 1 AND 5),
  tense SMALLINT NOT NULL CHECK (tense BETWEEN 1 AND 5),
  nervous SMALLINT NOT NULL CHECK (nervous BETWEEN 1 AND 5),
  anxious SMALLINT NOT NULL CHECK (anxious BETWEEN 1 AND 5),
  feed_seconds_at_submit INTEGER,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, survey_date)
);
GRANT SELECT, INSERT ON public.survey_responses TO authenticated;
GRANT ALL ON public.survey_responses TO service_role;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own responses" ON public.survey_responses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all responses" ON public.survey_responses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own responses" ON public.survey_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND username = (SELECT username FROM public.profiles WHERE id = auth.uid()));

-- Storage policies for the videos bucket
CREATE POLICY "Signed-in users can view videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'videos');
CREATE POLICY "Public can view videos" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'videos');
CREATE POLICY "Admins upload videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update videos files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'videos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'videos' AND public.has_role(auth.uid(), 'admin'));