-- DPO (Data Protection Officer) Table - Updated Schema
-- NOTE: If table exists, use migration 20260505000002_dpo_add_missing_columns.sql

-- ============================================
-- DPO TABLE - ENHANCED SCHEMA
-- ============================================

-- Only create table if it doesn't exist
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

-- Only create indexes if columns exist (handled by second migration if needed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dpo' AND column_name = 'is_active') THEN
        CREATE INDEX IF NOT EXISTS idx_dpo_user_id ON dpo(user_id);
        CREATE INDEX IF NOT EXISTS idx_dpo_company_id ON dpo(company_id);
        CREATE INDEX IF NOT EXISTS idx_dpo_is_active ON dpo(is_active);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Indexes will be created by subsequent migration';
END $$;

-- Enable RLS
ALTER TABLE dpo ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
DROP POLICY IF EXISTS "Allow DPO management" ON dpo;
CREATE POLICY "Allow DPO management" ON dpo
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS update_dpo_updated_at ON dpo;
CREATE TRIGGER update_dpo_updated_at
    BEFORE UPDATE ON dpo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data (only if table was just created)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dpo LIMIT 1) THEN
        INSERT INTO dpo (name, email, phone, nationality, appointment_date, training_status, user_id, company_id)
        VALUES 
            ('Ahmad Rahman', 'ahmad@acme.com', '+60 12 345 6789', 'Malaysian', '2024-01-15', 'certified', 'demo-user-001', 'acme-company-001');
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Sample data skipped';
END $$;

-- Verify
SELECT * FROM dpo LIMIT 5;
SELECT COUNT(*) as dpo_count FROM dpo;
