-- Drop the definer helper (linter flagged it) — server code can filter by
-- auth_user_id directly since we keep column access for authenticated role.
DROP FUNCTION IF EXISTS public.current_profile_id();

-- Restore column SELECT for authenticated so existing server-side and
-- own-profile lookups keep working, while anon (unauthenticated public API
-- callers using the publishable key) cannot read auth_user_id at all.
GRANT SELECT (auth_user_id) ON public.profiles TO authenticated;
