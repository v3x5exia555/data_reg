-- =============================================
-- DATAREX SUPABASE SCHEMA MIGRATION
-- Run this in your Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. VENDORS TABLE - Add missing columns
-- =============================================
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'Low';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS has_agreement BOOLEAN DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS agreement_date DATE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =============================================
-- 2. DATA_REQUESTS TABLE - Add missing columns
-- =============================================
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS requester_email TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE data_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =============================================
-- 3. DATA_RECORDS TABLE - Add missing columns
-- =============================================
ALTER TABLE data_records ADD COLUMN IF NOT EXISTS data_name TEXT;
ALTER TABLE data_records ADD COLUMN IF NOT EXISTS data_subject TEXT;
ALTER TABLE data_records ADD COLUMN IF NOT EXISTS retention_period TEXT;
ALTER TABLE data_records ADD COLUMN IF NOT EXISTS security_measures TEXT;

-- =============================================
-- 4. BREACH_LOG TABLE - Add columns
-- =============================================
ALTER TABLE breach_log ADD COLUMN IF NOT EXISTS breach_type TEXT;
ALTER TABLE breach_log ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE breach_log ADD COLUMN IF NOT EXISTS affected_count INTEGER DEFAULT 0;
ALTER TABLE breach_log ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Reported';
ALTER TABLE breach_log ADD COLUMN IF NOT EXISTS resolution TEXT;

-- =============================================
-- 5. DPIA_ASSESSMENTS TABLE
-- =============================================
ALTER TABLE dpia_assessments ADD COLUMN IF NOT EXISTS necessity TEXT;
ALTER TABLE dpia_assessments ADD COLUMN IF NOT EXISTS risks TEXT;
ALTER TABLE dpia_assessments ADD COLUMN IF NOT EXISTS mitigations TEXT;
ALTER TABLE dpia_assessments ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE dpia_assessments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- =============================================
-- 6. CROSS_BORDER_TRANSFERS TABLE
-- =============================================
ALTER TABLE cross_border_transfers ADD COLUMN IF NOT EXISTS transfer_country TEXT;
ALTER TABLE cross_border_transfers ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE cross_border_transfers ADD COLUMN IF NOT EXISTS data_types TEXT;
ALTER TABLE cross_border_transfers ADD COLUMN IF NOT EXISTS legal_basis TEXT;
ALTER TABLE cross_border_transfers ADD COLUMN IF NOT EXISTS safeguards TEXT;

-- =============================================
-- 7. TRAINING_RECORDS TABLE
-- =============================================
ALTER TABLE training_records ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE training_records ADD COLUMN IF NOT EXISTS training_type TEXT;
ALTER TABLE training_records ADD COLUMN IF NOT EXISTS training_date DATE;
ALTER TABLE training_records ADD COLUMN IF NOT EXISTS completion_status TEXT;

-- =============================================
-- 8. DPO TABLE
-- =============================================
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS role_type TEXT;
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS appointed_date DATE;

-- =============================================
-- 9. COMPANIES TABLE - Ensure all columns
-- =============================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Malaysia';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reg_no TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS dpo_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- =============================================
-- VERIFICATION - Check tables exist
-- =============================================
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- =============================================
-- VERIFICATION - Check vendors columns
-- =============================================
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vendors';

-- =============================================
-- VERIFICATION - Check data_requests columns
-- =============================================
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'data_requests';

-- =============================================
-- SAMPLE DATA - Insert test vendor (optional)
-- =============================================
-- INSERT INTO vendors (org_id, vendor_name, service_type, data_shared, risk_level, status, has_agreement, agreement_date)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'AWS Singapore', 'Cloud Hosting', 'All app data', 'Low', 'Active', true, CURRENT_DATE);

-- INSERT INTO vendors (org_id, vendor_name, service_type, data_shared, risk_level, status, has_agreement)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'Mailchimp', 'Email Marketing', 'Customer email, name', 'Medium', 'Active', true);

-- INSERT INTO vendors (org_id, vendor_name, service_type, data_shared, risk_level, status, has_agreement)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'FreshDesk', 'Customer Support', 'Customer contact info', 'High', 'Active', false);

PRINT 'Migration completed successfully!';
