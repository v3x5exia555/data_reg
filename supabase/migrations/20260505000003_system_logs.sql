-- ============================================================
-- JARVIS: System Logs Table
-- Captures all user actions for audit trail
-- ============================================================

CREATE TABLE IF NOT EXISTS system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Action Details
    action VARCHAR(100) NOT NULL,
    component VARCHAR(100) NOT NULL,
    
    -- Data Payload (JSON for flexibility)
    data JSONB DEFAULT '{}',
    response JSONB DEFAULT '{}',
    
    -- Error Tracking
    error_message TEXT,
    error_code VARCHAR(50),
    
    -- User Context
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- Enable RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for development (production should restrict)
DROP POLICY IF EXISTS "Allow system log management" ON system_logs;
CREATE POLICY "Allow system log management" ON system_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Verification
SELECT 'System logs table created' as status;
SELECT COUNT(*) as existing_logs FROM system_logs;
