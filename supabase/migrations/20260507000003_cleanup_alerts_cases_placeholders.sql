-- Follow-up cleanup for alerts/cases (migration 20260507000001 already
-- handles these via the table arrays it iterates; this file remains as a
-- safety net in case 20260507000001 is run on an older snapshot that
-- skipped them). Idempotent.

DO $$
DECLARE
  placeholder TEXT := '00000000-0000-0000-0000-000000000001';
  tbl         TEXT;
  tbls        TEXT[] := ARRAY['alerts', 'cases'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'org_id'
    ) THEN
      EXECUTE format('DELETE FROM %I WHERE org_id::text = $1', tbl) USING placeholder;
    END IF;
  END LOOP;
END $$;
