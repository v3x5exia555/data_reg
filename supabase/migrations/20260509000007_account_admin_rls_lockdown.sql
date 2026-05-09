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

-- ============================================================
-- 2. Uniform per-table policies
-- ============================================================
-- Every table whose `account_id` is NOT NULL gets the same four policies:
--   <table>_select / _insert / _update / _delete
-- Caller must be Superadmin OR row.account_id = caller's account_id.

DO $$
DECLARE
    tbl  TEXT;
    tbls TEXT[] := ARRAY[
        'companies',
        'vendors',
        'training_records',
        'data_records',
        'data_requests',
        'breach_log',
        'dpia_assessments',
        'dpia_screenings',
        'cross_border_transfers',
        'cases',
        'alerts',
        'dpo',
        'processing_activities',
        'documents',
        'team_members',
        'consent_settings'
    ];
    legacy TEXT[] := ARRAY[
        'Enable read for all',
        'Enable insert for all',
        'Enable update for all',
        'Enable delete for all',
        'Allow all access',
        'Allow all operations',
        'Allow DPO management',
        'Allow company management',
        'Allow vendor management',
        'Allow training management',
        'Allow data record management',
        'Allow data request management',
        'Allow breach log management',
        'Allow DPIA management',
        'dpia_screenings_owner_all',
        'Allow cross border management',
        'Allow case management',
        'Allow alert management',
        'Allow document management',
        'Users manage own documents',
        'Allow team member management',
        'Users manage own team',
        'Users manage company processing activities',
        'Allow consent settings',
        'Allow public select on team_members',
        'Allow public insert on team_members',
        'Users can view own data records',
        'Users can insert own data records',
        'Users can update own data records',
        'Users can delete own data records'
    ];
    p TEXT;
BEGIN
    FOREACH tbl IN ARRAY tbls
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

        FOREACH p IN ARRAY legacy LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p, tbl);
        END LOOP;
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_select', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_insert', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_update', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl || '_delete', tbl);

        EXECUTE format(
          'CREATE POLICY %I ON %I FOR SELECT USING ( public.auth_is_superadmin() OR account_id = public.auth_current_account_id() )',
          tbl || '_select', tbl);
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR INSERT WITH CHECK ( public.auth_is_superadmin() OR account_id = public.auth_current_account_id() )',
          tbl || '_insert', tbl);
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR UPDATE USING ( public.auth_is_superadmin() OR account_id = public.auth_current_account_id() ) WITH CHECK ( public.auth_is_superadmin() OR account_id = public.auth_current_account_id() )',
          tbl || '_update', tbl);
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR DELETE USING ( public.auth_is_superadmin() OR account_id = public.auth_current_account_id() )',
          tbl || '_delete', tbl);
    END LOOP;
END $$;
