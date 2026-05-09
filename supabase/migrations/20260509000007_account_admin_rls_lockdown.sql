-- 20260509000007_account_admin_rls_lockdown.sql
-- Account-admin scoping lock-down. Replaces permissive RLS with role-aware
-- policies. See docs/superpowers/specs/2026-05-09-account-admin-scoping-design.md.
--
-- This migration is split into sections:
--   1. SECURITY DEFINER helper functions
--   2. Uniform per-table policies (DO loop over scoped tables)
--   3. Special-case tables: accounts, user_profiles, system_logs

-- ============================================================
-- 1. Helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.auth_current_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.auth_current_account_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT account_id FROM public.user_profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.auth_is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.auth_current_role() = 'Superadmin' $$;

REVOKE ALL ON FUNCTION public.auth_current_role()        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_current_account_id()  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_superadmin()       FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_current_role()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_current_account_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_superadmin()      TO authenticated;
