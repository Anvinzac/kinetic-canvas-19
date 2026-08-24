-- ── Telemetry / admin tables (admin-only; served through service_role) ───────
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telemetry_events_app_time_idx ON public.telemetry_events (app_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.telemetry_daily_rollups (
  app_id TEXT NOT NULL,
  date DATE NOT NULL,
  new_users INTEGER NOT NULL DEFAULT 0,
  active_users INTEGER NOT NULL DEFAULT 0,
  content_created INTEGER NOT NULL DEFAULT 0,
  content_updated INTEGER NOT NULL DEFAULT 0,
  links_created INTEGER NOT NULL DEFAULT 0,
  link_interactions INTEGER NOT NULL DEFAULT 0,
  errors_total INTEGER NOT NULL DEFAULT 0,
  errors_critical INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (app_id, date)
);

CREATE TABLE IF NOT EXISTS public.telemetry_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  uptime_pct_24h NUMERIC NOT NULL DEFAULT 100,
  p50_latency_ms NUMERIC NOT NULL DEFAULT 0,
  p95_latency_ms NUMERIC NOT NULL DEFAULT 0,
  error_rate_pct NUMERIC NOT NULL DEFAULT 0,
  queue_depth INTEGER,
  db_connections_used INTEGER,
  db_connections_max INTEGER
);
CREATE INDEX IF NOT EXISTS telemetry_health_app_time_idx ON public.telemetry_health_snapshots (app_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID,
  app_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error',
  actor_user_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by UUID,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS admin_error_reports_status_idx ON public.admin_error_reports (app_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server-only tables: service_role writes/reads, clients get nothing (fail closed).
GRANT ALL ON public.telemetry_events TO service_role;
GRANT ALL ON public.telemetry_daily_rollups TO service_role;
GRANT ALL ON public.telemetry_health_snapshots TO service_role;
GRANT ALL ON public.admin_error_reports TO service_role;
GRANT ALL ON public.admin_access_log TO service_role;

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_daily_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.bump_telemetry_daily_rollup(
  _app_id TEXT,
  _date DATE,
  _new_users INTEGER DEFAULT 0,
  _active_users INTEGER DEFAULT 0,
  _content_created INTEGER DEFAULT 0,
  _content_updated INTEGER DEFAULT 0,
  _links_created INTEGER DEFAULT 0,
  _link_interactions INTEGER DEFAULT 0,
  _errors_total INTEGER DEFAULT 0,
  _errors_critical INTEGER DEFAULT 0
) RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $$
  INSERT INTO public.telemetry_daily_rollups AS r (
    app_id, date, new_users, active_users, content_created, content_updated,
    links_created, link_interactions, errors_total, errors_critical
  ) VALUES (
    _app_id, _date, _new_users, _active_users, _content_created, _content_updated,
    _links_created, _link_interactions, _errors_total, _errors_critical
  )
  ON CONFLICT (app_id, date) DO UPDATE SET
    new_users = r.new_users + EXCLUDED.new_users,
    active_users = r.active_users + EXCLUDED.active_users,
    content_created = r.content_created + EXCLUDED.content_created,
    content_updated = r.content_updated + EXCLUDED.content_updated,
    links_created = r.links_created + EXCLUDED.links_created,
    link_interactions = r.link_interactions + EXCLUDED.link_interactions,
    errors_total = r.errors_total + EXCLUDED.errors_total,
    errors_critical = r.errors_critical + EXCLUDED.errors_critical;
$$;

REVOKE ALL ON FUNCTION public.bump_telemetry_daily_rollup(TEXT, DATE, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_telemetry_daily_rollup(TEXT, DATE, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;

-- ── Internal token used by pg_cron to call the app's refill endpoint ─────────
CREATE TABLE IF NOT EXISTS public.internal_api_keys (
  name TEXT PRIMARY KEY,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.internal_api_keys TO service_role;
ALTER TABLE public.internal_api_keys ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_api_keys (name) VALUES ('vocabulary_refill')
ON CONFLICT (name) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.request_vocabulary_refill()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  token TEXT;
  ready_count INTEGER;
  request_id BIGINT;
BEGIN
  SELECT count(*) INTO ready_count
  FROM public.agent_content_items
  WHERE source_key = 'vocabulary.en_vi' AND status = 'ready';

  -- Only top up when the queue is running dry (consumer drains 3 items/day).
  IF ready_count >= 9 THEN
    RETURN NULL;
  END IF;

  SELECT secret INTO token FROM public.internal_api_keys WHERE name = 'vocabulary_refill';
  IF token IS NULL THEN RETURN NULL; END IF;

  SELECT net.http_post(
    url := 'https://project--3adaf7f2-6c4c-403a-8f08-06ccb4e95507.lovable.app/api/public/vocabulary-refill?count=8',
    headers := jsonb_build_object('content-type', 'application/json', 'x-ingest-key', token),
    body := '{}'::jsonb
  ) INTO request_id;

  RETURN request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_vocabulary_refill() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('kinetic-vocabulary-refill-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kinetic-vocabulary-refill-daily');

SELECT cron.schedule(
  'kinetic-vocabulary-refill-daily',
  '30 22 * * *',
  $$SELECT public.request_vocabulary_refill();$$
);