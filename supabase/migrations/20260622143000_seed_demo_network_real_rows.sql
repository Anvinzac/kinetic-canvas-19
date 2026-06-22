-- Seed the current in-app mock/demo network into real Supabase rows.
--
-- This is intentionally idempotent:
-- - profiles are matched by username,
-- - posts use stable mock IDs,
-- - likes/follows/comments use primary keys or ON CONFLICT guards.
--
-- Existing live profiles with the same username keep their UUIDs; seeded posts
-- attach by username so this can run safely after the older random seed.

INSERT INTO public.profiles (id, auth_user_id, username, display_name, avatar_url, bio, created_at)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-4000-8000-000000000000',
    'demo_creator',
    'Demo Creator',
    'https://i.pravatar.cc/240?u=demo_creator',
    'Testing every moving-word flow before it ships.',
    '2026-05-28T08:30:00.000Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    NULL,
    'nova_rae',
    'Nova Rae',
    'https://i.pravatar.cc/240?u=nova_rae',
    'High-contrast typography, soft landings, loud feelings.',
    '2026-04-17T12:12:00.000Z'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    NULL,
    'kai_loop',
    'Kai Loop',
    'https://i.pravatar.cc/240?u=kai_loop',
    'Loops for creators who think in beats.',
    '2026-04-23T15:45:00.000Z'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    NULL,
    'mira_aux',
    'Mira Aux',
    'https://i.pravatar.cc/240?u=mira_aux',
    'I turn tiny notes into kinetic postcards.',
    '2026-05-02T11:05:00.000Z'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    NULL,
    'zeph_404',
    'Zeph 404',
    'https://i.pravatar.cc/240?u=zeph_404',
    'Glitch language, video overlays, and borrowed neon.',
    '2026-05-11T20:22:00.000Z'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    NULL,
    'lila_om',
    'Lila Om',
    'https://i.pravatar.cc/240?u=lila_om',
    'Quiet captions that still know how to move.',
    '2026-05-20T06:18:00.000Z'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    NULL,
    'do_chu_bot',
    'Đố Chữ Mỗi Ngày',
    'https://api.dicebear.com/7.x/bottts/svg?seed=dochu&backgroundColor=8338EC,3A86FF',
    '🤖 Mỗi ngày một từ tiếng Anh — đoán nghĩa qua gợi ý tiếng Việt.',
    '2026-05-30T05:00:00.000Z'
  )
ON CONFLICT (username) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,
  auth_user_id = COALESCE(public.profiles.auth_user_id, EXCLUDED.auth_user_id);

WITH seed_posts (
  id,
  username,
  post_type,
  post_text,
  font,
  font_size,
  text_color,
  entrance,
  loop,
  bg_gradient,
  media_urls,
  link_url,
  created_at
) AS (
  VALUES
    (
      '70707070-7021-4721-8721-707070700021'::uuid,
      'do_chu_bot',
      'text',
      E'Mùi đất thơm dịu sau cơn mưa đầu mùa.\nTừ này bắt đầu bằng chữ P.\nCả từ gồm 9 chữ cái.\nĐoán tiếp nào, bạn tìm ra chứ?\nPetrichor',
      'Inter',
      72,
      '#ffffff',
      'fade',
      'float',
      'linear-gradient(135deg,#00B4D8,#FF006E)',
      ARRAY[]::text[],
      NULL,
      '2026-06-20T18:08:42.902Z'::timestamptz
    ),
    (
      '70707070-7022-4722-8722-707070700022'::uuid,
      'do_chu_bot',
      'text',
      E'Niềm vui bất ngờ khi gặp điều may mắn.\nTừ này bắt đầu bằng chữ S.\nCả từ gồm 11 chữ cái.\nThử đoán xem, bạn tìm ra không?\nSerendipity',
      'Inter',
      72,
      '#ffffff',
      'scale',
      'pulse',
      'linear-gradient(135deg,#F72585,#7209B7)',
      ARRAY[]::text[],
      NULL,
      '2026-06-21T07:00:00.191Z'::timestamptz
    ),
    (
      '70707070-7023-4723-8723-707070700023'::uuid,
      'do_chu_bot',
      'text',
      E'Thứ tồn tại rất ngắn, thoáng qua rồi tan.\nTừ này bắt đầu bằng chữ E.\nCả từ gồm 9 chữ cái.\nĐoán tiếp đi, bạn nghĩ ra chưa?\nEphemeral',
      'Inter',
      72,
      '#ffffff',
      'slide',
      'float',
      'linear-gradient(135deg,#3A86FF,#8338EC)',
      ARRAY[]::text[],
      NULL,
      '2026-06-21T13:00:00.188Z'::timestamptz
    ),
    (
      '70707070-7001-4701-8701-707070700001'::uuid,
      'do_chu_bot',
      'text',
      E'Mùi đất thơm dịu sau cơn mưa đầu mùa.\nTừ này bắt đầu bằng chữ P.\nCả từ gồm 9 chữ cái.\nĐoán tiếp nào, bạn tìm ra chứ?\nPetrichor',
      'Inter',
      72,
      '#ffffff',
      'fade',
      'float',
      'linear-gradient(135deg,#00B4D8,#FF006E)',
      ARRAY[]::text[],
      NULL,
      '2026-06-19T22:30:00.000Z'::timestamptz
    ),
    (
      '70707070-7002-4702-8702-707070700002'::uuid,
      'do_chu_bot',
      'text',
      E'Niềm vui bất ngờ khi gặp điều may mắn.\nTừ này bắt đầu bằng chữ S.\nCả từ gồm 11 chữ cái.\nThử đoán xem, bạn tìm ra không?\nSerendipity',
      'Inter',
      72,
      '#ffffff',
      'scale',
      'pulse',
      'linear-gradient(135deg,#F72585,#7209B7)',
      ARRAY[]::text[],
      NULL,
      '2026-06-19T13:00:00.000Z'::timestamptz
    ),
    (
      '70707070-7003-4703-8703-707070700003'::uuid,
      'do_chu_bot',
      'text',
      E'Thứ tồn tại rất ngắn, thoáng qua rồi tan.\nTừ này bắt đầu bằng chữ E.\nCả từ gồm 9 chữ cái.\nĐoán tiếp đi, bạn nghĩ ra chưa?\nEphemeral',
      'Inter',
      72,
      '#ffffff',
      'slide',
      'float',
      'linear-gradient(135deg,#3A86FF,#8338EC)',
      ARRAY[]::text[],
      NULL,
      '2026-06-19T06:45:00.000Z'::timestamptz
    ),
    (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
      'demo_creator',
      'text',
      'Start with the smallest clear promise. Let the first frame breathe. Give every sentence one job. Make the rhythm easy to follow. Leave the final page glowing.',
      'Space Grotesk',
      82,
      '#ffffff',
      'scale',
      'pulse',
      'linear-gradient(135deg,#FF006E,#8338EC)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:20:00.000Z'::timestamptz
    ),
    (
      '19191919-0619-4619-8619-191919191919'::uuid,
      'mira_aux',
      'image',
      E'Ao thu lạnh lẽo nước trong veo,\nMột chiếc thuyền câu bé tẻo teo.\nSóng biếc theo làn hơi gợn tí,\nLá vàng trước gió khẽ đưa vèo.\nTầng mây lơ lửng trời xanh ngắt,\nNgõ trúc quanh co khách vắng teo.\nTựa gối buông cần lâu chẳng được,\nCá đâu đớp động dưới chân bèo.',
      'Inter',
      66,
      '#ffffff',
      'fade',
      'float',
      'linear-gradient(135deg,#00B4D8,#FF006E)',
      ARRAY['https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=80']::text[],
      NULL,
      '2026-06-16T07:19:30.000Z'::timestamptz
    ),
    (
      'dadadada-dada-4ada-8ada-dadadadada05'::uuid,
      'demo_creator',
      'text',
      'Tiếng Việt cần khoảng thở dài hơn một chút. Mỗi trang nên giữ trọn một ý rõ. Dấu sắc dấu huyền cũng tạo nhịp riêng. Khi chữ hiện chậm, cảm xúc dễ bám hơn. Người đọc có thể nhớ câu cuối lâu hơn. Đây là bài thử cho nhịp hấp thụ.',
      'Inter',
      70,
      '#ffffff',
      'fade',
      'float',
      'linear-gradient(135deg,#00B4D8,#FF006E)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:19:00.000Z'::timestamptz
    ),
    (
      'bebebebe-bebe-4ebe-8ebe-bebebebebe06'::uuid,
      'kai_loop',
      'text',
      'Nếu thông tin dày, mở bằng hình ảnh quen. Sau đó đặt luận điểm ở giữa màn hình. Đừng ép người xem hiểu quá nhanh. Cho họ một nhịp để tự đồng ý. Khi trang đổi, ý mới mới bắt đầu. Nội dung tốt cần thở cùng người đọc.',
      'Inter',
      70,
      '#17140f',
      'blur',
      'pulse',
      'linear-gradient(135deg,#FFBE0B,#06FFA5)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:18:00.000Z'::timestamptz
    ),
    (
      'fafafafa-fafa-4afa-8afa-fafafafafa07'::uuid,
      'mira_aux',
      'text',
      'Buổi sáng ở Hà Nội có màu rất mềm. Một câu ngắn có thể giữ lại hơi sương. Tôi muốn chữ đi qua như tiếng xe xa. Không cần quá nhanh, chỉ cần đủ gần. Đọc xong vẫn còn một chút lặng. Hãy để mắt tự chọn nơi dừng.',
      'Inter',
      68,
      '#ffffff',
      'slide',
      'float',
      'linear-gradient(135deg,#3A86FF,#7209B7)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:16:00.000Z'::timestamptz
    ),
    (
      '91919191-9191-4919-8919-919191919108'::uuid,
      'lila_om',
      'text',
      'Trong một cuộc trò chuyện, tốc độ không phải tất cả. Có lúc câu trả lời hay nhất là im lặng. Chữ chuyển động nên giống hơi thở. Vào đúng lúc, ra đúng lúc. Người xem sẽ tự theo nếu nhịp thật.',
      'Inter',
      72,
      '#ffffff',
      'scale',
      'none',
      'linear-gradient(135deg,#F72585,#118AB2)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:14:00.000Z'::timestamptz
    ),
    (
      'abababab-abab-4aba-8aba-ababababab01'::uuid,
      'nova_rae',
      'text',
      'Một ý tưởng nhỏ cũng cần nhịp. Hãy để câu đầu thở. Rồi ánh sáng tự tìm người.',
      'Inter',
      78,
      '#ffffff',
      'fade',
      'float',
      'linear-gradient(135deg,#118AB2,#06D6A0)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:17:00.000Z'::timestamptz
    ),
    (
      'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02'::uuid,
      'kai_loop',
      'text',
      'Đừng vội làm mọi thứ rực rỡ. Một khoảng lặng đủ giữ mắt. Một chữ đúng cũng biết sáng.',
      'Inter',
      74,
      '#17140f',
      'blur',
      'pulse',
      'linear-gradient(135deg,#FFBE0B,#06FFA5)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:12:00.000Z'::timestamptz
    ),
    (
      'efefefef-efef-4efe-8efe-efefefefef03'::uuid,
      'mira_aux',
      'text',
      'Sài Gòn chậm lại sau cơn mưa. Màn hình sáng như một quán nhỏ. Ai cũng có câu chuyện riêng.',
      'Inter',
      72,
      '#ffffff',
      'slide',
      'float',
      'linear-gradient(135deg,#3A86FF,#7209B7)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:08:00.000Z'::timestamptz
    ),
    (
      'acacacac-acac-4aca-8aca-acacacacac04'::uuid,
      'lila_om',
      'text',
      'Bữa cơm tối cần nhiều tiếng cười. Tin nhắn dài để dành sau. Trước hết hãy ngồi thật gần.',
      'Inter',
      76,
      '#ffffff',
      'scale',
      'none',
      'linear-gradient(135deg,#F72585,#FFD60A)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T07:03:00.000Z'::timestamptz
    ),
    (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid,
      'nova_rae',
      'link',
      'The best interfaces explain themselves before the user needs a tooltip.',
      'Playfair Display',
      74,
      '#17140f',
      'blur',
      'float',
      'linear-gradient(135deg,#FFD60A,#FF006E)',
      ARRAY['https://www.nngroup.com/articles/designing-effective-carousels/']::text[],
      'https://www.nngroup.com/articles/designing-effective-carousels/',
      '2026-06-16T07:06:00.000Z'::timestamptz
    ),
    (
      'bcbcbcbc-bcbc-4bcb-8bcb-bcbcbcbcbcb3'::uuid,
      'nova_rae',
      'image',
      'Make the first frame honest. Let the second frame surprise them. Leave the last frame glowing.',
      'Bebas Neue',
      90,
      '#ffffff',
      'slide',
      'float',
      'linear-gradient(135deg,#00B4D8,#FF006E)',
      ARRAY['https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=80']::text[],
      NULL,
      '2026-06-16T06:58:00.000Z'::timestamptz
    ),
    (
      'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'::uuid,
      'kai_loop',
      'text',
      'Tiny drafts count. Slow mornings count. The loop is proof you came back.',
      'Playfair Display',
      76,
      '#ffffff',
      'blur',
      'float',
      'linear-gradient(135deg,#00B4D8,#FF006E)',
      ARRAY[]::text[],
      NULL,
      '2026-06-16T06:32:00.000Z'::timestamptz
    ),
    (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid,
      'mira_aux',
      'slideshow',
      'Archive the spark before it cools. Name the version you want to remember.',
      'Inter',
      72,
      '#ffffff',
      'fade',
      'pulse',
      'linear-gradient(135deg,#3A86FF,#06FFA5)',
      ARRAY[
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80',
        'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=80'
      ]::text[],
      NULL,
      '2026-06-16T05:49:00.000Z'::timestamptz
    ),
    (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'::uuid,
      'zeph_404',
      'video',
      'Motion is a shortcut to memory. Give the sentence somewhere to land.',
      'JetBrains Mono',
      64,
      '#06FFA5',
      'split',
      'shake',
      'linear-gradient(135deg,#00B4D8,#FF006E)',
      ARRAY['https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4']::text[],
      NULL,
      '2026-06-15T22:15:00.000Z'::timestamptz
    ),
    (
      'ffffffff-ffff-4fff-8fff-fffffffffff6'::uuid,
      'lila_om',
      'text',
      'A small pause can make the whole post breathe.',
      'Space Grotesk',
      86,
      '#ffffff',
      'fade',
      'none',
      'linear-gradient(135deg,#FFD60A,#FF006E)',
      ARRAY[]::text[],
      NULL,
      '2026-06-15T18:40:00.000Z'::timestamptz
    ),
    (
      '77777777-7777-4777-8777-777777777777'::uuid,
      'nova_rae',
      'text',
      'If the line feels flat, change the entrance before you change the thought.',
      'Bebas Neue',
      92,
      '#000000',
      'slide',
      'pulse',
      'linear-gradient(135deg,#06FFA5,#FFBE0B)',
      ARRAY[]::text[],
      NULL,
      '2026-06-15T12:25:00.000Z'::timestamptz
    ),
    (
      '88888888-8888-4888-8888-888888888888'::uuid,
      'kai_loop',
      'text',
      'You can publish the draft and still protect the deeper work.',
      'Inter',
      78,
      '#ffffff',
      'scale',
      'float',
      'linear-gradient(135deg,#F72585,#7209B7)',
      ARRAY[]::text[],
      NULL,
      '2026-06-14T21:02:00.000Z'::timestamptz
    ),
    (
      '99999999-9999-4999-8999-999999999999'::uuid,
      'demo_creator',
      'text',
      'Test the replay button. Test the comment timing. Test the feeling after the fade.',
      'JetBrains Mono',
      62,
      '#06FFA5',
      'blur',
      'pulse',
      'linear-gradient(135deg,#00B4D8,#FF006E)',
      ARRAY[]::text[],
      NULL,
      '2026-06-14T14:18:00.000Z'::timestamptz
    ),
    (
      '12121212-1212-4212-8212-121212121212'::uuid,
      'mira_aux',
      'image',
      'A good background should hold the sentence, not steal it.',
      'Playfair Display',
      74,
      '#ffffff',
      'fade',
      'float',
      'linear-gradient(135deg,#3A86FF,#8338EC)',
      ARRAY['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80']::text[],
      NULL,
      '2026-06-14T09:35:00.000Z'::timestamptz
    )
),
resolved_posts AS (
  SELECT seed_posts.*, profiles.id AS author_id
  FROM seed_posts
  JOIN public.profiles ON profiles.username = seed_posts.username
)
INSERT INTO public.posts (id, author_id, post_type, canvas_html, media_urls, bg_gradient, created_at)
SELECT
  id,
  author_id,
  post_type,
  jsonb_strip_nulls(
    jsonb_build_object(
      'text', post_text,
      'font', font,
      'size', font_size,
      'color', text_color,
      'weight', 800,
      'letterSpacing', -0.02,
      'x', 50,
      'y', 50,
      'entrance', entrance,
      'loop', loop,
      'tempo', 'steady',
      'rhythm', 'smooth',
      'rotation', 0,
      'link', CASE
        WHEN link_url IS NULL THEN NULL
        ELSE jsonb_build_object(
          'url', link_url,
          'host', regexp_replace(regexp_replace(link_url, '^https?://(www\.)?', ''), '/.*$', ''),
          'title', post_text
        )
      END
    )
  )::text,
  media_urls,
  bg_gradient,
  created_at
FROM resolved_posts
ON CONFLICT (id) DO UPDATE
SET
  author_id = EXCLUDED.author_id,
  post_type = EXCLUDED.post_type,
  canvas_html = EXCLUDED.canvas_html,
  media_urls = EXCLUDED.media_urls,
  bg_gradient = EXCLUDED.bg_gradient,
  created_at = EXCLUDED.created_at;

WITH seed_follows (follower_username, following_username, created_at) AS (
  VALUES
    ('demo_creator', 'nova_rae', '2026-06-01T09:00:00.000Z'::timestamptz),
    ('demo_creator', 'kai_loop', '2026-06-01T09:05:00.000Z'::timestamptz),
    ('demo_creator', 'mira_aux', '2026-06-01T09:10:00.000Z'::timestamptz),
    ('demo_creator', 'zeph_404', '2026-06-01T09:15:00.000Z'::timestamptz),
    ('demo_creator', 'lila_om', '2026-06-01T09:20:00.000Z'::timestamptz),
    ('demo_creator', 'do_chu_bot', '2026-06-01T09:25:00.000Z'::timestamptz),
    ('nova_rae', 'demo_creator', '2026-06-10T16:15:00.000Z'::timestamptz),
    ('kai_loop', 'demo_creator', '2026-06-12T11:42:00.000Z'::timestamptz),
    ('mira_aux', 'demo_creator', '2026-06-15T18:19:00.000Z'::timestamptz),
    ('lila_om', 'nova_rae', '2026-06-05T13:40:00.000Z'::timestamptz),
    ('zeph_404', 'kai_loop', '2026-06-07T20:12:00.000Z'::timestamptz)
)
INSERT INTO public.follows (follower_id, following_id, created_at)
SELECT follower.id, following.id, seed_follows.created_at
FROM seed_follows
JOIN public.profiles follower ON follower.username = seed_follows.follower_username
JOIN public.profiles following ON following.username = seed_follows.following_username
ON CONFLICT (follower_id, following_id) DO NOTHING;

WITH seed_likes (post_id, username, created_at) AS (
  VALUES
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'nova_rae', '2026-06-16T07:23:00.000Z'::timestamptz),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'kai_loop', '2026-06-16T07:25:00.000Z'::timestamptz),
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'mira_aux', '2026-06-16T07:29:00.000Z'::timestamptz),
    ('19191919-0619-4619-8619-191919191919'::uuid, 'demo_creator', '2026-06-16T07:20:00.000Z'::timestamptz),
    ('19191919-0619-4619-8619-191919191919'::uuid, 'nova_rae', '2026-06-16T07:22:00.000Z'::timestamptz),
    ('19191919-0619-4619-8619-191919191919'::uuid, 'lila_om', '2026-06-16T07:25:00.000Z'::timestamptz),
    ('dadadada-dada-4ada-8ada-dadadadada05'::uuid, 'demo_creator', '2026-06-16T07:20:00.000Z'::timestamptz),
    ('dadadada-dada-4ada-8ada-dadadadada05'::uuid, 'nova_rae', '2026-06-16T07:22:00.000Z'::timestamptz),
    ('dadadada-dada-4ada-8ada-dadadadada05'::uuid, 'mira_aux', '2026-06-16T07:26:00.000Z'::timestamptz),
    ('bebebebe-bebe-4ebe-8ebe-bebebebebe06'::uuid, 'demo_creator', '2026-06-16T07:19:00.000Z'::timestamptz),
    ('bebebebe-bebe-4ebe-8ebe-bebebebebe06'::uuid, 'lila_om', '2026-06-16T07:23:00.000Z'::timestamptz),
    ('fafafafa-fafa-4afa-8afa-fafafafafa07'::uuid, 'demo_creator', '2026-06-16T07:17:00.000Z'::timestamptz),
    ('fafafafa-fafa-4afa-8afa-fafafafafa07'::uuid, 'nova_rae', '2026-06-16T07:20:00.000Z'::timestamptz),
    ('91919191-9191-4919-8919-919191919108'::uuid, 'demo_creator', '2026-06-16T07:15:00.000Z'::timestamptz),
    ('abababab-abab-4aba-8aba-ababababab01'::uuid, 'demo_creator', '2026-06-16T07:18:00.000Z'::timestamptz),
    ('abababab-abab-4aba-8aba-ababababab01'::uuid, 'kai_loop', '2026-06-16T07:21:00.000Z'::timestamptz),
    ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02'::uuid, 'demo_creator', '2026-06-16T07:14:00.000Z'::timestamptz),
    ('efefefef-efef-4efe-8efe-efefefefef03'::uuid, 'zeph_404', '2026-06-16T07:11:00.000Z'::timestamptz),
    ('acacacac-acac-4aca-8aca-acacacacac04'::uuid, 'demo_creator', '2026-06-16T07:06:00.000Z'::timestamptz),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid, 'demo_creator', '2026-06-16T07:04:00.000Z'::timestamptz),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid, 'kai_loop', '2026-06-16T07:08:00.000Z'::timestamptz),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3'::uuid, 'demo_creator', '2026-06-16T06:45:00.000Z'::timestamptz),
    ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3'::uuid, 'lila_om', '2026-06-16T06:52:00.000Z'::timestamptz),
    ('dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid, 'demo_creator', '2026-06-16T06:01:00.000Z'::timestamptz),
    ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'::uuid, 'nova_rae', '2026-06-15T22:22:00.000Z'::timestamptz),
    ('ffffffff-ffff-4fff-8fff-fffffffffff6'::uuid, 'demo_creator', '2026-06-15T19:11:00.000Z'::timestamptz),
    ('99999999-9999-4999-8999-999999999999'::uuid, 'zeph_404', '2026-06-14T14:30:00.000Z'::timestamptz),
    ('99999999-9999-4999-8999-999999999999'::uuid, 'lila_om', '2026-06-14T14:37:00.000Z'::timestamptz)
)
INSERT INTO public.likes (post_id, user_id, created_at)
SELECT seed_likes.post_id, profiles.id, seed_likes.created_at
FROM seed_likes
JOIN public.profiles ON profiles.username = seed_likes.username
JOIN public.posts ON posts.id = seed_likes.post_id
ON CONFLICT (user_id, post_id) DO NOTHING;

WITH seed_comments (id, post_id, username, chip_id, created_at) AS (
  VALUES
    ('10000000-0000-4000-8000-000000000001'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'nova_rae', 'The rhythm is clear and the final phrase actually lands', '2026-06-16T07:24:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000030'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'zeph_404', 'fire', '2026-06-16T07:25:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'kai_loop', 'I would save this because it explains the whole app', '2026-06-16T07:28:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000031'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'lila_om', 'mind-blown', '2026-06-16T07:29:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid, 'mira_aux', 'The sentence has space without losing its urgency', '2026-06-16T07:31:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000020'::uuid, '19191919-0619-4619-8619-191919191919'::uuid, 'kai_loop', 'Tám trang đọc từng câu rất hợp bài thơ', '2026-06-16T07:23:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000032'::uuid, '19191919-0619-4619-8619-191919191919'::uuid, 'lila_om', 'dịu ghê', '2026-06-16T07:24:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000021'::uuid, '19191919-0619-4619-8619-191919191919'::uuid, 'demo_creator', 'Nền nước và núi làm câu thu dịu hơn', '2026-06-16T07:26:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000015'::uuid, 'dadadada-dada-4ada-8ada-dadadadada05'::uuid, 'nova_rae', 'Bài này giúp kiểm tra nhịp đọc rất rõ', '2026-06-16T07:21:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000033'::uuid, 'dadadada-dada-4ada-8ada-dadadadada05'::uuid, 'zeph_404', 'đúng nhịp', '2026-06-16T07:22:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000016'::uuid, 'dadadada-dada-4ada-8ada-dadadadada05'::uuid, 'kai_loop', 'Mười từ mỗi trang nghe tự nhiên hơn', '2026-06-16T07:27:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000017'::uuid, 'bebebebe-bebe-4ebe-8ebe-bebebebebe06'::uuid, 'lila_om', 'Luận điểm hiện từng trang nên dễ giữ lại', '2026-06-16T07:24:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000034'::uuid, 'bebebebe-bebe-4ebe-8ebe-bebebebebe06'::uuid, 'kai_loop', 'rất rõ', '2026-06-16T07:25:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000018'::uuid, 'fafafafa-fafa-4afa-8afa-fafafafafa07'::uuid, 'demo_creator', 'Không khí Hà Nội chuyển thành nhịp khá mềm', '2026-06-16T07:18:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000035'::uuid, 'fafafafa-fafa-4afa-8afa-fafafafafa07'::uuid, 'nova_rae', 'êm thật', '2026-06-16T07:19:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000019'::uuid, '91919191-9191-4919-8919-919191919108'::uuid, 'mira_aux', 'Câu về hơi thở rất hợp với animation', '2026-06-16T07:16:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000011'::uuid, 'abababab-abab-4aba-8aba-ababababab01'::uuid, 'mira_aux', 'Nhịp này rất hợp với tiếng Việt', '2026-06-16T07:19:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000012'::uuid, 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02'::uuid, 'lila_om', 'Khoảng lặng làm câu sáng hơn thật', '2026-06-16T07:15:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000013'::uuid, 'efefefef-efef-4efe-8efe-efefefefef03'::uuid, 'demo_creator', 'Cảm giác thành phố sau mưa rất rõ', '2026-06-16T07:12:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000014'::uuid, 'acacacac-acac-4aca-8aca-acacacacac04'::uuid, 'nova_rae', 'Dòng cuối nghe rất ấm', '2026-06-16T07:07:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000004'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid, 'demo_creator', 'This one makes the image feel like part of the argument', '2026-06-16T07:06:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000005'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'::uuid, 'lila_om', 'The second beat surprised me in a good way', '2026-06-16T07:10:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000006'::uuid, 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3'::uuid, 'demo_creator', 'Tiny drafts count is exactly the reminder I needed', '2026-06-16T06:48:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000007'::uuid, 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid, 'demo_creator', 'The slideshow waits for the sentence and that feels right', '2026-06-16T05:58:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000008'::uuid, 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4'::uuid, 'zeph_404', 'I like that the archive idea feels calm instead of precious', '2026-06-16T06:03:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000009'::uuid, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5'::uuid, 'nova_rae', 'The motion makes the memory line feel almost physical', '2026-06-15T22:25:00.000Z'::timestamptz),
    ('10000000-0000-4000-8000-000000000010'::uuid, '99999999-9999-4999-8999-999999999999'::uuid, 'lila_om', 'This is useful because it tests replay timing and comment pacing', '2026-06-14T14:39:00.000Z'::timestamptz)
)
INSERT INTO public.comments (id, post_id, user_id, chip_id, created_at)
SELECT seed_comments.id, seed_comments.post_id, profiles.id, seed_comments.chip_id, seed_comments.created_at
FROM seed_comments
JOIN public.profiles ON profiles.username = seed_comments.username
JOIN public.posts ON posts.id = seed_comments.post_id
ON CONFLICT (id) DO UPDATE
SET
  post_id = EXCLUDED.post_id,
  user_id = EXCLUDED.user_id,
  chip_id = EXCLUDED.chip_id,
  created_at = EXCLUDED.created_at;
