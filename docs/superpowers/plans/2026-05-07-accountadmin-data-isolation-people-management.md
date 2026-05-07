# Accountadmin Data Isolation + People Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix cross-account data leaks for Accountadmin and add a cross-account People Management page with password reset and activate/deactivate user controls.

**Architecture:** Two parts — (1) add a fail-closed guard to every data-read query in `app.js` so Accountadmin queries always filter by their `account_id`; (2) a new `pages/22__people.html` page + JS functions that intentionally query `user_profiles` without an account filter, backed by a new `manage-user` mode in the existing Edge Function.

**Tech Stack:** Vanilla JS, Supabase JS client v2, Supabase Edge Functions (Deno/TypeScript), HTML/CSS following existing design system.

---

## File Map

| File | Action | What changes |
|---|---|---|
| Supabase SQL (dashboard) | Run migration | Add `consent_settings.account_id`, `user_profiles.status` |
| `js/app.js` | Modify | Fail-closed guards × 9 queries; fix `consent_settings` load; NAV_ITEMS + `applyNavPermissions`; page-switch hook; `loadAllPeople`, `resetUserPassword`, `setUserStatus` functions |
| `pages/22__people.html` | Create | People Management page HTML |
| `supabase/functions/create-user/index.ts` | Modify | New `manage-user` mode: `reset-password`, `activate`, `deactivate` |

---

## Task 1: Run DB Migrations

**Files:** SQL run in Supabase dashboard (Project → SQL Editor)

- [ ] **Step 1: Open Supabase SQL Editor and run migrations**

```sql
-- Add account scoping to consent_settings
ALTER TABLE consent_settings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);

-- Add status column to user_profiles for People page display
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Back-fill existing rows so they don't show as NULL
UPDATE user_profiles SET status = 'active' WHERE status IS NULL;
```

- [ ] **Step 2: Verify columns exist**

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('consent_settings', 'user_profiles')
  AND column_name IN ('account_id', 'status');
```

Expected: 2 rows returned — `consent_settings.account_id` (uuid) and `user_profiles.status` (text, default 'active').

- [ ] **Step 3: Commit a migration note**

```bash
git add -A
git commit -m "docs: note SQL migrations applied for consent_settings.account_id and user_profiles.status"
```

---

## Task 2: Fix `consent_settings` — Add `account_id` Filter

**Files:**
- Modify: `js/app.js:566-589`

The function `loadConsentFromSupabase` at line 566 queries `consent_settings` with no `account_id` filter at all — every user sees every account's consent settings.

- [ ] **Step 1: Open `js/app.js` and locate `loadConsentFromSupabase` at line 566**

Find this exact block (lines 573–577):

```js
  const { data, error } = await supabase
    .from('consent_settings')
    .select('*')
    .order('category');
```

- [ ] **Step 2: Replace it with the fail-closed + filtered version**

```js
  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) { renderConsent(); return; }
  let consentQuery = supabase.from('consent_settings').select('*');
  if (accountId) consentQuery = consentQuery.eq('account_id', accountId);
  const { data, error } = await consentQuery.order('category');
```

- [ ] **Step 3: Manual verify**

Log in as an Accountadmin. Open the Consent page. Open the browser console and confirm the network request to Supabase for `consent_settings` includes `account_id=eq.<their-account-id>` in the query params.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "fix(consent): scope consent_settings query to account_id for Accountadmin"
```

---

## Task 3: Add Fail-Closed Guard to All Remaining Data-Read Queries

**Files:**
- Modify: `js/app.js` — 8 locations listed below

The pattern to apply everywhere is identical. For each function, find the existing two lines and replace them with three lines (add the guard in between):

**Before (fails open):**
```js
const accountId = getEffectiveAccountId();
if (accountId) query = query.eq('account_id', accountId);
```

**After (fails closed):**
```js
const accountId = getEffectiveAccountId();
if (state.role === 'Accountadmin' && !accountId) return;
if (accountId) query = query.eq('account_id', accountId);
```

Apply this change at each of the following locations:

- [ ] **Step 1: `loadCompaniesFromSupabase` — lines 2217–2219**

Find:
```js
  const accountId = getEffectiveAccountId();
  let query = supabase.from('companies').select('*');
  if (accountId) query = query.eq('account_id', accountId);
```

Replace with:
```js
  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) return;
  let query = supabase.from('companies').select('*');
  if (accountId) query = query.eq('account_id', accountId);
```

- [ ] **Step 2: `loadDataRequestsFromSupabase` — lines 2258–2260**

Find:
```js
  const accountId = getEffectiveAccountId();
  let query = supabase.from('data_requests').select('*');
  if (accountId) query = query.eq('account_id', accountId);
```

Replace with:
```js
  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) { renderDataRequests(state.dataRequests); return; }
  let query = supabase.from('data_requests').select('*');
  if (accountId) query = query.eq('account_id', accountId);
```

- [ ] **Step 3: `loadBreachLogFromSupabase` — lines 2524–2526**

Find:
```js
    const accountId = getEffectiveAccountId();
    let query = supabase.from('breach_log').select('*');
    if (accountId) query = query.eq('account_id', accountId);
```

Replace with:
```js
    const accountId = getEffectiveAccountId();
    if (state.role === 'Accountadmin' && !accountId) return;
    let query = supabase.from('breach_log').select('*');
    if (accountId) query = query.eq('account_id', accountId);
```

- [ ] **Step 4: `loadDPIAFromSupabase` — lines 2796–2798**

Find:
```js
    const accountId = getEffectiveAccountId();
    let query = supabase.from('dpia_assessments').select('*');
    if (accountId) query = query.eq('account_id', accountId);
```

Replace with:
```js
    const accountId = getEffectiveAccountId();
    if (state.role === 'Accountadmin' && !accountId) return;
    let query = supabase.from('dpia_assessments').select('*');
    if (accountId) query = query.eq('account_id', accountId);
```

- [ ] **Step 5: `loadCrossBorderFromSupabase` — lines 3099–3101**

Find:
```js
    const accountId = getEffectiveAccountId();
    let query = supabase.from('cross_border_transfers').select('*');
    if (accountId) query = query.eq('account_id', accountId);
```

Replace with:
```js
    const accountId = getEffectiveAccountId();
    if (state.role === 'Accountadmin' && !accountId) return;
    let query = supabase.from('cross_border_transfers').select('*');
    if (accountId) query = query.eq('account_id', accountId);
```

- [ ] **Step 6: `loadAlertsFromSupabase` — lines 3284–3286**

Find:
```js
  const accountId = getEffectiveAccountId();
  let query = supabase.from('alerts').select('*');
  if (accountId) query = query.eq('account_id', accountId);
```

Replace with:
```js
  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) return;
  let query = supabase.from('alerts').select('*');
  if (accountId) query = query.eq('account_id', accountId);
```

- [ ] **Step 7: `loadCasesFromSupabase` — lines 3306–3308**

Find:
```js
  const accountId = getEffectiveAccountId();
  let query = supabase.from('cases').select('*');
  if (accountId) query = query.eq('account_id', accountId);
```

Replace with:
```js
  const accountId = getEffectiveAccountId();
  if (state.role === 'Accountadmin' && !accountId) return;
  let query = supabase.from('cases').select('*');
  if (accountId) query = query.eq('account_id', accountId);
```

- [ ] **Step 8: `renderTeam` — lines 4145–4147**

Find:
```js
    const accountId = getEffectiveAccountId();
    let query = supabase.from('team_members').select('*');
    if (accountId) query = query.eq('account_id', accountId);
```

Replace with:
```js
    const accountId = getEffectiveAccountId();
    if (state.role === 'Accountadmin' && !accountId) return;
    let query = supabase.from('team_members').select('*');
    if (accountId) query = query.eq('account_id', accountId);
```

- [ ] **Step 9: Commit**

```bash
git add js/app.js
git commit -m "fix(security): fail-closed account_id guards on all Accountadmin data queries"
```

---

## Task 4: Add People Nav Item + Update `applyNavPermissions`

**Files:**
- Modify: `js/app.js:3876` (NAV_ITEMS)
- Modify: `js/app.js:4039–4057` (`applyNavPermissions`)

- [ ] **Step 1: Add People nav item to NAV_ITEMS (line 3876)**

Find:
```js
  { id: 'accounts', label: 'Accounts', section: 'Admin', superadminOnly: true }
];
```

Replace with:
```js
  { id: 'accounts', label: 'Accounts', section: 'Admin', superadminOnly: true },
  { id: 'people', label: 'People', section: 'Admin', accountadminOnly: true }
];
```

- [ ] **Step 2: Update `applyNavPermissions` to handle `accountadminOnly` and show Admin label for Accountadmin**

Find the `applyNavPermissions` function (line 4039). Find this block inside it:

```js
  NAV_ITEMS.forEach(item => {
    const navEl = document.getElementById('nav-' + item.id);
    if (navEl) {
      if (item.superadminOnly && !isSuperadmin) {
        navEl.style.display = 'none';
      } else {
        navEl.style.display = (savedConfig && savedConfig[item.id] === false) ? 'none' : '';
      }
    }
  });

  // Hide the Admin nav section label for non-Superadmin users.
  const adminLabel = document.getElementById('nav-section-admin');
  if (adminLabel) adminLabel.style.display = isSuperadmin ? '' : 'none';
```

Replace with:
```js
  const isAccountadmin = state.role === 'Accountadmin';

  NAV_ITEMS.forEach(item => {
    const navEl = document.getElementById('nav-' + item.id);
    if (navEl) {
      if (item.superadminOnly && !isSuperadmin) {
        navEl.style.display = 'none';
      } else if (item.accountadminOnly && !isSuperadmin && !isAccountadmin) {
        navEl.style.display = 'none';
      } else {
        navEl.style.display = (savedConfig && savedConfig[item.id] === false) ? 'none' : '';
      }
    }
  });

  // Show Admin label for both Superadmin and Accountadmin (People page lives there).
  const adminLabel = document.getElementById('nav-section-admin');
  if (adminLabel) adminLabel.style.display = (isSuperadmin || isAccountadmin) ? '' : 'none';
```

- [ ] **Step 3: Add page-switch hook for `people` page (line ~846, inside the block with other page hooks)**

Find:
```js
  if (pageId === 'accounts' && typeof loadAccounts === 'function') loadAccounts();
```

Add immediately after:
```js
  if (pageId === 'people' && typeof loadAllPeople === 'function') loadAllPeople();
```

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat(nav): add People nav item for Accountadmin; show Admin label for Accountadmin"
```

---

## Task 5: Create People Management Page HTML

**Files:**
- Create: `pages/22__people.html`

- [ ] **Step 1: Create `pages/22__people.html` with this content**

```html
<section class="page page-shell accounts-shell" id="page-people" data-page="people">
  <div class="accounts-page-inner">
    <header class="accounts-hero">
      <div class="accounts-hero-text">
        <span class="accounts-eyebrow">Admin workspace</span>
        <h1>People</h1>
        <p class="page-sub">View and manage users across all accounts.</p>
      </div>
    </header>

    <div class="accounts-toolbar">
      <div class="accounts-search-wrap">
        <span class="accounts-search-icon">Search</span>
        <input type="search" id="people-search" placeholder="Search by name, email or account..." oninput="filterPeopleTable()" />
      </div>
      <select id="people-status-filter" onchange="filterPeopleTable()">
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    <div id="people-list" class="accounts-list" aria-live="polite">
      <div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Include the new page in `index.html`**

Open `index.html`. Find where the other page partials are included (look for the pattern `pages/20__accounts.html` or similar includes/script tags that inject pages). Add the new page in the same way immediately after the accounts page include.

If pages are included via a `<div>` fetch pattern or `<!--#include-->`, replicate exactly the same syntax used for `20__accounts.html`, substituting `22__people.html`.

If pages are inlined directly as HTML sections in `index.html`, copy the HTML from step 1 and insert it after the accounts section.

- [ ] **Step 3: Commit**

```bash
git add pages/22__people.html index.html
git commit -m "feat(people): add People Management page HTML"
```

---

## Task 6: Add People Management JS Functions

**Files:**
- Modify: `js/app.js` — add three new functions after the `removeTeamMember` function (~line 4210)

- [ ] **Step 1: Add `loadAllPeople`, `filterPeopleTable`, `resetUserPassword`, and `setUserStatus` to `app.js`**

Find the end of `removeTeamMember` function (around line 4210 — it ends with the closing `}` after `showToast('Team member removed', 'success');`). Insert after it:

```js
/* ───────────────────────────────────────────────
   PEOPLE MANAGEMENT (Accountadmin + Superadmin)
   ─────────────────────────────────────────────── */
let _allPeople = [];

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

  if (error) {
    console.error('Failed to load people:', error);
    document.getElementById('people-list').innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--muted);">Failed to load users.</div>';
    return;
  }

  _allPeople = data || [];
  renderPeopleList(_allPeople);
}

function filterPeopleTable() {
  const search = (document.getElementById('people-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('people-status-filter')?.value || 'all';
  const filtered = _allPeople.filter(u => {
    if (statusFilter !== 'all' && (u.status || 'active') !== statusFilter) return false;
    const haystack = [u.email, u.role, u.accounts?.name].filter(Boolean).join(' ').toLowerCase();
    return !search || haystack.includes(search);
  });
  renderPeopleList(filtered);
}

function renderPeopleList(people) {
  const list = document.getElementById('people-list');
  if (!list) return;

  if (!people.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">No users found.</div>';
    return;
  }

  list.innerHTML = people.map(u => {
    const status = u.status || 'active';
    const accountName = u.accounts?.name || u.account_id || '—';
    const initials = (u.email || '?')[0].toUpperCase();
    return `
    <article class="account-row ${status === 'suspended' ? 'is-suspended' : ''}" data-uid="${u.id}">
      <button class="account-main" type="button" style="cursor:default;pointer-events:none;">
        <span class="account-avatar">${initials}</span>
        <span class="account-copy">
          <span class="account-name">${escapeHtml(u.email || '—')}</span>
          <span class="account-meta">${escapeHtml(accountName)} · ${escapeHtml(u.role || 'user')}</span>
        </span>
      </button>
      <div class="account-status">
        <span class="account-status-badge ${status === 'active' ? 'active' : 'suspended'}">${escapeHtml(status)}</span>
      </div>
      <div class="account-actions">
        <button class="btn-secondary account-action-primary" onclick="resetUserPassword('${u.id}')">Reset PW</button>
        ${status === 'active'
          ? `<button class="btn-secondary" onclick="setUserStatus('${u.id}', 'deactivate')">Deactivate</button>`
          : `<button class="btn-secondary" onclick="setUserStatus('${u.id}', 'activate')">Activate</button>`
        }
      </div>
    </article>`;
  }).join('');
}

async function resetUserPassword(userId) {
  const newPw = window.prompt('New password for user (min 8 chars):');
  if (!newPw || newPw.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }

  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const supaUrl = (window.ENV?.SUPABASE_URL) || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');

  const res = await fetch(`${supaUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'manage-user', action: 'reset-password', user_id: userId, new_password: newPw }),
  });
  const out = await res.json();
  if (!res.ok) { showToast(out.error || 'Failed to reset password', 'error'); return; }
  showToast('Password reset successfully', 'success');
}

async function setUserStatus(userId, action) {
  const label = action === 'activate' ? 'Activate' : 'Deactivate';
  if (!confirm(`${label} this user?`)) return;

  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const supaUrl = (window.ENV?.SUPABASE_URL) || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '');

  const res = await fetch(`${supaUrl}/functions/v1/create-user`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'manage-user', action, user_id: userId }),
  });
  const out = await res.json();
  if (!res.ok) { showToast(out.error || `Failed to ${action} user`, 'error'); return; }
  showToast(`User ${action}d`, 'success');
  await loadAllPeople();
}
```

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "feat(people): add loadAllPeople, resetUserPassword, setUserStatus JS functions"
```

---

## Task 7: Extend Edge Function with `manage-user` Mode

**Files:**
- Modify: `supabase/functions/create-user/index.ts`

- [ ] **Step 1: Add the `ManageUserBody` interface after the existing interfaces (around line 30)**

Find:
```ts
type Body = AccountModeBody | UserModeBody;
```

Replace with:
```ts
interface ManageUserBody {
  mode: 'manage-user';
  user_id: string;
  action: 'reset-password' | 'activate' | 'deactivate';
  new_password?: string;
}
type Body = AccountModeBody | UserModeBody | ManageUserBody;
```

- [ ] **Step 2: Add the dispatch case in the `serve` handler (after the `body.mode === 'user'` block, around line 68)**

Find:
```ts
  return json({ error: 'Unknown mode' }, 400);
});
```

Replace with:
```ts
  if (body.mode === 'manage-user') {
    const isAdmin = callerProfile.role === 'Superadmin' || callerProfile.role === 'Accountadmin';
    if (!isAdmin) return json({ error: 'Admin only' }, 403);
    return await manageUser(adminClient, body);
  }
  return json({ error: 'Unknown mode' }, 400);
});
```

- [ ] **Step 3: Add the `manageUser` function at the bottom of the file, before the `json` helper**

Find:
```ts
function json(body: unknown, status: number) {
```

Insert before it:
```ts
async function manageUser(admin: ReturnType<typeof createClient>, body: ManageUserBody) {
  const { user_id, action, new_password } = body;

  if (action === 'reset-password') {
    if (!new_password || new_password.length < 8) {
      return json({ error: 'Password too short (min 8 chars)' }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true }, 200);
  }

  if (action === 'deactivate') {
    const { error: authErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration: '876600h' });
    if (authErr) return json({ error: authErr.message }, 500);
    await admin.from('user_profiles').update({ status: 'suspended' }).eq('id', user_id);
    return json({ ok: true }, 200);
  }

  if (action === 'activate') {
    const { error: authErr } = await admin.auth.admin.updateUserById(user_id, { ban_duration: 'none' });
    if (authErr) return json({ error: authErr.message }, 500);
    await admin.from('user_profiles').update({ status: 'active' }).eq('id', user_id);
    return json({ ok: true }, 200);
  }

  return json({ error: 'Unknown action' }, 400);
}

```

- [ ] **Step 4: Deploy the Edge Function**

```bash
supabase functions deploy create-user --project-ref <your-project-ref>
```

Replace `<your-project-ref>` with your Supabase project reference ID (found in Project Settings → General).

Expected output: `Deployed create-user successfully.`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-user/index.ts
git commit -m "feat(edge): add manage-user mode for password reset, activate, deactivate"
```

---

## Task 8: End-to-End Manual Test

No automated test framework is configured for browser JS, so verify manually.

- [ ] **Step 1: Test data isolation**

  1. Log in as an Accountadmin for Account A.
  2. Open each of these pages and confirm rows shown all belong to Account A (check `account_id` values in Supabase dashboard):
     - Companies
     - Data Requests
     - Breach Log
     - DPIA
     - Cross-border
     - Alerts
     - Cases
     - Access (team members)
     - Consent
  3. Confirm no rows from Account B appear.

- [ ] **Step 2: Test People page visibility**

  1. As Accountadmin: confirm "People" appears in the Admin sidebar section.
  2. As a regular `user`: confirm "People" is NOT in the sidebar.
  3. As Superadmin: confirm "People" IS in the sidebar.

- [ ] **Step 3: Test People page load**

  1. Navigate to People as Accountadmin.
  2. Confirm the table shows users from ALL accounts (not just their own).
  3. Confirm columns: email, account name, role, status badge, action buttons.

- [ ] **Step 4: Test Reset Password**

  1. Find a test user in the People table.
  2. Click "Reset PW", enter a new password (8+ chars).
  3. Confirm toast: "Password reset successfully."
  4. Log out and attempt login as that user with the new password — confirm it works.

- [ ] **Step 5: Test Deactivate / Activate**

  1. Click "Deactivate" on a test user. Confirm toast + row badge changes to "suspended".
  2. Log out and try to log in as that user — confirm login fails (Supabase auth ban in effect).
  3. Go back to People page, click "Activate". Confirm badge changes to "active".
  4. Log in as that user again — confirm login succeeds.

- [ ] **Step 6: Commit test sign-off note**

```bash
git commit --allow-empty -m "test(people): manual UAT passed — data isolation and People Management verified"
```
