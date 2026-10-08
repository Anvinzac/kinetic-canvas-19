-- Helper referenced by the telemetry visitor-session policies. Matches the
-- definition in 20260720120000_admin_telemetry.sql, which was never applied to
-- this database because its tables were created by a later migration instead.
CREATE OR REPLACE FUNCTION public.is_admin_account(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _uid AND is_admin = true
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_account(UUID) TO authenticated, anon;