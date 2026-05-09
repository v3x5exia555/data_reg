-- Migration 12's auto-create trigger defaults role to 'user' for all new auth users.
-- When migration 11 deleted the superadmin and they were re-created via Dashboard,
-- the trigger fired and overwrote the role to 'user', breaking superadmin access.
-- This migration restores the correct role and clears account_id (Superadmin has none).

UPDATE public.user_profiles
SET role = 'Superadmin',
    account_id = NULL
WHERE email = 'superadmin@datarex.com';
