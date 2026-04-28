-- Create an enum for Snowflake-like hierarchical user roles
CREATE TYPE user_role AS ENUM ('Accountadmin', 'security_user', 'useradmin', 'user');

-- Create a profiles table that links to Supabase's built-in auth.users
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role user_role DEFAULT 'user'::user_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on the table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Optional: Create a trigger to auto-update 'updated_at' when a row is modified
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- Basic RLS Policies (can be customized based on your exact hierarchy rules):

-- 1. Users can read their own profile
CREATE POLICY "Users can read own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- 2. Accountadmin can read all profiles
CREATE POLICY "Accountadmin can read all profiles"
ON public.user_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'Accountadmin'
  )
);
