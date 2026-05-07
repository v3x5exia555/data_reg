-- DPO RLS reset: drop legacy named policies and recreate permissive ones
-- so the app's anon/auth flows can read/write the dpo table.
-- Idempotent (DROP IF EXISTS + CREATE).
--
-- The original audit script also contained SELECT/INSERT debug statements;
-- those were removed because (a) SELECTs in migrations are no-ops and
-- (b) the INSERT used ON CONFLICT (user_id) but no UNIQUE constraint
-- exists on dpo.user_id, which broke `supabase db push`.

DROP POLICY IF EXISTS "Enable read for all"   ON dpo;
DROP POLICY IF EXISTS "Enable insert for all" ON dpo;
DROP POLICY IF EXISTS "Enable update for all" ON dpo;
DROP POLICY IF EXISTS "Enable delete for all" ON dpo;
DROP POLICY IF EXISTS "Allow DPO management"  ON dpo;

CREATE POLICY "Enable read for all"   ON dpo FOR SELECT USING (true);
CREATE POLICY "Enable insert for all" ON dpo FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all" ON dpo FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON dpo FOR DELETE USING (true);
