-- Fix profiles that were created by the on_auth_user_created trigger (migration 12)
-- before the Edge Function could run its UPSERT. The trigger inserts role='user' and
-- account_id=NULL; the Edge Function then tries to INSERT (old code) which fails with
-- a PK conflict, leaving the profile in the wrong state.
--
-- For every account that has an accountadmin_user_id, ensure that user's profile has:
--   role = 'Accountadmin'
--   account_id = <that account's id>
--
-- Safe to re-run (idempotent).

UPDATE public.user_profiles up
SET
  role       = 'Accountadmin',
  account_id = a.id
FROM public.accounts a
WHERE up.id = a.accountadmin_user_id
  AND (
    up.role        IS DISTINCT FROM 'Accountadmin'
    OR up.account_id IS DISTINCT FROM a.id
  );
