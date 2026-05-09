-- 20260509000006_dpia_screenings.sql
-- DEICA two-stage decision workflow. Distinct from public.dpia_assessments
-- (which backs the DPIA Screening page). The frontend saves both to
-- localStorage (`dpia_screenings` key) and to this table on a best-effort
-- basis so screenings survive cache-clearing hard refreshes and migrate
-- across devices.

CREATE TABLE IF NOT EXISTS public.dpia_screenings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  justification TEXT,
  decision TEXT NOT NULL DEFAULT 'pending',
  -- Step 1: quantitative thresholds
  subjects_over_20k BOOLEAN NOT NULL DEFAULT FALSE,
  sensitive_subjects_over_10k BOOLEAN NOT NULL DEFAULT FALSE,
  -- Step 2: qualitative risk factors
  legal_or_significant_impact BOOLEAN NOT NULL DEFAULT FALSE,
  systematic_monitoring BOOLEAN NOT NULL DEFAULT FALSE,
  innovative_technology BOOLEAN NOT NULL DEFAULT FALSE,
  restriction_of_rights BOOLEAN NOT NULL DEFAULT FALSE,
  behaviour_or_location_tracking BOOLEAN NOT NULL DEFAULT FALSE,
  children_or_vulnerable BOOLEAN NOT NULL DEFAULT FALSE,
  automated_decision_making BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dpia_screenings_user_id ON public.dpia_screenings(user_id);
CREATE INDEX IF NOT EXISTS idx_dpia_screenings_account_id ON public.dpia_screenings(account_id);

ALTER TABLE public.dpia_screenings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dpia_screenings_owner_all" ON public.dpia_screenings;
CREATE POLICY "dpia_screenings_owner_all" ON public.dpia_screenings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.dpia_screenings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dpia_screenings_updated_at ON public.dpia_screenings;
CREATE TRIGGER dpia_screenings_updated_at
  BEFORE UPDATE ON public.dpia_screenings
  FOR EACH ROW
  EXECUTE FUNCTION public.dpia_screenings_set_updated_at();
