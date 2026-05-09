# Account-Admin Scoping Lock-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down `Accountadmin` and `user` roles so they can only read/write rows in their own `account_id`, enforced server-side by Supabase RLS, with a self-checking verification migration.

**Architecture:** One forward-only migration adds three SECURITY DEFINER helper functions (`auth_current_role`, `auth_current_account_id`, `auth_is_superadmin`) and replaces every permissive `USING (true)` policy with role-aware policies that compare `account_id` to the caller's. A verification migration impersonates two synthetic Accountadmins via `request.jwt.claims` and aborts the deploy if any cross-account read or write succeeds. Client and edge-function patches close gaps RLS alone cannot.

**Tech Stack:** PostgreSQL 15 (Supabase), `supabase` CLI, plain JS (no framework), Deno (edge functions).

**Spec:** `docs/superpowers/specs/2026-05-09-account-admin-scoping-design.md`

---

## File Structure

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/20260509000007_account_admin_rls_lockdown.sql` | Create | Helper functions + uniform DO-loop policies + special-case policies for `accounts`, `user_profiles`, `system_logs`. |
| `supabase/migrations/20260509000008_test_account_admin_rls.sql` | Create | Self-checking verification: BEGIN; setup; impersonate; assert; ROLLBACK. |
| `js/app.js` | Modify | `loadAllPeople()` (line 4596) — add `account_id` filter. New helper `mapSupabaseError()` for friendly RLS-denial toasts. |
| `supabase/functions/create-user/index.ts` | Modify | `manage-user` mode — verify caller's `account_id` matches target user's `account_id` when caller is `Accountadmin`. |

No new test files. The verification migration is the regression guard.

---

## Pre-flight

- [ ] **Step P-1: Confirm local Supabase is running**

Run: `supabase status`
Expected: `API URL`, `DB URL`, `anon key` all printed without errors.

If not running: `supabase start`

- [ ] **Step P-2: Confirm a clean migration baseline**

Run: `supabase db reset` (this re-applies all existing migrations to a fresh local DB).
Expected: all migrations through `20260509000006_dpia_screenings.sql` apply without error. Final line: `Finished supabase db reset on branch ...`.

- [ ] **Step P-3: Note pre-fix behaviour (optional sanity)**

Run:
```bash
psql "$(supabase status --output env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "SELECT polname, polqual FROM pg_policy WHERE polrelid = 'public.companies'::regclass;"
```
Expected: four rows whose `polqual` is `true` — confirming permissive policies before the lock-down.

---

## Task 1: Helper Functions Migration

**Files:**
- Create: `supabase/migrations/20260509000007_account_admin_rls_lockdown.sql` (helpers section only — policies added in Tasks 2/3)

- [ ] **Step 1.1: Create the migration file with the three helpers**

Write `supabase/migrations/20260509000007_account_admin_rls_lockdown.sql`:

```sql
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
```

- [ ] **Step 1.2: Apply the migration**

Run: `supabase db push --local`
Expected: `Applying migration 20260509000007_account_admin_rls_lockdown.sql` succeeds.

- [ ] **Step 1.3: Verify the functions exist**

Run:
```bash
psql "$(supabase status --output env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "SELECT proname, prosecdef FROM pg_proc WHERE proname IN ('auth_current_role','auth_current_account_id','auth_is_superadmin');"
```
Expected: three rows, each with `prosecdef = t` (security definer).

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260509000007_account_admin_rls_lockdown.sql
git commit -m "feat(rls): add SECURITY DEFINER helpers for account scoping

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Uniform Per-Table Policies (DO loop)

**Files:**
- Modify: `supabase/migrations/20260509000007_account_admin_rls_lockdown.sql` (append section 2)

- [ ] **Step 2.1: Append the DO-loop section**

Append to the migration:

```sql

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
        'Allow DPO management'
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
```

- [ ] **Step 2.2: Apply the migration**

Run: `supabase db reset` (the migration is forward-only and idempotent; reset re-applies cleanly).
Expected: clean re-apply, no errors.

- [ ] **Step 2.3: Verify policies on a sample table**

Run:
```bash
psql "$(supabase status --output env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.companies'::regclass ORDER BY polname;"
```
Expected: four rows: `companies_delete`, `companies_insert`, `companies_select`, `companies_update`.

- [ ] **Step 2.4: Commit**

```bash
git add supabase/migrations/20260509000007_account_admin_rls_lockdown.sql
git commit -m "feat(rls): scope app data tables by account_id

Replaces USING (true) policies on companies, vendors, documents, and 13
other account-scoped tables with role-aware SELECT/INSERT/UPDATE/DELETE
policies driven by auth_current_account_id().

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Special-Case Policies (`accounts`, `user_profiles`, `system_logs`)

**Files:**
- Modify: `supabase/migrations/20260509000007_account_admin_rls_lockdown.sql` (append section 3)

- [ ] **Step 3.1: Append the special-case policies**

Append to the migration:

```sql

-- ============================================================
-- 3. Special-case tables
-- ============================================================

-- ---- accounts ----------------------------------------------
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounts_all"    ON public.accounts;
DROP POLICY IF EXISTS "accounts_select" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update" ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete" ON public.accounts;

CREATE POLICY "accounts_select" ON public.accounts FOR SELECT
  USING ( public.auth_is_superadmin()
       OR id = public.auth_current_account_id() );

CREATE POLICY "accounts_insert" ON public.accounts FOR INSERT
  WITH CHECK ( public.auth_is_superadmin() );

CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE
  USING      ( public.auth_is_superadmin() OR id = public.auth_current_account_id() )
  WITH CHECK ( public.auth_is_superadmin() OR id = public.auth_current_account_id() );

CREATE POLICY "accounts_delete" ON public.accounts FOR DELETE
  USING ( public.auth_is_superadmin() );

-- ---- user_profiles -----------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accountadmin can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile"        ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select"              ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert"              ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update"              ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete"              ON public.user_profiles;

CREATE POLICY "user_profiles_select" ON public.user_profiles FOR SELECT
  USING ( public.auth_is_superadmin()
       OR id = auth.uid()
       OR ( public.auth_current_role() = 'Accountadmin'
            AND account_id = public.auth_current_account_id() ) );

CREATE POLICY "user_profiles_insert" ON public.user_profiles FOR INSERT
  WITH CHECK ( public.auth_is_superadmin()
            OR ( public.auth_current_role() = 'Accountadmin'
                 AND account_id = public.auth_current_account_id() ) );

CREATE POLICY "user_profiles_update" ON public.user_profiles FOR UPDATE
  USING      ( public.auth_is_superadmin()
            OR id = auth.uid()
            OR ( public.auth_current_role() = 'Accountadmin'
                 AND account_id = public.auth_current_account_id() ) )
  WITH CHECK (
       public.auth_is_superadmin()
    OR ( ( id = auth.uid()
           OR ( public.auth_current_role() = 'Accountadmin'
                AND account_id = public.auth_current_account_id() ) )
         AND role <> 'Superadmin'
         AND account_id = public.auth_current_account_id() ) );

CREATE POLICY "user_profiles_delete" ON public.user_profiles FOR DELETE
  USING ( public.auth_is_superadmin() );

-- ---- system_logs (account_id is nullable) ------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_logs'
  ) THEN
    EXECUTE 'ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Enable read for all"   ON public.system_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert for all" ON public.system_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update for all" ON public.system_logs';
    EXECUTE 'DROP POLICY IF EXISTS "Enable delete for all" ON public.system_logs';
    EXECUTE 'DROP POLICY IF EXISTS "system_logs_select"    ON public.system_logs';
    EXECUTE 'DROP POLICY IF EXISTS "system_logs_insert"    ON public.system_logs';

    EXECUTE 'CREATE POLICY "system_logs_select" ON public.system_logs FOR SELECT
      USING ( public.auth_is_superadmin()
           OR account_id = public.auth_current_account_id() )';
    EXECUTE 'CREATE POLICY "system_logs_insert" ON public.system_logs FOR INSERT
      WITH CHECK ( public.auth_is_superadmin()
                OR account_id = public.auth_current_account_id() )';
    -- system_logs is append-only; no update/delete policies = denied.
  END IF;
END $$;
```

- [ ] **Step 3.2: Apply the migration**

Run: `supabase db reset`
Expected: clean re-apply, no errors.

- [ ] **Step 3.3: Verify policies**

Run:
```bash
psql "$(supabase status --output env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "SELECT polname FROM pg_policy WHERE polrelid = 'public.user_profiles'::regclass ORDER BY polname;"
```
Expected: four rows: `user_profiles_delete`, `user_profiles_insert`, `user_profiles_select`, `user_profiles_update`.

- [ ] **Step 3.4: Commit**

```bash
git add supabase/migrations/20260509000007_account_admin_rls_lockdown.sql
git commit -m "feat(rls): scope accounts, user_profiles, system_logs

accounts: own-row only for non-Superadmin; Superadmin gates writes.
user_profiles: self + same-account-when-Accountadmin; WITH CHECK
blocks self-promotion to Superadmin and cross-account moves.
system_logs: append-only, scoped by account_id.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Verification Migration

**Files:**
- Create: `supabase/migrations/20260509000008_test_account_admin_rls.sql`

This migration is the regression guard. It runs on every `supabase db push`; if any cross-account access succeeds, it raises `EXCEPTION` and the deploy aborts. The migration ends with `ROLLBACK` so it leaves no test data.

- [ ] **Step 4.1: Write the verification migration**

Create `supabase/migrations/20260509000008_test_account_admin_rls.sql`:

```sql
-- 20260509000008_test_account_admin_rls.sql
-- Self-checking verification of account-admin scoping. Sets up two synthetic
-- accounts, impersonates each Accountadmin via request.jwt.claims, and asserts
-- isolation. Wrapped in BEGIN; ... ROLLBACK; — leaves no residue. Aborts the
-- deploy via RAISE EXCEPTION on any leak.

BEGIN;

-- ---- 1. Setup ----------------------------------------------
INSERT INTO public.accounts (id, name, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Tenant A', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Tenant B', 'active'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Test Superadmin Home', 'active');

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'test-admin-a@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'test-admin-b@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'test-superadmin@example.test',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

INSERT INTO public.user_profiles (id, email, role, account_id, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test-admin-a@example.test', 'Accountadmin',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'test-admin-b@example.test', 'Accountadmin',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'test-superadmin@example.test', 'Superadmin',
   NULL, 'active');

INSERT INTO public.companies (account_id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Co A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Co B');

INSERT INTO public.documents (account_id, user_id, name, doc_type, category, file_size, storage_path, uploader_name)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'a.pdf','pdf','policy', 1, 'a/a.pdf','admin-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222',
   'b.pdf','pdf','policy', 1, 'b/b.pdf','admin-b');

-- ---- 2. Impersonation helper -------------------------------
CREATE OR REPLACE FUNCTION pg_temp.assume(uid UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.unassume() RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END $$;

-- ---- 3. Read isolation as admin-A --------------------------
DO $$
DECLARE n INT;
BEGIN
  PERFORM pg_temp.assume('11111111-1111-1111-1111-111111111111');

  SELECT count(*) INTO n FROM public.companies
   WHERE account_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF n <> 0 THEN RAISE EXCEPTION 'LEAK: admin-A saw % company rows from B', n; END IF;

  SELECT count(*) INTO n FROM public.documents
   WHERE account_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF n <> 0 THEN RAISE EXCEPTION 'LEAK: admin-A saw % document rows from B', n; END IF;

  SELECT count(*) INTO n FROM public.user_profiles
   WHERE account_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF n <> 0 THEN RAISE EXCEPTION 'LEAK: admin-A saw % staff rows from B', n; END IF;

  SELECT count(*) INTO n FROM public.accounts
   WHERE id <> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF n <> 0 THEN RAISE EXCEPTION 'LEAK: admin-A saw % foreign account rows', n; END IF;

  PERFORM pg_temp.unassume();
END $$;

-- ---- 4. Write attack: admin-A inserts into B ---------------
DO $$
DECLARE failed BOOLEAN := FALSE;
BEGIN
  PERFORM pg_temp.assume('11111111-1111-1111-1111-111111111111');
  BEGIN
    INSERT INTO public.companies (account_id, name)
      VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Pwned by A');
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR others THEN
      failed := TRUE;
  END;
  PERFORM pg_temp.unassume();
  IF NOT failed THEN
    RAISE EXCEPTION 'WRITE LEAK: admin-A inserted into tenant B';
  END IF;
END $$;

-- ---- 5. Privilege escalation: admin-A → Superadmin ---------
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  PERFORM pg_temp.assume('11111111-1111-1111-1111-111111111111');
  BEGIN
    UPDATE public.user_profiles SET role = 'Superadmin'
     WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR others THEN
      blocked := TRUE;
  END;
  PERFORM pg_temp.unassume();
  IF NOT blocked AND EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE id = '11111111-1111-1111-1111-111111111111' AND role = 'Superadmin'
  ) THEN
    RAISE EXCEPTION 'ESCALATION: admin-A self-promoted to Superadmin';
  END IF;
END $$;

-- ---- 6. Cross-account move blocked -------------------------
DO $$
DECLARE blocked BOOLEAN := FALSE;
BEGIN
  PERFORM pg_temp.assume('11111111-1111-1111-1111-111111111111');
  BEGIN
    UPDATE public.user_profiles
       SET account_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR others THEN
      blocked := TRUE;
  END;
  PERFORM pg_temp.unassume();
  IF NOT blocked AND EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE id = '11111111-1111-1111-1111-111111111111'
       AND account_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ) THEN
    RAISE EXCEPTION 'ESCALATION: admin-A moved self into tenant B';
  END IF;
END $$;

-- ---- 7. Symmetric checks as admin-B ------------------------
DO $$
DECLARE n INT;
BEGIN
  PERFORM pg_temp.assume('22222222-2222-2222-2222-222222222222');

  SELECT count(*) INTO n FROM public.companies
   WHERE account_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF n <> 0 THEN RAISE EXCEPTION 'LEAK: admin-B saw % company rows from A', n; END IF;

  SELECT count(*) INTO n FROM public.user_profiles
   WHERE account_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF n <> 0 THEN RAISE EXCEPTION 'LEAK: admin-B saw % staff rows from A', n; END IF;

  PERFORM pg_temp.unassume();
END $$;

-- ---- 8. Superadmin sees both tenants -----------------------
DO $$
DECLARE n INT;
BEGIN
  PERFORM pg_temp.assume('33333333-3333-3333-3333-333333333333');

  SELECT count(*) INTO n FROM public.accounts
   WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  IF n <> 2 THEN RAISE EXCEPTION 'BUG: Superadmin saw only % of 2 test tenants', n; END IF;

  SELECT count(*) INTO n FROM public.companies
   WHERE account_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  IF n <> 2 THEN RAISE EXCEPTION 'BUG: Superadmin saw only % of 2 test companies', n; END IF;

  PERFORM pg_temp.unassume();
END $$;

ROLLBACK;
```

- [ ] **Step 4.2: Apply migrations from a clean baseline**

Run: `supabase db reset`
Expected: every migration applies, including `20260509000008_test_account_admin_rls.sql`. The reset finishes without errors. (If any assertion fires, the reset fails with `RAISE EXCEPTION` and the verification migration name in the output.)

- [ ] **Step 4.3: (Negative test) Confirm the verification catches a regression**

Temporarily break the policy to prove the test bites:

```bash
psql "$(supabase status --output env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -c "DROP POLICY companies_select ON public.companies; \
      CREATE POLICY companies_select ON public.companies FOR SELECT USING (true);"
```

Then re-run the verification SQL by hand:
```bash
psql "$(supabase status --output env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
  -f supabase/migrations/20260509000008_test_account_admin_rls.sql
```
Expected: `ERROR: LEAK: admin-A saw 1 company rows from B`.

Restore: `supabase db reset`.

- [ ] **Step 4.4: Commit**

```bash
git add supabase/migrations/20260509000008_test_account_admin_rls.sql
git commit -m "test(rls): self-checking verification of account scoping

Migration runs on every db push, impersonates two synthetic
Accountadmins via request.jwt.claims, and asserts cross-account
SELECT/INSERT and self-promotion are all blocked. Wrapped in
BEGIN/ROLLBACK so it leaves no residue.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Client Patch — `loadAllPeople()` Filter

**Files:**
- Modify: `js/app.js` (function `loadAllPeople`, currently at line 4596)

The existing function fetches all `user_profiles` with no `account_id` filter. RLS will now silently drop foreign rows for an Accountadmin, but adding the explicit filter avoids issuing a query before the profile loads and matches the `getEffectiveAccountId()` pattern used elsewhere.

- [ ] **Step 5.1: Replace the function body with the scoped query**

Locate the function in `js/app.js`:

```js
async function loadAllPeople() {
  if (state.role !== 'Accountadmin' && state.role !== 'Superadmin') return;
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) {
    document.getElementById('people-list').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted);">Supabase not configured.</div>';
    return;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, role, status, account_id, accounts(name)')
    .order('email');
```

Replace the `const { data, error } = ...` block with:

```js
  let q = supabase
    .from('user_profiles')
    .select('id, email, role, status, account_id, accounts(name)')
    .order('email');

  if (state.role !== 'Superadmin') {
    const accountId = getEffectiveAccountId();
    if (!accountId) {
      document.getElementById('people-list').innerHTML =
        '<div style="text-align:center;padding:40px;color:var(--muted);">No account selected.</div>';
      return;
    }
    q = q.eq('account_id', accountId);
  } else if (state.viewAsAccountId) {
    q = q.eq('account_id', state.viewAsAccountId);
  }

  const { data, error } = await q;
```

Leave the rest of the function (error handling, render call) unchanged.

- [ ] **Step 5.2: Manual verification**

Start the dev server: `./start.sh` (or open `index.html` directly if that's the standing workflow — `PROJECT_README.md` documents the local launch flow).

In one browser, sign in as an Accountadmin in Tenant A. Open the People page. Confirm only Tenant A's users are listed.

In a second browser/incognito, sign in as an Accountadmin in Tenant B. Open the People page. Confirm only Tenant B's users are listed.

Expected: each session shows only its own staff, no overlap.

- [ ] **Step 5.3: Commit**

```bash
git add js/app.js
git commit -m "fix(people): scope People page query by account_id

Accountadmins now see only their own tenant's staff. Belt-and-suspenders
with the new RLS \`user_profiles_select\` policy.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Client Patch — Friendly RLS Error Toast

**Files:**
- Modify: `js/app.js` (add `mapSupabaseError` helper near the existing `showToast` block around line 408)

When RLS rejects a write, Supabase returns Postgres code `42501` ("new row violates row-level security policy"). The current code surfaces the raw message; we replace it with a human-readable toast.

- [ ] **Step 6.1: Add the helper next to `showError`**

Locate `js/app.js:408–410`:

```js
function showSuccess(msg) { showToast(msg, 'success'); }
function showError(msg) { showToast(msg, 'error'); }
function showWarning(msg) { showToast(msg, 'warning'); }
```

Insert directly after, on line 411:

```js
function mapSupabaseError(err) {
  if (!err) return 'Unknown error';
  const code = err.code || '';
  const msg = err.message || String(err);
  if (code === '42501' || /row-level security/i.test(msg)) {
    return "You don't have access to that account.";
  }
  if (code === '23514' && /role/i.test(msg)) {
    return "That role change isn't allowed.";
  }
  return msg;
}
```

- [ ] **Step 6.2: Use it in the few obvious write-error toasts**

There are many error sites; we only swap the ones that handle Supabase responses. Search and replace these patterns:

```bash
grep -n "showToast(.*error.*'error')" js/app.js | head -20
```

For each call site that toasts a Supabase `error.message`, change `error.message || 'Failed'` to `mapSupabaseError(error)`. Concretely:
- `js/app.js` near line 720 (`showToast('Failed to update consent', 'error')` — leaves as-is, it's a generic catch).
- Any `showToast(error.message, 'error')` or `showToast(\`Save failed: ${err.message}\`, 'error')` — change the inner expression to `mapSupabaseError(error)` / `mapSupabaseError(err)`.

If `grep` returns no `error.message` toast sites in app.js, this step is a no-op for messaging — the helper still ships for future use.

- [ ] **Step 6.3: Manual verification**

In a browser signed in as Accountadmin in Tenant A, open the JS console and run:
```js
const supabase = getSupabaseClient();
const r = await supabase.from('companies')
  .insert({ account_id: '<paste a known foreign account_id>', name: 'Should fail' });
console.log(mapSupabaseError(r.error));
```
Expected: prints `You don't have access to that account.`

- [ ] **Step 6.4: Commit**

```bash
git add js/app.js
git commit -m "feat(ui): map RLS denial errors to a friendly toast

Adds mapSupabaseError() that renders Postgres 42501 as
\"You don't have access to that account.\" instead of the raw
policy message.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Edge Function — `manage-user` Cross-Tenant Guard

**Files:**
- Modify: `supabase/functions/create-user/index.ts` (the `mode === 'manage-user'` branch around line 76)

The function uses the service-role key and bypasses RLS, so it must enforce scoping itself. Today it blocks an Accountadmin from managing a Superadmin (line 86) but does **not** verify the target user's `account_id` matches the caller's.

- [ ] **Step 7.1: Replace the manage-user authorization block**

Locate the block:

```ts
  if (body.mode === 'manage-user') {
    const isAdmin = callerProfile.role === 'Superadmin' || callerProfile.role === 'Accountadmin';
    if (!isAdmin) return json({ error: 'Admin only' }, 403);
    if (body.user_id === caller.id) return json({ error: 'Cannot manage your own account' }, 400);
    if (callerProfile.role === 'Accountadmin') {
      const { data: targetProfile } = await adminClient
        .from('user_profiles')
        .select('role')
        .eq('id', body.user_id)
        .single();
      if (targetProfile?.role === 'Superadmin') {
        return json({ error: 'Not authorized to manage Superadmin accounts' }, 403);
      }
    }
    return await manageUser(adminClient, body);
  }
```

Replace with:

```ts
  if (body.mode === 'manage-user') {
    const isAdmin = callerProfile.role === 'Superadmin' || callerProfile.role === 'Accountadmin';
    if (!isAdmin) return json({ error: 'Admin only' }, 403);
    if (body.user_id === caller.id) return json({ error: 'Cannot manage your own account' }, 400);

    if (callerProfile.role === 'Accountadmin') {
      const { data: targetProfile, error: targetErr } = await adminClient
        .from('user_profiles')
        .select('role, account_id')
        .eq('id', body.user_id)
        .single();
      if (targetErr || !targetProfile) {
        return json({ error: 'Target user not found' }, 404);
      }
      if (targetProfile.role === 'Superadmin') {
        return json({ error: 'Not authorized to manage Superadmin accounts' }, 403);
      }
      if (targetProfile.account_id !== callerProfile.account_id) {
        return json({ error: 'Not authorized for this account' }, 403);
      }
    }
    return await manageUser(adminClient, body);
  }
```

- [ ] **Step 7.2: Deploy the function locally**

Run: `supabase functions serve create-user`
Expected: function starts on `http://localhost:54321/functions/v1/create-user`.

- [ ] **Step 7.3: Manual cross-tenant test**

Get an Accountadmin JWT for Tenant A (sign in via the app, copy `access_token` from `supabase.auth.getSession()` in the console). Pick a `user_id` from Tenant B (look up via the SQL editor: `SELECT id FROM user_profiles WHERE account_id = '<tenant-B>' LIMIT 1`).

Run:
```bash
curl -i -X POST http://localhost:54321/functions/v1/create-user \
  -H "Authorization: Bearer $A_JWT" \
  -H "Content-Type: application/json" \
  -d '{"mode":"manage-user","user_id":"<tenant-B-user-id>","action":"deactivate"}'
```
Expected: `HTTP/1.1 403 Forbidden` with body `{"error":"Not authorized for this account"}`.

Then run the same `curl` against a user inside Tenant A. Expected: `HTTP/1.1 200 OK` with `{"ok":true}`.

- [ ] **Step 7.4: Commit**

```bash
git add supabase/functions/create-user/index.ts
git commit -m "fix(edge): block cross-tenant manage-user calls

Accountadmin callers can only reset/activate/deactivate users in their
own account_id. Closes the gap where the service-role function bypasses
the new RLS policies.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Manual UAT

- [ ] **Step 8.1: Sign in as two Accountadmins in two browsers and walk every scoped page**

For each page below, sign in as Accountadmin in Tenant A in Browser 1 and Tenant B in Browser 2, and confirm each session sees only its own tenant's data:

- Companies (`#companies`)
- Documents (`#documents`)
- People (`#people`)
- Vendors (`#vendors`)
- Data Register (`#dataregister`)
- Data Requests (`#datarequests`)
- DPIA (`#dpia`)
- Processing Activities (`#processing`)
- Training (`#training`)
- Breach Log (`#breachlog`)
- Cross-Border (`#crossborder`)
- Cases (`#cases`)
- Alerts (`#alerts`)
- DPO (`#dpo`)

Expected: counts and rows in Browser 1 never include Browser 2's data, and vice versa.

- [ ] **Step 8.2: Sign in as Superadmin and confirm full visibility**

Without `viewAsAccountId` set, Superadmin should still see all tenants' rows. With `viewAsAccountId` set to Tenant A, the same lists should narrow to Tenant A only (existing client-side filter behaviour).

- [ ] **Step 8.3: Append a UAT entry to `UAT-CHECKLIST.md`**

Append this section to `UAT-CHECKLIST.md`:

```markdown
## Account-Admin Scoping (2026-05-09)

- [ ] As Accountadmin in Tenant A, the People page shows only Tenant A staff.
- [ ] As Accountadmin in Tenant A, attempting to insert a row with a foreign account_id (via console) returns "You don't have access to that account."
- [ ] As Accountadmin in Tenant A, calling `manage-user` against a Tenant B user returns 403.
- [ ] As Superadmin, all tenants are visible; setting `viewAsAccountId` filters to that tenant.
```

- [ ] **Step 8.4: Commit UAT update**

```bash
git add UAT-CHECKLIST.md
git commit -m "docs(uat): add account-admin scoping checklist

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Done Definition

- All eight tasks above committed.
- `supabase db reset` succeeds end-to-end (proves the verification migration is green).
- Manual UAT checklist walked through with two browsers.
- No new Python or Playwright tests; the verification migration is the regression guard.

## Rollback

If RLS breaks something in UAT, revert the lock-down with a follow-up migration that re-creates the permissive policies:

```sql
-- Emergency rollback: restore permissive RLS on every locked-down table.
DO $$
DECLARE
  tbl  TEXT;
  tbls TEXT[] := ARRAY[
    'companies','vendors','training_records','data_records','data_requests',
    'breach_log','dpia_assessments','dpia_screenings','cross_border_transfers',
    'cases','alerts','dpo','processing_activities','documents','team_members',
    'consent_settings','user_profiles','accounts','system_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl||'_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl||'_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl||'_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', tbl||'_delete', tbl);
    EXECUTE format('CREATE POLICY "Allow all access" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl);
  END LOOP;
END $$;
```

Forward-only — do not edit the original migrations.
