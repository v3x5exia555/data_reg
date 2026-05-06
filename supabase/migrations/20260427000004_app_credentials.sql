-- App Credentials Table
-- Stores login credentials for the app (managed in Supabase).
-- Browser clients must NOT read this table directly. Use Supabase Auth
-- for end-user authentication; this table is service-role only and is
-- retained for legacy admin tooling.

CREATE TABLE IF NOT EXISTS public.app_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_name TEXT DEFAULT 'datarex',
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill: rename legacy plaintext column if it still exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_credentials'
      AND column_name = 'password'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'app_credentials'
      AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.app_credentials RENAME COLUMN password TO password_hash;
  END IF;
END $$;

-- Enable RLS. No anon-readable policy: only the service role may access.
ALTER TABLE public.app_credentials ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing permissive policies from earlier revisions.
DROP POLICY IF EXISTS "Public read active credentials" ON public.app_credentials;
DROP POLICY IF EXISTS "Service role can manage credentials" ON public.app_credentials;

-- Service role only. Anon and authenticated roles get no access.
CREATE POLICY "Service role manages credentials" ON public.app_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Revoke any inherited grants from anon/authenticated.
REVOKE ALL ON public.app_credentials FROM anon, authenticated;
