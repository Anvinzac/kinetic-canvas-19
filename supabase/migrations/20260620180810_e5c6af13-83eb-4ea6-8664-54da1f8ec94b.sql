-- Vocabulary bot: three scheduled kinetic guessing posts per day.

ALTER TABLE public.bot_post_runs
  ADD COLUMN IF NOT EXISTS slot_index INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.bot_post_runs
  DROP CONSTRAINT IF EXISTS bot_post_runs_pkey;

ALTER TABLE public.bot_post_runs
  ADD CONSTRAINT bot_post_runs_pkey PRIMARY KEY (agent_id, run_date, slot_index);

INSERT INTO public.profiles (id, username, display_name, avatar_url, bio)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  'do_chu_bot',
  'Đố Chữ Mỗi Ngày',
  'https://api.dicebear.com/7.x/bottts/svg?seed=dochu&backgroundColor=8338EC,3A86FF',
  'Mỗi ngày ba từ tiếng Anh — đoán nghĩa qua gợi ý tiếng Việt.'
)
ON CONFLICT (username) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio;

INSERT INTO public.bot_agents (profile_id, topic, prompt, bg_gradient, font, daily_post_time)
VALUES (
  '77777777-7777-4777-8777-777777777777',
  'Vocabulary',
  'Kinetic vocabulary guessing posts with Vietnamese clues and an English reveal.',
  'linear-gradient(135deg,#00B4D8,#FF006E)',
  'Inter',
  '08:00'
)
ON CONFLICT (topic) DO UPDATE
SET
  profile_id = EXCLUDED.profile_id,
  prompt = EXCLUDED.prompt,
  bg_gradient = EXCLUDED.bg_gradient,
  font = EXCLUDED.font,
  daily_post_time = EXCLUDED.daily_post_time,
  active = true;

DO $$
DECLARE
  cron_installed BOOLEAN;
  job_exists BOOLEAN := false;
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
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
    INTO job_exists
    USING 'kinetic-vocabulary-bot-3x-daily';

    IF NOT job_exists THEN
      EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING
        'kinetic-vocabulary-bot-3x-daily',
        '0 1,7,13 * * *',
        'SELECT public.publish_vocabulary_bot_post(now());';
    END IF;
  END IF;
END $$;

-- Generic content feed API for bot agents.

CREATE TABLE IF NOT EXISTS public.agent_content_sources (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  item_type TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL REFERENCES public.agent_content_sources(key) ON DELETE CASCADE,
  content_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'claimed', 'used', 'rejected')),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_by_agent_id UUID REFERENCES public.bot_agents(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  used_by_agent_id UUID REFERENCES public.bot_agents(id) ON DELETE SET NULL,
  used_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_key, content_key)
);

CREATE INDEX IF NOT EXISTS agent_content_items_ready_idx
  ON public.agent_content_items (source_key, status, available_at, created_at)
  WHERE status = 'ready';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_content_sources TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_content_items TO service_role;

ALTER TABLE public.agent_content_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_content_sources_service_manage" ON public.agent_content_sources;
CREATE POLICY "agent_content_sources_service_manage"
  ON public.agent_content_sources FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "agent_content_items_service_manage" ON public.agent_content_items;
CREATE POLICY "agent_content_items_service_manage"
  ON public.agent_content_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.agent_content_sources (key, label, item_type)
VALUES (
  'vocabulary.en_vi',
  'English vocabulary with Vietnamese clues',
  'vocabulary'
)
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label, item_type = EXCLUDED.item_type, active = true;

CREATE OR REPLACE FUNCTION public.enqueue_agent_content_item(
  p_source_key TEXT,
  p_content_key TEXT,
  p_payload JSONB,
  p_available_at TIMESTAMPTZ DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item_id UUID;
BEGIN
  INSERT INTO public.agent_content_items (source_key, content_key, payload, available_at, status, updated_at)
  VALUES (p_source_key, lower(trim(p_content_key)), p_payload, p_available_at, 'ready', now())
  ON CONFLICT (source_key, content_key) DO UPDATE
  SET payload = EXCLUDED.payload,
      available_at = EXCLUDED.available_at,
      status = CASE WHEN public.agent_content_items.status = 'used' THEN public.agent_content_items.status ELSE 'ready' END,
      updated_at = now()
  RETURNING id INTO item_id;
  RETURN item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_agent_content_item(TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_agent_content_item(TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;

SELECT public.enqueue_agent_content_item(
  'vocabulary.en_vi',
  item.word,
  jsonb_build_object('word', item.word, 'vi_definition', item.vi_definition, 'hints', item.hints, 'difficulty', item.difficulty)
)
FROM (
  VALUES
    ('Petrichor', 'Mùi đất thơm dịu sau cơn mưa đầu mùa.', ARRAY['Từ này bắt đầu bằng chữ P.', 'Cả từ gồm 9 chữ cái.', 'Đoán tiếp nào, bạn tìm ra chứ?'], 'medium'),
    ('Serendipity', 'Niềm vui bất ngờ khi gặp điều may mắn.', ARRAY['Từ này bắt đầu bằng chữ S.', 'Cả từ gồm 11 chữ cái.', 'Thử đoán xem, bạn tìm ra không?'], 'hard'),
    ('Ephemeral', 'Thứ tồn tại rất ngắn, thoáng qua rồi tan.', ARRAY['Từ này bắt đầu bằng chữ E.', 'Cả từ gồm 9 chữ cái.', 'Đoán tiếp đi, bạn nghĩ ra chưa?'], 'hard'),
    ('Composure', 'Sự bình tĩnh khi mọi thứ đang rối.', ARRAY['Từ này bắt đầu bằng chữ C.', 'Cả từ gồm 9 chữ cái.', 'Bạn có cảm nhận được nghĩa không?'], 'medium'),
    ('Glimpse', 'Một ý nghĩ hiện ra rất nhanh rồi biến mất.', ARRAY['Từ này bắt đầu bằng chữ G.', 'Cả từ gồm 7 chữ cái.', 'Đừng để nó trôi qua nhé.'], 'easy'),
    ('Dawn', 'Ánh sáng dịu xuất hiện ngay trước bình minh.', ARRAY['Từ này bắt đầu bằng chữ D.', 'Cả từ gồm 4 chữ cái.', 'Trang cuối sẽ bật mí.'], 'easy'),
    ('Curiosity', 'Sự tò mò khiến bạn muốn tìm hiểu thêm.', ARRAY['Từ này bắt đầu bằng chữ C.', 'Cả từ gồm 9 chữ cái.', 'Một từ rất hợp với người học.'], 'medium'),
    ('Routine', 'Một thói quen nhỏ lặp lại mỗi ngày.', ARRAY['Từ này bắt đầu bằng chữ R.', 'Cả từ gồm 7 chữ cái.', 'Bạn gặp nó mỗi sáng.'], 'easy'),
    ('Relief', 'Cảm giác nhẹ nhõm sau khi vấn đề được giải quyết.', ARRAY['Từ này bắt đầu bằng chữ R.', 'Cả từ gồm 6 chữ cái.', 'Thở ra một chút nhé.'], 'easy'),
    ('Clue', 'Một chi tiết nhỏ làm mọi thứ trở nên rõ hơn.', ARRAY['Từ này bắt đầu bằng chữ C.', 'Cả từ gồm 4 chữ cái.', 'Nó giúp bạn hiểu bức tranh lớn.'], 'easy'),
    ('Persistence', 'Sự bền bỉ khi bạn tiếp tục dù chưa dễ dàng.', ARRAY['Từ này bắt đầu bằng chữ P.', 'Cả từ gồm 11 chữ cái.', 'Từ này hơi dài, nhưng đáng nhớ.'], 'hard'),
    ('Insight', 'Khoảnh khắc một ý tưởng bỗng sáng lên.', ARRAY['Từ này bắt đầu bằng chữ I.', 'Cả từ gồm 7 chữ cái.', 'Nó thường đến rất bất ngờ.'], 'medium')
) AS item(word, vi_definition, hints, difficulty);

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
  hint_lines TEXT[];
  canvas TEXT;
  post_text TEXT;
BEGIN
  local_run_at := p_run_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
  local_run_date := local_run_at::DATE;
  local_hour := extract(hour FROM local_run_at)::INTEGER;
  v_slot_index := CASE WHEN local_hour < 12 THEN 1 WHEN local_hour < 18 THEN 2 ELSE 3 END;

  SELECT * INTO agent FROM public.bot_agents WHERE topic = 'Vocabulary' AND active LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF EXISTS (
    SELECT 1 FROM public.bot_post_runs
    WHERE agent_id = agent.id AND run_date = local_run_date AND bot_post_runs.slot_index = v_slot_index
  ) THEN RETURN 0; END IF;

  WITH next_item AS (
    SELECT item.id, item.payload
    FROM public.agent_content_items item
    WHERE item.source_key = 'vocabulary.en_vi'
      AND item.status = 'ready'
      AND item.available_at <= p_run_at
      AND item.payload ? 'word'
      AND item.payload ? 'vi_definition'
      AND NOT EXISTS (
        SELECT 1 FROM public.posts existing
        WHERE existing.author_id = agent.profile_id
          AND existing.canvas_html ILIKE '%' || (item.payload->>'word') || '%'
      )
    ORDER BY item.available_at, item.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.agent_content_items item
  SET status = 'claimed', claimed_by_agent_id = agent.id, claimed_at = now(), updated_at = now()
  FROM next_item
  WHERE item.id = next_item.id
  RETURNING item.id, item.payload
  INTO content_item_id, content_payload;

  IF content_item_id IS NULL THEN RETURN 0; END IF;

  word := content_payload->>'word';
  vi_definition := content_payload->>'vi_definition';
  hint_lines := CASE
    WHEN jsonb_typeof(content_payload->'hints') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(content_payload->'hints'))
    ELSE ARRAY[]::TEXT[]
  END;
  IF cardinality(hint_lines) = 0 THEN
    hint_lines := ARRAY[
      'Từ này bắt đầu bằng chữ ' || upper(left(word, 1)) || '.',
      'Cả từ gồm ' || char_length(word)::TEXT || ' chữ cái.',
      'Đoán tiếp nào, bạn tìm ra chứ?'
    ]::TEXT[];
  END IF;

  post_text := array_to_string(ARRAY[vi_definition] || hint_lines || ARRAY[word], E'\n');

  canvas := json_build_object(
    'text', post_text,
    'font', agent.font,
    'size', 72,
    'color', '#ffffff',
    'weight', 800,
    'letterSpacing', -0.02,
    'x', 50,
    'y', 50,
    'entrance', (ARRAY['fade', 'scale', 'slide'])[v_slot_index],
    'loop', (ARRAY['float', 'pulse', 'float'])[v_slot_index],
    'tempo', 'steady',
    'rhythm', (ARRAY['smooth', 'stagger', 'smooth'])[v_slot_index],
    'rotation', 0,
    'link', null
  )::TEXT;

  INSERT INTO public.posts (author_id, post_type, canvas_html, media_urls, bg_gradient, created_at)
  VALUES (agent.profile_id, 'text', canvas, '{}', agent.bg_gradient, p_run_at)
  RETURNING id INTO post_id;

  INSERT INTO public.bot_post_runs (agent_id, run_date, slot_index, post_id)
  VALUES (agent.id, local_run_date, v_slot_index, post_id);

  UPDATE public.agent_content_items
  SET status = 'used', used_by_agent_id = agent.id, used_post_id = post_id, used_at = now(), updated_at = now()
  WHERE id = content_item_id;

  UPDATE public.bot_agents SET last_posted_on = local_run_date WHERE id = agent.id;

  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO service_role;