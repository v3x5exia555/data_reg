-- Fix the infinite recursion on user_profiles policy
DROP POLICY IF EXISTS "Accountadmin can read all profiles" ON public.user_profiles;

CREATE POLICY "Accountadmin can read all profiles"
ON public.user_profiles
FOR SELECT
USING (
  -- Avoid selecting directly from the table to prevent recursion
  (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'Accountadmin'
);

-- Create a flexible team_members table for the Access Control UI
CREATE TABLE public.team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role_department TEXT,
  access_level user_role DEFAULT 'user'::user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and allow anonymous inserts/selects for prototyping purposes
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on team_members"
ON public.team_members FOR SELECT USING (true);

CREATE POLICY "Allow public insert on team_members"
ON public.team_members FOR INSERT WITH CHECK (true);
