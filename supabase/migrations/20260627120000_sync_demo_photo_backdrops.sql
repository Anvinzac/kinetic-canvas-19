-- Keep demo photo statuses in sync with src/lib/post-media.ts + mock-data.ts.
-- Without this, live Supabase feed serves post_type=text + empty media_urls while
-- the local mock feed shows Ken Burns photos — the Hanoi morning post looked black.

UPDATE public.posts
SET
  post_type = 'image',
  media_urls = ARRAY['https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjlvNjVwMWYxeHQ2aGloY2N4czJqeDZvY2Rwd21ubWF5eHhhbjhhOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/tZZTCbdO5cRUVUULFL/giphy.gif']::text[]
WHERE id = 'fafafafa-fafa-4afa-8afa-fafafafafa07'::uuid;

UPDATE public.posts
SET
  post_type = 'image',
  media_urls = ARRAY['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1400&q=80']::text[]
WHERE id = 'dadadada-dada-4ada-8ada-dadadadada05'::uuid;

UPDATE public.posts
SET
  post_type = 'image',
  media_urls = ARRAY['https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1400&q=80']::text[]
WHERE id = 'bebebebe-bebe-4ebe-8ebe-bebebebebe06'::uuid;

UPDATE public.posts
SET
  post_type = 'image',
  media_urls = ARRAY['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80']::text[]
WHERE id = '91919191-9191-4919-8919-919191919108'::uuid;

UPDATE public.posts
SET
  post_type = 'image',
  media_urls = ARRAY['https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80']::text[]
WHERE id = 'abababab-abab-4aba-8aba-ababababab01'::uuid;

UPDATE public.posts
SET
  post_type = 'image',
  media_urls = ARRAY['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80']::text[]
WHERE id = 'acacacac-acac-4aca-8aca-acacacacac04'::uuid;
