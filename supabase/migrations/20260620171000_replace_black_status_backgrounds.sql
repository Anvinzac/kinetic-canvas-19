UPDATE public.posts
SET bg_gradient = 'linear-gradient(135deg,#00B4D8,#FF006E)'
WHERE bg_gradient = 'linear-gradient(180deg,#000000,#1a1a2e)';

UPDATE public.posts
SET bg_gradient = 'linear-gradient(135deg,#00B4D8,#FF006E)'
WHERE bg_gradient IN (
  'linear-gradient(135deg,#073B4C,#118AB2)',
  'linear-gradient(135deg,#073B4C,#06D6A0)',
  'linear-gradient(135deg,#06283D,#06D6A0)',
  'linear-gradient(135deg,#0F172A,#7C3AED)'
);

UPDATE public.bot_agents
SET bg_gradient = 'linear-gradient(135deg,#00B4D8,#FF006E)'
WHERE bg_gradient IN (
  'linear-gradient(180deg,#000000,#1a1a2e)',
  'linear-gradient(135deg,#073B4C,#118AB2)',
  'linear-gradient(135deg,#073B4C,#06D6A0)',
  'linear-gradient(135deg,#06283D,#06D6A0)',
  'linear-gradient(135deg,#0F172A,#7C3AED)'
);
