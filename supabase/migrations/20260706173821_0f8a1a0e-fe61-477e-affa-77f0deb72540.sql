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

UPDATE public.bot_agents
SET active = false
WHERE topic IN ('Sports', 'Entertainment', 'Technology', 'Food', 'Travel', 'Design');

DROP FUNCTION IF EXISTS public.publish_daily_bot_posts(DATE);
