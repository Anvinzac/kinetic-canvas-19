-- Revert to a safe, invoker-checked view and use column-level privileges to
-- hide auth_user_id from client roles while leaving other columns readable.
DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, username, display_name, avatar_url, bio, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Restore broad row visibility so existing joins/reads keep working,
-- then remove column-level SELECT on the sensitive column for client roles.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;

CREATE POLICY profiles_select_all
  ON public.profiles
  FOR SELECT
  USING (true);

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, username, display_name, avatar_url, bio, created_at)
  ON public.profiles TO anon, authenticated;

-- Provide a security-definer helper so the app can still resolve
-- "which profile row belongs to the current auth user" without needing
-- SELECT privilege on auth_user_id from the client.
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO anon, authenticated;
