-- Add account_id scoping to consent_settings so rows can be filtered per tenant
ALTER TABLE consent_settings ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;
