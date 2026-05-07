-- ============================================================
-- JARVIS: DPO Table Column Migration
-- Adds missing columns to existing dpo table
-- ============================================================

-- Add missing columns (IF NOT EXISTS pattern for safety)
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS appointment_date DATE;
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS appointment_letter_name VARCHAR(255);
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS appointment_letter_size INTEGER;
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS training_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS training_completion_date DATE;
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS training_certificate_url TEXT;
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE dpo ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dpo_user_id ON dpo(user_id);
CREATE INDEX IF NOT EXISTS idx_dpo_company_id ON dpo(company_id);
CREATE INDEX IF NOT EXISTS idx_dpo_is_active ON dpo(is_active);

-- Ensure RLS is enabled
ALTER TABLE dpo ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for all operations
DROP POLICY IF EXISTS "Allow DPO management" ON dpo;
CREATE POLICY "Allow DPO management" ON dpo
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-update
DROP TRIGGER IF EXISTS update_dpo_updated_at ON dpo;
CREATE TRIGGER update_dpo_updated_at
    BEFORE UPDATE ON dpo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check column structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'dpo'
ORDER BY ordinal_position;

-- Count records
SELECT COUNT(*) as total_dpo_records FROM dpo;
