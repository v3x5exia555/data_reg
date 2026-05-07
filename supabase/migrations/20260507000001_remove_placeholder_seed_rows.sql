-- Remove placeholder seed rows that use the dummy UUID
-- '00000000-0000-0000-0000-000000000001'. These rows were inserted by
-- earlier migrations (20260428000002, 20260428000003, 20260505000004,
-- 20260505000005) and never matched any real user/company, so they were
-- invisible in the UI yet inflated table counts and confused debugging.
-- Real sample data is now seeded on demand via js/sample_data.js using
-- the live getCurrentOrgId().

DO $$
DECLARE
  placeholder UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- org_id-scoped tables
  DELETE FROM vendors                WHERE org_id = placeholder;
  DELETE FROM data_requests          WHERE org_id = placeholder;
  DELETE FROM breach_log             WHERE org_id = placeholder;
  DELETE FROM dpia_assessments       WHERE org_id = placeholder;
  DELETE FROM cross_border_transfers WHERE org_id = placeholder;
  DELETE FROM training_records       WHERE org_id = placeholder;

  -- user_id-scoped tables
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='dpo' AND column_name='user_id') THEN
    DELETE FROM dpo                  WHERE user_id = placeholder;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='data_records' AND column_name='user_id') THEN
    DELETE FROM data_records         WHERE user_id = placeholder;
  END IF;

  -- activity log uses TEXT user_id; cast for safety
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name='activity_log') THEN
    DELETE FROM activity_log
    WHERE user_id::text = placeholder::text;
  END IF;
END $$;
