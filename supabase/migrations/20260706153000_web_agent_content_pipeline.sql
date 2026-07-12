-- Web research agents: scrape -> LLM brief -> queue -> daily kinetic posts.

INSERT INTO public.agent_content_sources (key, label, item_type)
VALUES
  ('web.sports', 'Sports web briefs', 'web_brief'),
  ('web.entertainment', 'Entertainment web briefs', 'web_brief'),
  ('web.technology', 'Technology web briefs', 'web_brief'),
  ('web.food', 'Food web briefs', 'web_brief'),
  ('web.travel', 'Travel web briefs', 'web_brief'),
  ('web.design', 'Design web briefs', 'web_brief')
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  item_type = EXCLUDED.item_type,
  active = true;

CREATE OR REPLACE FUNCTION public.web_agent_source_key_for_topic(p_topic TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(p_topic))
    WHEN 'sports' THEN 'web.sports'
    WHEN 'entertainment' THEN 'web.entertainment'
    WHEN 'technology' THEN 'web.technology'
    WHEN 'food' THEN 'web.food'
    WHEN 'travel' THEN 'web.travel'
    WHEN 'design' THEN 'web.design'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.publish_web_agent_posts(p_run_at TIMESTAMPTZ DEFAULT now())
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent RECORD;
  source_key TEXT;
  local_run_date DATE := (p_run_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::DATE;
  post_id UUID;
  content_item_id UUID;
  content_payload JSONB;
  pages TEXT[];
  post_text TEXT;
  hashtags TEXT[];
  canvas TEXT;
  created_count INTEGER := 0;
BEGIN
  FOR agent IN
    SELECT *
    FROM public.bot_agents
    WHERE active
      AND topic IN ('Sports', 'Entertainment', 'Technology', 'Food', 'Travel', 'Design')
    ORDER BY daily_post_time, topic
  LOOP
    content_item_id := NULL;
    content_payload := NULL;
    source_key := public.web_agent_source_key_for_topic(agent.topic);
    IF source_key IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.bot_post_runs
      WHERE agent_id = agent.id
        AND run_date = local_run_date
        AND slot_index = 1
    ) THEN
      CONTINUE;
    END IF;

    WITH next_item AS (
      SELECT item.id, item.payload
      FROM public.agent_content_items item
      WHERE item.source_key = source_key
        AND item.status = 'ready'
        AND item.available_at <= p_run_at
        AND jsonb_typeof(item.payload->'pages') = 'array'
        AND NOT EXISTS (
          SELECT 1
          FROM public.posts existing
          WHERE existing.author_id = agent.profile_id
            AND existing.canvas_html ILIKE '%' || COALESCE(item.payload->>'source_url', item.content_key) || '%'
        )
      ORDER BY item.available_at, item.created_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.agent_content_items item
    SET
      status = 'claimed',
      claimed_by_agent_id = agent.id,
      claimed_at = now(),
      updated_at = now()
    FROM next_item
    WHERE item.id = next_item.id
    RETURNING item.id, item.payload
    INTO content_item_id, content_payload;

    IF content_item_id IS NULL THEN
      CONTINUE;
    END IF;

    pages := ARRAY(
      SELECT btrim(page_text.line)
      FROM jsonb_array_elements_text(content_payload->'pages') AS page_text(line)
      WHERE btrim(page_text.line) <> ''
      LIMIT 6
    );

    IF cardinality(pages) < 2 THEN
      UPDATE public.agent_content_items
      SET status = 'rejected', updated_at = now()
      WHERE id = content_item_id;
      CONTINUE;
    END IF;

    hashtags := CASE
      WHEN jsonb_typeof(content_payload->'hashtags') = 'array' THEN
        ARRAY(
          SELECT btrim(hashtag_text.line)
          FROM jsonb_array_elements_text(content_payload->'hashtags') AS hashtag_text(line)
          WHERE btrim(hashtag_text.line) <> ''
          LIMIT 5
        )
      ELSE ARRAY['#' || agent.topic]::TEXT[]
    END;

    post_text := array_to_string(pages, E'\n');

    canvas := json_build_object(
      'text', post_text,
      'font', agent.font,
      'size', 76,
      'color', '#ffffff',
      'weight', 900,
      'letterSpacing', -0.02,
      'x', 50,
      'y', 50,
      'entrance', CASE COALESCE(content_payload->>'style', '')
        WHEN 'poetic' THEN 'fade'
        WHEN 'editorial' THEN 'slide'
        ELSE 'scale'
      END,
      'loop', CASE COALESCE(content_payload->>'style', '')
        WHEN 'poetic' THEN 'float'
        ELSE 'pulse'
      END,
      'tempo', CASE COALESCE(content_payload->>'style', '')
        WHEN 'poetic' THEN 'slow'
        ELSE 'steady'
      END,
      'rhythm', CASE COALESCE(content_payload->>'style', '')
        WHEN 'poetic' THEN 'poetic'
        ELSE 'stagger'
      END,
      'rotation', 0,
      'link', NULLIF(content_payload->>'source_url', ''),
      'sourceDomain', NULLIF(content_payload->>'source_domain', ''),
      'hashtags', hashtags,
      'emphasis', COALESCE(content_payload->'emphasis', '[]'::JSONB)
    )::TEXT;

    INSERT INTO public.posts (author_id, post_type, canvas_html, media_urls, bg_gradient, created_at)
    VALUES (
      agent.profile_id,
      CASE WHEN NULLIF(content_payload->>'source_url', '') IS NULL THEN 'text' ELSE 'link' END,
      canvas,
      '{}',
      agent.bg_gradient,
      p_run_at
    )
    RETURNING id INTO post_id;

    INSERT INTO public.bot_post_runs (agent_id, run_date, slot_index, post_id)
    VALUES (agent.id, local_run_date, 1, post_id);

    UPDATE public.agent_content_items
    SET
      status = 'used',
      used_by_agent_id = agent.id,
      used_post_id = post_id,
      used_at = now(),
      updated_at = now()
    WHERE id = content_item_id;

    UPDATE public.bot_agents
    SET last_posted_on = local_run_date
    WHERE id = agent.id;

    created_count := created_count + 1;
    content_item_id := NULL;
    content_payload := NULL;
  END LOOP;

  RETURN created_count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_web_agent_posts(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_web_agent_posts(TIMESTAMPTZ) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_web_agent_posts(TIMESTAMPTZ) TO postgres';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_web_agent_posts(TIMESTAMPTZ) TO supabase_admin';
  END IF;
END;
$$;

DO $$
DECLARE
  cron_installed BOOLEAN;
  existing_job RECORD;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file OR invalid_schema_name THEN
      RAISE NOTICE 'pg_cron extension is not available; publish_web_agent_posts can still be called manually.';
  END;

  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
  INTO cron_installed;

  IF cron_installed THEN
    FOR existing_job IN
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'kinetic-web-agents-daily'
    LOOP
      PERFORM cron.unschedule(existing_job.jobid);
    END LOOP;

    PERFORM cron.schedule(
      'kinetic-web-agents-daily',
      '10 1 * * *',
      'SELECT public.publish_web_agent_posts(now()::timestamptz);'
    );
  END IF;
END;
$$;
