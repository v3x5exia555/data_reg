# Accountadmin Data Isolation + People Management

**Date:** 2026-05-07
**Status:** Approved

## Overview

Two related changes:

1. **Data isolation fix** — Accountadmin currently leaks cross-account data on multiple pages because the `account_id` filter is conditional and fails open when `accountId` is null. Fix all data-read queries to fail closed.

2. **People Management page** — New page visible to Accountadmin (and Superadmin) showing a cross-account directory of all users with the ability to reset passwords, activate, and deactivate accounts.

## Roles

| Role | Data access | People access |
|---|---|---|
| Superadmin | All accounts (or view-as) | All users |
| Accountadmin | Own account only | All users (read + manage) |
| user | Own account only | None |

## Section 1: Data Isolation Fix

### Root cause

Every data-fetching query uses the pattern:
```js
const accountId = getEffectiveAccountId();
if (accountId) query = query.eq('account_id', accountId);
```

This **fails open**: if `accountId` is null (e.g., timing issue post-login, or state not yet populated), the filter is silently dropped and the query returns all rows across all accounts.

### Fix

Add a fail-closed guard used by every Accountadmin data query:

```js
// At the top of each load function, after getting accountId:
const accountId = getEffectiveAccountId();
if (state.role === 'Accountadmin' && !accountId) return; // bail — show empty, not all data
if (accountId) query = query.eq('account_id', accountId);
```

### Tables affected

| Table | Current state | Fix required |
|---|---|---|
| `companies` | Conditional filter | Fail-closed guard |
| `data_requests` | Conditional filter | Fail-closed guard |
| `breach_log` | Conditional filter | Fail-closed guard |
| `dpia_assessments` | Conditional filter | Fail-closed guard |
| `cross_border_transfers` | Conditional filter | Fail-closed guard |
| `alerts` | Conditional filter | Fail-closed guard |
| `cases` | Conditional filter | Fail-closed guard |
| `documents` | Conditional filter | Fail-closed guard |
| `team_members` | Conditional filter | Fail-closed guard |
| `consent_settings` | **No filter at all** | Add `account_id` column + fail-closed guard |
| `checklist_items` | Filters by `user_id` | Intentional — leave unchanged |

### `consent_settings` migration

This table has no `account_id` column and no filter — it returns all rows to all users.

```sql
ALTER TABLE consent_settings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
```

After migration, the JS load function adds the standard fail-closed filter.

## Section 2: People Management Page

### Nav entry

Add to `NAV_ITEMS` array in `app.js`:

```js
{ id: 'people', label: 'People', section: 'Admin', accountadminOnly: true }
```

The `accountadminOnly` flag is handled in `buildNav()` — hide the item if role is neither `Accountadmin` nor `Superadmin`.

### New file: `pages/22__people.html`

Mirrors the Accounts page layout. Contains:
- Search input (filter by name, email, or account)
- Table: **Name · Email · Account · Role · Status · Actions**
- Actions per row: **Reset Password** button, **Activate / Deactivate** toggle button

### JS functions (added to `app.js`)

**`loadAllPeople()`**
- Guard: return if role is not `Accountadmin` or `Superadmin`
- Query: `supabase.from('user_profiles').select('*, accounts(name)')` — no `account_id` filter (intentionally cross-account)
- Populates the table

**`resetUserPassword(userId)`**
- Prompts for new password (min 8 chars)
- Calls Edge Function: `{ mode: 'manage-user', action: 'reset-password', user_id: userId, new_password: pw }`
- Shows success/error toast

**`setUserStatus(userId, action)`**
- `action`: `'activate'` or `'deactivate'`
- Calls Edge Function: `{ mode: 'manage-user', action, user_id: userId }`
- Refreshes the row status badge on success

### Page navigation hook

Add to the `navigateTo` / page-switch handler in `app.js`:
```js
if (pageId === 'people' && typeof loadAllPeople === 'function') loadAllPeople();
```

## Section 3: Edge Function Extension

### File: `supabase/functions/create-user/index.ts`

Add a new mode alongside the existing `account` and `user` modes.

**New interface:**
```ts
interface ManageUserBody {
  mode: 'manage-user';
  user_id: string;
  action: 'reset-password' | 'activate' | 'deactivate';
  new_password?: string; // required when action = 'reset-password'
}
```

**Authorization:** Accountadmin OR Superadmin — no account restriction (cross-account by design).

**Operations:**

| Action | Auth operation | DB update |
|---|---|---|
| `reset-password` | `admin.auth.admin.updateUserById(userId, { password })` | none |
| `deactivate` | `admin.auth.admin.updateUserById(userId, { ban_duration: '876600h' })` | `user_profiles.status = 'suspended'` |
| `activate` | `admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })` | `user_profiles.status = 'active'` |

### DB migration required

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
```

This column drives the Status badge in the People page UI and avoids a round-trip to Supabase Auth admin API just to know if a user is banned.

## Data flow summary

```
Accountadmin logs in
  └─ state.accountId set from user_profiles.account_id

Data pages (companies, breach_log, etc.)
  └─ getEffectiveAccountId() → own accountId
  └─ if Accountadmin && !accountId → bail (empty)
  └─ query filtered by account_id → own data only

People page
  └─ loadAllPeople() → user_profiles JOIN accounts (no account_id filter)
  └─ resetUserPassword / setUserStatus → Edge Function manage-user mode
  └─ Edge Function → Supabase Auth admin + user_profiles.status update
```

## Files changed

| File | Change |
|---|---|
| `js/app.js` | Fail-closed guards on all data queries; `loadAllPeople`, `resetUserPassword`, `setUserStatus` functions; nav item; page-switch hook; `buildNav` accountadminOnly support |
| `pages/22__people.html` | New People Management page |
| `supabase/functions/create-user/index.ts` | New `manage-user` mode |
| SQL (run in Supabase dashboard) | Add `consent_settings.account_id`, `user_profiles.status` |
