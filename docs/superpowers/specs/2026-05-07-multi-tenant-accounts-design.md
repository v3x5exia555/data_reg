# Multi-tenant Accounts + Superadmin Role — Design

**Date:** 2026-05-07
**Status:** Approved (Option C — combined tenant model + Superadmin role)
**Scope:** ~3–5 weeks of work. Single coherent ship. No throwaway code.

## Context

The current app has overloaded `org_id` semantics — sometimes it carries `user.id`, sometimes `companies.id` — which has produced repeated "ghost data" bugs across `vendors`, `training_records`, `cases`, `breach_log`, `cross_border_transfers`, `data_requests`. RLS policies are universally `USING (true)`, so the database enforces no isolation. The codebase has placeholder comments ("re-introduce when adding multi-tenancy") sitting where account-scoped filters should live.

This spec replaces the overloaded `org_id` with a clean two-table model (`accounts` for tenancy/billing, `companies` for the customer's compliance subject) and introduces a `Superadmin` role for the operator (Tyson) to provision and supervise customer accounts. Existing 4-role enum collapses to 3: `Superadmin` / `Accountadmin` / `User`.

## Why Option C (combined) over A or B alone

- **Option A alone** (tenant cleanup only) ships invisible plumbing — hard to demo, doesn't deliver Superadmin.
- **Option B alone** (Superadmin role only) is built on the still-overloaded `org_id`. Edge cases will leak. Privacy/compliance risk the moment a real customer signs up. 30–50% rework when A lands later.
- **Option C** ships proper multi-tenancy AND Superadmin together: one mental-model swap, no throwaway code, no half-state.
- **Option D** (A-lite — only the 6 buggy tables) was considered but leaves the model inconsistent ("which tables have account_id and which don't?") — not worth the saved effort.

Cost of C: ~3–5 weeks vs ~2 for A or ~1 for B. Failure compounds (a tenant-model bug breaks the Superadmin UI), so the rollout is sequenced to land additive migrations first.

---

## Section 1 — Data model

### New `accounts` table

| column | type | notes |
|---|---|---|
| `id` | UUID | primary key, `DEFAULT gen_random_uuid()` |
| `name` | text | the customer's company name (denormalized for display) |
| `accountadmin_user_id` | UUID FK → `auth.users(id)` | the boss for this account |
| `seat_limit` | int | default 2 |
| `status` | text enum | `active` / `suspended` |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()`, trigger-updated |

Indexes: `idx_accounts_status`, `idx_accounts_accountadmin_user_id`.

### Updated `user_profiles`

- Add `account_id UUID NULL REFERENCES accounts(id)` — null **only** for Superadmin.
- Update `role user_role` enum: existing values are `'Accountadmin', 'security_user', 'useradmin', 'user'` (note lowercase `user`). Add `'Superadmin'`. Migrate any existing `security_user` / `useradmin` rows → `'user'`. Postgres can't drop enum values cleanly — `security_user` and `useradmin` stay defined but unused. The codebase's three live roles going forward are `Superadmin`, `Accountadmin`, `user`.

### `account_id` added to data tables

`vendors`, `training_records`, `data_records`, `data_requests`, `breach_log`, `dpia_assessments`, `cross_border_transfers`, `cases`, `alerts`, `team_members`, `dpo`, `processing_activities`, `documents`, `companies`, `system_logs`.

All become `NOT NULL` after backfill (except `user_profiles.account_id`, which stays nullable — Superadmin has none).

### `companies` kept separate (1:1 with accounts today)

- `accounts` is the **billing/tenancy unit** (who pays, seat limits, subscription status).
- `companies` is the **customer's compliance subject** (registration number, country, etc.).
- Enforce 1:1 with a `UNIQUE` constraint on `companies.account_id`. Drop the constraint later if a parent-company / multi-subsidiary model is needed.
- `team_members` table kept for backward compatibility but de-emphasized — new flow uses `user_profiles.account_id` directly.

### Why this shape

- Cleanly separates billing/tenancy from compliance subject.
- Stays 1:1 today but doesn't paint into a corner if you later sell to a parent company with subsidiaries.
- Makes the `org_id` ambiguity bug structurally impossible — there's exactly one canonical owner column going forward.

---

## Section 2 — Role + auth model

### Identity

```
auth.users (id, email, encrypted password)
  ↓ 1:1
user_profiles (id, role, account_id, ...)
  ↓ many:1
accounts (id, name, seat_limit, accountadmin_user_id, status)
```

### Login flow (same for all 3 roles)

1. User submits email + password → `supabase.auth.signInWithPassword`.
2. On success, frontend reads their row from `user_profiles`:
   ```js
   state.user = { id, email }
   state.role = user_profiles.role            // 'Superadmin' | 'Accountadmin' | 'user'
   state.accountId = user_profiles.account_id // null only for Superadmin
   state.viewAsAccountId = null               // Superadmin can override
   ```
3. New helper `getEffectiveAccountId()` replaces `getCurrentOrgId()` everywhere:
   ```js
   function getEffectiveAccountId() {
     if (state.role === 'Superadmin') return state.viewAsAccountId; // null = aggregate-only views
     return state.accountId; // Accountadmin & User pinned to their tenant
   }
   ```
4. Every load helper filters `account_id = getEffectiveAccountId()`. The "re-introduce when adding multi-tenancy" comments turn into real filter calls.

### Pick-first Superadmin model (decided)

Superadmin can see one of two things:

- **The Accounts page** — always available; aggregate stats (counts, seat usage) only. Never reads from compliance data tables.
- **Some account's data** — only after clicking "View as"; identical to what the Accountadmin sees, with a sticky banner.

This avoids a global cross-account view of compliance data:
- Existing load helpers always get a non-null `account_id` to filter on. No "what if it's null" edge cases.
- Prevents accidental cross-tenant data leaks (CSV exports, screenshots).
- Queries always hit indexed `account_id = $1`. No full-table scans.

### Account creation (Superadmin → Edge Function)

1. Superadmin clicks "+ New account" → form: `company_name`, `accountadmin_email`, `temp_password`, `seat_limit` (default 2), checkbox "Seed sample data".
2. Browser calls `POST /functions/v1/create-user` with `mode='account'`. The Edge Function atomically:
   1. Inserts `accounts` row (`status='active'`, given `seat_limit`).
   2. Calls `supabase.auth.admin.createUser({ email, password, email_confirm: true })`.
   3. Inserts `user_profiles` (role=`Accountadmin`, `account_id`=new account).
   4. Updates `accounts.accountadmin_user_id`.
   5. Inserts `companies` row (`account_id`=new account, `name`=company_name).
   6. If `seed_sample_data`: inserts the existing `sample_data.js` payloads server-side, tagged with the new `account_id`.
   7. Returns `{ account_id, accountadmin_email, temp_password }` for the UI to display.
3. Superadmin hands the temp password to the customer out-of-band. They log in and change it.

### User invitation (Accountadmin → same Edge Function)

- Same endpoint, `mode='user'`. Caller's JWT is checked: must be `Accountadmin` of the supplied `account_id` (or any `Superadmin`).
- Function verifies `current_users < seat_limit` for that account. If exceeded, returns `402` so the UI can show "Seat limit reached".

### View-as / impersonation

- Each Accounts row has a "View as" button → `state.viewAsAccountId = thatAccount.id`, sticky banner appears, all data nav unlocks.
- Banner: `👁 Viewing as <account name>  •  [Exit view-as]`.
- "Exit view-as" → `viewAsAccountId = null`, return to Accounts page.
- `viewAsAccountId` is persisted in `localStorage` so it survives a refresh.

### RLS posture

- **This spec (demo):** keep current `USING (true)` policies. Isolation enforced in the frontend by the `account_id` filter on every query. Matches current code; avoids piling on too much.
- **Follow-up spec (production):** JWT-based RLS reading `account_id` from a custom claim. Out of scope here.

### Legacy `app_credentials`

Out of scope. The 2026-05-06 migration that wired it to `processing_activities` stays untouched. Phasing it out is a separate spec.

---

## Section 3 — UI scope by role

### Superadmin — new top-level Accounts page

Replaces the dashboard for Superadmin. **This is the only page they see by default until they pick "View as".**

```
╭──────────────────────────────────────────────────────╮
│ Accounts                              [ + New account ]│
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                       │
│ │ 12  │ │ 10  │ │ 24  │ │  2  │                       │
│ │Total│ │Active│ │Seats│ │Susp.│                      │
│ └─────┘ └─────┘ └─────┘ └─────┘                       │
│ 🔍 [Search by name/email]   [All ▾]                   │
│ ┌────────────────────────────────────────────────┐   │
│ │ Acme Pte Ltd  mary@acme.com  1/2  Active       │   │
│ │ Created Apr 12  •  Last activity 2h ago        │   │
│ │ [View as] [Edit seats] [Suspend] [⋯]          │   │
│ └────────────────────────────────────────────────┘   │
╰──────────────────────────────────────────────────────╯
```

**Per-row actions:**
- **View as** → sets `state.viewAsAccountId`, banner appears, full nav unlocks.
- **Edit seats** → modal: change `seat_limit`, validates ≥ current user count.
- **Suspend / Reactivate** → toggles `accounts.status`. Suspended account's users are denied login.
- **⋯ menu** → "Reset admin password" (Edge Function), "Delete account" (typed-confirmation modal that purges all `account_id`-tagged rows).

**`+ New account` modal:** `company_name`, `accountadmin_email`, `temp_password`, `seat_limit` (default 2), checkbox "Seed sample data". Submit → toast with credentials.

**Aggregate stats** are computed from the `accounts` table only (`COUNT(*)`, `SUM(seat_limit)`, etc.) — never from compliance data tables.

### Accountadmin — existing UI + small additions

Almost no UI changes. Every existing page just filters by `account_id`. New bits:

- **Dashboard `#/dashboard`** — new "User activity" card:
  ```
  ╭────────────────────────────────╮
  │ User activity                   │
  │ Mary Lim    Logged in       2m │
  │ John Tan    Added vendor    1h │
  │ Mary Lim    Updated DPIA    3h │
  │ [View all activity →]          │
  ╰────────────────────────────────╯
  ```
  Reads `system_logs WHERE account_id = $1 ORDER BY created_at DESC LIMIT 5`. "View all" → full audit log with filters. **Decision: source is `system_logs`** (the canonical log written by `JARVIS_LOG`), with a friendly formatter on the frontend. The legacy `activity_log` table is dropped in migration 6.

- **Access page `#/access`** — currently shows team members. Add:
  - Header chip: `Seats: 1 / 2 used`.
  - "+ Add user" button — disabled when `current_users >= seat_limit`, tooltip "Upgrade to add more seats. Contact support."
  - Each row: "Disable / Enable" toggle and "Reset password" link.

### User — stripped subset

Plain user (non-admin) sees:
- Dashboard (read-only, their own activity highlighted).
- Data Register / Consent / Vendors / Training / Breach Log etc. — read or read+write per the existing `permissions` JSON on `user_profiles`.
- **No** Access page, **no** settings, **no** "Add user".

The existing `applyNavPermissions()` already handles this correctly. We only clean up the role values from the dropped enum members.

### Login routing

- Same login form.
- Post-login, route by `user_profiles.role`:
  - `Superadmin` → `/accounts`
  - `Accountadmin` / `User` → `/dashboard`
- If the account's `status = 'suspended'`, deny login: "Your account is suspended — contact support."

### Out of scope (each becomes its own follow-up spec)

- Email-based password reset (Edge Function admin reset for now).
- Self-service signup.
- Stripe / payment for seat upgrades (manual via Superadmin Accounts page).
- Account groups / parent-subsidiary hierarchy.
- `system_logs` retention policy.
- 2FA.
- Production-grade JWT RLS.

---

## Section 4 — Migration, Edge Function, testing, rollout

### Migration sequence (additive first, then enforce)

| # | File (timestamp) | What it does |
|---|---|---|
| 1 | `20260508000001_create_accounts_table.sql` | New `accounts` table + indexes. |
| 2 | `20260508000002_alter_user_role_enum.sql` | `ALTER TYPE user_role ADD VALUE 'Superadmin'`. Migrate `security_user` / `useradmin` rows → `User`. (Enum values left defined; Postgres can't drop them cleanly.) |
| 3 | `20260508000003_add_account_id_columns.sql` | Add nullable `account_id UUID REFERENCES accounts(id)` to: `user_profiles`, `companies` (UNIQUE), `vendors`, `training_records`, `data_records`, `data_requests`, `breach_log`, `dpia_assessments`, `cross_border_transfers`, `cases`, `alerts`, `dpo`, `processing_activities`, `documents`, `team_members`, `system_logs`. |
| 4 | `20260508000004_backfill_default_account.sql` | Insert "Default Account 1"; assign every existing data row + `user_profiles` row to it. **Does NOT** auto-promote anyone to Superadmin — the operator promotes themselves manually via SQL after migrations land (one-line `UPDATE user_profiles SET role='Superadmin', account_id=NULL WHERE id='<tyson auth uid>'`). Keeps the migration deterministic and avoids guessing "who is the operator". |
| 5 | `20260508000005_make_account_id_required.sql` | Run **after** frontend migration is verified. `ALTER COLUMN account_id SET NOT NULL` for the data tables (NOT `user_profiles` — Superadmin stays null). |
| 6 | `20260508000006_drop_activity_log.sql` | `DROP TABLE activity_log` (placeholder-only, already cleaned). `system_logs` is canonical. |
| 7 | `20260508000007_drop_org_id.sql` (deferred) | Drop legacy `org_id` columns once nothing reads them. Optional cleanup. |

### Frontend migration (lands alongside Steps 1–4)

| Stage | Change |
|---|---|
| 1 | Add `getEffectiveAccountId()` in `js/app.js` (alongside `getCurrentOrgId` for now). |
| 2 | Every `loadXFromSupabase` calls `.eq('account_id', getEffectiveAccountId())` when non-null. The "re-introduce when adding multi-tenancy" comments become real filters. |
| 3 | Every `saveX` writes `account_id: getEffectiveAccountId()`. |
| 4 | `state.role`, `state.accountId`, `state.viewAsAccountId` populated on login from `user_profiles`. |
| 5 | New `pages/superadmin_accounts.html` + nav item gated on `state.role === 'Superadmin'`. |
| 6 | View-as banner component (sticky, appears when `state.viewAsAccountId !== null`). |
| 7 | Dashboard's `loadDashboardFromSupabase` extended with "User activity" card pulling `system_logs WHERE account_id = $1 ORDER BY created_at DESC LIMIT 5`. |
| 8 | Access page: seat-usage chip + seat-limit-gated "+ Add user" button. |
| 9 | Login routing: `Superadmin → /accounts`, others → `/dashboard`; suspended account → deny with message. |

### Edge Function: `create-user`

One function, two modes — kept lean.

**Endpoint:** `POST /functions/v1/create-user`

**Input:**
```json
{
  "mode": "account" | "user",
  "email": "...",
  "temp_password": "...",
  "company_name": "...",          // mode=account only
  "seat_limit": 2,                // mode=account only
  "account_id": "uuid",           // mode=user only — the calling Accountadmin's account
  "seed_sample_data": true        // mode=account only
}
```

**Authorization:** function reads caller's JWT and looks up `user_profiles.role`:
- `mode='account'` → caller must be `Superadmin`.
- `mode='user'` → caller must be `Accountadmin` of `account_id` (or any `Superadmin`).

**Atomicity:** wrap in a savepoint. If any step fails, delete whatever was already created (auth user, accounts row).

**Steps for `mode='account'`:**
1. Insert `accounts` row (`status='active'`, given `seat_limit`).
2. `supabase.auth.admin.createUser({ email, password, email_confirm: true })`.
3. Insert `user_profiles` (id=auth user id, role=`'Accountadmin'`, `account_id`=new account).
4. Update `accounts.accountadmin_user_id`.
5. Insert `companies` (`account_id`=new account, `name`=company_name).
6. If `seed_sample_data`: server-side equivalent of `sample_data.js` payloads, tagged with the new `account_id`.
7. Return `{ account_id, user_id, email, temp_password }`.

**Steps for `mode='user'`:**
1. Verify `current_users < seat_limit`: `SELECT COUNT(*) FROM user_profiles WHERE account_id = $1`.
2. `supabase.auth.admin.createUser`.
3. Insert `user_profiles` (role=`'user'`, `account_id`=given).
4. Return `{ user_id, email, temp_password }`.

**File:** `supabase/functions/create-user/index.ts` (~80 lines TypeScript).

**Deploy:**
```bash
supabase functions new create-user
supabase functions deploy create-user --project-ref <ref>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

The function uses the service role key (never shipped to the browser).

### Error handling

| Scenario | Behavior |
|---|---|
| Login from a suspended account | Deny: "Your account is suspended — contact support" |
| Edge Function: email already exists | `409`; UI toast: "Email already registered" |
| Edge Function: seat limit exceeded | `402`; UI toast: "Seat limit reached. Upgrade to add more users." |
| Edge Function: any step fails | Roll back created entities; return `500` with the error |
| Superadmin deletes an account | Typed-confirmation modal ("type ACME PTE LTD to confirm"); on confirm, deletes account + cascades all `account_id` rows |
| User loads a page while not logged in | Redirect to login (existing behavior preserved) |
| Superadmin in view-as mode refreshes | `viewAsAccountId` restored from `localStorage` |

### Testing approach

The codebase has no JS test framework. Two layers:

**1. Manual smoke checklist** (`docs/multi-tenant-smoke.md`) — runs against staging **after** the full frontend deploy (rollout Phase F below) so that `/accounts`, view-as, and seat-gated "+ Add user" exist in the bundle:

| # | Step | Expected |
|---|---|---|
| 1 | Run migrations 1–4 against staging Supabase | Each succeeds; no orphan columns |
| 2 | Run promotion SQL: `UPDATE user_profiles SET role='Superadmin', account_id=NULL WHERE id='<tyson uid>'` | One row updated |
| 3 | Tyson logs in | Lands on `/accounts`, sees Default Account 1 with seat usage and "Active" status |
| 4 | Superadmin clicks "+ New account" | Edge Function returns 200; new `accounts` row; new auth user; toast shows temp password |
| 5 | Log out → log in as new Accountadmin | Lands on `/dashboard`; sees ONLY their (empty or seeded) data; no `/accounts` nav |
| 6 | Accountadmin opens Access page | "Seats: 1 / 2 used"; "+ Add user" enabled |
| 7 | Accountadmin clicks "+ Add user" | New User created; chip flips to 2/2; "+ Add user" disables |
| 8 | Try to add a 3rd user | Toast: "Seat limit reached" |
| 9 | Log in as the User | Sees nav per `permissions` JSON; no Access page |
| 10 | Superadmin: "View as Default Account 1" | Banner appears; Dashboard shows legacy data; "Exit view-as" returns to `/accounts` |
| 11 | Superadmin: suspend an account | `accounts.status` updates; that account's users get the suspended message on next login |
| 12 | Superadmin: delete account (typed confirm) | Account + all `account_id`-tagged rows gone; auth users deleted |

**2. SQL invariants** (run after Step 4 backfill, before Step 5 enforcement):

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
UNION ALL SELECT 'system_logs', count(*) FROM system_logs WHERE account_id IS NULL;
-- Expected: all zeros. If any non-zero, fix before running migration 5.
```

### Rollout sequence (zero-downtime)

| Phase | Action | App state |
|---|---|---|
| A | Deploy migrations 1–4 | Frontend unchanged, still uses `org_id`; new `account_id` columns nullable, ignored by UI |
| B | Deploy frontend bundle with `getEffectiveAccountId()` writing to BOTH `org_id` and `account_id` | Old data still readable; new writes dual-tagged |
| C | Run **SQL invariants** (data integrity only — no UI smoke yet) | All counts zero |
| D | Deploy migration 5 (`account_id` NOT NULL) | Reads/writes use `account_id` exclusively |
| E | Deploy migration 6 (drop `activity_log`) | `system_logs` is sole audit table |
| F | Deploy frontend follow-up: drop `org_id` writes; ship `/accounts` page, view-as banner, seat-gated "+ Add user", new login routing. Run promotion SQL to make Tyson Superadmin. | Superadmin/Accountadmin/User flows fully live |
| G | Run the **manual smoke checklist** against staging end-to-end | All 12 steps pass |
| H | (later) Migration 7 drops `org_id` columns | Cleanup |

If anything in C fails, halt — only additive changes are deployed (nullable column + dual-write), reversible by reverting the frontend bundle. If anything in G fails, the rollback is to revert the Phase F frontend bundle (Phase B bundle still works since `org_id` is dual-written).

---

## Deliverables summary

If approved, the implementation produces:

1. **7 migration files** in `supabase/migrations/` (timestamps `20260508000001`–`20260508000007`).
2. **One Edge Function** `supabase/functions/create-user/index.ts`.
3. **Frontend changes** in `js/app.js`: `getEffectiveAccountId()`, account-scoped queries, login routing, view-as state.
4. **One new page** `pages/superadmin_accounts.html` (Accounts list, add/suspend/delete/view-as).
5. **Modified Access page** with seat chip + gated "+ Add user".
6. **Modified Dashboard** with User-activity card (Accountadmin only).
7. **Login page** route logic.
8. **Smoke checklist** at `docs/multi-tenant-smoke.md`.

Approximate volume: ~600 lines SQL, ~80 lines TS, ~400 lines JS, ~250 lines HTML.

## Open follow-up specs (intentionally NOT in this design)

- Production-grade JWT-based RLS using a custom `account_id` claim.
- Self-service signup + email-based password reset.
- Stripe webhook for seat-limit upgrades.
- Account groups / parent-subsidiary hierarchy.
- `system_logs` retention policy.
- 2FA.
- `app_credentials` phase-out.
