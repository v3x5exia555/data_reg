-- JARVIS GLOBAL PERSISTENCE & RLS AUDIT
-- Run this in Supabase SQL Editor to ensure ALL tables allow data operations
-- Version: 2.0 | Date: 2026-05-05

-- ═══════════════════════════════════════════════════════════════
-- GLOBAL RLS ENABLEMENT & POLICY FIX
-- ═══════════════════════════════════════════════════════════════

-- List of all tables that need RLS policies
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
        -- Enable RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        
        -- Drop existing policies
        EXECUTE format('DROP POLICY IF EXISTS "Enable read for all" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable insert for all" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable update for all" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Enable delete for all" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all access" ON %I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Allow all operations" ON %I', tbl);
        
        -- Create permissive policies for development
        EXECUTE format('CREATE POLICY "Enable read for all" ON %I FOR SELECT USING (true)', tbl);
        EXECUTE format('CREATE POLICY "Enable insert for all" ON %I FOR INSERT WITH CHECK (true)', tbl);
        EXECUTE format('CREATE POLICY "Enable update for all" ON %I FOR UPDATE USING (true) WITH CHECK (true)', tbl);
        EXECUTE format('CREATE POLICY "Enable delete for all" ON %I FOR DELETE USING (true)', tbl);
        
        RAISE NOTICE 'RLS policies created for table: %', tbl;
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════

-- Check all tables and their policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Count rows in each table
SELECT 
    'dpo' as table_name, COUNT(*) as row_count FROM dpo
UNION ALL SELECT 'data_records', COUNT(*) FROM data_records
UNION ALL SELECT 'data_requests', COUNT(*) FROM data_requests
UNION ALL SELECT 'processing_activities', COUNT(*) FROM processing_activities
UNION ALL SELECT 'dpia_assessments', COUNT(*) FROM dpia_assessments
UNION ALL SELECT 'vendors', COUNT(*) FROM vendors
UNION ALL SELECT 'companies', COUNT(*) FROM companies
UNION ALL SELECT 'breach_log', COUNT(*) FROM breach_log
UNION ALL SELECT 'cross_border_transfers', COUNT(*) FROM cross_border_transfers
UNION ALL SELECT 'training_records', COUNT(*) FROM training_records
UNION ALL SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL SELECT 'cases', COUNT(*) FROM cases
UNION ALL SELECT 'documents', COUNT(*) FROM documents
UNION ALL SELECT 'team_members', COUNT(*) FROM team_members
UNION ALL SELECT 'consent_records', COUNT(*) FROM consent_records
UNION ALL SELECT 'access_logs', COUNT(*) FROM access_logs
UNION ALL SELECT 'system_logs', COUNT(*) FROM system_logs;

-- Test SELECT on each table (should return data if exists)
SELECT 'dpo test' as test, COUNT(*) > 0 as has_data FROM dpo
UNION ALL SELECT 'data_records test', COUNT(*) > 0 FROM data_records
UNION ALL SELECT 'data_requests test', COUNT(*) > 0 FROM data_requests;

-- ═══════════════════════════════════════════════════════════════
-- INSERT TEST (for each table)
-- ═══════════════════════════════════════════════════════════════

-- Test DPO insert
INSERT INTO dpo (user_id, name, email, phone, nationality, appointment_date, training_status)
VALUES ('00000000-0000-0000-0000-000000000001', 'JARVIS Test DPO', 'jarvis@test.com', '+1234567890', 'US', CURRENT_DATE, 'pending')
ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name
RETURNING id, name, 'DPO test successful' as status;

-- Test data_records insert
INSERT INTO data_records (user_id, data_type, purpose, storage, access_level, retention_months, consent_obtained)
VALUES ('00000000-0000-0000-0000-000000000001', 'JARVIS Test Data', 'Testing', 'Test Storage', 'Internal', 12, true)
ON CONFLICT DO NOTHING
RETURNING id, data_type, 'data_records test successful' as status;

-- Test data_requests insert
INSERT INTO data_requests (org_id, requester_name, requester_email, request_type, description, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'JARVIS Test', 'jarvis@test.com', 'Access', 'Test request', 'Open')
RETURNING id, requester_name, 'data_requests test successful' as status;

-- ═══════════════════════════════════════════════════════════════
-- CLEANUP TEST DATA (optional - uncomment to run)
-- ═══════════════════════════════════════════════════════════════
-- DELETE FROM dpo WHERE name = 'JARVIS Test DPO';
-- DELETE FROM data_records WHERE data_type = 'JARVIS Test Data';
-- DELETE FROM data_requests WHERE requester_name = 'JARVIS Test';
