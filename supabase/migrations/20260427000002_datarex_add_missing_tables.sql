-- DataRex Schema Fix - Add Missing Tables
-- This migration adds the tables that don't exist yet

-- ===========================================
-- PROFILES TABLE (if not exists)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT DEFAULT '',
  company TEXT DEFAULT '',
  biz_type TEXT,
  current_user_level TEXT DEFAULT 'Accountadmin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- CHECKLIST ITEMS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- ===========================================
-- CONSENT ITEMS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.consent_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  purpose TEXT,
  toggles JSONB DEFAULT '[]',
  note TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- RETENTION RULES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.retention_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  subcategory TEXT,
  months INTEGER DEFAULT 12,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- NAV PERMISSIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.nav_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_level TEXT NOT NULL,
  nav_item TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  is_editable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, access_level, nav_item)
);

-- ===========================================
-- ADD COLUMNS TO EXISTING TABLES
-- ===========================================

-- Add org_id to existing team_members
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'org_id') THEN
    ALTER TABLE public.team_members ADD COLUMN org_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'permissions') THEN
    ALTER TABLE public.team_members ADD COLUMN permissions JSONB DEFAULT '{}';
  END IF;
END $$;

-- ===========================================
-- RLS POLICIES
-- ===========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nav_permissions ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Checklist
DROP POLICY IF EXISTS "Users manage own checklist" ON public.checklist_items;
CREATE POLICY "Users manage own checklist" ON public.checklist_items FOR ALL USING (auth.uid() = user_id);

-- Consent
DROP POLICY IF EXISTS "Users manage own consent" ON public.consent_items;
CREATE POLICY "Users manage own consent" ON public.consent_items FOR ALL USING (auth.uid() = user_id);

-- Retention
DROP POLICY IF EXISTS "Users manage own retention" ON public.retention_rules;
CREATE POLICY "Users manage own retention" ON public.retention_rules FOR ALL USING (auth.uid() = user_id);

-- Team members
DROP POLICY IF EXISTS "Users manage own team" ON public.team_members;
CREATE POLICY "Users manage own team" ON public.team_members FOR ALL USING (auth.uid() = org_id);

-- Nav permissions
DROP POLICY IF EXISTS "Users manage own nav" ON public.nav_permissions;
CREATE POLICY "Users manage own nav" ON public.nav_permissions FOR ALL USING (auth.uid() = org_id);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_checklist_user ON public.checklist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_user ON public.consent_items(user_id);
CREATE INDEX IF NOT EXISTS idx_retention_user ON public.retention_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_nav_org ON public.nav_permissions(org_id);