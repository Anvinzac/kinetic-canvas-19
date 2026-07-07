-- The previous migration accidentally left a permissive USING(true) policy that
-- still exposed auth_user_id. Drop it and switch the public view to run with
-- definer rights so it can read the underlying rows without needing a
-- permissive base-table policy.
DROP POLICY IF EXISTS profiles_select_public_columns ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = off) AS
SELECT id, username, display_name, avatar_url, bio, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
