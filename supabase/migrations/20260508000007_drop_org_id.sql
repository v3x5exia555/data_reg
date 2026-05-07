-- 20260508000007_drop_org_id.sql
-- DEFERRED. Apply only after confirming no code reads/writes org_id.
-- Verify with: grep -rn "org_id" js/ pages/ supabase/functions/
-- Expected: zero matches before running this.

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
