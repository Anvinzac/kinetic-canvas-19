-- Prevent duplicate vocabulary reveal posts from the same bot/profile.
--
-- The content queue already has UNIQUE (source_key, content_key), but demo posts
-- can be inserted directly into public.posts. This helper extracts the reveal
-- word from vocabulary-style canvases so direct seeds, cron posts, and repairs
-- all share one database-level guard.

CREATE OR REPLACE FUNCTION public.vocabulary_reveal_word_from_canvas(p_canvas_html TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  text_value TEXT;
  reveal_word TEXT;
BEGIN
  IF p_canvas_html IS NULL OR btrim(p_canvas_html) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    text_value := p_canvas_html::jsonb ->> 'text';
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  IF text_value IS NULL OR btrim(text_value) = '' THEN
    RETURN NULL;
  END IF;

  IF text_value NOT ILIKE '%Từ này bắt đầu bằng chữ%'
    OR text_value NOT ILIKE '%Cả từ gồm%'
  THEN
    RETURN NULL;
  END IF;

  SELECT lower(btrim(line))
  INTO reveal_word
  FROM regexp_split_to_table(text_value, E'\n') WITH ORDINALITY AS lines(line, ord)
  WHERE btrim(line) <> ''
  ORDER BY ord DESC
  LIMIT 1;

  IF reveal_word IS NULL OR reveal_word !~ '^[a-z][a-z'' -]{0,63}$' THEN
    RETURN NULL;
  END IF;

  RETURN reveal_word;
END;
$$;

WITH duplicate_vocabulary_posts AS (
  SELECT
    posts.id,
    row_number() OVER (
      PARTITION BY posts.author_id, public.vocabulary_reveal_word_from_canvas(posts.canvas_html)
      ORDER BY posts.created_at DESC, posts.id DESC
    ) AS duplicate_rank
  FROM public.posts
  WHERE public.vocabulary_reveal_word_from_canvas(posts.canvas_html) IS NOT NULL
)
DELETE FROM public.posts
USING duplicate_vocabulary_posts
WHERE posts.id = duplicate_vocabulary_posts.id
  AND duplicate_vocabulary_posts.duplicate_rank > 1;

WITH posted_vocabulary_items AS (
  SELECT
    posts.id AS post_id,
    public.vocabulary_reveal_word_from_canvas(posts.canvas_html) AS reveal_word
  FROM public.posts
  JOIN public.profiles ON profiles.id = posts.author_id
  WHERE profiles.username = 'do_chu_bot'
    AND public.vocabulary_reveal_word_from_canvas(posts.canvas_html) IS NOT NULL
)
UPDATE public.agent_content_items AS item
SET
  status = 'used',
  used_post_id = posted_vocabulary_items.post_id,
  used_at = COALESCE(item.used_at, now()),
  updated_at = now()
FROM posted_vocabulary_items
WHERE item.source_key = 'vocabulary.en_vi'
  AND lower(btrim(item.content_key)) = posted_vocabulary_items.reveal_word
  AND (
    item.status <> 'used'
    OR item.used_post_id IS DISTINCT FROM posted_vocabulary_items.post_id
  );

CREATE UNIQUE INDEX IF NOT EXISTS posts_author_vocabulary_reveal_word_uidx
ON public.posts (author_id, public.vocabulary_reveal_word_from_canvas(canvas_html))
WHERE public.vocabulary_reveal_word_from_canvas(canvas_html) IS NOT NULL;
