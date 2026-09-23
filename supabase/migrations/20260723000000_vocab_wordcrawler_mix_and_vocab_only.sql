-- WordCrawler mix & match + vocab-only mode (reversible)
--
-- 1) Upgrade publish_vocabulary_bot_post to handle 7-page WordCrawler payload:
--    leadVi, usageEn, ipa/pos/style, anticipatVi while keeping backward compat
--    with old 3-hint payloads. When extended fields exist, canvas text becomes:
--    1_leadVi / 2_defVi / 3_chars / 4_usageEn / 5_initial / 6_anticipate / 7_reveal
--    The two hint substrings ("Từ này bắt đầu bằng chữ", "Cả từ gồm") are
--    preserved so public.vocabulary_reveal_word_from_canvas() still classifies.
--
-- 2) Re-assert vocab-only scheduled mode: deactivate 6 web bot_agents, unschedule
--    their crons. To revert: set active=true and re-schedule (see bottom).
--
-- 3) No deletions — non-vocabulary posts stay in DB, just not scheduled/published.

-- ── 1) Publish function upgrade ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_vocabulary_bot_post(p_run_at TIMESTAMPTZ DEFAULT now())
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  agent RECORD;
  local_run_at TIMESTAMP;
  local_run_date DATE;
  local_hour INTEGER;
  v_slot_index INTEGER;
  post_id UUID;
  content_item_id UUID;
  content_payload JSONB;
  word TEXT;
  vi_definition TEXT;
  lead_vi TEXT;
  usage_en TEXT;
  usage_vi TEXT;
  ipa TEXT;
  pos TEXT;
  style TEXT;
  anticipate TEXT;
  hint_lines TEXT[];
  canvas TEXT;
  post_text TEXT;
  reveal_line TEXT;
  post_lines TEXT[];
BEGIN
  local_run_at := p_run_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
  local_run_date := local_run_at::DATE;
  local_hour := extract(hour FROM local_run_at)::INTEGER;
  v_slot_index := CASE
    WHEN local_hour < 12 THEN 1
    WHEN local_hour < 18 THEN 2
    ELSE 3
  END;

  SELECT *
  INTO agent
  FROM public.bot_agents
  WHERE topic = 'Vocabulary'
    AND active
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bot_post_runs
    WHERE agent_id = agent.id
      AND run_date = local_run_date
      AND bot_post_runs.slot_index = v_slot_index
  ) THEN
    RETURN 0;
  END IF;

  WITH next_item AS (
    SELECT item.id, item.payload
    FROM public.agent_content_items item
    WHERE item.source_key = 'vocabulary.en_vi'
      AND item.status = 'ready'
      AND item.available_at <= p_run_at
      AND item.payload ? 'word'
      AND item.payload ? 'vi_definition'
      AND NOT EXISTS (
        SELECT 1
        FROM public.posts existing
        WHERE existing.author_id = agent.profile_id
          AND existing.canvas_html ILIKE '%' || (item.payload->>'word') || '%'
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
    RETURN 0;
  END IF;

  word := content_payload->>'word';
  vi_definition := content_payload->>'vi_definition';
  lead_vi := NULLIF(content_payload->>'leadVi', '');
  usage_en := NULLIF(content_payload->>'usageEn', '');
  usage_vi := NULLIF(content_payload->>'usageVi', '');
  ipa := NULLIF(content_payload->>'ipa', '');
  pos := NULLIF(content_payload->>'pos', '');
  style := COALESCE(NULLIF(content_payload->>'style', ''), 'minimal');
  anticipate := NULLIF(content_payload->>'anticipateVi', '');

  hint_lines := CASE
    WHEN jsonb_typeof(content_payload->'hints') = 'array' THEN
      ARRAY(SELECT jsonb_array_elements_text(content_payload->'hints'))
    ELSE ARRAY[]::TEXT[]
  END;

  IF cardinality(hint_lines) = 0 THEN
    hint_lines := ARRAY[
      'Từ này bắt đầu bằng chữ ' || upper(left(word, 1)) || '.',
      'Cả từ gồm ' || char_length(word)::TEXT || ' chữ cái.',
      COALESCE(anticipate, 'Đoán tiếp nào, bạn tìm ra chứ?')
    ]::TEXT[];
  END IF;

  -- Build reveal line with optional IPA/POS (page 7)
  reveal_line := word;
  IF ipa IS NOT NULL THEN
    reveal_line := reveal_line || ' ' || ipa;
  END IF;
  IF pos IS NOT NULL THEN
    reveal_line := reveal_line || ' (' || pos || ')';
  END IF;

  -- 7-page WordCrawler flow when leadVi/usage present; else fallback to legacy 4-line
  IF lead_vi IS NOT NULL OR usage_en IS NOT NULL THEN
    post_lines := ARRAY[]::TEXT[];
    IF lead_vi IS NOT NULL THEN
      post_lines := array_append(post_lines, lead_vi);
    END IF;
    post_lines := array_append(post_lines, vi_definition);
    -- chars hint is hint_lines[2] (index 2), initial is [1]
    IF cardinality(hint_lines) >= 2 THEN
      post_lines := array_append(post_lines, hint_lines[2]);
    END IF;
    IF usage_en IS NOT NULL THEN
      post_lines := array_append(post_lines, usage_en);
    END IF;
    IF cardinality(hint_lines) >= 1 THEN
      post_lines := array_append(post_lines, hint_lines[1]);
    END IF;
    IF cardinality(hint_lines) >= 3 THEN
      post_lines := array_append(post_lines, hint_lines[3]);
    ELSIF anticipate IS NOT NULL THEN
      post_lines := array_append(post_lines, anticipate);
    END IF;
    post_lines := array_append(post_lines, reveal_line);
    post_text := array_to_string(post_lines, E'\n');
  ELSE
    -- legacy: vi_definition + hints + word (keeps old queue items rendering)
    post_text := array_to_string(ARRAY[vi_definition] || hint_lines || ARRAY[reveal_line], E'\n');
  END IF;

  -- Style-aware canvas effects
  canvas := json_build_object(
    'text', post_text,
    'font', agent.font,
    'size', 72,
    'color', '#ffffff',
    'weight', 800,
    'letterSpacing', -0.02,
    'x', 50,
    'y', 50,
    'entrance', CASE style WHEN 'speed' THEN 'slide' WHEN 'detective' THEN 'fade' WHEN 'confession' THEN 'scale' ELSE (ARRAY['fade','scale','slide'])[v_slot_index] END,
    'loop', CASE style WHEN 'speed' THEN 'pulse' WHEN 'confession' THEN 'float' ELSE (ARRAY['float','pulse','float'])[v_slot_index] END,
    'tempo', CASE style WHEN 'speed' THEN 'fast' WHEN 'minimal' THEN 'slow' ELSE 'steady' END,
    'rhythm', (ARRAY['smooth','stagger','smooth'])[v_slot_index],
    'rotation', 0,
    'link', null,
    'style', style,
    'topic', content_payload->>'topic',
    'level', content_payload->>'level'
  )::TEXT;

  INSERT INTO public.posts (author_id, post_type, canvas_html, media_urls, bg_gradient, created_at)
  VALUES (agent.profile_id, 'text', canvas, '{}', agent.bg_gradient, p_run_at)
  RETURNING id INTO post_id;

  INSERT INTO public.bot_post_runs (agent_id, run_date, slot_index, post_id)
  VALUES (agent.id, local_run_date, v_slot_index, post_id);

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

  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO service_role;

-- Re-grant for direct cron context (pg_cron runs as postgres/supabase_admin)
DO $$
BEGIN
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO postgres';
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO supabase_admin';
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- ── 2) Vocab-only scheduled mode (idempotent, reversible) ──────────────────
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

-- NOTE: To revert vocab-only mode:
--   UPDATE public.bot_agents SET active = true WHERE topic IN ('Sports','Entertainment','Technology','Food','Travel','Design');
--   SELECT cron.schedule('kinetic-web-agents-daily','10 1 * * *','SELECT public.publish_web_agent_posts(now()::timestamptz);');
--   SELECT cron.schedule('kinetic-bot-daily-posts','5 9 * * *','SELECT public.publish_daily_bot_posts(current_date);');
