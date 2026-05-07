-- 20260508000004_backfill_default_account.sql
-- Insert "Default Account 1" and assign all existing data rows to it.
-- Does NOT auto-promote anyone to Superadmin — operator runs manual SQL post-migrations.
--
-- NOTE: companies_account_id_unique constraint is dropped before backfill since
-- multiple companies must share the same default account (1:many is the correct model).

DROP INDEX IF EXISTS idx_companies_account_id;
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_account_id_unique;

INSERT INTO public.accounts (id, name, seat_limit, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Account 1', 99, 'active')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  default_account UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  UPDATE public.user_profiles SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.companies SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.vendors SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.training_records SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.data_records SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.data_requests SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.breach_log SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.dpia_assessments SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.cross_border_transfers SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.cases SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.alerts SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.dpo SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.processing_activities SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.documents SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.team_members SET account_id = default_account WHERE account_id IS NULL;
  UPDATE public.system_logs SET account_id = default_account WHERE account_id IS NULL;
END$$;

-- Wire the existing demo Accountadmin (if any) to Default Account 1.
UPDATE public.accounts
SET accountadmin_user_id = (
  SELECT id FROM public.user_profiles
  WHERE role = 'Accountadmin' AND account_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY created_at ASC LIMIT 1
)
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND accountadmin_user_id IS NULL;
