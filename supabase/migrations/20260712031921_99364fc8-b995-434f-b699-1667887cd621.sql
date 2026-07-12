
-- 1. Mark system accounts on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS profiles_is_system_idx ON public.profiles(is_system) WHERE is_system;

-- 2. Helper (SECURITY DEFINER so it can read profiles without recursing through RLS)
CREATE OR REPLACE FUNCTION public.is_system_account(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _uid AND is_system = true
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_system_account(UUID) TO authenticated, anon;

-- 3. Ensure signed-in users can reach the pipeline tables at all (RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_content_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_content_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_post_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_agents TO authenticated;

-- 4. Permissive "system can do anything" policies (OR'd with the existing deny/own policies)
DROP POLICY IF EXISTS agent_content_items_system_all ON public.agent_content_items;
CREATE POLICY agent_content_items_system_all ON public.agent_content_items
  FOR ALL TO authenticated
  USING (public.is_system_account(auth.uid()))
  WITH CHECK (public.is_system_account(auth.uid()));

DROP POLICY IF EXISTS agent_content_sources_system_all ON public.agent_content_sources;
CREATE POLICY agent_content_sources_system_all ON public.agent_content_sources
  FOR ALL TO authenticated
  USING (public.is_system_account(auth.uid()))
  WITH CHECK (public.is_system_account(auth.uid()));

DROP POLICY IF EXISTS bot_post_runs_system_all ON public.bot_post_runs;
CREATE POLICY bot_post_runs_system_all ON public.bot_post_runs
  FOR ALL TO authenticated
  USING (public.is_system_account(auth.uid()))
  WITH CHECK (public.is_system_account(auth.uid()));

DROP POLICY IF EXISTS bot_agents_system_all ON public.bot_agents;
CREATE POLICY bot_agents_system_all ON public.bot_agents
  FOR ALL TO authenticated
  USING (public.is_system_account(auth.uid()))
  WITH CHECK (public.is_system_account(auth.uid()));

DROP POLICY IF EXISTS posts_system_all ON public.posts;
CREATE POLICY posts_system_all ON public.posts
  FOR ALL TO authenticated
  USING (public.is_system_account(auth.uid()))
  WITH CHECK (public.is_system_account(auth.uid()));

-- 5. Let signed-in users call the pipeline RPCs (RLS still gates rows)
GRANT EXECUTE ON FUNCTION public.enqueue_agent_content_item(TEXT, TEXT, JSONB, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO authenticated;
