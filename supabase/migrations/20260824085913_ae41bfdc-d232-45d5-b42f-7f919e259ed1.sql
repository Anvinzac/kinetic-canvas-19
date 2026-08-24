ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- is_admin is read server-side (service role) only; do not widen client grants.
REVOKE EXECUTE ON FUNCTION public.is_system_account(uuid) FROM PUBLIC, anon;

-- RLS is intentionally fail-closed (no policies) on server-only tables:
-- telemetry_*, admin_error_reports, admin_access_log, internal_api_keys.
-- They are reached exclusively through the service role.