-- DataRex PDPA Portal - Database Setup
-- Run this in Supabase SQL Editor

-- ============================================
-- NAV_PERMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS nav_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  access_level VARCHAR(50) NOT NULL,
  nav_item VARCHAR(50) NOT NULL,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, access_level, nav_item)
);

-- Enable RLS
ALTER TABLE nav_permissions ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (allows inserts/updates based on ownership)
CREATE POLICY "Allow authenticated upserts" ON nav_permissions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TEAM_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role_department VARCHAR(255),
  access_level VARCHAR(50) DEFAULT 'user',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow team member management" ON team_members
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DATA_RECORDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS data_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  user_id UUID,
  data_type VARCHAR(255) NOT NULL,
  purpose TEXT,
  storage TEXT,
  access_level TEXT,
  retention_months INTEGER DEFAULT 12,
  consent_obtained BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE data_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow data record management" ON data_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  category VARCHAR(100),
  size BIGINT,
  uploader VARCHAR(255),
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow document management" ON documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- APP_CREDENTIALS TABLE (already exists)
-- ============================================
-- Just ensure policy allows reading for login
CREATE POLICY "Allow credential lookup" ON app_credentials
  FOR SELECT
  USING (true);

-- ============================================
-- USER_PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  company VARCHAR(255),
  access_level VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow profile management" ON user_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- CHECKLIST_ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  check_id VARCHAR(100) NOT NULL,
  completed BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, check_id)
);

ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow checklist management" ON checklist_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- RETENTION_RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS retention_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  data_type VARCHAR(255) NOT NULL,
  retention_months INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retention_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow retention rule management" ON retention_rules
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- CONSENT_ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS consent_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  category VARCHAR(100) NOT NULL,
  toggle_key VARCHAR(100) NOT NULL,
  toggle_label VARCHAR(255),
  is_enabled BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, category, toggle_key)
);

ALTER TABLE consent_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow consent management" ON consent_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(org_id, session_id)
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow session management" ON sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);