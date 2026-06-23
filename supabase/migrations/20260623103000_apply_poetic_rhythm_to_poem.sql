-- Make the Vietnamese poem post the seeded example for the romantic/poetic rhythm.
UPDATE public.posts
SET
  canvas_html = (
    canvas_html::jsonb || jsonb_build_object(
      'font', 'Playfair Display',
      'size', 72,
      'color', '#FFF7ED',
      'weight', 700,
      'letterSpacing', -0.015,
      'entrance', 'blur',
      'loop', 'float',
      'tempo', 'slow',
      'rhythm', 'poetic',
      'y', 54
    )
  )::text,
  bg_gradient = 'linear-gradient(135deg,#F8C8DC,#7C3AED)'
WHERE id = '19191919-0619-4619-8619-191919191919'::uuid;
