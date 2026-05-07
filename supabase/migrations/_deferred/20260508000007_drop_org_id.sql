-- 20260508000007_drop_org_id.sql
-- DEFERRED. Lives in supabase/migrations/_deferred/ so `supabase db push`
-- will not pick it up. To apply: move this file up one level
-- (`mv supabase/migrations/_deferred/20260508000007_drop_org_id.sql supabase/migrations/`)
-- and run `supabase db push`.
--
-- Apply only after the data tables listed below no longer read/write org_id from any
-- application code. Verify with:
--   grep -rn "org_id" js/ pages/ supabase/functions/ \
--     | grep -v "nav_permissions"
-- Expected: zero matches. The `nav_permissions` table intentionally retains its
-- org_id column (it is a per-user FK to auth.users, NOT a tenant column) and is
-- not touched by this migration.

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
