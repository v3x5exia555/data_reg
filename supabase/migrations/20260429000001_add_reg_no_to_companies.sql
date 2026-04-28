-- Add registration number column to companies table
-- Run this in Supabase SQL Editor

-- Add reg_no column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reg_no VARCHAR(50);

-- Update existing companies with sample registration numbers
UPDATE companies SET reg_no = '202001000001' WHERE name = 'Acme Pte Ltd';
UPDATE companies SET reg_no = '202102000002' WHERE name = 'Tech Solutions Pte Ltd';
UPDATE companies SET reg_no = '202203000003' WHERE name = 'Healthcare Plus';
UPDATE companies SET reg_no = '202304000004' WHERE name = 'Finance Hub Asia';
UPDATE companies SET reg_no = '202405000005' WHERE name = 'Digital Retail Co';
UPDATE companies SET reg_no = '202506000006' WHERE name = 'EduLearn Institute';
UPDATE companies SET reg_no = '202607000007' WHERE name = 'MediCare Clinic';
UPDATE companies SET reg_no = '202708000008' WHERE name = 'DataTech Indonesia';

-- Verify
SELECT name, reg_no FROM companies ORDER BY name;