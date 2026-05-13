-- Ensure the seeded Default Account 1 admin is named Accountadmin, not Super Admin.
-- Safe to re-run.

UPDATE public.user_profiles
SET
  first_name = 'Accountadmin',
  last_name = '',
  role = 'Accountadmin',
  status = 'active'
WHERE lower(email) = 'admin@datarex.com';

UPDATE auth.users
SET raw_user_meta_data =
  jsonb_set(
    jsonb_set(
      jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{name}', to_jsonb('Accountadmin'::text), true),
      '{first_name}', to_jsonb('Accountadmin'::text), true
    ),
    '{last_name}', to_jsonb(''::text), true
  )
WHERE lower(email) = 'admin@datarex.com';
