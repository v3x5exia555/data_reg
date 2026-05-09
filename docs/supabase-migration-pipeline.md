# DataRex — Supabase Migration Pipeline

## Overview

Apply local `.sql` migration files to the remote Supabase database (`xvjfosmzmfitrcivsgpu`). The pipeline uses the Supabase CLI to track which migrations have been applied and push pending ones.

---

## 1. Prerequisites

| Requirement | Check                  |
|------------|------------------------|
| Supabase CLI | `supabase --version`  |
| Docker      | Only needed for `supabase start` (local dev). Not required for `db push`. |
| Project linked | `supabase link --project-ref xvjfosmzmfitrcivsgpu` |

The project is already linked to remote: `xvjfosmzmfitrcivsgpu` (Data_reg).

---

## 2. Migration Files

All migrations live in `supabase/migrations/`.

### Naming Convention

```
<timestamp>_<description>.sql
```

Example: `20260508000001_create_accounts_table.sql`

> **Warning:** Files not matching the `<timestamp>_name.sql` pattern are **skipped** (e.g., `JARVIS_DPO_MIGRATION.sql`).

### Directory

```
supabase/migrations/
├── 20260426094202_create_users_roles.sql
├── 20260426105644_create_data_records_table.sql
├── ...
├── 20260509000003_consent_settings_backfill.sql
├── JARVIS_DPO_MIGRATION.sql          ← SKIPPED (bad name)
└── _deferred/                        ← Holds migrations held back intentionally
```

---

## 3. Pipeline Commands

### Check Migration Status

See which migrations are applied locally vs remotely:

```bash
supabase migration list
```

Output shows:
```
  Local          | Remote         | Time (UTC)
  ---------------|----------------|---------------------
   20260508000001 |                | 2026-05-08 00:00:01   ← pending
   20260508000002 |                | 2026-05-08 00:00:02   ← pending
   20260508000003 | 20260508000003 | 2026-05-08 00:00:03   ← applied
```

### Push Pending Migrations

```bash
supabase db push
```

This:
1. Connects to the remote Supabase PostgreSQL database
2. Reads the `supabase_migrations` table to see what's been applied
3. Prompts to apply any pending migrations in order
4. Runs each `.sql` file sequentially

---

## 4. Common Failures & Fixes

### 4a. Unique Constraint Violation

**Error:**
```
ERROR: duplicate key value violates unique constraint "companies_account_id_unique"
```

**Cause:** A UNIQUE constraint on `companies.account_id` prevents multiple rows from sharing the same default account UUID during backfill.

**Fix:** Drop the constraint before backfill, then re-create as a plain index:

```sql
ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_account_id_unique;
-- ... run backfill UPDATEs ...
CREATE INDEX IF NOT EXISTS idx_companies_account_id ON public.companies(account_id);
```

Applied in: `20260508000004_backfill_default_account.sql`

### 4b. Non-Existent Column

**Error:**
```
ERROR: column "title" of relation "consent_settings" does not exist
```

**Cause:** The backfill INSERT references `title` but the table was created with `toggle_label` instead.

**Fix:** Use the actual column names from the original `CREATE TABLE`:

```sql
-- Wrong:
INSERT INTO consent_settings (category, title, description, is_enabled, account_id)

-- Right:
INSERT INTO consent_settings (category, toggle_key, toggle_label, is_enabled, note, account_id)
```

Applied in: `20260509000003_consent_settings_backfill.sql`

---

## 5. Full Pipeline Steps

```
1. Edit migration .sql files locally
         │
         ▼
2. Check status: supabase migration list
         │
         ▼
3. If conflicts exist, fix migration files
         │
         ▼
4. Push: supabase db push
         │
         ▼
5. If FAILED:
   ├── Fix the offending .sql file
   └── Re-run: supabase db push
         │
         ▼
6. Verify: supabase migration list (all Local == Remote)
```

---

## 6. Important Rules

- **Never edit an already-applied migration** on the remote. If a migration is already in the `supabase_migrations` table, `supabase db push` skips it. Create a **new** migration file to alter/fix.
- **File naming is strict.** Must be `<timestamp>_<name>.sql` or it's silently skipped.
- **Migrations are idempotent** where possible: use `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP CONSTRAINT IF EXISTS`.
- **Test locally first** (if Docker is available): `supabase start` → `supabase db push` against local DB.

---

## 7. Quick Reference

```bash
# Status
supabase migration list

# Push pending
supabase db push

# Reset local DB (Docker only)
supabase db reset

# Pull remote schema (creates a new migration)
supabase db pull
```
