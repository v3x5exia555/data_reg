-- Fix superadmin: update token fields to NULL (empty strings break GoTrue login)
UPDATE auth.users
SET
  confirmation_token = NULL,
  recovery_token     = NULL,
  email_change_token_new = NULL,
  email_change_token_current = NULL,
  reauthentication_token = NULL,
  encrypted_password = extensions.crypt('DataRex@2026!', extensions.gen_salt('bf')),
  email_confirmed_at = NOW(),
  updated_at         = NOW()
WHERE email = 'superadmin@datarex.com';
