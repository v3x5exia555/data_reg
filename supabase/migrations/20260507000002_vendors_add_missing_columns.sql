-- Extend vendors with the columns the UI already collects (risk level,
-- agreement date, notes). Without these, saveVendor() inserts fail with
-- PGRST204 because the vendor modal sends fields the table doesn't have.

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS risk_level     VARCHAR(20)  DEFAULT 'Low',
  ADD COLUMN IF NOT EXISTS agreement_date DATE,
  ADD COLUMN IF NOT EXISTS notes          TEXT;
