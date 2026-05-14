# TODOs

Deferred work surfaced by reviews. Each entry: **What / Why / Effort / Priority**.
Add new items at the top of the relevant section.

---

## DPO module

### Fix RLS auth gap so real Supabase deletes work
- **What:** The May 9 RLS lockdown (`20260509000007_account_admin_rls_lockdown.sql`) requires `auth.uid()` to identify the caller. The app's localStorage-based login (`datarex_users`, `password_hash`) never establishes a Supabase Auth session, so `auth.uid()` is NULL and all DELETE/UPDATE/INSERT operations on RLS-locked tables silently fail (0 rows affected, no error returned).
- **Why:** This is the actual root cause of the DPO delete bug. The current tombstone fix hides the symptom on the user's current device but leaves zombie records in Supabase. The same bug applies to **16 tables** locked down in that migration: companies, vendors, training_records, data_records, data_requests, breach_log, dpia_assessments, dpia_screenings, cross_border_transfers, cases, alerts, dpo, processing_activities, documents, team_members, consent_settings.
- **Approach options:** (a) Wire the localStorage login flow into Supabase Auth so `signInWithPassword` runs alongside, populating `auth.uid()`. (b) Route mutating operations through a service-role Edge Function. (c) Loosen RLS to use a custom JWT claim derived from `datarex_users`.
- **Where to start:** `js/dpo_logic.js:deleteDPOLocal` (instrumented with rowcount check from this CEO review), `supabase/migrations/20260509000007_account_admin_rls_lockdown.sql`, `js/env.js` (Supabase client init).
- **Effort:** M — human ~1 day / CC ~2 hr
- **Priority:** P1
- **Depends on:** none. Blocks: removing the tombstone code, restoring multi-device coherence.

### Refactor DPO module to single source of truth
- **What:** Kill the four-way local merge logic in `js/dpo_logic.js`. Currently `getLocalDPORecords()` reads from `dpo_data` + `datarex_dpo` + `state.dpo` + `state.dpoRecords` and dedupes. Pick one source of truth: either Supabase + transparent local cache, or local + outbox queue for Supabase sync.
- **Why:** The file has been touched 6 times in 30 days, mostly to patch reconciliation bugs between these sources. The header still reads `STATUS: LOCAL STORAGE MODE (LSM)` — the codebase is stuck mid-migration and accumulating debt. Every new feature in this module adds cost until this is resolved.
- **Effort:** L — human ~3-4 days / CC ~4 hr
- **Priority:** P2
- **Depends on:** P1 RLS fix above (cleaner to refactor against a working backend).
- **Blocked by:** —

### Cap dpo_deleted_ids tombstone list at 500 entries (FIFO)
- **What:** When `dpo_deleted_ids` exceeds 500 entries, drop the oldest. ~5 LOC in `addDeletedDPOId`.
- **Why:** Tombstone list grows unbounded. Not a real problem at human-scale DPO usage (most users will have <50 deletes ever) but worth a TODO so a future maintainer knows it's intentional. If the upstream RLS fix lands, the tombstone can be removed entirely and this TODO becomes moot.
- **Effort:** S — human ~10 min / CC ~5 min
- **Priority:** P3

### Disable Delete button on click when confirm() is replaced with a non-blocking modal
- **What:** When `window.confirm()` is replaced with a custom (non-blocking) modal, add `button.disabled = true` at click time to prevent double-click races.
- **Why:** Captured here for traceability. The in-scope fix uses native `confirm()` which blocks the JS thread, making the race impossible today. If anyone swaps in a React/promise-based modal, the race becomes real.
- **Effort:** S — human ~10 min / CC ~3 min
- **Priority:** P3
- **Trigger:** when modifying `getDPOModal()` or replacing `confirm()` calls in dpo_logic.js

---
