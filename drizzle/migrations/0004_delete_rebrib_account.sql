DELETE FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE username = 'rebrib');
DELETE FROM public.profiles WHERE username = 'rebrib';