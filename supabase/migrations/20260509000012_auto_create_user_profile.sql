-- Auto-create a user_profiles row whenever a new auth user is created.
-- This removes the chicken-and-egg FK problem: profile is always created
-- by the trigger immediately after auth.users INSERT, so manual SQL inserts
-- into user_profiles are no longer needed after Dashboard user creation.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, first_name, last_name, role, account_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'user',   -- default role; update manually after creation
    NULL      -- no account assigned yet
  )
  ON CONFLICT (id) DO NOTHING;  -- safe to re-run; won't overwrite existing profiles
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
