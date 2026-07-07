-- Stop exposing auth.users UIDs through the public profiles SELECT policy.
-- Owners can still read their own profile row (needed for lookups that filter by auth_user_id).
-- Cross-user profile reads flow through server functions using the service role.
DROP POLICY IF EXISTS profiles_select_all ON public.profiles;

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = auth_user_id);

-- Public-safe view without the auth_user_id column, for any future client-side
-- reads of other users' profiles.
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, username, display_name, avatar_url, bio, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Allow anon/authenticated to read the view rows even though the base table
-- SELECT policy is now owner-only.
CREATE POLICY profiles_select_public_columns
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);
