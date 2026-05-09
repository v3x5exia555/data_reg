CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_uid UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'superadmin@datarex.com') THEN
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
      'superadmin@datarex.com',
      extensions.crypt('DataRex@2026!', extensions.gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false, '', ''
    );

    INSERT INTO public.user_profiles (id, email, first_name, last_name, role, account_id)
    VALUES (new_uid, 'superadmin@datarex.com', 'Super', 'Admin', 'Superadmin', NULL);
  END IF;
END$$;
