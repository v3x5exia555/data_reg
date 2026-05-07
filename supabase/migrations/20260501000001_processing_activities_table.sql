-- Migration: Create processing_activities table
-- Date: 2026-05-04

CREATE TABLE IF NOT EXISTS public.processing_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id TEXT NOT NULL,
  
  -- Basic info
  name TEXT NOT NULL,
  purpose TEXT,
  
  -- Nature of processing
  nature TEXT[],
  nature_other TEXT,
  
  -- Scope
  who TEXT[],
  freq TEXT,
  storage TEXT,
  scope_note TEXT,
  
  -- Context
  context TEXT[],
  power_imbalance BOOLEAN DEFAULT FALSE,
  
  -- Legal basis
  legal TEXT[],
  legal_other TEXT,
  
  -- Data categories
  data TEXT[],
  data_other TEXT,
  
  -- Recipients
  recip TEXT[],
  gov TEXT[],
  recip_other TEXT,
  
  -- Retention
  ret_type TEXT,
  ret_years INTEGER,
  ret_override BOOLEAN DEFAULT FALSE,
  
  -- Volume
  total INTEGER DEFAULT 0,
  sensitive INTEGER DEFAULT 0,
  
  -- Cross-border
  cross_border BOOLEAN DEFAULT FALSE,
  country TEXT,
  safeguards TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.processing_activities ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to manage their company data
CREATE POLICY "Users manage company processing activities" 
  ON public.processing_activities 
  FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_processing_activities_company ON public.processing_activities(company_id);
CREATE INDEX IF NOT EXISTS idx_processing_activities_user ON public.processing_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_activities_created ON public.processing_activities(created_at DESC);
