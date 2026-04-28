-- Create the table for Personal Data Register inputs
CREATE TABLE public.data_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- The fields matching the UI modal
  data_type TEXT NOT NULL,
  purpose TEXT,
  storage TEXT,
  access_level TEXT,
  retention_months INTEGER DEFAULT 12,
  consent_obtained BOOLEAN DEFAULT false,
  note TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.data_records ENABLE ROW LEVEL SECURITY;

-- Create policies so users can only see and edit their own records
CREATE POLICY "Users can view own data records"
ON public.data_records FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data records"
ON public.data_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data records"
ON public.data_records FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data records"
ON public.data_records FOR DELETE
USING (auth.uid() = user_id);

-- Optional: Auto-update the updated_at timestamp (using the trigger function from previous migration)
CREATE TRIGGER data_records_updated_at
BEFORE UPDATE ON public.data_records
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();


-- ==========================================
-- BONUS: We can also add columns to the user_profiles table for Onboarding & Checklist Data
-- ==========================================
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS business_type TEXT,
ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS checklist_state JSONB DEFAULT '{}'::jsonb;
