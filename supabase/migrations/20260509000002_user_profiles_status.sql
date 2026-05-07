-- Add status column to user_profiles for People Management page display
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Back-fill existing rows
UPDATE user_profiles SET status = 'active' WHERE status IS NULL;
