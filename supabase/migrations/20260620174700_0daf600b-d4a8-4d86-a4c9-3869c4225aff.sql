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
SET display_name = EXCLUDED.display_name,
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
SET profile_id = EXCLUDED.profile_id,
    prompt = EXCLUDED.prompt,
    bg_gradient = EXCLUDED.bg_gradient,
    font = EXCLUDED.font,
    daily_post_time = EXCLUDED.daily_post_time,
    active = true;

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
  vocab_index INTEGER;
  candidate_index INTEGER;
  attempt_index INTEGER;
  post_id UUID;
  canvas TEXT;
  post_text TEXT;
  clue TEXT[];
  reveal_word TEXT;
BEGIN
  local_run_at := p_run_at AT TIME ZONE 'Asia/Ho_Chi_Minh';
  local_run_date := local_run_at::DATE;
  local_hour := extract(hour FROM local_run_at)::INTEGER;
  v_slot_index := CASE
    WHEN local_hour < 12 THEN 1
    WHEN local_hour < 18 THEN 2
    ELSE 3
  END;

  SELECT * INTO agent FROM public.bot_agents WHERE topic = 'Vocabulary' AND active LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF EXISTS (
    SELECT 1 FROM public.bot_post_runs
    WHERE agent_id = agent.id AND run_date = local_run_date AND bot_post_runs.slot_index = v_slot_index
  ) THEN
    RETURN 0;
  END IF;

  vocab_index := ((extract(doy FROM local_run_date)::INTEGER * 3 + v_slot_index - 4) % 12) + 1;

  FOR attempt_index IN 0..11 LOOP
    candidate_index := ((vocab_index + attempt_index - 1) % 12) + 1;
    clue := CASE candidate_index
      WHEN 1 THEN ARRAY['Mùi đất thơm dịu sau cơn mưa đầu mùa.','Từ này bắt đầu bằng chữ P.','Cả từ gồm 9 chữ cái.','Đoán tiếp nào, bạn tìm ra chứ?','Petrichor']::TEXT[]
      WHEN 2 THEN ARRAY['Niềm vui bất ngờ khi gặp điều may mắn.','Từ này bắt đầu bằng chữ S.','Cả từ gồm 11 chữ cái.','Thử đoán xem, bạn tìm ra không?','Serendipity']::TEXT[]
      WHEN 3 THEN ARRAY['Thứ tồn tại rất ngắn, thoáng qua rồi tan.','Từ này bắt đầu bằng chữ E.','Cả từ gồm 9 chữ cái.','Đoán tiếp đi, bạn nghĩ ra chưa?','Ephemeral']::TEXT[]
      WHEN 4 THEN ARRAY['Sự bình tĩnh khi mọi thứ đang rối.','Từ này bắt đầu bằng chữ C.','Cả từ gồm 9 chữ cái.','Bạn có cảm nhận được nghĩa không?','Composure']::TEXT[]
      WHEN 5 THEN ARRAY['Một ý nghĩ hiện ra rất nhanh rồi biến mất.','Từ này bắt đầu bằng chữ G.','Cả từ gồm 7 chữ cái.','Đừng để nó trôi qua nhé.','Glimpse']::TEXT[]
      WHEN 6 THEN ARRAY['Ánh sáng dịu xuất hiện ngay trước bình minh.','Từ này bắt đầu bằng chữ D.','Cả từ gồm 4 chữ cái.','Trang cuối sẽ bật mí.','Dawn']::TEXT[]
      WHEN 7 THEN ARRAY['Sự tò mò khiến bạn muốn tìm hiểu thêm.','Từ này bắt đầu bằng chữ C.','Cả từ gồm 9 chữ cái.','Một từ rất hợp với người học.','Curiosity']::TEXT[]
      WHEN 8 THEN ARRAY['Một thói quen nhỏ lặp lại mỗi ngày.','Từ này bắt đầu bằng chữ R.','Cả từ gồm 7 chữ cái.','Bạn gặp nó mỗi sáng.','Routine']::TEXT[]
      WHEN 9 THEN ARRAY['Cảm giác nhẹ nhõm sau khi vấn đề được giải quyết.','Từ này bắt đầu bằng chữ R.','Cả từ gồm 6 chữ cái.','Thở ra một chút nhé.','Relief']::TEXT[]
      WHEN 10 THEN ARRAY['Một chi tiết nhỏ làm mọi thứ trở nên rõ hơn.','Từ này bắt đầu bằng chữ C.','Cả từ gồm 4 chữ cái.','Nó giúp bạn hiểu bức tranh lớn.','Clue']::TEXT[]
      WHEN 11 THEN ARRAY['Sự bền bỉ khi bạn tiếp tục dù chưa dễ dàng.','Từ này bắt đầu bằng chữ P.','Cả từ gồm 11 chữ cái.','Từ này hơi dài, nhưng đáng nhớ.','Persistence']::TEXT[]
      ELSE ARRAY['Khoảnh khắc một ý tưởng bỗng sáng lên.','Từ này bắt đầu bằng chữ I.','Cả từ gồm 7 chữ cái.','Nó thường đến rất bất ngờ.','Insight']::TEXT[]
    END;
    reveal_word := clue[5];
    IF NOT EXISTS (
      SELECT 1 FROM public.posts
      WHERE author_id = agent.profile_id AND canvas_html ILIKE '%' || reveal_word || '%'
    ) THEN
      EXIT;
    END IF;
    clue := NULL;
    reveal_word := NULL;
  END LOOP;

  IF clue IS NULL THEN RETURN 0; END IF;

  post_text := array_to_string(clue, E'\n');

  canvas := json_build_object(
    'text', post_text,
    'font', agent.font,
    'size', 72,
    'color', '#ffffff',
    'weight', 800,
    'letterSpacing', -0.02,
    'x', 50,
    'y', 50,
    'entrance', (ARRAY['fade','scale','slide'])[v_slot_index],
    'loop', (ARRAY['float','pulse','float'])[v_slot_index],
    'tempo', 'steady',
    'rhythm', (ARRAY['smooth','stagger','smooth'])[v_slot_index],
    'rotation', 0,
    'link', null
  )::TEXT;

  INSERT INTO public.posts (author_id, post_type, canvas_html, media_urls, bg_gradient, created_at)
  VALUES (agent.profile_id, 'text', canvas, '{}', agent.bg_gradient, p_run_at)
  RETURNING id INTO post_id;

  INSERT INTO public.bot_post_runs (agent_id, run_date, slot_index, post_id)
  VALUES (agent.id, local_run_date, v_slot_index, post_id);

  UPDATE public.bot_agents SET last_posted_on = local_run_date WHERE id = agent.id;

  RETURN 1;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_vocabulary_bot_post(TIMESTAMPTZ) TO service_role;

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

  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO cron_installed;

  IF cron_installed THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
    INTO job_exists USING 'kinetic-vocabulary-bot-3x-daily';

    IF NOT job_exists THEN
      EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING 'kinetic-vocabulary-bot-3x-daily','0 1,7,13 * * *','SELECT public.publish_vocabulary_bot_post(now());';
    END IF;
  END IF;
END $$;