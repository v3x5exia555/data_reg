# Project Structure Modularization Design

## Context

DataRex is a vanilla JavaScript static SPA backed by Supabase. The current structure works, but `js/app.js` has grown to roughly 7,300 lines and now mixes unrelated responsibilities: page loading, routing, auth, session handling, profile forms, checklist rules, dashboard rendering, Supabase access, localStorage fallback, and page-level CRUD flows.

The goal is to improve maintainability without changing the product architecture. This project will keep vanilla JavaScript, script-tag loading, Supabase, current page fragments, and existing global function compatibility.

## Goals

- Reduce `js/app.js` from a large owner of application behavior into a small boot/orchestration file.
- Split stable responsibilities into focused modules with clear names and load order.
- Preserve existing runtime behavior, URLs, localStorage keys, Supabase table usage, and global APIs used by inline handlers and tests.
- Make future feature work easier by giving auth, routing, state, profile, checklist, and dashboard code obvious homes.
- Keep the change incremental and testable with the existing Playwright and pytest coverage.

## Non-Goals

- Do not introduce React, Vue, a bundler, TypeScript, or a package build step.
- Do not rewrite page fragments or remove inline `onclick` handlers in this phase.
- Do not redesign the UI or CSS system.
- Do not change Supabase schema, RLS policies, migrations, or deployment targets.
- Do not mix behavioral feature changes into the structural refactor.

## Recommended Approach

Use moderate modularization. Extract cohesive code from `js/app.js` into plain browser scripts under `js/core/`, `js/shared/`, and `js/features/`, then load those scripts from `index.html` before a smaller `js/app.js`.

Each extracted module will attach intentional compatibility exports to `window.DataRex` and, where required by existing HTML/tests, to existing `window.*` names. This preserves the current global API while making dependencies explicit.

## Target Structure

```text
js/
  app.js                         # boot/orchestration only after extraction
  core/
    state.js                     # state object, loadState, saveState, persistence queues
    supabase.js                  # Supabase client/config/session helpers
    router.js                    # page fragment loading, showPage, sidebar/nav behavior
    auth.js                      # auth listener, login, logout, registration, demo login
  shared/
    dom.js                       # DOM helpers, input/select setters, escaping
    toast.js                     # toast, success/error/warning helpers, Supabase error mapping
  features/
    profile.js                   # profile completeness, onboarding/profile forms, autosave
    checklist.js                 # checklist data, rules, scores, metadata, rendering
    dashboard.js                 # dashboard metrics and rendering
```

Later phases can extract records, companies, data requests, breach log, DPIA, and DEICA into feature modules. They are intentionally left out of the first phase to keep risk bounded.

## Module Responsibilities

### `js/core/state.js`

Owns the global application state and storage lifecycle:

- `state`
- `loadState()`
- `saveState()`
- local list helpers such as `readLocalList()` and `saveLocalList()`
- pending profile write queue helpers if they remain tightly coupled to state

The module must preserve current localStorage keys including `dataRexState`, `datarex_checklist_meta`, `datarex_records`, and `dataRexPendingProfileWrites`.

### `js/core/supabase.js`

Owns Supabase access and session primitives:

- `getSupabaseClient()`
- `isSupabaseConfigured()`
- `getSessionToken()`
- `getSessionId()`
- `getSessionExpiry()`
- `getRefreshToken()`
- `getCurrentSupabaseSession()`
- `apiFetch()` if still required

This module depends on `js/env.js` and must tolerate missing Supabase config for local/demo mode.

### `js/core/router.js`

Owns navigation and page loading:

- `PAGES_TO_LOAD`
- `PAGE_ASSET_VERSION`
- `loadAllPages()`
- `goTo()`
- `showPage()`
- `toggleSidebar()`
- `closeSidebar()`
- org dropdown navigation glue that is not profile-specific

`showPage()` must keep role hard-block behavior and nav permission checks intact. Existing globals such as `window.showPage`, `window.toggleSidebar`, and `window.closeSidebar` must remain available.

### `js/core/auth.js`

Owns authentication flows:

- `initAuthListener()`
- `doLogin()`
- `doLogout()`
- `doRegister()`
- `demoLogin()`
- local fallback user validation and session creation
- password strength and password hash helpers if they remain used only by auth flows

Compatibility exports must include `window.doLogin`, `window.doLogout`, `window.doRegister` if currently used, `window.demoLogin`, `window.hashPasswordForStorage`, and `window.updatePasswordStrength`.

### `js/shared/dom.js`

Owns generic browser helpers with no product logic:

- `setInputValue()`
- `setSelectValue()`
- HTML escaping helpers
- simple formatting helpers that are shared across multiple features

### `js/shared/toast.js`

Owns user-facing feedback helpers:

- `showToast()`
- `showSuccess()`
- `showError()` if used as a toast wrapper
- `showWarning()`
- `mapSupabaseError()`

Any form-specific error display functions should stay with their feature if they rely on page-specific DOM.

### `js/features/profile.js`

Owns profile and onboarding company information:

- profile field constants
- country normalization and validation
- profile completeness calculation
- profile form rendering and reading
- profile autosave
- onboarding profile save
- profile upsert and pending write draining if not kept in state

Compatibility exports must include `window.saveProfileCompanyInfo`, `window.saveProfileScope`, `window.discardProfileScope`, `window.drainPendingProfileWrites`, and `window.switchProfileTab`.

### `js/features/checklist.js`

Owns generated checklist logic:

- checklist definitions
- compliance rule definitions
- rule evaluation
- generated checklist construction
- checklist score and pending counts
- checklist metadata
- checklist rendering

Compatibility exports must include `window.updateChecklistMeta`, `window.generateComplianceChecklist`, `window.evaluateComplianceRules`, and `window.renderChecklist`.

### `js/features/dashboard.js`

Owns dashboard metrics and rendering:

- dashboard data loading
- DPO name resolution
- dashboard overview cards
- dashboard alert rendering
- dashboard date formatting

It may call checklist/profile helpers through `window.DataRex` or compatibility globals during the first phase.

## Loading Strategy

`index.html` will keep script-tag loading. New scripts should be loaded after existing base dependencies and before `js/app.js`.

Expected order:

```html
<script src="js/env.js"></script>
<script src="js/role_capability.js"></script>
<script src="js/shared/dom.js"></script>
<script src="js/shared/toast.js"></script>
<script src="js/core/state.js"></script>
<script src="js/core/supabase.js"></script>
<script src="js/features/profile.js"></script>
<script src="js/features/checklist.js"></script>
<script src="js/features/dashboard.js"></script>
<script src="js/core/router.js"></script>
<script src="js/core/auth.js"></script>
<script src="js/app.js"></script>
```

Existing page-specific scripts such as `vendor_logic.js`, `superadmin_logic.js`, `training_logic.js`, `activities_logic.js`, `dpo_logic.js`, and `sample_data.js` can remain in their current order until their dependencies are explicitly mapped.

## Compatibility Contract

The extraction must preserve:

- Current page IDs and hash routes.
- Current localStorage keys and data shapes.
- Current Supabase table names and query semantics.
- Current `window.*` functions invoked by inline HTML and tests.
- Current fallback behavior when Supabase is not configured or unavailable.
- Current test entry points such as `window.hashPasswordForStorage()` and `window.showPage()`.

New code should prefer `window.DataRex` as the structured namespace, but must not remove existing globals during this phase.

## Implementation Phases

1. Create directories and extract shared helpers.
2. Extract state and Supabase helpers.
3. Extract checklist logic because it has direct automated coverage and relatively clear boundaries.
4. Extract profile logic while preserving onboarding/profile tests.
5. Extract dashboard logic.
6. Extract router and auth after dependencies are explicit.
7. Reduce `js/app.js` to boot orchestration and any still-unextracted workflows.
8. Update `ARCHITECTURE.md` with the new module layout.

Each phase should run targeted tests before continuing.

## Testing Strategy

Run focused checks after each extraction batch:

- Login flow: `test_login.js`
- Onboarding flow: `test_onboarding_flow.js`
- Profile company info: `test_profile_company_info.js`
- PDPA checklist core: `test_pdpa_checklist_core.js`
- Compliance rules engine: `test_compliance_rules_engine.js`
- Access nav permissions: `test_access_nav_permissions.js`
- Existing pytest suite or targeted pytest files if a change touches Python-tested behavior

If script ordering becomes fragile, add a lightweight browser smoke test that asserts key globals exist after loading `index.html`.

## Risks And Mitigations

- **Script order regressions:** keep extraction order conservative and add missing-global smoke checks.
- **Hidden global dependencies:** preserve compatibility globals first, then gradually move callers to `window.DataRex`.
- **Local fallback regressions:** keep localStorage key names and shapes unchanged.
- **Supabase mode regressions:** do not alter query filters or RLS-related assumptions during extraction.
- **Large-diff review burden:** extract one responsibility at a time and avoid unrelated formatting churn.

## Acceptance Criteria

- `js/app.js` is meaningfully smaller and primarily handles boot/orchestration plus intentionally deferred workflows.
- New module folders exist with clear responsibility boundaries.
- Existing login, onboarding, profile, checklist, compliance rules, and access-control tests pass.
- Existing inline handlers and Playwright tests continue to work without HTML-wide rewrites.
- `ARCHITECTURE.md` reflects the new structure and compatibility strategy.
- No framework, bundler, deployment, database, or UI redesign changes are introduced.
