# DPO Delete Permanent Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the DPO Delete operation at `#/dpo` permanently reliable on the user's current device, surface server-side failures so they don't hide silently, prevent double-click races, and stabilize the regression test so future regressions are caught.

**Scope mode:** SCOPE REDUCTION (per CEO review 2026-05-14). The deeper root-cause work (Supabase RLS auth gap, four-source-of-truth refactor) is deferred to `TODOS.md`. This plan ships the minimum permanent fix the user already accepted as Option A.

**Architecture:** Keep the existing tombstone-based delete (commits `5c33989`, `6016f8d`). Layer three small reliability fixes on top:
1. **Visibility:** when Supabase delete returns zero rows (RLS denial), show a warning toast and log to console with full context.
2. **Race guard:** disable the Delete button on click so a double-click can't fire `deleteDPOLocal` twice with shifting indices.
3. **Test reliability:** replace the flaky 15-second `waitForURL` in `test_dpo_delete.js` with a polled state check, and add two regression tests (logout/relogin tombstone persistence; RLS-denial warning toast appearance).

**Tech Stack:** Static HTML fragments, vanilla JavaScript, localStorage, Supabase `dpo` table, Playwright regression.

**Out of scope (deferred to `TODOS.md`):**
- P1: Fix RLS auth gap so real Supabase deletes work (root cause for 16 tables).
- P2: Refactor DPO module to single source of truth.
- P3: Cap `dpo_deleted_ids` list at 500 entries (FIFO).
- P3: Disable Delete button when `confirm()` is replaced with a non-blocking modal (current `confirm()` is thread-blocking so the in-scope race is theoretical).

---

## File Structure

- `js/dpo_logic.js`: add rowcount check + warning toast in `deleteDPOLocal` after the Supabase delete call; add double-click guard inside the rendered Delete button onclick path.
- `test_dpo_delete.js`: stabilize `loginOnly` helper; add TEST 5 (logout/relogin tombstone persistence); add TEST 6 (RLS-denial warning toast).
- `TODOS.md`: already written by the CEO review with the 4 deferred items.

---

## Task 1: Add RLS-denial visibility to `deleteDPOLocal`

**Files:**
- Modify: `js/dpo_logic.js`

- [ ] **Step 1: Surface Supabase delete failures**

In `js/dpo_logic.js`, inside `deleteDPOLocal`, change the Supabase delete block from:

```js
const { error } = await supabase.from('dpo').delete().eq('id', record.id);
if (error) throw error;
console.log('[JARVIS] DPO deleted from Supabase:', record.id);
```

to:

```js
const { data, error } = await supabase
  .from('dpo')
  .delete()
  .eq('id', record.id)
  .select();
if (error) throw error;
if (!data || data.length === 0) {
  console.error('[JARVIS] DPO Supabase Delete returned 0 rows — likely blocked by RLS', {
    id: record.id,
    user_id: record.user_id,
    account_id: record.account_id || 'n/a'
  });
  if (typeof showToast === 'function') {
    showToast('Removed locally; database delete blocked. Re-sync may restore.', 'warning');
  }
} else {
  console.log('[JARVIS] DPO deleted from Supabase:', record.id);
}
```

Acceptance: appending `.select()` causes Supabase to return the deleted rows. An empty array means RLS denied the delete; we then warn the user instead of silently lying.

## Task 2: Add double-click guard on Delete button

**Files:**
- Modify: `js/dpo_logic.js`

- [ ] **Step 1: Disable button on click**

In `renderDPOTable`, change the Delete button markup from:

```js
<button class="btn-edit" onclick="deleteDPOLocal(${i})" ...>Delete</button>
```

to:

```js
<button class="btn-edit" onclick="this.disabled=true; deleteDPOLocal(${i})" ...>Delete</button>
```

Acceptance: when the user double-clicks, the second click is dispatched to a `disabled` button which does not fire `deleteDPOLocal`. The button is recreated by the subsequent `renderDPOTable` re-render so no manual re-enable is needed.

## Task 3: Stabilize `loginOnly` in regression test

**Files:**
- Modify: `test_dpo_delete.js`

- [ ] **Step 1: Replace flaky waitForURL with polled state check**

In `test_dpo_delete.js`, inside `loginOnly`, change:

```js
await page.click('#login-btn');
await page.waitForURL(/#\/dashboard$/, { timeout: 15000 });
```

to:

```js
await page.click('#login-btn');
await page.waitForFunction(
  () => location.hash === '#/dashboard' && document.querySelector('#page-dashboard.active'),
  null,
  { timeout: 30000, polling: 200 }
);
```

Acceptance: login no longer flakes intermittently. The polled check tolerates slow Supabase auth handshakes and detects readiness as soon as the dashboard page becomes active, not just when the URL changes.

## Task 4: Add TEST 5 — logout/relogin tombstone persistence

**Files:**
- Modify: `test_dpo_delete.js`

- [ ] **Step 1: Add the test block**

Insert this test before the final `assert(pageErrors.length === 0, ...)` line in `test_dpo_delete.js`:

```js
// ── TEST 5: Tombstone survives logout + login on same browser ───
{
  const page = await browser.newPage();
  page.on('pageerror', e => pageErrors.push(e.message));
  await blockDpoSupabase(page);
  await loginOnly(page);

  const record = {
    id: 'test-dpo-del-005',
    name: 'Logout Persist DPO',
    email: 'logout@dpo.test',
    appointment_date: '2026-05-01',
    training_status: 'pending',
    status: 'Active',
    created_at: new Date().toISOString()
  };
  await goToDPOWithRecord(page, record);

  // Delete the record
  await page.locator('#dpo-table-body .btn-edit').first().click();
  await page.waitForTimeout(500);

  // Logout (clear session but keep persistent localStorage keys)
  await page.evaluate(() => {
    if (typeof window.logout === 'function') window.logout();
    else { sessionStorage.clear(); location.hash = '#/'; }
  });
  await page.waitForTimeout(500);

  // Log back in as the same user
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#screen-landing.screen.active', { timeout: 10000 });
  await page.getByRole('button', { name: /^Log in$/i }).click();
  await page.waitForSelector('#screen-login.screen.active', { timeout: 5000 });
  // The user's email/password were the last seeded ones; reuse the global vars or re-seed
  // For simplicity, this test assumes loginOnly's seeded user is still in datarex_users.
  await page.evaluate(() => {
    const users = JSON.parse(localStorage.getItem('datarex_users') || '[]');
    const u = users[users.length - 1];
    if (u) { document.getElementById('login-email').value = u.email; }
  });
  await page.fill('#login-password', 'Account123!');
  await page.click('#login-btn');
  await page.waitForFunction(
    () => location.hash === '#/dashboard' && document.querySelector('#page-dashboard.active'),
    null,
    { timeout: 30000, polling: 200 }
  );

  await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
  await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
  await page.waitForTimeout(1000);

  const tableText = await page.locator('#dpo-table-body').innerText();
  assert(
    !tableText.includes('Logout Persist DPO'),
    `Tombstone did not persist across logout/login: "${tableText}"`
  );
  console.log('PASS tombstone persists across logout + login');

  await page.close();
}
```

Acceptance: simulates the realistic single-device user behavior (log out, log back in, expect deleted records to stay gone).

## Task 5: Add TEST 6 — RLS-denial warning toast

**Files:**
- Modify: `test_dpo_delete.js`

- [ ] **Step 1: Add the test block**

Insert this test after TEST 5 and before the final assertion:

```js
// ── TEST 6: G1 — warning toast appears when Supabase delete returns 0 rows ─
{
  const page = await browser.newPage();
  page.on('pageerror', e => pageErrors.push(e.message));

  // Intercept Supabase: GET returns the record, DELETE returns 0 rows (RLS-denied)
  await page.route(/supabase\.co.*\/rest\/v1\/dpo/, (route) => {
    const method = route.request().method();
    if (method === 'DELETE') {
      // Empty array simulates RLS-blocked delete (status 200 + no rows)
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else if (method === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
  });

  await loginOnly(page);

  const record = {
    id: 'test-dpo-del-006',
    name: 'RLS Warn DPO',
    email: 'rlswarn@dpo.test',
    appointment_date: '2026-06-01',
    training_status: 'pending',
    status: 'Active',
    created_at: new Date().toISOString()
  };

  await page.evaluate((rec) => {
    localStorage.setItem('dpo_data', JSON.stringify([rec]));
    window.confirm = () => true;
  }, record);

  await page.evaluate(() => window.showPage('dpo', document.getElementById('nav-dpo')));
  await page.waitForSelector('#page-dpo.active', { timeout: 10000 });
  await page.waitForFunction(
    (name) => document.getElementById('dpo-table-body')?.innerText?.includes(name),
    record.name,
    { timeout: 10000 }
  );

  // Click delete — Supabase DELETE will return [] (simulated RLS denial)
  await page.locator('#dpo-table-body .btn-edit').first().click();

  // Wait for warning toast
  const toast = await page.waitForSelector('.toast.warning, .toast-warning, [data-toast="warning"]', { timeout: 5000 }).catch(() => null);
  assert(toast, 'Expected warning toast when Supabase delete returns 0 rows');

  const toastText = await toast.innerText();
  assert(
    /database delete blocked|blocked|re-sync/i.test(toastText),
    `Toast text did not mention block/re-sync: "${toastText}"`
  );
  console.log('PASS RLS-denial warning toast appears');

  await page.close();
}
```

Note: the selector for `.toast.warning` may need adjustment based on the actual toast DOM produced by `showToast`. Inspect the current `showToast` implementation in `js/app.js` and adjust the selector accordingly. If the warning class is `.toast-warn` or similar, update the locator.

Acceptance: when Supabase rejects the delete, the user sees the warning toast and the test catches a regression that would re-introduce silent failures.

## Task 6: Verify

**Files:**
- Modify based on failures.

- [ ] **Step 1: Run focused DPO delete tests**

```bash
NODE_PATH=/private/tmp/datareg-playwright/node_modules node test_dpo_delete.js
```

Expected: all 6 tests PASS, no `BROWSER PAGE ERROR` lines.

- [ ] **Step 2: Run adjacent regression tests to confirm no collateral damage**

```bash
NODE_PATH=/private/tmp/datareg-playwright/node_modules node test_pdpa_checklist_core.js
```

Expected: PASS. The DPO changes should not touch checklist behavior.

- [ ] **Step 3: Static checks**

```bash
node --check js/dpo_logic.js
node --check test_dpo_delete.js
rg -n "showToast.*blocked|select\\(\\)|this\\.disabled=true" js/dpo_logic.js test_dpo_delete.js
```

Expected: syntax checks pass and all three reliability hooks are present in the files.

## Task 7: Commit and deploy

**Files:**
- No file changes; git operations only.

- [ ] **Step 1: Stage and commit**

```bash
git add js/dpo_logic.js test_dpo_delete.js TODOS.md docs/superpowers/plans/2026-05-14-dpo-delete-permanent-fix.md
git commit -m "fix: DPO delete reliability — RLS-denial visibility, double-click guard, test stabilization"
```

- [ ] **Step 2: Push**

```bash
git push origin main
```

Hostinger auto-deploy picks up the change. No manual deploy step.

- [ ] **Step 3: Smoke check on live**

Open `http://localhost:8060/#/dpo`, add a DPO, delete it, refresh — verify it stays gone. If you have a Supabase row that you know is RLS-blocked, attempt to delete it and confirm the new warning toast appears.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | clean | mode: SCOPE_REDUCTION, 0 critical gaps, 4 TODOs deferred (P1 RLS, P2 refactor, P3 cap, P3 dblclick) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | n/a (no UI scope beyond toast text) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0
**VERDICT:** CEO CLEARED (REDUCTION mode) — eng review required before shipping (run `/plan-eng-review` next)
