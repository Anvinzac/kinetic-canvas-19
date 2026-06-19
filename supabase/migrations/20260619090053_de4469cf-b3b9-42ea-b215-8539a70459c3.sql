ALTER FUNCTION public.publish_daily_bot_posts(DATE) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.publish_daily_bot_posts(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_daily_bot_posts(DATE) TO service_role;

REVOKE SELECT ON public.bot_agents FROM anon;
DROP POLICY IF EXISTS "bot_agents_select_all" ON public.bot_agents;
CREATE POLICY "bot_agents_select_authenticated" ON public.bot_agents FOR SELECT TO authenticated USING (true);