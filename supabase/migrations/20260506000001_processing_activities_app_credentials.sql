-- Make processing_activities compatible with DataRex app-credential login.
-- The frontend authenticates through app_credentials/demo sessions, not Supabase Auth,
-- so user_id must store the app user/actor id instead of referencing auth.users.

ALTER TABLE public.processing_activities
  DROP CONSTRAINT IF EXISTS processing_activities_user_id_fkey;

ALTER TABLE public.processing_activities
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT,
  ALTER COLUMN user_id SET DEFAULT 'jarvis',
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.processing_activities
  ADD COLUMN IF NOT EXISTS actor TEXT NOT NULL DEFAULT 'jarvis';

DROP POLICY IF EXISTS "Users manage company processing activities" ON public.processing_activities;

CREATE POLICY "Users manage company processing activities"
  ON public.processing_activities
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_processing_activities_actor ON public.processing_activities(actor);
