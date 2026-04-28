-- Consent Settings Table (with sample data)
-- Run this in Supabase SQL Editor

-- ============================================
-- CONSENT_SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS consent_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  toggle_key VARCHAR(100) NOT NULL,
  toggle_label VARCHAR(255),
  is_enabled BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE consent_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow consent settings" ON consent_settings FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- SAMPLE DATA
-- ============================================
INSERT INTO consent_settings (category, toggle_key, toggle_label, is_enabled, note) VALUES
('Email Marketing', 'newsletter', 'Newsletter subscriptions', true, 'Monthly newsletter'),
('Email Marketing', 'promotions', 'Promotional emails', true, 'Promotional offers'),
('Email Marketing', 'product_updates', 'Product update notifications', false, NULL),
('Customer Data', 'account_creation', 'Account creation', true, 'Required for account'),
('Customer Data', 'profile_photos', 'Profile photos', true, NULL),
('Customer Data', 'purchase_history', 'Purchase history tracking', true, NULL),
('Customer Data', 'location_data', 'Location-based services', false, NULL),
('Analytics', 'usage_analytics', 'Usage analytics', true, NULL),
('Analytics', 'ab_testing', 'A/B testing', true, NULL),
('Analytics', 'personalization', 'Personalized recommendations', true, NULL);