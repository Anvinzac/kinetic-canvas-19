-- One-time setup: mark the content-hub feeder Auth user as a system account.
-- Replace the email with SYSTEM_BOT_EMAIL before running in the Supabase SQL editor.
-- Full guide: docs/lovable-auto-posting-credentials.md

UPDATE public.profiles
SET is_system = true
WHERE auth_user_id = (
  SELECT id FROM auth.users
  WHERE email = 'system-bot@yourdomain.com'  -- ← change me
);

SELECT id, username, display_name, is_system, auth_user_id
FROM public.profiles
WHERE is_system = true;

-- Publisher + cron sanity checks
SELECT id, username, is_system FROM public.profiles WHERE username = 'do_chu_bot';

SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'kinetic-vocabulary-bot-3x-daily';

SELECT status, count(*)
FROM public.agent_content_items
WHERE source_key = 'vocabulary.en_vi'
GROUP BY 1
ORDER BY 1;
