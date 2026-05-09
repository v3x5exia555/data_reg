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
