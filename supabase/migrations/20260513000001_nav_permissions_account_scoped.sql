-- nav_permissions: add account_id column so settings are account-scoped.
--
-- The existing org_id column is a FK to auth.users(id), so it stores the
-- saving admin's user UUID — not useful for reading by other users in the
-- same account. We add account_id (FK to accounts) and a unique constraint
-- so admins can save once and all users in the account benefit.

ALTER TABLE public.nav_permissions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Unique constraint for the new account-scoped key so upsert works.
-- The old (org_id, access_level, nav_item) constraint is left intact for
-- any legacy rows that still use org_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nav_permissions_account_access_nav_unique'
  ) THEN
    ALTER TABLE public.nav_permissions
      ADD CONSTRAINT nav_permissions_account_access_nav_unique
      UNIQUE (account_id, access_level, nav_item);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nav_account ON public.nav_permissions(account_id);

-- Drop the old restrictive per-user policy and replace with account-scoped policies.
DROP POLICY IF EXISTS "Users manage own nav" ON public.nav_permissions;
DROP POLICY IF EXISTS "Allow authenticated upserts" ON public.nav_permissions;

-- Superadmin can manage all rows.
DROP POLICY IF EXISTS "Superadmin manages all nav" ON public.nav_permissions;
CREATE POLICY "Superadmin manages all nav" ON public.nav_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'Superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'Superadmin'
    )
  );

-- Accountadmin can manage nav permissions for their own account.
DROP POLICY IF EXISTS "Accountadmin manages account nav" ON public.nav_permissions;
CREATE POLICY "Accountadmin manages account nav" ON public.nav_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'Accountadmin'
        AND account_id = nav_permissions.account_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'Accountadmin'
        AND account_id = nav_permissions.account_id
    )
  );

-- All users in an account can read that account's nav permissions.
DROP POLICY IF EXISTS "Users read account nav" ON public.nav_permissions;
CREATE POLICY "Users read account nav" ON public.nav_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND account_id = nav_permissions.account_id
    )
  );
