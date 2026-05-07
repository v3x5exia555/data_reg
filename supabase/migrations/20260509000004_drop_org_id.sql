-- 20260509000004_drop_org_id.sql
-- Drops the legacy org_id column from all data tables now that account_id
-- is the authoritative tenant identifier.
-- nav_permissions intentionally retains its org_id column (per-user FK).

-- Drop RLS policy on team_members that references org_id before the column is dropped.
DROP POLICY IF EXISTS "Users manage own team" ON public.team_members;

ALTER TABLE public.vendors DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.training_records DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.data_records DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.data_requests DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.breach_log DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.dpia_assessments DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.cross_border_transfers DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.cases DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.alerts DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.dpo DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.processing_activities DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.documents DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.team_members DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.companies DROP COLUMN IF EXISTS org_id;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS org_id;
