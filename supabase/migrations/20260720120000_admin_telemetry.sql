-- Admin telemetry contract + admin auth flag for kinetic-canvas embedded /admin.

-- 1. Admin flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_admin_idx
  ON public.profiles (is_admin)
  WHERE is_admin;

CREATE OR REPLACE FUNCTION public.is_admin_account(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _uid AND is_admin = true
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin_account(UUID) TO authenticated, anon;

-- 2. Raw telemetry events
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL DEFAULT 'kinetic-canvas',
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID NULL,
  entity_type TEXT NULL,
  entity_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT telemetry_events_event_type_check CHECK (
    event_type IN (
      'user.registered',
      'content.created',
      'content.updated',
      'content.deleted',
      'link.created',
      'link.interacted',
      'error.reported',
      'system.heartbeat'
    )
  ),
  CONSTRAINT telemetry_events_severity_check CHECK (
    severity IS NULL OR severity IN ('info', 'warn', 'error', 'critical')
  )
);

CREATE INDEX IF NOT EXISTS telemetry_events_app_occurred_idx
  ON public.telemetry_events (app_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_events_type_occurred_idx
  ON public.telemetry_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS telemetry_events_actor_idx
  ON public.telemetry_events (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telemetry_events_admin_select ON public.telemetry_events;
CREATE POLICY telemetry_events_admin_select ON public.telemetry_events
  FOR SELECT TO authenticated
  USING (public.is_admin_account(auth.uid()));

-- Writes go through service role only (no insert policy for authenticated).

-- 3. Daily rollups (pre-aggregated)
CREATE TABLE IF NOT EXISTS public.telemetry_daily_rollups (
  app_id TEXT NOT NULL DEFAULT 'kinetic-canvas',
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

ALTER TABLE public.telemetry_daily_rollups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telemetry_rollups_admin_select ON public.telemetry_daily_rollups;
CREATE POLICY telemetry_rollups_admin_select ON public.telemetry_daily_rollups
  FOR SELECT TO authenticated
  USING (public.is_admin_account(auth.uid()));

-- 4. Health snapshots (history for uptime charts)
CREATE TABLE IF NOT EXISTS public.telemetry_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL DEFAULT 'kinetic-canvas',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  uptime_pct_24h NUMERIC(6, 3) NOT NULL DEFAULT 100,
  p50_latency_ms NUMERIC(12, 3) NOT NULL DEFAULT 0,
  p95_latency_ms NUMERIC(12, 3) NOT NULL DEFAULT 0,
  error_rate_pct NUMERIC(8, 4) NOT NULL DEFAULT 0,
  queue_depth INTEGER NULL,
  db_connections_used INTEGER NULL,
  db_connections_max INTEGER NULL,
  CONSTRAINT telemetry_health_status_check CHECK (
    status IN ('operational', 'degraded', 'partial_outage', 'major_outage')
  )
);

CREATE INDEX IF NOT EXISTS telemetry_health_app_captured_idx
  ON public.telemetry_health_snapshots (app_id, captured_at DESC);

ALTER TABLE public.telemetry_health_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telemetry_health_admin_select ON public.telemetry_health_snapshots;
CREATE POLICY telemetry_health_admin_select ON public.telemetry_health_snapshots
  FOR SELECT TO authenticated
  USING (public.is_admin_account(auth.uid()));

-- 5. Admin-resolvable error reports
CREATE TABLE IF NOT EXISTS public.admin_error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NULL REFERENCES public.telemetry_events (id) ON DELETE SET NULL,
  app_id TEXT NOT NULL DEFAULT 'kinetic-canvas',
  status TEXT NOT NULL DEFAULT 'new',
  message TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'error',
  actor_user_id UUID NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by UUID NULL,
  resolved_at TIMESTAMPTZ NULL,
  CONSTRAINT admin_error_reports_status_check CHECK (
    status IN ('new', 'acknowledged', 'resolved')
  ),
  CONSTRAINT admin_error_reports_severity_check CHECK (
    severity IN ('info', 'warn', 'error', 'critical')
  )
);

CREATE INDEX IF NOT EXISTS admin_error_reports_status_created_idx
  ON public.admin_error_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_error_reports_severity_created_idx
  ON public.admin_error_reports (severity, created_at DESC);

ALTER TABLE public.admin_error_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_error_reports_admin_select ON public.admin_error_reports;
CREATE POLICY admin_error_reports_admin_select ON public.admin_error_reports
  FOR SELECT TO authenticated
  USING (public.is_admin_account(auth.uid()));

DROP POLICY IF EXISTS admin_error_reports_admin_update ON public.admin_error_reports;
CREATE POLICY admin_error_reports_admin_update ON public.admin_error_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin_account(auth.uid()))
  WITH CHECK (public.is_admin_account(auth.uid()));

-- 6. Admin access audit log
CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS admin_access_log_occurred_idx
  ON public.admin_access_log (occurred_at DESC);

ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_access_log_admin_select ON public.admin_access_log;
CREATE POLICY admin_access_log_admin_select ON public.admin_access_log
  FOR SELECT TO authenticated
  USING (public.is_admin_account(auth.uid()));

-- 7. Atomic rollup bump helper (service role / SECURITY DEFINER)
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
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.telemetry_daily_rollups AS r (
    app_id, date, new_users, active_users, content_created, content_updated,
    links_created, link_interactions, errors_total, errors_critical
  ) VALUES (
    _app_id, _date, _new_users, _active_users, _content_created, _content_updated,
    _links_created, _link_interactions, _errors_total, _errors_critical
  )
  ON CONFLICT (app_id, date) DO UPDATE SET
    new_users = r.new_users + EXCLUDED.new_users,
    active_users = GREATEST(r.active_users, r.active_users + EXCLUDED.active_users),
    content_created = r.content_created + EXCLUDED.content_created,
    content_updated = r.content_updated + EXCLUDED.content_updated,
    links_created = r.links_created + EXCLUDED.links_created,
    link_interactions = r.link_interactions + EXCLUDED.link_interactions,
    errors_total = r.errors_total + EXCLUDED.errors_total,
    errors_critical = r.errors_critical + EXCLUDED.errors_critical;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_telemetry_daily_rollup(
  TEXT, DATE, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER
) TO service_role;
