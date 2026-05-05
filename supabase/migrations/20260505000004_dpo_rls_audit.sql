-- JARVIS DPO TABLE AUDIT & RLS FIX
-- Run this in Supabase SQL Editor to ensure DPO data is accessible

-- ============================================
-- STEP 1: Verify table exists
-- ============================================
SELECT 'Checking dpo table...' as status;
SELECT COUNT(*) as total_rows FROM dpo LIMIT 1;

-- ============================================
-- STEP 2: Drop existing restrictive policies
-- ============================================
DROP POLICY IF EXISTS "Enable read for all" ON dpo;
DROP POLICY IF EXISTS "Enable insert for all" ON dpo;
DROP POLICY IF EXISTS "Enable update for all" ON dpo;
DROP POLICY IF EXISTS "Enable delete for all" ON dpo;
DROP POLICY IF EXISTS "Allow DPO management" ON dpo;

-- ============================================
-- STEP 3: Create permissive policies for development
-- ============================================
CREATE POLICY "Enable read for all" ON dpo
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all" ON dpo  
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all" ON dpo
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all" ON dpo
    FOR DELETE USING (true);

-- ============================================
-- STEP 4: Verify policies
-- ============================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'dpo';

-- ============================================
-- STEP 5: Test insert (replace values as needed)
-- ============================================
INSERT INTO dpo (user_id, name, email, phone, nationality, appointment_date, training_status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test DPO', 'test@example.com', '+1234567890', 'US', CURRENT_DATE, 'pending')
ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
RETURNING *;

-- ============================================
-- STEP 6: Verify data
-- ============================================
SELECT * FROM dpo ORDER BY created_at DESC LIMIT 5;

-- ============================================
-- STEP 7: Clean up test record (optional)
-- ============================================
-- DELETE FROM dpo WHERE user_id = '00000000-0000-0000-0000-000000000001' AND name = 'Test DPO';
