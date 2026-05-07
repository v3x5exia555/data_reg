-- Follow-up cleanup for tables missed by 20260507000001:
-- alerts (5 placeholder rows from 20260428000002:179-183)
-- cases  (4 placeholder rows from 20260428000002:206-209)
-- Same root cause: rows seeded with the placeholder org_id are unreachable
-- from the UI because loaders filter by getCurrentOrgId().

DO $$
DECLARE
  placeholder UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  DELETE FROM alerts WHERE org_id = placeholder;
  DELETE FROM cases  WHERE org_id = placeholder;
END $$;
