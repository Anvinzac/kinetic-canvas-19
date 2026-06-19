GRANT SELECT ON public.bot_agents TO service_role;
GRANT SELECT ON public.bot_post_runs TO service_role;

DROP POLICY IF EXISTS "bot_agents_select_authenticated" ON public.bot_agents;
CREATE POLICY "bot_agents_select_authenticated" ON public.bot_agents FOR SELECT TO authenticated, service_role USING (true);

CREATE POLICY "bot_agents_deny_insert" ON public.bot_agents FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "bot_agents_deny_update" ON public.bot_agents FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "bot_agents_deny_delete" ON public.bot_agents FOR DELETE TO authenticated USING (false);

REVOKE SELECT ON public.bot_post_runs FROM anon;
DROP POLICY IF EXISTS "bot_post_runs_select_all" ON public.bot_post_runs;
CREATE POLICY "bot_post_runs_select_authenticated" ON public.bot_post_runs FOR SELECT TO authenticated, service_role USING (true);

CREATE POLICY "bot_post_runs_deny_insert" ON public.bot_post_runs FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "bot_post_runs_deny_update" ON public.bot_post_runs FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "bot_post_runs_deny_delete" ON public.bot_post_runs FOR DELETE TO authenticated USING (false);