-- Remove the bad superadmin record so it can be re-created via Dashboard
DELETE FROM public.user_profiles WHERE email = 'superadmin@datarex.com';
DELETE FROM auth.users WHERE email = 'superadmin@datarex.com';
