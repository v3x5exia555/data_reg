-- 20260508000005_make_account_id_required.sql
-- Enforce account_id NOT NULL on data tables.
-- user_profiles.account_id stays nullable (Superadmin has none).
-- system_logs.account_id stays nullable (pre-tenancy logs may have NULL).

ALTER TABLE public.companies ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.vendors ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.training_records ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.data_records ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.data_requests ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.breach_log ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.dpia_assessments ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.cross_border_transfers ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.cases ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.alerts ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.dpo ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.processing_activities ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.documents ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.team_members ALTER COLUMN account_id SET NOT NULL;
