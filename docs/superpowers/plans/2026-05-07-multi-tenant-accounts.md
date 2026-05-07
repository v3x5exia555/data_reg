# Multi-tenant Accounts + Superadmin Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overloaded `org_id` with a clean two-table model (`accounts` for tenancy/billing, `companies` for compliance subject), add `Superadmin` role, ship Accounts page + view-as + seat-gated user invitation.

**Architecture:** Phased rollout — additive migrations (1–4) with dual-write frontend first; SQL invariants gate; enforcement migrations (5–6); then full Superadmin UI + Edge Function (Phase F); manual smoke checklist gate; deferred `org_id` drop (migration 7). Single Edge Function (`create-user`) serves both Superadmin "+ New account" and Accountadmin "+ Add user" flows. Isolation is enforced in the frontend by an `account_id` filter on every query — production-grade JWT RLS is a follow-up spec.

**Tech Stack:** Supabase Postgres, Supabase Auth (`auth.admin.createUser`), Supabase Edge Functions (TypeScript/Deno), vanilla JS (no framework — `js/app.js` + per-page logic files), HTML pages in `pages/`.

**Spec:** `docs/superpowers/specs/2026-05-07-multi-tenant-accounts-design.md`

---

## File Structure

**Created:**
- `supabase/migrations/20260508000001_create_accounts_table.sql`
- `supabase/migrations/20260508000002_alter_user_role_enum.sql`
- `supabase/migrations/20260508000003_add_account_id_columns.sql`
- `supabase/migrations/20260508000004_backfill_default_account.sql`
- `supabase/migrations/20260508000005_make_account_id_required.sql`
- `supabase/migrations/20260508000006_drop_activity_log.sql`
- `supabase/migrations/20260508000007_drop_org_id.sql` (deferred — created but not run until cleanup phase)
- `supabase/functions/create-user/index.ts` — Edge Function, ~80 lines
- `pages/20__accounts.html` — Superadmin Accounts page
- `js/superadmin_logic.js` — Accounts page logic + view-as state
- `docs/multi-tenant-smoke.md` — manual smoke checklist

**Modified:**
- `js/app.js` — add `getEffectiveAccountId()`; populate `state.role`, `state.accountId`, `state.viewAsAccountId` on login; login routing; suspended-account handling; nav gating; view-as banner rendering
- `js/vendor_logic.js`, `js/training_logic.js`, `js/dpo_logic.js`, `js/activities_logic.js` — replace `getCurrentOrgId()` calls with `getEffectiveAccountId()`; add `account_id` filter to load helpers; dual-write `account_id` alongside `org_id` in Phase B; drop `org_id` writes in Phase F
- `pages/06__access.html` — add seat chip + gated "+ Add user" button
- `pages/00__dashboard.html` — add "User activity" card markup
- `pages/auth__login.html` (or login handler in `js/app.js`) — post-login routing by role; suspended-account error message

**Why these splits:**
- Superadmin logic gets its own file (`superadmin_logic.js`) instead of bloating `app.js` (already 4048 lines). Same pattern as `vendor_logic.js`, `training_logic.js`, etc.
- View-as banner is a small component rendered from `app.js` since it's app-wide chrome, not page-specific.
- Edge Function lives under `supabase/functions/` per Supabase convention.

---

## Phase A — Migrations 1–4 (additive, reversible)

### Task 1: Migration 1 — create accounts table

**Files:**
- Create: `supabase/migrations/20260508000001_create_accounts_table.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260508000001_create_accounts_table.sql
-- Create accounts table: the billing/tenancy unit.

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  accountadmin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seat_limit INTEGER NOT NULL DEFAULT 2 CHECK (seat_limit >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_status ON public.accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_accountadmin_user_id ON public.accounts(accountadmin_user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Permissive RLS for demo; tighten in follow-up spec.
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounts_all" ON public.accounts;
CREATE POLICY "accounts_all" ON public.accounts FOR ALL USING (true);
```

- [ ] **Step 2: Apply against staging Supabase**

Run via Supabase CLI or paste into the SQL editor. Verify with:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='accounts'
ORDER BY ordinal_position;
```

Expected: 7 rows matching the column list above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508000001_create_accounts_table.sql
git commit -m "feat(db): create accounts table for multi-tenancy"
```

---

### Task 2: Migration 2 — alter user_role enum

**Files:**
- Create: `supabase/migrations/20260508000002_alter_user_role_enum.sql`

- [ ] **Step 1: Write the migration**

The existing enum is `'Accountadmin', 'security_user', 'useradmin', 'user'`. We add `'Superadmin'` and migrate `security_user`/`useradmin` rows to `'user'`. The two unused values stay defined (Postgres can't drop enum values cleanly).

```sql
-- 20260508000002_alter_user_role_enum.sql
-- Add 'Superadmin' to user_role enum.
-- Migrate existing 'security_user' and 'useradmin' rows to 'user'.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Superadmin'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'Superadmin';
  END IF;
END$$;

UPDATE public.user_profiles
SET role = 'user'
WHERE role IN ('security_user', 'useradmin');
```

- [ ] **Step 2: Apply and verify**

```sql
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
ORDER BY enumsortorder;
```

Expected: `Accountadmin, security_user, useradmin, user, Superadmin` (the new value appended at the end).

```sql
SELECT role, count(*) FROM public.user_profiles GROUP BY role;
```

Expected: no rows with `role IN ('security_user', 'useradmin')`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508000002_alter_user_role_enum.sql
git commit -m "feat(db): add Superadmin role; migrate legacy roles to user"
```

---

### Task 3: Migration 3 — add account_id columns

**Files:**
- Create: `supabase/migrations/20260508000003_add_account_id_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260508000003_add_account_id_columns.sql
-- Add nullable account_id to user_profiles + every data table.
-- NOT NULL is enforced later (migration 5) after backfill.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.training_records
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.data_records
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.data_requests
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.breach_log
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.dpia_assessments
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.cross_border_transfers
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.dpo
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.processing_activities
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.system_logs
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Indexes for the filter that fires on every page load.
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_id ON public.user_profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_companies_account_id ON public.companies(account_id);
CREATE INDEX IF NOT EXISTS idx_vendors_account_id ON public.vendors(account_id);
CREATE INDEX IF NOT EXISTS idx_training_records_account_id ON public.training_records(account_id);
CREATE INDEX IF NOT EXISTS idx_data_records_account_id ON public.data_records(account_id);
CREATE INDEX IF NOT EXISTS idx_data_requests_account_id ON public.data_requests(account_id);
CREATE INDEX IF NOT EXISTS idx_breach_log_account_id ON public.breach_log(account_id);
CREATE INDEX IF NOT EXISTS idx_dpia_assessments_account_id ON public.dpia_assessments(account_id);
CREATE INDEX IF NOT EXISTS idx_cross_border_transfers_account_id ON public.cross_border_transfers(account_id);
CREATE INDEX IF NOT EXISTS idx_cases_account_id ON public.cases(account_id);
CREATE INDEX IF NOT EXISTS idx_alerts_account_id ON public.alerts(account_id);
CREATE INDEX IF NOT EXISTS idx_dpo_account_id ON public.dpo(account_id);
CREATE INDEX IF NOT EXISTS idx_processing_activities_account_id ON public.processing_activities(account_id);
CREATE INDEX IF NOT EXISTS idx_documents_account_id ON public.documents(account_id);
CREATE INDEX IF NOT EXISTS idx_team_members_account_id ON public.team_members(account_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_account_id ON public.system_logs(account_id);

-- companies is 1:1 with accounts for now; enforce uniqueness.
-- (drop the constraint later if a 1:many relationship is needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_account_id_unique'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_account_id_unique UNIQUE (account_id);
  END IF;
END$$;
```

- [ ] **Step 2: Apply and verify**

```sql
SELECT table_name FROM information_schema.columns
WHERE column_name = 'account_id' AND table_schema = 'public'
ORDER BY table_name;
```

Expected: 16 rows (the 15 data tables + `user_profiles`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508000003_add_account_id_columns.sql
git commit -m "feat(db): add nullable account_id to all data tables"
```

---

### Task 4: Migration 4 — backfill default account

**Files:**
- Create: `supabase/migrations/20260508000004_backfill_default_account.sql`

- [ ] **Step 1: Write the migration**

This migration is **deterministic**: it inserts "Default Account 1", points every existing data row at it, and assigns every existing `user_profiles` row to it. It does **not** auto-promote anyone to `Superadmin` — the operator runs a one-line UPDATE manually after migrations land.

```sql
-- 20260508000004_backfill_default_account.sql
-- Insert "Default Account 1" and assign all existing data rows to it.
-- Does NOT auto-promote anyone to Superadmin — operator runs manual SQL post-migrations.

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
```

- [ ] **Step 2: Apply and verify with SQL invariants**

```sql
SELECT 'vendors' AS t, count(*) FROM vendors WHERE account_id IS NULL
UNION ALL SELECT 'training_records', count(*) FROM training_records WHERE account_id IS NULL
UNION ALL SELECT 'data_records', count(*) FROM data_records WHERE account_id IS NULL
UNION ALL SELECT 'data_requests', count(*) FROM data_requests WHERE account_id IS NULL
UNION ALL SELECT 'breach_log', count(*) FROM breach_log WHERE account_id IS NULL
UNION ALL SELECT 'dpia_assessments', count(*) FROM dpia_assessments WHERE account_id IS NULL
UNION ALL SELECT 'cross_border_transfers', count(*) FROM cross_border_transfers WHERE account_id IS NULL
UNION ALL SELECT 'cases', count(*) FROM cases WHERE account_id IS NULL
UNION ALL SELECT 'alerts', count(*) FROM alerts WHERE account_id IS NULL
UNION ALL SELECT 'dpo', count(*) FROM dpo WHERE account_id IS NULL
UNION ALL SELECT 'processing_activities', count(*) FROM processing_activities WHERE account_id IS NULL
UNION ALL SELECT 'documents', count(*) FROM documents WHERE account_id IS NULL
UNION ALL SELECT 'team_members', count(*) FROM team_members WHERE account_id IS NULL
UNION ALL SELECT 'companies', count(*) FROM companies WHERE account_id IS NULL
UNION ALL SELECT 'system_logs', count(*) FROM system_logs WHERE account_id IS NULL
UNION ALL SELECT 'user_profiles_non_super', count(*) FROM user_profiles WHERE account_id IS NULL AND role <> 'Superadmin';
```

Expected: every count is 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508000004_backfill_default_account.sql
git commit -m "feat(db): backfill Default Account 1 across all data tables"
```

---

## Phase B — Frontend dual-write (still on legacy UI)

### Task 5: Add `getEffectiveAccountId()` and login state

**Files:**
- Modify: `js/app.js` — add helper near `getCurrentOrgId` (currently line 1620); populate state on login.

- [ ] **Step 1: Add the helper**

In `js/app.js`, add directly **after** the existing `getCurrentOrgId` function (around line 1623):

```js
// Returns the account_id to scope queries to.
// - Superadmin with no view-as: returns null (callers must handle this — only the Accounts page reads when null)
// - Superadmin with view-as: returns the picked account_id
// - Accountadmin / user: returns their pinned account_id
function getEffectiveAccountId() {
  if (state.role === 'Superadmin') return state.viewAsAccountId || null;
  return state.accountId || null;
}
```

- [ ] **Step 2: Add new state fields to the initial state declaration**

Find the `state` object literal near the top of `js/app.js` (search for `currentUserLevel: 'Accountadmin',`). Add these three fields next to it:

```js
  // Multi-tenant state (populated on login from user_profiles).
  role: null,           // 'Superadmin' | 'Accountadmin' | 'user'
  accountId: null,      // null only for Superadmin
  viewAsAccountId: null, // Superadmin override; persisted in localStorage
```

- [ ] **Step 3: Populate state.role / state.accountId on login**

Find the post-login handler. Search for `state.user = {` inside the login success path (around line 1064 or 1231). Immediately after the `state.user = {...}` assignment in the Supabase login path, add:

```js
// Populate multi-tenant state from user_profiles
const supabase = getSupabaseClient();
if (supabase && state.user?.id) {
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('role, account_id')
    .eq('id', state.user.id)
    .single();
  if (!profileErr && profile) {
    state.role = profile.role;
    state.accountId = profile.account_id;
    state.viewAsAccountId = localStorage.getItem('viewAsAccountId') || null;
    JARVIS_LOG.success('Auth', 'Profile loaded', { role: profile.role, accountId: profile.account_id });
  } else {
    JARVIS_LOG.error('Auth', 'Failed to load profile', profileErr || new Error('No profile row'));
  }
}
```

- [ ] **Step 4: Smoke test in browser**

Start the dev server (whatever the project uses — `python -m http.server 8060` or similar), open the app, log in. In the browser console:

```js
console.log({ role: state.role, accountId: state.accountId, viewAsAccountId: state.viewAsAccountId });
```

Expected: `{ role: 'Accountadmin', accountId: '00000000-0000-0000-0000-000000000001', viewAsAccountId: null }` — i.e. populated from `user_profiles` after the backfill.

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat(auth): populate state.role/accountId on login + getEffectiveAccountId helper"
```

---

### Task 6: Dual-write `account_id` alongside `org_id` in save helpers

**Files:**
- Modify: `js/vendor_logic.js` (line ~244 — save insert)
- Modify: `js/training_logic.js` — find the equivalent insert path
- Modify: `js/dpo_logic.js` — find the equivalent insert path
- Modify: `js/activities_logic.js` — find the equivalent insert path
- Modify: `js/app.js` — for `saveRecord`, `saveDataRequest`, `saveBreach`, `saveCase`, `saveCrossBorder`, `saveDpia` (search `.insert([{`)

For each save site that currently writes `org_id: orgId`, also write `account_id: getEffectiveAccountId()`. We do NOT remove the `org_id` write yet — that happens in Task 17 after enforcement.

- [ ] **Step 1: Update `js/vendor_logic.js` save site**

Find `.insert([{ ...vendorData, org_id: orgId }])` (around line 244) and replace with:

```js
.insert([{
  ...vendorData,
  org_id: orgId,
  account_id: (typeof getEffectiveAccountId === 'function') ? getEffectiveAccountId() : null
}]);
```

Repeat the same pattern at every UPDATE site in the file (search for `org_id`).

- [ ] **Step 2: Repeat for the other logic files**

Apply the identical pattern (`account_id: getEffectiveAccountId()` added to the insert/update payload) to every save site in:
- `js/training_logic.js`
- `js/dpo_logic.js`
- `js/activities_logic.js`

To find every site:

```bash
grep -nE "org_id: orgId|org_id\s*:\s*orgId|\.insert\(.*org_id|\.update\(.*org_id" js/*.js
```

For every match, add `account_id: getEffectiveAccountId()` to the same object literal.

- [ ] **Step 3: Repeat for `js/app.js` save sites**

Same grep pattern; same edit. Expect ~6–10 sites.

- [ ] **Step 4: Smoke test**

Log in, create a new vendor. In Supabase SQL editor:

```sql
SELECT id, org_id, account_id, name FROM vendors ORDER BY created_at DESC LIMIT 1;
```

Expected: the new row has BOTH `org_id` (legacy value) AND `account_id = '00000000-0000-0000-0000-000000000001'`.

- [ ] **Step 5: Commit**

```bash
git add js/
git commit -m "feat(frontend): dual-write account_id alongside org_id in save helpers"
```

---

### Task 7: Add `account_id` filter to load helpers

**Files:**
- Modify: `js/vendor_logic.js` line ~50 (the "NOTE: org_id filter intentionally removed" comment)
- Modify: `js/training_logic.js`, `js/dpo_logic.js`, `js/activities_logic.js` — equivalent comment sites
- Modify: `js/app.js` — every `loadXFromSupabase` function

For each load helper, add an `account_id` filter when `getEffectiveAccountId()` returns non-null. When it returns null (Superadmin without view-as on a data page — shouldn't happen post-Phase F because of pick-first model, but defensive), skip the filter.

- [ ] **Step 1: Update `js/vendor_logic.js` load helper**

Find the comment `// NOTE: org_id filter intentionally removed. Re-introduce when adding multi-tenancy` (around line 50). Replace the comment + the surrounding query with:

```js
async function loadVendorsFromSupabase() {
  const supabase = getSupabaseClient();
  if (!supabase || !isSupabaseConfigured()) return readLocalVendors();
  try {
    const accountId = (typeof getEffectiveAccountId === 'function') ? getEffectiveAccountId() : null;
    let query = supabase.from('vendors').select('*');
    if (accountId) query = query.eq('account_id', accountId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) {
      JARVIS_LOG.error('Vendors', 'Load from Supabase', error);
      return readLocalVendors();
    }
    state.vendors = (data || []).map(normalizeVendorRecord);
    renderVendors(state.vendors);
    return state.vendors;
  } catch (err) {
    JARVIS_LOG.error('Vendors', 'Load from Supabase exception', err);
    return readLocalVendors();
  }
}
```

(Adjust to match the exact existing function signature/body — keep helper imports intact.)

- [ ] **Step 2: Apply the same `account_id` filter pattern to every other load helper**

To find them:

```bash
grep -nE "loadFromSupabase|^async function load[A-Z].*FromSupabase" js/*.js
```

For each one, change `supabase.from('<table>').select('*')` into the conditional-filter pattern from Step 1 (`if (accountId) query = query.eq('account_id', accountId)`). Do NOT remove any existing filters; just add this one.

- [ ] **Step 3: Smoke test**

In the browser:
1. Log in (as Accountadmin of Default Account 1 — pre-promotion).
2. Open Vendors page. All current vendors should still appear (they were backfilled to Default Account 1).
3. In the Network tab, confirm the request to `/rest/v1/vendors` includes `account_id=eq.00000000-0000-0000-0000-000000000001`.

- [ ] **Step 4: Commit**

```bash
git add js/
git commit -m "feat(frontend): scope every load helper by account_id"
```

---

## Phase C — SQL invariants gate

### Task 8: Run SQL invariants and gate the rollout

**Files:** none (pure verification — output captured in PR/deploy log)

- [ ] **Step 1: Run the invariants query against staging**

Execute the full UNION ALL query from Task 4 Step 2.

- [ ] **Step 2: Confirm every count is zero**

If any non-zero, halt. Investigate the offending table — likely a row that was created between migrations 3 and 4 without `account_id`. Remediation: a one-off `UPDATE <table> SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL`, then re-run the invariants.

- [ ] **Step 3: No commit needed — just record the result in the deploy log**

---

## Phase D — Migration 5 (enforce NOT NULL)

### Task 9: Migration 5 — make account_id required

**Files:**
- Create: `supabase/migrations/20260508000005_make_account_id_required.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

```sql
SELECT table_name, is_nullable
FROM information_schema.columns
WHERE column_name = 'account_id' AND table_schema = 'public'
ORDER BY table_name;
```

Expected: every data table reports `is_nullable = 'NO'`. Only `user_profiles` and `system_logs` should report `'YES'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508000005_make_account_id_required.sql
git commit -m "feat(db): enforce account_id NOT NULL on data tables"
```

---

## Phase E — Migration 6 (drop legacy activity_log)

### Task 10: Migration 6 — drop activity_log table

**Files:**
- Create: `supabase/migrations/20260508000006_drop_activity_log.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260508000006_drop_activity_log.sql
-- Drop the legacy activity_log table.
-- system_logs (written by JARVIS_LOG) is the canonical audit table going forward.

DROP TABLE IF EXISTS public.activity_log CASCADE;
```

- [ ] **Step 2: Apply and verify**

```sql
SELECT to_regclass('public.activity_log');
```

Expected: `NULL`.

Also confirm no JS reads from `activity_log`:

```bash
grep -rn "activity_log\|from('activity_log')" js/ pages/
```

Expected: no matches (or only matches you can prove are dead code; remove them in this commit if found).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508000006_drop_activity_log.sql
git commit -m "feat(db): drop legacy activity_log; system_logs is canonical"
```

---

## Phase F — Edge Function + Superadmin UI

### Task 11: Edge Function — `create-user`

**Files:**
- Create: `supabase/functions/create-user/index.ts`
- Create: `supabase/functions/create-user/deno.json` (minimal)

- [ ] **Step 1: Scaffold the function**

```bash
supabase functions new create-user
```

- [ ] **Step 2: Write `supabase/functions/create-user/index.ts`**

```ts
// supabase/functions/create-user/index.ts
// One Edge Function, two modes:
//   mode='account' — Superadmin creates a new account + Accountadmin user
//   mode='user'    — Accountadmin invites a User into their own account
//
// Atomicity: best-effort rollback. If a step fails, the function attempts to
// delete the auth user / accounts row that was already created.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface AccountModeBody {
  mode: 'account';
  email: string;
  temp_password: string;
  company_name: string;
  seat_limit?: number;
  seed_sample_data?: boolean;
}
interface UserModeBody {
  mode: 'user';
  email: string;
  temp_password: string;
  account_id: string;
}
type Body = AccountModeBody | UserModeBody;

serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  // CORS preflight handled by Supabase platform; for explicit headers see docs.
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const callerJwt = auth.slice('Bearer '.length);
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } },
  });
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !caller) return json({ error: 'Invalid caller token' }, 401);

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: callerProfile, error: profileErr } = await adminClient
    .from('user_profiles')
    .select('role, account_id')
    .eq('id', caller.id)
    .single();
  if (profileErr || !callerProfile) return json({ error: 'Caller has no profile' }, 403);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (body.mode === 'account') {
    if (callerProfile.role !== 'Superadmin') return json({ error: 'Superadmin only' }, 403);
    return await createAccount(adminClient, body);
  }
  if (body.mode === 'user') {
    const isSuper = callerProfile.role === 'Superadmin';
    const isOwnAdmin = callerProfile.role === 'Accountadmin' && callerProfile.account_id === body.account_id;
    if (!isSuper && !isOwnAdmin) return json({ error: 'Not authorized for this account' }, 403);
    return await createUser(adminClient, body);
  }
  return json({ error: 'Unknown mode' }, 400);
});

async function createAccount(admin: ReturnType<typeof createClient>, body: AccountModeBody) {
  const { data: account, error: acctErr } = await admin.from('accounts').insert({
    name: body.company_name,
    seat_limit: body.seat_limit ?? 2,
    status: 'active',
  }).select().single();
  if (acctErr || !account) return json({ error: 'Account insert failed', detail: acctErr?.message }, 500);

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.temp_password,
    email_confirm: true,
  });
  if (authErr || !authUser?.user) {
    await admin.from('accounts').delete().eq('id', account.id);
    const code = authErr?.message?.includes('already') ? 409 : 500;
    return json({ error: 'Auth user create failed', detail: authErr?.message }, code);
  }

  const { error: profileInsErr } = await admin.from('user_profiles').insert({
    id: authUser.user.id,
    email: body.email,
    role: 'Accountadmin',
    account_id: account.id,
  });
  if (profileInsErr) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    await admin.from('accounts').delete().eq('id', account.id);
    return json({ error: 'Profile insert failed', detail: profileInsErr.message }, 500);
  }

  await admin.from('accounts').update({ accountadmin_user_id: authUser.user.id }).eq('id', account.id);
  await admin.from('companies').insert({ name: body.company_name, account_id: account.id });

  if (body.seed_sample_data) {
    // Sample data seeding is left as a server-side TODO marker — implement by
    // porting js/sample_data.js payloads into a SQL function or inline inserts
    // here, all tagged with account_id = account.id. For now we no-op rather
    // than ship partial seeding.
  }

  return json({
    account_id: account.id,
    user_id: authUser.user.id,
    email: body.email,
    temp_password: body.temp_password,
  }, 200);
}

async function createUser(admin: ReturnType<typeof createClient>, body: UserModeBody) {
  const { data: account, error: acctErr } = await admin
    .from('accounts').select('seat_limit').eq('id', body.account_id).single();
  if (acctErr || !account) return json({ error: 'Account not found' }, 404);

  const { count, error: countErr } = await admin
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', body.account_id);
  if (countErr) return json({ error: 'Seat count failed', detail: countErr.message }, 500);
  if ((count ?? 0) >= account.seat_limit) return json({ error: 'Seat limit reached' }, 402);

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.temp_password,
    email_confirm: true,
  });
  if (authErr || !authUser?.user) {
    const code = authErr?.message?.includes('already') ? 409 : 500;
    return json({ error: 'Auth user create failed', detail: authErr?.message }, code);
  }

  const { error: profileInsErr } = await admin.from('user_profiles').insert({
    id: authUser.user.id,
    email: body.email,
    role: 'user',
    account_id: body.account_id,
  });
  if (profileInsErr) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return json({ error: 'Profile insert failed', detail: profileInsErr.message }, 500);
  }

  return json({
    user_id: authUser.user.id,
    email: body.email,
    temp_password: body.temp_password,
  }, 200);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 3: Deploy**

```bash
supabase functions deploy create-user --project-ref <project-ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

(`SUPABASE_URL` and `SUPABASE_ANON_KEY` are auto-injected by the platform.)

- [ ] **Step 4: Smoke test the function from the command line**

First, get a caller JWT (log into the app, copy `localStorage.getItem('sb-<ref>-auth-token')` → parse JSON → access_token field — or use `supabase.auth.signInWithPassword` from a script).

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/create-user" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"mode":"account","email":"test1@acme.com","temp_password":"Test1234!","company_name":"Acme Pte Ltd","seat_limit":2}'
```

Expected (caller is Superadmin): `200` with `{ account_id, user_id, email, temp_password }`.

If caller is not Superadmin: `403`.

If email already exists: `409`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-user/
git commit -m "feat(edge): create-user function for Superadmin + Accountadmin flows"
```

---

### Task 12: Superadmin Accounts page (markup + logic)

**Files:**
- Create: `pages/20__accounts.html`
- Create: `js/superadmin_logic.js`
- Modify: `js/app.js` — register the new page in the router/nav system; load `superadmin_logic.js`

- [ ] **Step 1: Look at an existing page for the markup pattern**

```bash
sed -n '1,60p' pages/13__vendors.html
```

Match that exact wrapper structure (page container, header, etc.).

- [ ] **Step 2: Write `pages/20__accounts.html`**

```html
<section class="page" id="page-accounts" data-page="accounts">
  <header class="page-head">
    <div class="page-head-text">
      <h1>Accounts</h1>
      <p class="page-sub">All customer accounts. Click an account to view as.</p>
    </div>
    <div class="page-head-actions">
      <button id="btn-new-account" class="btn-primary">+ New account</button>
    </div>
  </header>

  <div class="stat-row" id="account-stats">
    <div class="stat-card"><div class="stat-num" id="stat-total">–</div><div class="stat-label">Total</div></div>
    <div class="stat-card"><div class="stat-num" id="stat-active">–</div><div class="stat-label">Active</div></div>
    <div class="stat-card"><div class="stat-num" id="stat-seats">–</div><div class="stat-label">Seats used</div></div>
    <div class="stat-card"><div class="stat-num" id="stat-suspended">–</div><div class="stat-label">Suspended</div></div>
  </div>

  <div class="filter-row">
    <input type="search" id="account-search" placeholder="Search by name or admin email" />
    <select id="account-status-filter">
      <option value="all">All</option>
      <option value="active">Active</option>
      <option value="suspended">Suspended</option>
    </select>
  </div>

  <div id="accounts-list" class="card-list" aria-live="polite"></div>
</section>

<!-- New-account modal -->
<div class="modal" id="modal-new-account" aria-hidden="true">
  <div class="modal-card">
    <header><h2>New account</h2><button class="modal-close" data-close="modal-new-account">×</button></header>
    <form id="form-new-account">
      <label>Company name <input name="company_name" required /></label>
      <label>Accountadmin email <input name="email" type="email" required /></label>
      <label>Temporary password <input name="temp_password" required minlength="8" /></label>
      <label>Seat limit <input name="seat_limit" type="number" min="1" value="2" required /></label>
      <label class="checkbox-row"><input name="seed_sample_data" type="checkbox" /> Seed sample data</label>
      <footer><button type="submit" class="btn-primary">Create</button></footer>
    </form>
  </div>
</div>
```

- [ ] **Step 3: Write `js/superadmin_logic.js`**

```js
/* superadmin_logic.js — Accounts page (Superadmin only) */

async function loadAccounts() {
  if (state.role !== 'Superadmin') return;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    JARVIS_LOG.error('Accounts', 'Load', error);
    return;
  }

  // Per-account seat usage (count user_profiles per account_id).
  const ids = accounts.map(a => a.id);
  const { data: counts } = await supabase
    .from('user_profiles')
    .select('account_id')
    .in('account_id', ids);
  const seatUsage = (counts || []).reduce((m, r) => {
    m[r.account_id] = (m[r.account_id] || 0) + 1;
    return m;
  }, {});

  renderAccountStats(accounts, seatUsage);
  renderAccountsList(accounts, seatUsage);
}

function renderAccountStats(accounts, seatUsage) {
  const total = accounts.length;
  const active = accounts.filter(a => a.status === 'active').length;
  const suspended = accounts.filter(a => a.status === 'suspended').length;
  const seatsUsed = Object.values(seatUsage).reduce((a, b) => a + b, 0);
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-seats').textContent = seatsUsed;
  document.getElementById('stat-suspended').textContent = suspended;
}

function renderAccountsList(accounts, seatUsage) {
  const list = document.getElementById('accounts-list');
  const search = (document.getElementById('account-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('account-status-filter')?.value || 'all';
  const filtered = accounts.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search && !a.name.toLowerCase().includes(search)) return false;
    return true;
  });
  list.innerHTML = filtered.map(a => `
    <article class="account-row" data-id="${a.id}">
      <div class="account-name">${escapeHtml(a.name)}</div>
      <div class="account-meta">
        ${seatUsage[a.id] || 0}/${a.seat_limit} seats · ${a.status}
      </div>
      <div class="account-actions">
        <button class="btn-secondary" data-action="view-as" data-id="${a.id}">View as</button>
        <button class="btn-secondary" data-action="edit-seats" data-id="${a.id}">Edit seats</button>
        <button class="btn-secondary" data-action="${a.status === 'active' ? 'suspend' : 'reactivate'}" data-id="${a.id}">
          ${a.status === 'active' ? 'Suspend' : 'Reactivate'}
        </button>
        <button class="btn-danger" data-action="delete" data-id="${a.id}">Delete</button>
      </div>
    </article>
  `).join('');
}

function enterViewAs(accountId) {
  state.viewAsAccountId = accountId;
  localStorage.setItem('viewAsAccountId', accountId);
  renderViewAsBanner();
  navigateTo('dashboard');
}

function exitViewAs() {
  state.viewAsAccountId = null;
  localStorage.removeItem('viewAsAccountId');
  renderViewAsBanner();
  navigateTo('accounts');
}

async function createAccountFromForm(formEl) {
  const fd = new FormData(formEl);
  const body = {
    mode: 'account',
    email: fd.get('email'),
    temp_password: fd.get('temp_password'),
    company_name: fd.get('company_name'),
    seat_limit: Number(fd.get('seat_limit')),
    seed_sample_data: fd.get('seed_sample_data') === 'on',
  };
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  if (!res.ok) {
    showToast(out.error || 'Failed to create account', 'error');
    return;
  }
  showToast(`Created. Email: ${out.email}  Password: ${out.temp_password}`, 'success');
  closeModal('modal-new-account');
  await loadAccounts();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Wire DOM events.
document.addEventListener('click', (e) => {
  const action = e.target?.dataset?.action;
  if (!action) return;
  const id = e.target.dataset.id;
  if (action === 'view-as') enterViewAs(id);
  else if (action === 'suspend') updateAccountStatus(id, 'suspended');
  else if (action === 'reactivate') updateAccountStatus(id, 'active');
  else if (action === 'edit-seats') openEditSeatsModal(id);
  else if (action === 'delete') openDeleteAccountModal(id);
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'form-new-account') {
    e.preventDefault();
    createAccountFromForm(e.target);
  }
});

async function updateAccountStatus(accountId, status) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('accounts').update({ status }).eq('id', accountId);
  if (error) { showToast('Update failed', 'error'); return; }
  await loadAccounts();
}

function openEditSeatsModal(accountId) {
  const next = window.prompt('New seat limit (>=1):');
  if (!next) return;
  const n = parseInt(next, 10);
  if (!n || n < 1) { showToast('Invalid value', 'error'); return; }
  const supabase = getSupabaseClient();
  supabase.from('accounts').update({ seat_limit: n }).eq('id', accountId)
    .then(({ error }) => {
      if (error) showToast('Update failed', 'error');
      else loadAccounts();
    });
}

function openDeleteAccountModal(accountId) {
  // Find the account row for the typed-confirm message.
  const row = document.querySelector(`.account-row[data-id="${accountId}"]`);
  const name = row?.querySelector('.account-name')?.textContent || 'this account';
  const typed = window.prompt(`Type the account name to confirm deletion:\n${name}`);
  if (typed !== name) { showToast('Cancelled', 'info'); return; }
  const supabase = getSupabaseClient();
  supabase.from('accounts').delete().eq('id', accountId)
    .then(({ error }) => {
      if (error) showToast('Delete failed', 'error');
      else loadAccounts();
    });
}
```

- [ ] **Step 4: Wire the page into `js/app.js`**

Find the page-router (search for the existing `if (pageId === 'vendors' && typeof loadVendorsFromSupabase === 'function')` block around line 824). Add:

```js
if (pageId === 'accounts' && typeof loadAccounts === 'function') loadAccounts();
```

Add `<script src="js/superadmin_logic.js"></script>` to the main HTML shell (`index.html` or whatever is the entry; match existing pattern from `vendor_logic.js`).

Add a nav entry for Accounts gated on Superadmin role. Find the nav rendering (search for `applyNavPermissions`); add an `accounts` permission key controlled by `state.role === 'Superadmin'`.

- [ ] **Step 5: Smoke test**

1. Open the app, log in as Tyson (still Accountadmin pre-promotion).
2. In SQL editor, run promotion: `UPDATE user_profiles SET role='Superadmin', account_id=NULL WHERE id='<tyson uid>';`
3. Refresh. Sidebar shows "Accounts" link. Click it.
4. Page loads with "Default Account 1" listed.
5. Click "+ New account", fill in `Acme Pte Ltd` / `test1@acme.com` / `Test1234!` / `2`. Submit. Toast shows credentials.

- [ ] **Step 6: Commit**

```bash
git add pages/20__accounts.html js/superadmin_logic.js js/app.js
git commit -m "feat(ui): Superadmin Accounts page + create-account modal"
```

---

### Task 13: View-as banner

**Files:**
- Modify: `js/app.js` — add `renderViewAsBanner()` and call it on every navigation
- Modify: `index.html` (or main shell) — add a banner container element

- [ ] **Step 1: Add the banner container in the main shell**

In the body of the main HTML shell, immediately above the page container, add:

```html
<div id="view-as-banner" class="view-as-banner" hidden></div>
```

- [ ] **Step 2: Add `renderViewAsBanner()` to `js/app.js`**

```js
function renderViewAsBanner() {
  const banner = document.getElementById('view-as-banner');
  if (!banner) return;
  if (!state.viewAsAccountId) {
    banner.hidden = true;
    banner.innerHTML = '';
    return;
  }
  // Best-effort: we have the id; ask Supabase for the name (cached).
  const cached = state._viewAsAccountName;
  if (cached && cached.id === state.viewAsAccountId) {
    paint(cached.name);
    return;
  }
  const supabase = getSupabaseClient();
  if (!supabase) return paint('account');
  supabase.from('accounts').select('name').eq('id', state.viewAsAccountId).single()
    .then(({ data }) => {
      state._viewAsAccountName = { id: state.viewAsAccountId, name: data?.name || 'account' };
      paint(state._viewAsAccountName.name);
    });
  function paint(name) {
    banner.hidden = false;
    banner.innerHTML = `👁 Viewing as <strong>${name}</strong> · <button id="btn-exit-view-as">Exit view-as</button>`;
  }
}

document.addEventListener('click', (e) => {
  if (e.target?.id === 'btn-exit-view-as') exitViewAs();
});
```

- [ ] **Step 3: Call `renderViewAsBanner()` at boot and on every navigation**

In the existing `navigateTo` function (search for `function navigateTo`), call `renderViewAsBanner()` at the end. Also call it once at the end of the boot sequence (after `state.role` / `state.viewAsAccountId` are populated in Task 5).

- [ ] **Step 4: Smoke test**

Click "View as" on Default Account 1 in the Accounts page. Expected:
- Banner appears: `👁 Viewing as Default Account 1 · [Exit view-as]`
- Dashboard loads showing legacy data.
- Refresh — banner persists (because `viewAsAccountId` is in localStorage).
- Click "Exit view-as" — banner hides; back to `/accounts`.

- [ ] **Step 5: Commit**

```bash
git add js/app.js index.html
git commit -m "feat(ui): view-as banner with localStorage persistence"
```

---

### Task 14: Login routing + suspended account handling

**Files:**
- Modify: `js/app.js` — post-login routing branch added in Task 5

- [ ] **Step 1: Extend the post-login flow to check status and route**

After the `state.role` / `state.accountId` populate from Task 5, add (immediately following):

```js
// Check account status (Accountadmin/user only — Superadmin has no account).
if (state.role !== 'Superadmin' && state.accountId) {
  const { data: acct } = await supabase.from('accounts').select('status').eq('id', state.accountId).single();
  if (acct?.status === 'suspended') {
    await supabase.auth.signOut();
    state.user = { name: '', company: '', email: '' };
    state.role = null;
    state.accountId = null;
    showToast('Your account is suspended — contact support', 'error');
    navigateTo('login');
    return;
  }
}

// Route by role.
if (state.role === 'Superadmin') {
  navigateTo('accounts');
} else {
  navigateTo('dashboard');
}
```

- [ ] **Step 2: Smoke test**

1. Login as Superadmin → lands on `/accounts`.
2. Login as Accountadmin → lands on `/dashboard`.
3. In SQL: `UPDATE accounts SET status='suspended' WHERE id='<acct id>';`. Login as that account's Accountadmin → lands back on login with toast: "Your account is suspended — contact support".
4. Restore: `UPDATE accounts SET status='active' WHERE ...;` to reset.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat(auth): role-based post-login routing + suspended-account block"
```

---

### Task 15: Access page seat chip + gated "+ Add user"

**Files:**
- Modify: `pages/06__access.html` — add seat chip + "+ Add user" button
- Modify: `js/app.js` — implement `loadSeatUsage()` and `addUser(email, password)` calling the Edge Function

- [ ] **Step 1: Add the seat chip + button to `pages/06__access.html`**

Find the existing access-page header (open the file and locate the `<header>`/title block). Add inside it:

```html
<div class="seat-chip">
  Seats: <span id="seat-current">–</span> / <span id="seat-limit">–</span>
</div>
<button id="btn-add-user" class="btn-primary">+ Add user</button>
```

- [ ] **Step 2: Add the seat-loader to `js/app.js`**

```js
async function loadSeatUsage() {
  if (state.role === 'Superadmin' && !state.viewAsAccountId) return; // not on a per-account view
  const accountId = getEffectiveAccountId();
  if (!accountId) return;
  const supabase = getSupabaseClient();
  const { data: account } = await supabase
    .from('accounts').select('seat_limit').eq('id', accountId).single();
  const { count } = await supabase
    .from('user_profiles').select('id', { count: 'exact', head: true }).eq('account_id', accountId);
  const limit = account?.seat_limit ?? 0;
  const current = count ?? 0;
  const limitEl = document.getElementById('seat-limit');
  const curEl = document.getElementById('seat-current');
  const btn = document.getElementById('btn-add-user');
  if (limitEl) limitEl.textContent = limit;
  if (curEl) curEl.textContent = current;
  if (btn) {
    btn.disabled = current >= limit;
    btn.title = btn.disabled ? 'Upgrade to add more seats. Contact support.' : '';
  }
}
```

Call it from the access-page render path (search for the existing handler that fires when page=`access`).

- [ ] **Step 3: Wire "+ Add user" to the Edge Function**

Add to `js/app.js`:

```js
async function addUserPrompt() {
  const email = window.prompt('User email:');
  if (!email) return;
  const temp = window.prompt('Temporary password (min 8 chars):');
  if (!temp || temp.length < 8) { showToast('Password too short', 'error'); return; }
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const accountId = getEffectiveAccountId();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'user', email, temp_password: temp, account_id: accountId }),
  });
  const out = await res.json();
  if (!res.ok) {
    if (res.status === 402) showToast('Seat limit reached. Upgrade to add more users.', 'error');
    else showToast(out.error || 'Failed to add user', 'error');
    return;
  }
  showToast(`Added. Share: ${out.email} / ${out.temp_password}`, 'success');
  await loadSeatUsage();
}

document.addEventListener('click', (e) => {
  if (e.target?.id === 'btn-add-user') addUserPrompt();
});
```

- [ ] **Step 4: Smoke test**

Log in as the Accountadmin of Acme Pte Ltd (created in Task 12). Open the Access page. Expected:
- Chip shows `Seats: 1 / 2`.
- Click "+ Add user", supply `john@acme.com` / `password123`. Toast: "Added. Share: ...".
- Refresh — chip shows `Seats: 2 / 2`. Button is disabled.
- Click "+ Add user" anyway (if not disabled — direct call). Expect toast: "Seat limit reached. Upgrade to add more users."

- [ ] **Step 5: Commit**

```bash
git add pages/06__access.html js/app.js
git commit -m "feat(access): seat chip + seat-gated invite via Edge Function"
```

---

### Task 16: Dashboard "User activity" card

**Files:**
- Modify: `pages/00__dashboard.html` — add the markup
- Modify: `js/app.js` — extend `loadDashboardFromSupabase` (or whatever currently exists) to populate the card

- [ ] **Step 1: Add markup to the dashboard page**

Inside the existing dashboard grid, add:

```html
<section class="dash-card" id="user-activity-card">
  <header><h3>User activity</h3></header>
  <ul id="user-activity-list" class="activity-list"></ul>
  <footer><a href="#/audit" class="link">View all activity →</a></footer>
</section>
```

- [ ] **Step 2: Populate it from `system_logs`**

Add to `js/app.js` (or to `loadDashboardFromSupabase` if it already exists):

```js
async function loadDashboardActivity() {
  const accountId = getEffectiveAccountId();
  if (!accountId) return; // Only Accountadmin/user OR Superadmin in view-as mode.
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('system_logs')
    .select('action, component, user_email, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) { JARVIS_LOG.error('Dashboard', 'Activity load', error); return; }
  const list = document.getElementById('user-activity-list');
  if (!list) return;
  list.innerHTML = (data || []).map(r => `
    <li>
      <span class="activity-user">${escapeHtml(r.user_email || 'someone')}</span>
      <span class="activity-action">${escapeHtml(r.action)} · ${escapeHtml(r.component)}</span>
      <span class="activity-time">${timeAgo(r.created_at)}</span>
    </li>
  `).join('');
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
```

Call `loadDashboardActivity()` from the dashboard page-load path.

- [ ] **Step 3: Smoke test**

Log in as Accountadmin. Open Dashboard. Expected:
- "User activity" card appears with up to 5 recent rows.
- Each row shows user_email + action + relative time.

- [ ] **Step 4: Commit**

```bash
git add pages/00__dashboard.html js/app.js
git commit -m "feat(dashboard): user activity card sourced from system_logs"
```

---

### Task 17: Drop org_id writes from frontend

**Files:**
- Modify: `js/vendor_logic.js`, `js/training_logic.js`, `js/dpo_logic.js`, `js/activities_logic.js`, `js/app.js` — remove the `org_id: orgId` field from every insert/update; remove the `getCurrentOrgId()` calls that only feed those writes.

- [ ] **Step 1: Find every `org_id` write site**

```bash
grep -nE "org_id\s*:\s*orgId|org_id\s*:\s*getCurrentOrgId" js/*.js
```

For each match, remove that key/value pair from the object literal. Leave `account_id: getEffectiveAccountId()` untouched.

- [ ] **Step 2: Remove the now-unused `orgId` local declarations**

If a function had:

```js
const orgId = (typeof getCurrentOrgId === 'function') ? getCurrentOrgId() : (state.user?.id || null);
```

…and `orgId` is no longer referenced anywhere in the function, remove that line too.

`getCurrentOrgId` itself stays in `app.js` until migration 7 is run — keep it defined to avoid breaking any callers we might have missed.

- [ ] **Step 3: Smoke test**

Create a new vendor. In SQL:

```sql
SELECT org_id, account_id FROM vendors ORDER BY created_at DESC LIMIT 1;
```

Expected: `org_id IS NULL` (or the legacy default), `account_id` matches the current account.

Re-load the vendors list — all rows still appear (the load filter uses `account_id`, not `org_id`).

- [ ] **Step 4: Commit**

```bash
git add js/
git commit -m "refactor(frontend): drop org_id writes; account_id is canonical"
```

---

## Phase G — Manual smoke checklist

### Task 18: Smoke checklist document and execution

**Files:**
- Create: `docs/multi-tenant-smoke.md`

- [ ] **Step 1: Write the smoke checklist**

```markdown
# Multi-tenant smoke checklist

Run this against staging **after** Phase F (full Superadmin UI deployed). Expected: all 12 steps pass.

| # | Step | Expected |
|---|---|---|
| 1 | Run migrations 1–6 | All succeed |
| 2 | Run promotion SQL: `UPDATE user_profiles SET role='Superadmin', account_id=NULL WHERE id='<tyson uid>'` | One row updated |
| 3 | Tyson logs in | Lands on /accounts; sees Default Account 1 |
| 4 | Click "+ New account" → fill in `Acme Pte Ltd / test1@acme.com / Test1234! / 2` | Toast shows credentials; new row in `accounts`; new auth user; `companies` row created |
| 5 | Log out → log in as `test1@acme.com` | Lands on /dashboard; legacy nav unchanged; no Accounts link in sidebar |
| 6 | Open Access page | Seat chip "1 / 2"; "+ Add user" enabled |
| 7 | Click "+ Add user" → `john@acme.com / password123` | Toast: Added. Chip flips to 2/2. |
| 8 | Try "+ Add user" again | Toast: "Seat limit reached" (or button disabled) |
| 9 | Log out → log in as `john@acme.com` | Lands on /dashboard; nav respects `permissions` JSON; no Access page |
| 10 | Log out → log in as Tyson → click "View as Default Account 1" | Banner appears; Dashboard shows legacy data; "Exit view-as" returns to /accounts |
| 11 | Tyson: suspend Acme Pte Ltd | `accounts.status='suspended'`. Log in as `test1@acme.com` → toast "Your account is suspended"; redirect to login |
| 12 | Tyson: delete Acme Pte Ltd (typed-confirm modal) | All `account_id`-tagged rows for Acme are gone; auth users deleted |
```

- [ ] **Step 2: Execute the checklist against staging and record results**

Open the file, work through each row, mark pass/fail. Any fail → halt the rollout, file an issue, fix, re-run from the failing row.

- [ ] **Step 3: Commit the checklist**

```bash
git add docs/multi-tenant-smoke.md
git commit -m "docs: multi-tenant manual smoke checklist"
```

---

## Phase H — Cleanup (deferred)

### Task 19: Migration 7 — drop org_id (deferred)

**Files:**
- Create: `supabase/migrations/20260508000007_drop_org_id.sql`

This migration is checked into the repo but **not** applied during the initial rollout. Apply it only after all production traffic has been verified to read/write `account_id` exclusively for at least one full review cycle.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Pre-apply verification**

```bash
grep -rn "org_id" js/ pages/ supabase/functions/
```

Expected: zero matches. If any match remains, fix it first.

- [ ] **Step 3: Commit (without applying)**

```bash
git add supabase/migrations/20260508000007_drop_org_id.sql
git commit -m "feat(db): deferred migration to drop legacy org_id columns"
```

The migration file is in version control and will be picked up the next time `supabase db push` runs against an environment — so don't push to production until you're ready.

Also remove the `getCurrentOrgId` function from `js/app.js` at the same time, after grep confirms zero callers.

---

## Self-Review

**1. Spec coverage:**
- §1 Data model → Tasks 1, 3 (accounts table + account_id columns)
- §1 Role enum collapse → Task 2
- §2 Login flow + getEffectiveAccountId → Task 5
- §2 Pick-first Superadmin → Tasks 5, 13, 14 (state, banner, routing)
- §2 Account creation Edge Function → Task 11
- §2 User invitation flow → Tasks 11, 15
- §2 View-as / impersonation → Task 13
- §3 Superadmin Accounts page → Task 12
- §3 Accountadmin dashboard activity card → Task 16
- §3 Access page seat chip + gated invite → Task 15
- §3 Login routing → Task 14
- §4 Migrations 1–7 → Tasks 1, 2, 3, 4, 9, 10, 19
- §4 Phased rollout → Tasks split by phase header (A/B/C/D/E/F/G/H)
- §4 SQL invariants → Tasks 4, 8
- §4 Smoke checklist → Task 18
- §4 Frontend dual-write then drop → Tasks 6 (add), 17 (drop)

Coverage looks complete.

**2. Placeholder scan:** The Edge Function's sample-data seeding is intentionally a no-op with an inline comment explaining why (porting `js/sample_data.js` into SQL is a separate concern). All other code blocks contain runnable code. No "TBD"/"TODO" markers in steps.

**3. Type / signature consistency:**
- `getEffectiveAccountId()` defined in Task 5; used in Tasks 6, 7, 15, 16, 17. Name matches.
- `loadAccounts()`, `enterViewAs()`, `exitViewAs()` defined in Task 12; called in Task 13. Names match.
- `renderViewAsBanner()` defined in Task 13; called from Task 12 (`enterViewAs`/`exitViewAs`). Names match.
- Edge Function input contract used identically in Tasks 12 (mode='account') and 15 (mode='user').
- Role string values: `'Superadmin'` (capital S), `'Accountadmin'` (capital A), `'user'` (lowercase) used consistently per the spec.
