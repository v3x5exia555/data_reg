# Account-Admin Scoping Lock-Down — Design

Status: Draft for review
Date: 2026-05-09
Owner: Tyson Chua

## Problem

`Accountadmin` users can currently read data belonging to other tenants:

- The People page query (`loadAllPeople()` in `js/app.js:4596`) fetches `user_profiles` with no `account_id` filter, so an Accountadmin sees every tenant's staff.
- Every account-scoped table has Row Level Security policies of the form `USING (true)` (`supabase/migrations/20260505000005_global_rls_audit.sql`). All scoping today is client-side; a logged-in Accountadmin can call `supabase.from('<table>').select()` directly with their JWT and read every tenant's rows.
- The `accounts` table itself has `accounts_all USING (true)`, so Accountadmins can list every tenant.
- The `create-user` edge function uses the service role key and does not verify that the caller's `account_id` matches the target user's `account_id`, so an Accountadmin could reset another tenant's user's password by calling the function directly.

## Goal

`Accountadmin` and `user` roles can only read or write data whose `account_id` equals their own. `Superadmin` keeps full visibility (the existing `viewAsAccountId` UI remains a client-side convenience filter). Enforcement moves into Supabase RLS so a malicious or buggy client cannot bypass it. Edge functions enforce the same scope on privileged operations.

## Non-goals

- Changing the multi-tenant data model (the `account_id` columns and the existence of `accounts` are pre-existing).
- Re-architecting auth (no JWT custom claims; policies look up `user_profiles` per query via SECURITY DEFINER helpers).
- Locking Superadmin to a specific `viewAsAccountId` server-side. Superadmin remains "sees everything always".
- Column-level grants (e.g. preventing an Accountadmin from editing `accounts.seat_limit`). Out of scope; can be a follow-up.

## Approach

One forward-only migration replaces every permissive RLS policy with role-aware policies that read the caller's role and account_id from `public.user_profiles`. A second test-only migration impersonates two synthetic Accountadmins via `request.jwt.claims` and aborts the deploy if any cross-account read or write succeeds. Client and edge-function patches close the remaining gaps that RLS alone cannot.

## Components

### 1. SECURITY DEFINER helper functions

Created once in the lock-down migration. Wrap `user_profiles` lookups so policies stay legible and so the lookup itself bypasses the new RLS on `user_profiles`.

```sql
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
```

`EXECUTE` granted to `authenticated`, revoked from `PUBLIC`. `STABLE` lets the planner cache results within a single statement.

### 2. Uniform per-table policies (DO loop)

Applied via a `DO` block that iterates the same array used by `add_account_id_columns.sql` and `global_rls_audit.sql`. Replaces the four permissive policies with four scoped ones:

```sql
CREATE POLICY "<t>_select" ON <t> FOR SELECT
  USING ( public.auth_is_superadmin()
       OR account_id = public.auth_current_account_id() );

CREATE POLICY "<t>_insert" ON <t> FOR INSERT
  WITH CHECK ( public.auth_is_superadmin()
            OR account_id = public.auth_current_account_id() );

CREATE POLICY "<t>_update" ON <t> FOR UPDATE
  USING      ( public.auth_is_superadmin() OR account_id = public.auth_current_account_id() )
  WITH CHECK ( public.auth_is_superadmin() OR account_id = public.auth_current_account_id() );

CREATE POLICY "<t>_delete" ON <t> FOR DELETE
  USING ( public.auth_is_superadmin()
       OR account_id = public.auth_current_account_id() );
```

**Tables covered (`account_id NOT NULL`):** `companies`, `vendors`, `training_records`, `data_records`, `data_requests`, `breach_log`, `dpia_assessments`, `dpia_screenings`, `cross_border_transfers`, `cases`, `alerts`, `dpo`, `processing_activities`, `documents`, `team_members`, `consent_settings`.

**`system_logs` variant:** `account_id` is nullable for pre-tenancy rows. SELECT also allows `account_id IS NULL` *only* when `auth_is_superadmin()`.

The DO loop also `DROP POLICY IF EXISTS` for the legacy permissive policy names: `Enable read for all`, `Enable insert for all`, `Enable update for all`, `Enable delete for all`, `Allow all access`, `Allow all operations`, plus any table-specific legacy names found in the migration history.

### 3. Special-case table: `accounts`

The caller's "own row" matches by `id`, not `account_id`.

```sql
DROP POLICY IF EXISTS "accounts_all" ON public.accounts;

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
```

Effect: Accountadmin sees and can update only their own tenant row. Only Superadmin can create or delete tenants.

### 4. Special-case table: `user_profiles`

Three concentric circles: self, same-account-when-Accountadmin, all-when-Superadmin. Includes a privilege-escalation guard so an Accountadmin cannot self-promote to Superadmin or move themselves into another account.

```sql
DROP POLICY IF EXISTS "Accountadmin can read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile"        ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.user_profiles;

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
```

The WITH CHECK on UPDATE blocks two attacks at once: writing `role = 'Superadmin'` and writing a foreign `account_id`.

### 5. Client-side patches (`js/app.js`)

- **`loadAllPeople()` (line 4596):** add an explicit `account_id` filter for non-Superadmin callers. Belt-and-suspenders with RLS, and avoids issuing a query before the profile loads.

  ```js
  let q = supabase.from('user_profiles')
    .select('id, email, role, status, account_id, accounts(name)')
    .order('email');
  if (state.role !== 'Superadmin') {
    const accountId = getEffectiveAccountId();
    if (!accountId) return;
    q = q.eq('account_id', accountId);
  } else if (state.viewAsAccountId) {
    q = q.eq('account_id', state.viewAsAccountId);
  }
  ```

- **Existing `state.role === 'Accountadmin' && !accountId` short-circuits** in load functions stay as-is. They prevent no-op queries before profile load. Do not "clean up" client filters as part of this work; RLS is the security boundary, the client filter is a UX optimization.

- **No write-path changes required.** Insert/update payloads already include `account_id` via `getEffectiveAccountId()`; RLS rejects mismatches.

- **Friendlier error mapping.** When Supabase returns code `42501` ("new row violates row-level security policy"), the toast/log layer renders "You don't have access to that account" instead of the raw error.

### 6. Edge-function patch (`supabase/functions/create-user/`)

The function uses the service-role key, which bypasses RLS. Add an explicit caller-vs-target scope check before any privileged action (`reset-password`, `activate`, `deactivate`, `user`-mode invite):

```ts
const { data: caller } = await admin
  .from('user_profiles').select('role, account_id').eq('id', callerUid).single();

if (caller.role !== 'Superadmin') {
  if (caller.role !== 'Accountadmin') return forbidden();
  const { data: target } = await admin
    .from('user_profiles').select('account_id').eq('id', targetUserId).single();
  if (!target || target.account_id !== caller.account_id) return forbidden();

  // Force payload account_id to caller's, ignoring whatever the client sent
  payload.account_id = caller.account_id;
}
```

For invite flows where there is no existing `targetUserId` yet, the same `payload.account_id = caller.account_id` override applies.

### 7. Verification migration

`supabase/migrations/20260509000008_test_account_admin_rls.sql`. Wrapped in `BEGIN; … ROLLBACK;` so it leaves no residue but aborts the deploy on any leak.

Test matrix:

1. Insert two synthetic accounts, two `auth.users`, two Accountadmin `user_profiles`, and one row per scoped table for each tenant.
2. Define `pg_temp.assume(uid)` that sets `request.jwt.claims` and `role` to `authenticated`.
3. Impersonate admin-A. For every scoped table, assert `count(*) = 0` for rows where `account_id = <B>`.
4. Impersonate admin-A. Assert `INSERT INTO companies (account_id, …) VALUES ('<B>', …)` raises `insufficient_privilege` or `check_violation`.
5. Impersonate admin-A. Assert `UPDATE user_profiles SET role = 'Superadmin' WHERE id = '<A-admin>'` either raises or leaves the row unchanged.
6. Impersonate admin-A. Assert only one row visible in `accounts`.
7. Repeat 3–6 symmetrically for admin-B.
8. Sanity check: synthetic Superadmin sees both tenants.

Any failure raises `EXCEPTION`, which aborts the migration and fails `supabase db push`.

**Caveat:** the test assumes `set_config('request.jwt.claims', …, true)` is honored by `auth.uid()` inside a migration, which is the standard Supabase behavior. If a future Supabase version changes this, the fall-back is to invoke the same assertions via `supabase functions invoke` against deployed test accounts.

## Data flow

Login → `js/app.js:1150` populates `state.role` and `state.accountId` from `user_profiles`. Every subsequent query carries the user's JWT. RLS intercepts the query, calls `auth_is_superadmin()` / `auth_current_account_id()` (single `user_profiles` row lookup, cached for the statement), and either returns scoped rows or rejects the write. The client's existing `getEffectiveAccountId()` filter narrows the result set client-side to the same scope; if the two ever disagree, RLS wins.

## Failure modes and handling

| Failure | Handling |
|---|---|
| Caller has no `user_profiles` row (orphaned auth.users) | Helpers return NULL; policies fail closed (NULL ≠ NULL). Sign-in flow already redirects orphaned users to onboarding. |
| Caller's profile has `account_id IS NULL` and role ≠ Superadmin | Same as above — fails closed. Existing onboarding gate keeps users out of the app until profile is complete. |
| RLS rejects an INSERT because client sent stale `account_id` | Postgres raises `42501`. Client maps to "You don't have access to that account" toast. |
| Accountadmin tries to escalate to Superadmin via direct UPDATE | WITH CHECK on `user_profiles_update` rejects (`role <> 'Superadmin'`). Test 5 in the verification migration covers this. |
| Service-role queries (edge functions, migrations) | Bypass RLS as designed. Edge function adds explicit scope check (Component 6). |
| Pre-tenancy `system_logs` rows with NULL `account_id` | Visible only to Superadmin (the variant policy). |

## Testing

- **Verification migration** (Component 7) — runs on every `supabase db push`, gates UAT and prod deploys.
- Manual UAT: sign in as Accountadmin in two tenants in separate browsers, confirm the People page shows only their own staff, the Documents page shows only their own files, and the Companies dropdown shows only their own company.
- No new Python/Playwright tests required. Existing `test_*.py` suites should still pass; if any test relies on cross-tenant access without using the service role, it gets fixed in the same PR.

## Migration ordering

1. `20260509000007_account_admin_rls_lockdown.sql` — helpers + policies (this design).
2. `20260509000008_test_account_admin_rls.sql` — verification (rolls back).
3. Client + edge-function patches in the same PR; deploy together so the friendlier error mapping ships with the new RLS.

## Open questions

None blocking. Column-level update restrictions on `accounts` (e.g. preventing Accountadmin from editing `seat_limit`) are out of scope for this spec — flag as a follow-up if business policy requires it.
