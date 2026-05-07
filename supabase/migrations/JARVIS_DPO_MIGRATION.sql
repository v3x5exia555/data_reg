-- ============================================================
-- JARVIS: DPO Table SQL Migration
-- Copy this entire file and paste into Supabase SQL Editor
-- ============================================================

-- Step 1: Create the DPO table with all required fields
CREATE TABLE IF NOT EXISTS dpo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User & Company association
    user_id VARCHAR(255),
    company_id VARCHAR(255),
    
    -- Core DPO Information
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    nationality VARCHAR(50) NOT NULL,
    
    -- Appointment Details
    appointment_date DATE,
    appointment_letter_url TEXT,
    appointment_letter_name VARCHAR(255),
    appointment_letter_size INTEGER,
    
    -- Training & Certification
    training_status VARCHAR(50) DEFAULT 'pending',
    training_completion_date DATE,
    training_certificate_url TEXT,
    
    -- Additional Contact
    address TEXT,
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dpo_user_id ON dpo(user_id);
CREATE INDEX IF NOT EXISTS idx_dpo_company_id ON dpo(company_id);
CREATE INDEX IF NOT EXISTS idx_dpo_is_active ON dpo(is_active);

-- Step 3: Enable Row Level Security
ALTER TABLE dpo ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policy
-- Development: Allow all operations (replace with restrictive policies for production)
DROP POLICY IF EXISTS "Allow DPO management" ON dpo;
CREATE POLICY "Allow DPO management" ON dpo
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Step 5: Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger for auto-update
DROP TRIGGER IF EXISTS update_dpo_updated_at ON dpo;
CREATE TRIGGER update_dpo_updated_at
    BEFORE UPDATE ON dpo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VERIFICATION: Run these to confirm setup
-- ============================================================

-- Check table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'dpo'
ORDER BY ordinal_position;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'dpo';

-- Clear any test data
DELETE FROM dpo WHERE user_id LIKE 'demo%' OR user_id LIKE 'test%';

-- Insert test DPO record
INSERT INTO dpo (
    name, 
    email, 
    phone, 
    nationality, 
    appointment_date,
    training_status,
    user_id, 
    company_id
) VALUES (
    'Ahmad Rahman',
    'ahmad@acme.com',
    '+60 12 345 6789',
    'Malaysian',
    CURRENT_DATE,
    'certified',
    'demo-user-001',
    'acme-company-001'
);

-- Verify data was inserted
SELECT * FROM dpo;

-- Count should be 1
SELECT COUNT(*) as total_dpo_records FROM dpo;
