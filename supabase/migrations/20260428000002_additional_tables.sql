-- DataRex Additional Tables with Sample Data
-- Run this in Supabase SQL Editor

-- ============================================
-- DATA_REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS data_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  request_type VARCHAR(50) NOT NULL,
  requester_name VARCHAR(255),
  requester_email VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow data request management" ON data_requests FOR ALL USING (true) WITH CHECK (true);

-- Sample Data Requests
INSERT INTO data_requests (org_id, request_type, requester_name, requester_email, description, status) VALUES
('00000000-0000-0000-0000-000000000001', 'Access', 'John Tan', 'john@example.com', 'Request to view my personal data', 'Completed'),
('00000000-0000-0000-0000-000000000001', 'Correction', 'Mary Lim', 'mary@example.com', 'Update my phone number', 'In Progress'),
('00000000-0000-0000-0000-000000000001', 'Deletion', 'Alex Wong', 'alex@example.com', 'Delete my marketing preferences', 'Pending');

-- ============================================
-- BREACH_LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS breach_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  breach_type VARCHAR(100),
  description TEXT,
  data_categories TEXT[],
  affected_count INTEGER,
  reported_to_authorities BOOLEAN DEFAULT false,
  notified_affected BOOLEAN DEFAULT false,
  resolution_status VARCHAR(50) DEFAULT 'Under Investigation',
  incident_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE breach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow breach log management" ON breach_log FOR ALL USING (true) WITH CHECK (true);

-- Sample Breach Logs
INSERT INTO breach_log (org_id, breach_type, description, data_categories, affected_count, reported_to_authorities, notified_affected, incident_date, resolution_status) VALUES
('00000000-0000-0000-0000-000000000001', 'Unauthorized Access', 'Server breach affecting customer emails', ARRAY['Email', 'Phone'], 150, true, false, '2024-03-15', 'Resolved'),
('00000000-0000-0000-0000-000000000001', 'Accidental Disclosure', 'Email sent to wrong recipient', ARRAY['Name', 'Email'], 5, false, false, '2024-04-01', 'Resolved'),
('00000000-0000-0000-0000-000000000001', 'Ransomware Attack', 'Encrypted customer database', ARRAY['Name', 'IC', 'Address'], 200, false, true, '2024-04-20', 'Under Investigation');

-- ============================================
-- DPIA table
-- ============================================
CREATE TABLE IF NOT EXISTS dpia_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,
  processing_purpose TEXT,
  is_necessary BOOLEAN,
  risk_level VARCHAR(20) DEFAULT 'Medium',
  mitigation_measures TEXT,
  status VARCHAR(50) DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dpia_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow DPIA management" ON dpia_assessments FOR ALL USING (true) WITH CHECK (true);

-- Sample DPIA
INSERT INTO dpia_assessments (org_id, activity_name, description, processing_purpose, is_necessary, risk_level, mitigation_measures, status) VALUES
('00000000-0000-0000-0000-000000000001', 'Customer Profiling', 'AI-based product recommendations', 'Improve customer experience', true, 'Low', 'Data minimization, anonymization', 'Approved'),
('00000000-0000-0000-0000-000000000001', 'Employee Monitoring', 'GPS tracking for delivery staff', 'Safety and efficiency', false, 'High', 'Consent, limited access', 'Pending Review'),
('00000000-0000-0000-0000-000000000001', 'Biometric Access', 'Face recognition for office entry', 'Security', true, 'Medium', 'Encryption, limited storage', 'Approved');

-- ============================================
-- CROSS_BORDER_TRANSFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cross_border_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  destination_country VARCHAR(100) NOT NULL,
  recipient_name VARCHAR(255),
  data_categories TEXT[],
  transfer_purpose TEXT,
  safeguards TEXT,
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cross_border_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow cross border management" ON cross_border_transfers FOR ALL USING (true) WITH CHECK (true);

-- Sample Cross-border Transfers
INSERT INTO cross_border_transfers (org_id, destination_country, recipient_name, data_categories, transfer_purpose, safeguards, status) VALUES
('00000000-0000-0000-0000-000000000001', 'Singapore', 'CloudTech Pte Ltd', ARRAY['Name', 'Email'], 'Cloud hosting', 'SCCs, Encryption', 'Active'),
('00000000-0000-0000-0000-000000000001', 'USA', 'AWS Asia Pacific', ARRAY['All data types'], 'Cloud storage', 'Standard Contractual Clauses', 'Active'),
('00000000-0000-0000-0000-000000000001', 'India', 'Support Center', ARRAY['Name', 'Phone'], 'Customer support', 'DPA, Encryption', 'Active');

-- ============================================
-- VENDORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(100),
  contact_email VARCHAR(255),
  data_processed TEXT[],
  has_dpa BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow vendor management" ON vendors FOR ALL USING (true) WITH CHECK (true);

-- Sample Vendors
INSERT INTO vendors (org_id, vendor_name, service_type, contact_email, data_processed, has_dpa, status) VALUES
('00000000-0000-0000-0000-000000000001', 'AWS Singapore', 'Cloud Hosting', 'support@aws.com', ARRAY['All data types'], true, 'Active'),
('00000000-0000-0000-0000-000000000001', 'Mailchimp', 'Email Marketing', 'support@mailchimp.com', ARRAY['Email', 'Name'], true, 'Active'),
('00000000-0000-0000-0000-000000000001', 'Salesforce Asia', 'CRM', 'asia@salesforce.com', ARRAY['Customer data'], true, 'Active'),
('00000000-0000-0000-0000-000000000001', 'Google Cloud', 'Cloud Storage', 'enterprise@google.com', ARRAY['All data types'], true, 'Active'),
('00000000-0000-0000-0000-000000000001', 'Twilio', 'SMS Notifications', 'support@twilio.com', ARRAY['Phone'], false, 'Inactive');

-- ============================================
-- TRAINING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS training_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  training_type VARCHAR(100),
  training_date DATE,
  status VARCHAR(50) DEFAULT 'Completed',
  certificate_url TEXT,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow training management" ON training_records FOR ALL USING (true) WITH CHECK (true);

-- Sample Training Records
INSERT INTO training_records (org_id, employee_name, training_type, training_date, status, expires_at) VALUES
('00000000-0000-0000-0000-000000000001', 'John Tan', 'PDPA Fundamentals', '2024-01-15', 'Completed', '2025-01-15'),
('00000000-0000-0000-0000-000000000001', 'Mary Lim', 'Data Protection Officer', '2024-02-20', 'Completed', '2026-02-20'),
('00000000-0000-0000-0000-000000000001', 'Alex Wong', 'Privacy Awareness', '2024-03-10', 'Completed', '2025-03-10'),
('00000000-0000-0000-0000-000000000001', 'Sarah Chen', 'PDPA Fundamentals', '2024-04-05', 'In Progress', NULL),
('00000000-0000-0000-0000-000000000001', 'Mike Lee', 'Security Best Practices', '2024-04-15', 'Completed', '2025-04-15');

-- ============================================
-- ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  alert_type VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  message TEXT,
  priority VARCHAR(20) DEFAULT 'Medium',
  is_read BOOLEAN DEFAULT false,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow alert management" ON alerts FOR ALL USING (true) WITH CHECK (true);

-- Sample Alerts
INSERT INTO alerts (org_id, alert_type, title, message, priority, due_date) VALUES
('00000000-0000-0000-0000-000000000001', 'Deadline', 'Annual PDPA Review Due', 'Your annual compliance review is due next month', 'High', '2024-12-31'),
('00000000-0000-0000-0000-000000000001', 'Training', 'Staff Training Expiring', 'John Tan PDPA certificate expires in 30 days', 'Medium', '2024-06-15'),
('00000000-0000-0000-0000-000000000001', 'Retention', 'Data Retention Review', 'Review customer data older than retention period', 'Low', '2024-07-01'),
('00000000-0000-0000-0000-000000000001', 'Breach', 'Quarterly Breach Review', 'Submit quarterly breach report to authorities', 'High', '2024-06-30'),
('00000000-0000-0000-0000-000000000001', 'Vendor', 'DPA Review Needed', 'Twilio Data Processing Agreement expires soon', 'Medium', '2024-06-20');

-- ============================================
-- CASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  case_number VARCHAR(50) NOT NULL,
  case_type VARCHAR(100),
  description TEXT,
  status VARCHAR(50) DEFAULT 'Open',
  priority VARCHAR(20) DEFAULT 'Medium',
  assigned_to VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow case management" ON cases FOR ALL USING (true) WITH CHECK (true);

-- Sample Cases
INSERT INTO cases (org_id, case_number, case_type, description, status, priority, assigned_to) VALUES
('00000000-0000-0000-0000-000000000001', 'CASE-2024-001', 'Data Subject Request', 'Customer requests data deletion under PDPA', 'Open', 'High', 'Mary Lim'),
('00000000-0000-0000-0000-000000000001', 'CASE-2024-002', 'Complaint', 'Customer complaints about unauthorized data use', 'Under Investigation', 'High', 'John Tan'),
('00000000-0000-0000-0000-000000000001', 'CASE-2024-003', 'Internal Audit', 'Annual compliance audit', 'In Progress', 'Medium', 'Sarah Chen'),
('00000000-0000-0000-0000-000000000001', 'CASE-2024-004', 'Regulatory Inquiry', 'PDPA authority inquiry about data retention', 'Resolved', 'High', 'DPO');

-- ============================================
-- ACTIVITY_LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  user_email VARCHAR(255),
  action_type VARCHAR(100),
  description TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow activity log" ON activity_log FOR ALL USING (true) WITH CHECK (true);

-- Sample Activity Logs
INSERT INTO activity_log (org_id, user_email, action_type, description, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Login', 'User logged in', '2024-04-01 09:00:00'),
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Record Update', 'Updated data record: Customer email', '2024-04-01 10:30:00'),
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Document Upload', 'Uploaded: Privacy Policy v2.pdf', '2024-04-02 14:00:00'),
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Checklist Update', 'Completed: Security Policy checklist', '2024-04-03 11:00:00'),
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Team Add', 'Added new team member: John Tan', '2024-04-05 16:00:00');