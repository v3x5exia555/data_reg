-- Make admin@datarex.com an Accountadmin under Default Account 1.
-- Safe to re-run (idempotent).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  target_email   TEXT := 'admin@datarex.com';
  target_pass    TEXT := 'AccountAdmin123!';
  default_account UUID := '00000000-0000-0000-0000-000000000001';
  existing_uid   UUID;
  new_uid        UUID;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO existing_uid FROM auth.users WHERE email = target_email;

  IF existing_uid IS NULL THEN
    new_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_uid,
      'authenticated', 'authenticated',
      target_email,
      extensions.crypt(target_pass, extensions.gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false, '', ''
    );
  ELSE
    new_uid := existing_uid;
  END IF;

  -- Upsert user_profiles row as Accountadmin for Default Account 1
  INSERT INTO public.user_profiles (id, email, first_name, last_name, role, account_id, status)
  VALUES (new_uid, target_email, 'Admin', 'Datarex', 'Accountadmin', default_account, 'active')
  ON CONFLICT (id) DO UPDATE SET
    role       = 'Accountadmin',
    account_id = default_account,
    status     = 'active',
    email      = target_email;

  -- Wire to the Default Account 1 as the managing admin
  UPDATE public.accounts
  SET accountadmin_user_id = new_uid
  WHERE id = default_account
    AND (accountadmin_user_id IS NULL OR accountadmin_user_id <> new_uid);
END $$;
