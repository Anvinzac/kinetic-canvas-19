-- Repair and harden the vocabulary bot schedule.
--
-- The vocabulary publisher now reads from agent_content_items. This migration:
-- - lets the function run safely from pg_cron by making it SECURITY DEFINER,
-- - resets abandoned claims that could leave the queue stuck,
-- - replaces the cron job instead of leaving an older/broken job untouched,
-- - adds an owner/service-role diagnostic helper for checking the bot.

ALTER FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ)
  SECURITY DEFINER
  SET search_path = public;

REVOKE ALL ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO postgres';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO supabase_admin';
  END IF;
END;
$$;

UPDATE public.agent_content_items
SET
  status = 'ready',
  claimed_by_agent_id = NULL,
  claimed_at = NULL,
  updated_at = now()
WHERE source_key = 'vocabulary.en_vi'
  AND status = 'claimed'
  AND used_at IS NULL
  AND claimed_at < now() - INTERVAL '15 minutes';

DO $$
DECLARE
  cron_installed BOOLEAN;
  existing_job RECORD;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file OR invalid_schema_name THEN
      RAISE NOTICE 'pg_cron extension is not available; publish_vocabulary_bot_post can still be called manually.';
  END;

  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
  INTO cron_installed;

  IF cron_installed THEN
    FOR existing_job IN
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'kinetic-vocabulary-bot-3x-daily'
    LOOP
      PERFORM cron.unschedule(existing_job.jobid);
    END LOOP;

    PERFORM cron.schedule(
      'kinetic-vocabulary-bot-3x-daily',
      '0 1,7,13 * * *',
      'SELECT public.publish_vocabulary_bot_post(now()::timestamptz);'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_vocabulary_bot_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_record RECORD;
  local_now TIMESTAMP := now() AT TIME ZONE 'Asia/Ho_Chi_Minh';
  local_hour INTEGER := extract(hour FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::INTEGER;
  current_slot INTEGER;
  cron_installed BOOLEAN := false;
  cron_jobs JSONB := '[]'::JSONB;
BEGIN
  current_slot := CASE
    WHEN local_hour < 12 THEN 1
    WHEN local_hour < 18 THEN 2
    ELSE 3
  END;

  SELECT *
  INTO agent_record
  FROM public.bot_agents
  WHERE topic = 'Vocabulary'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'local_now_vietnam', local_now,
      'current_slot', current_slot,
      'agent', NULL,
      'post_count', 0,
      'latest_posts', '[]'::jsonb,
      'runs', '[]'::jsonb,
      'queue_counts', '{}'::jsonb,
      'cron_installed', cron_installed,
      'cron_jobs', cron_jobs,
      'error', 'Vocabulary bot agent not found'
    );
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
  INTO cron_installed;

  IF cron_installed THEN
    BEGIN
      EXECUTE $cron$
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'jobid', jobid,
              'jobname', jobname,
              'schedule', schedule,
              'command', command,
              'active', active
            )
            ORDER BY jobid
          ),
          '[]'::jsonb
        )
        FROM cron.job
        WHERE jobname = 'kinetic-vocabulary-bot-3x-daily'
      $cron$
      INTO cron_jobs;
    EXCEPTION
      WHEN undefined_table OR insufficient_privilege THEN
        cron_jobs := jsonb_build_array(jsonb_build_object('error', 'cron.job not readable'));
    END;
  END IF;

  RETURN jsonb_build_object(
    'local_now_vietnam', local_now,
    'current_slot', current_slot,
    'agent', CASE
      WHEN agent_record.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', agent_record.id,
        'profile_id', agent_record.profile_id,
        'active', agent_record.active,
        'last_posted_on', agent_record.last_posted_on
      )
    END,
    'post_count', (
      SELECT count(*)
      FROM public.posts
      WHERE author_id = agent_record.profile_id
    ),
    'latest_posts', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'created_at', created_at,
            'preview', left(canvas_html, 500)
          )
          ORDER BY created_at DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT id, created_at, canvas_html
        FROM public.posts
        WHERE author_id = agent_record.profile_id
        ORDER BY created_at DESC
        LIMIT 6
      ) latest
    ),
    'runs', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'run_date', run_date,
            'slot_index', slot_index,
            'post_id', post_id,
            'created_at', created_at
          )
          ORDER BY run_date DESC, slot_index DESC
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT run_date, slot_index, post_id, created_at
        FROM public.bot_post_runs
        WHERE agent_id = agent_record.id
        ORDER BY run_date DESC, slot_index DESC
        LIMIT 12
      ) latest_runs
    ),
    'queue_counts', (
      SELECT COALESCE(jsonb_object_agg(status, item_count), '{}'::jsonb)
      FROM (
        SELECT status, count(*) AS item_count
        FROM public.agent_content_items
        WHERE source_key = 'vocabulary.en_vi'
        GROUP BY status
      ) counts
    ),
    'cron_installed', cron_installed,
    'cron_jobs', cron_jobs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_vocabulary_bot_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vocabulary_bot_status() TO service_role;
