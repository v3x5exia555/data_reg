-- Quick Fix: Add org_id to all sample data

-- Activity Log (last table to fail)
INSERT INTO activity_log (org_id, user_email, action_type, description, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Login', 'User logged in', '2024-04-01 09:00:00'),
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Record Update', 'Updated data record: Customer email', '2024-04-01 10:30:00'),
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Document Upload', 'Uploaded: Privacy Policy v2.pdf', '2024-04-02 14:00:00'),
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Checklist Update', 'Completed: Security Policy checklist', '2024-04-03 11:00:00'),
('00000000-0000-0000-0000-000000000001', 'dpo@acme.com', 'Team Add', 'Added new team member: John Tan', '2024-04-05 16:00:00');