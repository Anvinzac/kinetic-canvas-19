-- Scope the scheduled publishing to the types we actually want live.
--
-- Decision: only the Vocabulary (EN<->VI) bot posts on a schedule. The six web
-- fields keep their LLM pipeline (sources, publish_web_agent_posts(), Content Hub
-- config) fully intact but UNSCHEDULED and their bot_agents deactivated, so they
-- can be flipped on later without re-adding anything.
--
-- We also retire the canned publish_daily_bot_posts() — it targeted the same six
-- web bot_agents with hardcoded text and collided with the LLM pipeline. Removing
-- it removes the conflict entirely; the LLM pipeline is the single web source.

-- 1) Stop the web publishers from running on a schedule.
DO $$
DECLARE
  existing_job RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR existing_job IN
      SELECT jobid FROM cron.job WHERE jobname IN ('kinetic-web-agents-daily', 'kinetic-bot-daily-posts')
    LOOP
      PERFORM cron.unschedule(existing_job.jobid);
    END LOOP;
  END IF;
END $$;

-- 2) Deactivate the six web bot_agents. Vocabulary stays active (unchanged).
UPDATE public.bot_agents
SET active = false
WHERE topic IN ('Sports', 'Entertainment', 'Technology', 'Food', 'Travel', 'Design');

-- 3) Retire the canned publisher and its function (no longer used; LLM pipeline
--    is the only web source). Safe to drop: nothing else references it.
DROP FUNCTION IF EXISTS public.publish_daily_bot_posts(DATE);

-- NOTE: publish_web_agent_posts() is intentionally KEPT (unscheduled). To re-enable
-- the web fields later:
--   UPDATE public.bot_agents SET active = true
--     WHERE topic IN ('Sports','Entertainment','Technology','Food','Travel','Design');
--   SELECT cron.schedule('kinetic-web-agents-daily','10 1 * * *',
--     'SELECT public.publish_web_agent_posts(now()::timestamptz);');
--
-- Vocabulary publisher (publish_vocabulary_bot_post) and its 3x/daily cron are
-- left untouched — that is the one live scheduled post type.
