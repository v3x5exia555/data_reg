-- 20260516000003_access_audit_log.sql
-- Append-only audit trail for Superadmin destructive actions and view-as
-- impersonation. PDPA accountability: a compliance product must be able to
-- answer "who suspended/deleted this account, when, and on what basis".
--
-- Append-only: SELECT + INSERT policies only. No UPDATE, no DELETE policy —
-- with RLS enabled and no permissive policy, those operations are denied for
-- non-owner roles.

CREATE TABLE IF NOT EXISTS public.access_audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role       public.user_role NOT NULL,
  action           TEXT NOT NULL,   -- 'account.suspend' | 'account.reactivate' |
                                    -- 'account.delete'  | 'account.seat_change' |
                                    -- 'viewas.enter'    | 'viewas.exit' |
                                    -- 'user.role_change'
  target_account_id UUID,
  target_user_id    UUID,
  detail            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aal_actor
  ON public.access_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aal_target_account
  ON public.access_audit_log(target_account_id, created_at DESC);

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aal_select ON public.access_audit_log;
DROP POLICY IF EXISTS aal_insert ON public.access_audit_log;

-- SELECT: Superadmin sees everything; Accountadmin sees rows targeting their
-- own account. Reuses the SECURITY DEFINER helpers from 20260509000007.
CREATE POLICY aal_select ON public.access_audit_log FOR SELECT
  USING ( public.auth_is_superadmin()
       OR target_account_id = public.auth_current_account_id() );

-- INSERT: any authenticated actor, but the row's actor_user_id MUST be the
-- caller (prevents forging audit entries on behalf of someone else).
CREATE POLICY aal_insert ON public.access_audit_log FOR INSERT
  WITH CHECK ( actor_user_id = auth.uid() );

-- No UPDATE / DELETE policies → append-only for all non-service roles.

-- Rollback (manual): DROP TABLE public.access_audit_log;
