-- Daily topic agents that keep the network warm before organic posting ramps up.

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_post_type_check;
ALTER TABLE public.posts
  ADD CONSTRAINT posts_post_type_check
  CHECK (post_type IN ('text', 'image', 'video', 'slideshow', 'link'));

CREATE TABLE IF NOT EXISTS public.bot_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  bg_gradient TEXT NOT NULL,
  font TEXT NOT NULL DEFAULT 'Space Grotesk',
  active BOOLEAN NOT NULL DEFAULT true,
  daily_post_time TIME NOT NULL DEFAULT '09:00',
  last_posted_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bot_post_runs (
  agent_id UUID NOT NULL REFERENCES public.bot_agents(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, run_date)
);

GRANT SELECT ON public.bot_agents TO anon, authenticated;
GRANT SELECT ON public.bot_post_runs TO anon, authenticated;
GRANT ALL ON public.bot_agents TO service_role;
GRANT ALL ON public.bot_post_runs TO service_role;

ALTER TABLE public.bot_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_post_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_agents_select_all" ON public.bot_agents FOR SELECT USING (true);
CREATE POLICY "bot_post_runs_select_all" ON public.bot_post_runs FOR SELECT USING (true);

INSERT INTO public.profiles (id, username, display_name, avatar_url, bio)
VALUES
  (
    '91000000-0000-4000-8000-000000000001',
    'sports_wire',
    'Sports Wire',
    'https://api.dicebear.com/8.x/shapes/svg?seed=sports-wire',
    'Daily sports rhythm, scores, streaks, and storylines.'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    'entertainment_desk',
    'Entertainment Desk',
    'https://api.dicebear.com/8.x/shapes/svg?seed=entertainment-desk',
    'Movies, music, celebrity loops, and culture moments.'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    'tech_signal',
    'Tech Signal',
    'https://api.dicebear.com/8.x/shapes/svg?seed=tech-signal',
    'Product shifts, AI notes, devices, and software signals.'
  ),
  (
    '91000000-0000-4000-8000-000000000004',
    'food_line',
    'Food Line',
    'https://api.dicebear.com/8.x/shapes/svg?seed=food-line',
    'Menus, cravings, street food, and kitchen notes.'
  ),
  (
    '91000000-0000-4000-8000-000000000005',
    'travel_window',
    'Travel Window',
    'https://api.dicebear.com/8.x/shapes/svg?seed=travel-window',
    'Places, routes, weather moods, and city postcards.'
  ),
  (
    '91000000-0000-4000-8000-000000000006',
    'design_brief',
    'Design Brief',
    'https://api.dicebear.com/8.x/shapes/svg?seed=design-brief',
    'Interface, typography, brand systems, and visual ideas.'
  )
ON CONFLICT (username) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio;

INSERT INTO public.bot_agents (profile_id, topic, prompt, bg_gradient, font, daily_post_time)
VALUES
  (
    '91000000-0000-4000-8000-000000000001',
    'Sports',
    'Short kinetic posts about sports momentum, rivalries, training, and game-day emotions.',
    'linear-gradient(135deg,#06FFA5,#00B4D8)',
    'Bebas Neue',
    '09:05'
  ),
  (
    '91000000-0000-4000-8000-000000000002',
    'Entertainment',
    'Short kinetic posts about movies, music, fandom, performance, and pop culture.',
    'linear-gradient(135deg,#FF006E,#8338EC)',
    'Space Grotesk',
    '09:12'
  ),
  (
    '91000000-0000-4000-8000-000000000003',
    'Technology',
    'Short kinetic posts about AI, product launches, apps, hardware, and software habits.',
    'linear-gradient(135deg,#00B4D8,#FF006E)',
    'JetBrains Mono',
    '09:19'
  ),
  (
    '91000000-0000-4000-8000-000000000004',
    'Food',
    'Short kinetic posts about food rituals, cravings, restaurants, and kitchen culture.',
    'linear-gradient(135deg,#FB5607,#FFBE0B)',
    'Playfair Display',
    '09:26'
  ),
  (
    '91000000-0000-4000-8000-000000000005',
    'Travel',
    'Short kinetic posts about cities, transit, escapes, maps, and travel moods.',
    'linear-gradient(135deg,#3A86FF,#06FFA5)',
    'Inter',
    '09:33'
  ),
  (
    '91000000-0000-4000-8000-000000000006',
    'Design',
    'Short kinetic posts about interfaces, typography, visual systems, and creative work.',
    'linear-gradient(135deg,#9D4EDD,#FF006E)',
    'Space Grotesk',
    '09:40'
  )
ON CONFLICT (topic) DO UPDATE
SET
  profile_id = EXCLUDED.profile_id,
  prompt = EXCLUDED.prompt,
  bg_gradient = EXCLUDED.bg_gradient,
  font = EXCLUDED.font,
  daily_post_time = EXCLUDED.daily_post_time,
  active = true;

CREATE OR REPLACE FUNCTION public.publish_daily_bot_posts(p_run_date DATE DEFAULT current_date)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent RECORD;
  post_id UUID;
  created_count INTEGER := 0;
  day_index INTEGER;
  post_text TEXT;
  canvas TEXT;
  publish_at TIMESTAMPTZ;
BEGIN
  FOR agent IN
    SELECT *
    FROM public.bot_agents
    WHERE active
    ORDER BY daily_post_time, topic
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.bot_post_runs
      WHERE agent_id = agent.id
        AND run_date = p_run_date
    ) THEN
      CONTINUE;
    END IF;

    day_index := ((extract(doy FROM p_run_date)::INTEGER + abs(hashtext(agent.topic))) % 8) + 1;

    post_text := CASE agent.topic
      WHEN 'Sports' THEN
        (ARRAY[
          'Game day is mostly rhythm before it becomes a result.',
          'The best teams turn pressure into a shared tempo.',
          'A streak is just yesterday agreeing to show up again.',
          'Watch the bench. That is where momentum learns its name.',
          'Training makes the dramatic moment look almost quiet.',
          'Rivalries work because everyone remembers the last frame.',
          'The scoreboard is late. The shift happens first in the body.',
          'Great defense can feel louder than a goal.'
        ])[day_index]
      WHEN 'Entertainment' THEN
        (ARRAY[
          'A chorus wins when the room knows it before the hook ends.',
          'The trailer did its job if one image follows you home.',
          'Fandom is a calendar made of premieres and tiny theories.',
          'A good performance changes the air before the line lands.',
          'The best pop moment feels obvious only after it arrives.',
          'Every comeback needs one clean frame people can repeat.',
          'A scene becomes culture when it learns to move without context.',
          'The spotlight is just timing with better lighting.'
        ])[day_index]
      WHEN 'Technology' THEN
        (ARRAY[
          'The winning app removes one decision you forgot was expensive.',
          'New hardware matters when the habit changes with it.',
          'AI feels useful when it disappears into the workflow.',
          'A launch is not a moment. It is a promise under load.',
          'The interface is the product before the feature list starts.',
          'Speed is a design language people notice with their shoulders.',
          'The next platform shift starts as a tiny daily convenience.',
          'Software gets trusted one recovered mistake at a time.'
        ])[day_index]
      WHEN 'Food' THEN
        (ARRAY[
          'The first bite should explain why the line was worth it.',
          'A good menu knows what kind of night you are trying to have.',
          'Street food wins because the story is still warm.',
          'The best table has a rhythm before anyone orders.',
          'A sauce can carry more memory than a photograph.',
          'Comfort food is architecture for a tired day.',
          'The kitchen has a tempo, and the plate is just the final beat.',
          'A craving is a tiny headline written by the body.'
        ])[day_index]
      WHEN 'Travel' THEN
        (ARRAY[
          'A city introduces itself through the walk between plans.',
          'The best window seat turns distance into a moving postcard.',
          'Some streets only make sense after the sun changes angle.',
          'A map is useful, but a detour makes the memory.',
          'Morning light can make a familiar block feel rented from a dream.',
          'The station is where every trip briefly becomes a crowd.',
          'Pack lighter than the version of yourself that worries.',
          'A place becomes yours when you know where to pause.'
        ])[day_index]
      ELSE
        (ARRAY[
          'The strongest layout makes the next action feel inevitable.',
          'Type is voice before it becomes information.',
          'A good button does not beg. It waits in the right place.',
          'Contrast is kindness when the screen is busy.',
          'The grid is invisible until it saves the whole page.',
          'Motion should explain state, not decorate uncertainty.',
          'A brand system earns trust by repeating with taste.',
          'Every useful interface has one less argument than expected.'
        ])[day_index]
    END;

    canvas := json_build_object(
      'text', post_text,
      'font', agent.font,
      'size', 76,
      'color', '#ffffff',
      'weight', 900,
      'letterSpacing', -0.03,
      'x', 50,
      'y', 50,
      'entrance', 'scale',
      'loop', 'float',
      'tempo', 'steady',
      'rhythm', 'stagger',
      'rotation', 0,
      'link', null
    )::TEXT;

    publish_at := ((p_run_date + agent.daily_post_time) AT TIME ZONE 'UTC');

    INSERT INTO public.posts (author_id, post_type, canvas_html, media_urls, bg_gradient, created_at)
    VALUES (agent.profile_id, 'text', canvas, '{}', agent.bg_gradient, publish_at)
    RETURNING id INTO post_id;

    INSERT INTO public.bot_post_runs (agent_id, run_date, post_id)
    VALUES (agent.id, p_run_date, post_id);

    UPDATE public.bot_agents
    SET last_posted_on = p_run_date
    WHERE id = agent.id;

    created_count := created_count + 1;
  END LOOP;

  RETURN created_count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_daily_bot_posts(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_daily_bot_posts(DATE) TO service_role;

SELECT public.publish_daily_bot_posts(current_date);

DO $$
DECLARE
  cron_installed BOOLEAN;
  job_exists BOOLEAN := false;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file OR invalid_schema_name THEN
      RAISE NOTICE 'pg_cron extension is not available; publish_daily_bot_posts can still be called manually.';
  END;

  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
  INTO cron_installed;

  IF cron_installed THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
    INTO job_exists
    USING 'kinetic-bot-daily-posts';

    IF NOT job_exists THEN
      EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING
        'kinetic-bot-daily-posts',
        '5 9 * * *',
        'SELECT public.publish_daily_bot_posts(current_date);';
    END IF;
  END IF;
END $$;
