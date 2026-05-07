-- Add 'Superadmin' to user_role enum.
-- Migrate existing 'security_user' and 'useradmin' rows to 'user'.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Superadmin'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'Superadmin';
  END IF;
END$$;

UPDATE public.user_profiles
SET role = 'user'
WHERE role IN ('security_user', 'useradmin');
