-- 20260516000002_fix_role_selfupdate_privesc.sql
-- Close the privilege-escalation hole: the prior user_profiles_update RLS
-- (20260509000007) only blocked role <> 'Superadmin' on self-update, so any
-- authenticated `user` could self-promote to Accountadmin via:
--   supabase.from('user_profiles').update({role:'Accountadmin'}).eq('id', ownId)
--
-- Fix mechanism (Postgres-canonical, unambiguous — unlike an RLS WITH CHECK
-- which cannot reference OLD): remove the ability for client roles to write
-- the privileged columns at all, and add a trigger backstop. Role/account
-- changes flow ONLY through the create-user Edge function (service_role),
-- which already enforces server-side authz.
--
-- The existing user_profiles_update ROW policy from 20260509000007 is left
-- intact — it still governs WHICH rows are updatable. This migration only
-- removes the ability to mutate the role / account_id COLUMNS from the client.
-- Verified: no client code mutates these via direct update (all role changes
-- already route through the Edge function manage-user path).

-- 1. Column-level privilege: client grants cannot write role / account_id.
REVOKE UPDATE (role, account_id) ON public.user_profiles FROM authenticated;
REVOKE UPDATE (role, account_id) ON public.user_profiles FROM anon;

-- 2. Trigger backstop: hard-fail any role/account_id change not made by the
--    service_role, so a future GRANT mistake cannot silently reopen the hole.
--    Service-role detection MUST match this codebase's existing convention
--    (verified against 20260426120145_fix_profiles_add_team.sql:9):
--    plural `request.jwt.claims`, cast ::jsonb, ->> 'role'. The singular
--    `request.jwt.claim.role` GUC is a legacy PostgREST form Supabase does
--    not reliably set — using it would break the Edge function's legitimate
--    service-role role changes.
CREATE OR REPLACE FUNCTION public.guard_user_profiles_privileged_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.account_id IS DISTINCT FROM OLD.account_id)
     AND COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'role/account_id may only be changed via the admin service path';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profiles_privcols ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profiles_privcols
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profiles_privileged_cols();

-- Rollback (manual):
--   GRANT UPDATE (role, account_id) ON public.user_profiles TO authenticated;
--   DROP TRIGGER trg_guard_user_profiles_privcols ON public.user_profiles;
--   DROP FUNCTION public.guard_user_profiles_privileged_cols();
-- NOTE: do NOT roll this back without a compensating control — it reopens a
-- live privilege-escalation vulnerability.
