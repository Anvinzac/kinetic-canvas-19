
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  auth_user_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = auth_user_id);

-- POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN ('text','image','video','slideshow')),
  canvas_html TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  bg_gradient TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_select_all" ON public.posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_own" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = author_id AND p.auth_user_id = auth.uid()));
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = author_id AND p.auth_user_id = auth.uid()));
CREATE POLICY "posts_delete_own" ON public.posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = author_id AND p.auth_user_id = auth.uid()));

-- FOLLOWS
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);
GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_self" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = follower_id AND p.auth_user_id = auth.uid()));
CREATE POLICY "follows_delete_self" ON public.follows FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = follower_id AND p.auth_user_id = auth.uid()));

-- LIKES
CREATE TABLE public.likes (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT ON public.likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_select_all" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_self" ON public.likes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.auth_user_id = auth.uid()));
CREATE POLICY "likes_delete_self" ON public.likes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.auth_user_id = auth.uid()));

-- COMMENTS (chip-based)
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chip_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_self" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.auth_user_id = auth.uid()));
CREATE POLICY "comments_delete_self" ON public.comments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_id AND p.auth_user_id = auth.uid()));

-- Indexes
CREATE INDEX ON public.posts (author_id, created_at DESC);
CREATE INDEX ON public.comments (post_id, created_at DESC);
CREATE INDEX ON public.likes (post_id);
CREATE INDEX ON public.follows (following_id);

-- ========================================================================
-- SEED MOCK DATA: 5 profiles, 10 posts each, follows, likes, comments
-- ========================================================================
DO $$
DECLARE
  u1 UUID := gen_random_uuid();
  u2 UUID := gen_random_uuid();
  u3 UUID := gen_random_uuid();
  u4 UUID := gen_random_uuid();
  u5 UUID := gen_random_uuid();
  users UUID[];
  uid UUID;
  other UUID;
  post_id UUID;
  i INT;
  ptype TEXT;
  ptypes TEXT[] := ARRAY['text','text','text','text','image','image','video','slideshow','slideshow','text'];
  gradients TEXT[] := ARRAY[
    'linear-gradient(135deg,#FF006E,#8338EC)',
    'linear-gradient(135deg,#06FFA5,#00B4D8)',
    'linear-gradient(135deg,#FB5607,#FFBE0B)',
    'linear-gradient(135deg,#3A86FF,#8338EC)',
    'linear-gradient(135deg,#F72585,#7209B7)',
    'linear-gradient(135deg,#FFD60A,#FF006E)',
    'linear-gradient(135deg,#06D6A0,#118AB2)',
    'linear-gradient(135deg,#EF476F,#FFD166)',
    'linear-gradient(135deg,#00B4D8,#FF006E)',
    'linear-gradient(135deg,#9D4EDD,#FF006E)'
  ];
  texts TEXT[] := ARRAY[
    'FEEL IT.', 'NEVER SLEEP', 'electric dreams', 'CHAOS', 'soft / loud',
    'tomorrow now', 'made you look.', 'velocity', 'after hours', 'big small big',
    'glow up', 'pure noise', 'kinetic.', 'wide awake', 'less / more',
    'unfiltered', 'analog hearts', 'reset', 'manifesto', 'NOW.'
  ];
  fonts TEXT[] := ARRAY['Inter','Space Grotesk','Bebas Neue','Playfair Display','JetBrains Mono'];
  chips TEXT[] := ARRAY['fire','heart','wow','laugh','clap','mind-blown','obsessed','vibe','genius','goals'];
  img_urls TEXT[] := ARRAY[
    'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=900',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=900',
    'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=900',
    'https://images.unsplash.com/photo-1502691876148-a84978e59af8?w=900',
    'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=900',
    'https://images.unsplash.com/photo-1505739679850-7adbf3e3b8e0?w=900',
    'https://images.unsplash.com/photo-1551763051-a3b3a16f3f3f?w=900',
    'https://images.unsplash.com/photo-1490604001847-b712b0c2f967?w=900'
  ];
  vid_urls TEXT[] := ARRAY[
    'https://cdn.coverr.co/videos/coverr-a-young-woman-dancing-in-the-street-1572/1080p.mp4',
    'https://cdn.coverr.co/videos/coverr-young-people-watching-fireworks-7148/1080p.mp4'
  ];
  txt TEXT;
  fnt TEXT;
  grad TEXT;
  media TEXT[];
  canvas TEXT;
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, bio) VALUES
    (u1,'nova_rae','Nova Rae','https://i.pravatar.cc/200?img=47','typography junkie • kinetic everything'),
    (u2,'kai_loop','Kai Loop','https://i.pravatar.cc/200?img=12','motion designer. always shipping.'),
    (u3,'mira_aux','Mira Aux','https://i.pravatar.cc/200?img=32','soft loud / loud soft'),
    (u4,'zeph_404','Zeph 404','https://i.pravatar.cc/200?img=68','noise + signal'),
    (u5,'lila_om','Lila Om','https://i.pravatar.cc/200?img=49','sunsets, slowness, serifs');

  users := ARRAY[u1,u2,u3,u4,u5];

  -- follows: everyone follows everyone else
  FOREACH uid IN ARRAY users LOOP
    FOREACH other IN ARRAY users LOOP
      IF uid <> other THEN
        INSERT INTO public.follows (follower_id, following_id) VALUES (uid, other);
      END IF;
    END LOOP;
  END LOOP;

  -- 10 posts per user
  FOREACH uid IN ARRAY users LOOP
    FOR i IN 1..10 LOOP
      ptype := ptypes[i];
      txt := texts[((random()*19)::INT)+1];
      fnt := fonts[((random()*4)::INT)+1];
      grad := gradients[((random()*9)::INT)+1];
      media := '{}';
      IF ptype = 'image' THEN
        media := ARRAY[img_urls[((random()*7)::INT)+1]];
      ELSIF ptype = 'video' THEN
        media := ARRAY[vid_urls[((random()*1)::INT)+1]];
      ELSIF ptype = 'slideshow' THEN
        media := ARRAY[
          img_urls[((random()*7)::INT)+1],
          img_urls[((random()*7)::INT)+1],
          img_urls[((random()*7)::INT)+1]
        ];
      END IF;

      canvas := json_build_object(
        'text', upper(txt),
        'font', fnt,
        'size', 64 + (random()*48)::INT,
        'color', '#ffffff',
        'weight', (CASE WHEN random() > 0.5 THEN 900 ELSE 400 END),
        'letterSpacing', (random()*0.2 - 0.05),
        'x', 50,
        'y', 50,
        'entrance', (ARRAY['fade','slide','scale','blur','split'])[((random()*4)::INT)+1],
        'loop', (ARRAY['pulse','float','shake','none','none'])[((random()*4)::INT)+1],
        'rotation', ((random()*20)::INT - 10)
      )::TEXT;

      INSERT INTO public.posts (author_id, post_type, canvas_html, media_urls, bg_gradient, created_at)
      VALUES (uid, ptype, canvas, media, grad, now() - (random()*interval '14 days'))
      RETURNING id INTO post_id;

      -- Random likes from other users
      FOREACH other IN ARRAY users LOOP
        IF other <> uid AND random() > 0.4 THEN
          INSERT INTO public.likes (user_id, post_id) VALUES (other, post_id) ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;

      -- 2-5 random comments
      FOR i IN 1..((random()*3)::INT + 2) LOOP
        INSERT INTO public.comments (post_id, user_id, chip_id)
        VALUES (
          post_id,
          users[((random()*4)::INT)+1],
          chips[((random()*9)::INT)+1]
        );
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
