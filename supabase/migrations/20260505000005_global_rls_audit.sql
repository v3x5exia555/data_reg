-- Global RLS reset: enable RLS and recreate permissive policies on every
-- app table so reads/writes work for the dev/UAT environment.
-- Idempotent (DROP IF EXISTS + CREATE) and safe to re-run.
--
-- The original audit script also contained SELECT verification queries
-- and INSERT smoke-tests with ON CONFLICT clauses that referenced
-- non-existent UNIQUE constraints. Those broke `supabase db push` and
-- were stripped out.

DO $$
DECLARE
    tbl TEXT;
    tbls TEXT[] := ARRAY[
        'dpo',
        'data_records',
        'data_requests',
        'processing_activities',
        'dpia_assessments',
        'vendors',
        'companies',
        'breach_log',
        'cross_border_transfers',
        'training_records',
        'alerts',
        'cases',
        'documents',
        'team_members',
        'consent_records',
        'access_logs',
        'system_logs'
    ];
BEGIN
    FOREACH tbl IN ARRAY tbls
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

        EXECUTE format('DROP POLICY IF EXISTS "Enable read for all"   ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable insert for all" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable update for all" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable delete for all" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all access"      ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all operations"  ON %I', tbl);

        EXECUTE format('CREATE POLICY "Enable read for all"   ON %I FOR SELECT USING (true)',                  tbl);
        EXECUTE format('CREATE POLICY "Enable insert for all" ON %I FOR INSERT WITH CHECK (true)',             tbl);
        EXECUTE format('CREATE POLICY "Enable update for all" ON %I FOR UPDATE USING (true) WITH CHECK (true)', tbl);
        EXECUTE format('CREATE POLICY "Enable delete for all" ON %I FOR DELETE USING (true)',                  tbl);
    END LOOP;
END $$;
