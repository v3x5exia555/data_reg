-- DataRex Companies Table
-- Run this in Supabase SQL Editor

-- ============================================
-- COMPANIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  country VARCHAR(100),
  dpo_name VARCHAR(255),
  address TEXT,
  contact_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "Allow company management" ON companies
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- SAMPLE COMPANY DATA
-- ============================================
INSERT INTO companies (name, industry, country, dpo_name, address, contact_email) VALUES
('Acme Pte Ltd', 'General', 'Singapore', 'Demo DPO', '123 Singapore Ave', 'dpo@acme.com'),
('Tech Solutions Pte Ltd', 'Ecommerce', 'Singapore', 'Sarah Chen', '456 Tech Lane', 'sarah@techsolutions.com'),
('Healthcare Plus', 'Healthcare', 'Singapore', 'Dr. James Lee', '789 Medical Blvd', 'james@healthcareplus.com'),
('Finance Hub Asia', 'Finance', 'Hong Kong', 'Michael Wong', '88 Finance St, Central', 'michael@financehub.asia'),
('Digital Retail Co', 'Ecommerce', 'Thailand', 'Nakorn Siam', '99 Shopping Ave, Bangkok', 'nakorn@digitalretail.co.th'),
('EduLearn Institute', 'Education', 'Malaysia', 'Ahmad Rahman', '12 Learning Road, KL', 'ahmad@edulearn.my'),
('MediCare Clinic', 'Healthcare', 'Philippines', 'Dr. Maria Santos', '55 Health Center, Manila', 'maria@medicare.clinic'),
('DataTech Indonesia', 'General', 'Indonesia', 'Budi Santoso', '77 Tech Park, Jakarta', 'budi@datatech.id');