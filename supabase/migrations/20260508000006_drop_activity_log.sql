-- 20260508000006_drop_activity_log.sql
-- Drop the legacy activity_log table.
-- system_logs (written by JARVIS_LOG) is the canonical audit table going forward.

DROP TABLE IF EXISTS public.activity_log CASCADE;
