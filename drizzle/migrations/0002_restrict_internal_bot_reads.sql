-- Internal bot tables are not a public catalog. Keep the existing system-account
-- policies and service-role grants; remove only unrestricted signed-in reads.
DROP POLICY IF EXISTS bot_agents_select_authenticated ON public.bot_agents;
DROP POLICY IF EXISTS bot_post_runs_select_authenticated ON public.bot_post_runs;

-- Regression test: ordinary signed-in users cannot read bot agent records,
-- while the existing system account and service role retain their full access.
DO $test_bot_agents$
DECLARE
  expected_count bigint;
  actual_count bigint;
  system_uid uuid;
BEGIN
  SELECT count(*) INTO expected_count FROM public.bot_agents;
  SELECT auth_user_id INTO system_uid FROM public.profiles WHERE is_system = true LIMIT 1;
  IF expected_count = 0 OR system_uid IS NULL THEN
    RAISE EXCEPTION 'Bot agent test requires existing agents and a system account';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO actual_count FROM public.bot_agents;
  EXECUTE 'RESET ROLE';
  IF actual_count <> 0 THEN RAISE EXCEPTION 'Ordinary user can read bot agents'; END IF;
  PERFORM set_config('request.jwt.claim.sub', system_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', system_uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO actual_count FROM public.bot_agents;
  EXECUTE 'RESET ROLE';
  IF actual_count <> expected_count THEN RAISE EXCEPTION 'System account lost bot agent access'; END IF;
  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT count(*) INTO actual_count FROM public.bot_agents;
  EXECUTE 'RESET ROLE';
  IF actual_count <> expected_count THEN RAISE EXCEPTION 'Service role lost bot agent access'; END IF;
END $test_bot_agents$;

-- Regression test: the same access boundary holds for bot posting history.
DO $test_bot_post_runs$
DECLARE
  expected_count bigint;
  actual_count bigint;
  system_uid uuid;
BEGIN
  SELECT count(*) INTO expected_count FROM public.bot_post_runs;
  SELECT auth_user_id INTO system_uid FROM public.profiles WHERE is_system = true LIMIT 1;
  IF expected_count = 0 OR system_uid IS NULL THEN
    RAISE EXCEPTION 'Bot run test requires existing runs and a system account';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO actual_count FROM public.bot_post_runs;
  EXECUTE 'RESET ROLE';
  IF actual_count <> 0 THEN RAISE EXCEPTION 'Ordinary user can read bot posting history'; END IF;
  PERFORM set_config('request.jwt.claim.sub', system_uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', system_uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO actual_count FROM public.bot_post_runs;
  EXECUTE 'RESET ROLE';
  IF actual_count <> expected_count THEN RAISE EXCEPTION 'System account lost bot posting history access'; END IF;
  EXECUTE 'SET LOCAL ROLE service_role';
  SELECT count(*) INTO actual_count FROM public.bot_post_runs;
  EXECUTE 'RESET ROLE';
  IF actual_count <> expected_count THEN RAISE EXCEPTION 'Service role lost bot posting history access'; END IF;
END $test_bot_post_runs$;

RESET request.jwt.claim.sub;
RESET request.jwt.claims;