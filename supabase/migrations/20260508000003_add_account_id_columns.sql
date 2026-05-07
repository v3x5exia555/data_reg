-- 20260508000003_add_account_id_columns.sql
-- Add nullable account_id to user_profiles + every data table.
-- NOT NULL is enforced later (migration 5) after backfill.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.training_records
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.data_records
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.data_requests
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.breach_log
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.dpia_assessments
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.cross_border_transfers
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.dpo
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.processing_activities
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Indexes for the filter that fires on every page load.
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_id ON public.user_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_companies_account_id ON public.companies(account_id);
CREATE INDEX IF NOT EXISTS idx_vendors_account_id ON public.vendors(account_id);
CREATE INDEX IF NOT EXISTS idx_training_records_account_id ON public.training_records(account_id);
CREATE INDEX IF NOT EXISTS idx_data_records_account_id ON public.data_records(account_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_account_id ON public.data_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_breach_log_account_id ON public.breach_log(account_id);
CREATE INDEX IF NOT EXISTS idx_dpia_assessments_account_id ON public.dpia_assessments(account_id);
CREATE INDEX IF NOT EXISTS idx_cross_border_transfers_account_id ON public.cross_border_transfers(account_id);
CREATE INDEX IF NOT EXISTS idx_cases_account_id ON public.cases(account_id);
CREATE INDEX IF NOT EXISTS idx_alerts_account_id ON public.alerts(account_id);
CREATE INDEX IF NOT EXISTS idx_dpo_account_id ON public.dpo(account_id);
CREATE INDEX IF NOT EXISTS idx_processing_activities_account_id ON public.processing_activities(account_id);
CREATE INDEX IF NOT EXISTS idx_documents_account_id ON public.documents(account_id);
CREATE INDEX IF NOT EXISTS idx_team_members_account_id ON public.team_members(account_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_account_id ON public.system_logs(account_id);

-- companies is 1:1 with accounts for now; enforce uniqueness.
-- (drop the constraint later if a 1:many relationship is needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_account_id_unique'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_account_id_unique UNIQUE (account_id);
  END IF;
END$$;
