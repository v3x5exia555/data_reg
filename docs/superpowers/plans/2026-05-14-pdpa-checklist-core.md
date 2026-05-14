# PDPA Checklist Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Checklist page into the core PDPA compliance checklist while preserving the current app flow: Signup/Login -> Profile/Onboarding -> Dashboard.

**Architecture:** Keep the current static HTML and vanilla JavaScript architecture. Replace the small hardcoded `CHECKLIST` dataset in `js/app.js` with a broader PDPA checklist organized into compliance sections, then enhance `renderChecklist()` to show status, owner, due date, notes, evidence link/upload placeholder, and last-reviewed controls per item. Store local item metadata in `state.checklistMeta` and keep the existing boolean `state.checks` behavior for compatibility with dashboard score and Supabase `checklist_items`.

**Tech Stack:** Static HTML fragments, vanilla JavaScript, localStorage, optional Supabase checklist sync, Playwright regression.

---

## File Structure

- `test_pdpa_checklist_core.js`: new Playwright regression for expanded checklist sections, item metadata controls, local persistence, and dashboard score compatibility.
- `js/app.js`: replace `CHECKLIST`, add checklist metadata helpers, update `renderChecklist()`, update `toggleAllChecklist()`, and make dashboard counts use the canonical checklist item IDs.
- `pages/01__checklist.html`: update copy and progress label defaults so the page reads like the main PDPA checklist module.
- `css/style.css`: style checklist sections, item metadata rows, status selects, notes fields, evidence controls, and compact responsive layout.

## Task 1: Playwright Regression

**Files:**
- Create: `test_pdpa_checklist_core.js`

- [x] **Step 1: Add failing checklist regression**

Create `test_pdpa_checklist_core.js` that:

1. Opens `http://localhost:8060`.
2. Clears local/session storage.
3. Seeds a local completed-profile user.
4. Logs in.
5. Navigates to `#/checklist`.
6. Verifies these section headings exist:
   - `Company Profile & Applicability`
   - `DPO Appointment`
   - `Privacy Notice`
   - `Consent Management`
   - `Personal Data Inventory / Data Register`
   - `Data Subject Rights`
   - `Data Breach Notification`
   - `DPIA / Risk Assessment`
   - `Data Protection by Design`
   - `Cross-Border Transfer`
   - `Vendor / Data Processor Management`
   - `Retention & Disposal`
   - `Security Safeguards`
   - `Training & Awareness`
   - `Audit Evidence & Management Reporting`
7. Verifies one checklist item exposes:
   - `.check-status-select`
   - `.check-owner-input`
   - `.check-due-date-input`
   - `.check-notes-input`
   - `.check-evidence-input`
   - `.check-reviewed-date-input`
8. Sets the first item to `In Progress`, fills owner, due date, notes, evidence, and reviewed date.
9. Reloads `#/checklist` and verifies the metadata persisted in `localStorage`.
10. Marks one item done and verifies the progress label changes from `0 of N done` to `1 of N done`.

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
NODE_PATH=/private/tmp/datareg-playwright/node_modules node test_pdpa_checklist_core.js
```

Expected before implementation: FAIL because most section headings and metadata controls do not exist.

## Task 2: Checklist Data Model

**Files:**
- Modify: `js/app.js`

- [x] **Step 1: Replace `CHECKLIST` with PDPA sections**

Replace the current `CHECKLIST` constant with 15 sections. Each section must use stable IDs and item IDs. Minimum content:

- `profile-applicability`
  - `profile-complete`: Company profile is complete.
  - `industry-code-reviewed`: Applicable industry code/checklist has been reviewed.
- `dpo-appointment`
  - `dpo-appointed`: DPO has been appointed.
  - `dpo-contact-published`: DPO/contact channel is published in privacy notice or official channel.
- `privacy-notice`
  - `privacy-notice-created`: Privacy notice exists.
  - `privacy-notice-published`: Privacy notice is published and accessible.
- `consent-management`
  - `consent-captured`: Consent capture process is documented.
  - `withdrawal-process`: Withdrawal of consent process exists.
- `data-inventory`
  - `data-register-created`: Personal data inventory/data register is created.
  - `purpose-legal-basis-mapped`: Purpose and legal basis are mapped per data category.
- `data-subject-rights`
  - `rights-request-process`: Data subject request process is documented.
  - `rights-request-log`: Data subject request log is maintained.
- `breach-notification`
  - `breach-response-plan`: Data breach response plan exists.
  - `breach-notification-template`: Notification template and escalation path are ready.
- `dpia-risk`
  - `dpia-screening-process`: DPIA screening process exists.
  - `high-risk-processing-reviewed`: High-risk processing has been reviewed.
- `dpbd`
  - `privacy-by-design-checklist`: Data Protection by Design checklist is used for new projects.
  - `project-privacy-review`: Product/system privacy review evidence is retained.
- `cross-border-transfer`
  - `transfer-register`: Cross-border transfer register exists.
  - `transfer-safeguards`: Transfer safeguards are documented.
- `vendor-management`
  - `processor-register`: Vendor/data processor register exists.
  - `processor-contracts`: Processor contracts include data protection clauses.
- `retention-disposal`
  - `retention-schedule`: Retention schedule exists.
  - `disposal-process`: Secure disposal process is documented.
- `security-safeguards`
  - `access-controls`: Access controls are implemented.
  - `security-review`: Security safeguards are reviewed periodically.
- `training-awareness`
  - `staff-training`: Staff PDPA training is completed.
  - `training-evidence`: Training attendance/evidence is retained.
- `audit-evidence-reporting`
  - `evidence-vault`: Evidence is stored for completed checklist items.
  - `management-report`: Management/audit report can be produced.

Each item should have:

```js
{
  id: 'profile-complete',
  q: 'Company profile is complete',
  hint: 'Company name, industry, company size, country, and official email are filled.',
  evidence: 'Completed profile record'
}
```

- [x] **Step 2: Add checklist ID helper**

Add:

```js
function getChecklistItemIds() {
  return CHECKLIST.flatMap(section => section.items.map(item => item.id));
}
```

Use this helper in `updateScore()`, `renderDashboardOverview()`, `renderAudit()`, and any progress/count logic so legacy keys in `state.checks` do not inflate counts.

## Task 3: Checklist Metadata Persistence

**Files:**
- Modify: `js/app.js`

- [x] **Step 1: Initialize metadata state**

Ensure `state.checklistMeta` exists. In `loadState()`, restore `parsed.checklistMeta` when present.

- [x] **Step 2: Add metadata helpers**

Add:

```js
function getChecklistMeta(itemId) {
  if (!state.checklistMeta) state.checklistMeta = {};
  if (!state.checklistMeta[itemId]) {
    state.checklistMeta[itemId] = {
      status: state.checks[itemId] ? 'Done' : 'Not Started',
      owner: '',
      dueDate: '',
      notes: '',
      evidence: '',
      reviewedDate: ''
    };
  }
  return state.checklistMeta[itemId];
}

function updateChecklistMeta(itemId, patch) {
  const meta = getChecklistMeta(itemId);
  state.checklistMeta[itemId] = { ...meta, ...patch };
  state.checks[itemId] = state.checklistMeta[itemId].status === 'Done';
  saveState();
  updateScore();
}
```

Expose `updateChecklistMeta` on `window` because rendered HTML will call it from inline handlers.

## Task 4: Checklist UI Rendering

**Files:**
- Modify: `js/app.js`
- Modify: `css/style.css`
- Modify: `pages/01__checklist.html`

- [x] **Step 1: Update page copy**

Change `pages/01__checklist.html` subtitle to:

`Track required PDPA controls, owners, due dates, notes, and evidence.`

Change progress default from `0 of 12 done` to `0 of 0 done`.

- [x] **Step 2: Render metadata controls per item**

Update each checklist item in `renderChecklist()` to include:

- Status select with options `Not Started`, `In Progress`, `Done`, `Not Applicable`.
- Owner input.
- Due date input.
- Notes textarea.
- Evidence input for URL/file reference text.
- Last reviewed date input.

Clicking the checkbox should still toggle Done/Not Started and persist to Supabase when configured.

- [x] **Step 3: Add focused CSS**

Add CSS for:

- `.check-item`
- `.check-main`
- `.check-meta-grid`
- `.check-status-select`
- `.check-owner-input`
- `.check-due-date-input`
- `.check-notes-input`
- `.check-evidence-input`
- `.check-reviewed-date-input`
- responsive single-column layout on mobile.

## Task 5: Dashboard and Audit Compatibility

**Files:**
- Modify: `js/app.js`

- [x] **Step 1: Fix `updateScore()` count source**

Change `updateScore()` to count only IDs from `getChecklistItemIds()`.

- [x] **Step 2: Fix dashboard pending task count**

In `renderDashboardOverview()`, compute pending tasks as checklist IDs whose `state.checks[id]` is not true.

- [x] **Step 3: Preserve audit report behavior**

Update audit report checklist counting to call `getChecklistItemIds()` instead of rebuilding IDs inline.

## Task 6: Verify

**Files:**
- Modify if needed based on evidence.

- [x] **Step 1: Run focused checklist regression**

Run:

```bash
NODE_PATH=/private/tmp/datareg-playwright/node_modules node test_pdpa_checklist_core.js
```

Expected after implementation: PASS.

- [x] **Step 2: Run existing critical flows**

Run:

```bash
NODE_PATH=/private/tmp/datareg-playwright/node_modules node test_profile_company_info.js
NODE_PATH=/private/tmp/datareg-playwright/node_modules node test_onboarding_flow.js
```

Expected: both PASS.

- [x] **Step 3: Run static checks**

Run:

```bash
node --check js/app.js
node --check test_pdpa_checklist_core.js
rg -n "Company Profile & Applicability|Data Breach Notification|DPIA / Risk Assessment|Data Protection by Design|Cross-Border Transfer|Vendor / Data Processor Management|Audit Evidence & Management Reporting|check-status-select|check-owner-input|check-evidence-input" js/app.js test_pdpa_checklist_core.js css/style.css
```

Expected: syntax checks pass and all key checklist sections/controls are present.
