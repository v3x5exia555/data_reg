-- App Credentials Table
-- Stores login credentials for the app (managed in Supabase)

CREATE TABLE IF NOT EXISTS public.app_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_name TEXT DEFAULT 'datarex',
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (public read for now - credentials are app-level)
ALTER TABLE public.app_credentials ENABLE ROW LEVEL SECURITY;

-- Allow public read of active credentials
CREATE POLICY "Public read active credentials" ON public.app_credentials
FOR SELECT USING (is_active = TRUE);

-- Only allow updates via service role (not from browser)
CREATE POLICY "Service role can manage credentials" ON public.app_credentials
FOR ALL USING (true);

-- Insert default credentials
INSERT INTO public.app_credentials (email, password) VALUES 
('admin@datarex.com', 'Admin123!@#')
ON CONFLICT (email) DO NOTHING;