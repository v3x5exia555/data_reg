-- Backfill: for each existing account, copy the NULL-account_id consent rows as per-account rows.
-- These were seeded as global demo data before multi-tenancy was added.
INSERT INTO consent_settings (category, title, description, is_enabled, account_id)
SELECT c.category, c.title, c.description, c.is_enabled, a.id
FROM consent_settings c
CROSS JOIN accounts a
WHERE c.account_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM consent_settings existing
    WHERE existing.account_id = a.id
      AND existing.title = c.title
  );

-- Remove the now-orphaned template rows (they had no account_id).
DELETE FROM consent_settings WHERE account_id IS NULL;
