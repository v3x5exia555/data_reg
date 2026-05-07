-- Remove placeholder seed rows that use the dummy UUID
-- '00000000-0000-0000-0000-000000000001'. These rows were inserted by
-- earlier migrations (20260428000002, 20260428000003, 20260505000004,
-- 20260505000005) and never matched any real user/company, so they were
-- invisible in the UI yet inflated table counts and confused debugging.
-- Real sample data is now seeded on demand via js/sample_data.js using
-- the live getCurrentOrgId().
--
-- All DELETEs are dispatched via EXECUTE format() because (a) some
-- tables/columns may not exist on every environment and (b) org_id
-- column types vary (UUID vs VARCHAR), so we cast to text on both sides.

DO $$
DECLARE
  placeholder TEXT := '00000000-0000-0000-0000-000000000001';
  rec         RECORD;
  tables_org  TEXT[] := ARRAY[
    'vendors',
    'data_requests',
    'breach_log',
    'dpia_assessments',
    'cross_border_transfers',
    'training_records',
    'alerts',
    'cases'
  ];
  tables_user TEXT[] := ARRAY[
    'dpo',
    'data_records',
    'activity_log'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables_org LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'org_id'
    ) THEN
      EXECUTE format('DELETE FROM %I WHERE org_id::text = $1', tbl) USING placeholder;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY tables_user LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id'
    ) THEN
      EXECUTE format('DELETE FROM %I WHERE user_id::text = $1', tbl) USING placeholder;
    END IF;
  END LOOP;
END $$;
