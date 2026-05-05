-- DPO (Data Protection Officer) Table
-- Run this in Supabase SQL Editor

-- ============================================
-- DPO TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS dpo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(255),
    company_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    nationality VARCHAR(50) NOT NULL,
    appointment_letter_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE dpo ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow DPO management" ON dpo
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert DPO for current user
INSERT INTO dpo (name, email, phone, nationality, appointment_letter_url, user_id)
VALUES 
    ('John Smith', 'dpo@company.com', '+60 12 345 6789', 'Malaysian', 'https://example.com/letter.pdf', 'demo-user');

-- Verify
SELECT * FROM dpo;