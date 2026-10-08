-- Visitor-level telemetry: unique visitors, session errors, page-load health.
--
-- Four defects in the existing telemetry schema made visitor metrics unusable:
--
--   1. The event_type CHECK predates page.loaded / page.failed / session.error,
--      so every visitor event inserted live failed the constraint.
--   2. Unique visitors were counted by de-duplicating entity_id across a single
--      200-row page of events, which silently undercounts any day busier than
--      that. Sessions now get one row each, so a COUNT is exact regardless of
--      how many events a session produced.
--   3. active_users summed every qualifying event, so one busy user read as many
--      active users. Actors now get one row per day, same as sessions.
--   4. Session id arrives as entity_id, which had no index.

-- 1. Accept the visitor event types the client already emits.
ALTER TABLE public.telemetry_events
  DROP CONSTRAINT IF EXISTS telemetry_events_event_type_check;
ALTER TABLE public.telemetry_events
  ADD CONSTRAINT telemetry_events_event_type_check CHECK (
    event_type IN (
      'user.registered',
      'content.created',
      'content.updated',
      'content.deleted',
      'link.created',
      'link.interacted',
      'error.reported',
      'system.heartbeat',
      'page.loaded',
      'page.failed',
      'session.error'
    )
  );

CREATE INDEX IF NOT EXISTS telemetry_events_entity_occurred_idx
  ON public.telemetry_events (app_id, entity_id, occurred_at DESC)
  WHERE entity_id IS NOT NULL;

-- 2. One row per (app, session, day). Counting rows here is an exact unique
-- visitor count; counting distinct entity_id over events never can be, because
-- events are read back one bounded page at a time.
CREATE TABLE IF NOT EXISTS public.telemetry_visitor_sessions (
  app_id TEXT NOT NULL DEFAULT 'kinetic-canvas',
  session_id TEXT NOT NULL,
  date DATE NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  page_loads INTEGER NOT NULL DEFAULT 0,
  page_failures INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (app_id, session_id, date)
);

CREATE INDEX IF NOT EXISTS telemetry_visitor_sessions_date_idx
  ON public.telemetry_visitor_sessions (app_id, date DESC);

ALTER TABLE public.telemetry_visitor_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telemetry_visitor_sessions_admin_select
  ON public.telemetry_visitor_sessions;
CREATE POLICY telemetry_visitor_sessions_admin_select
  ON public.telemetry_visitor_sessions
  FOR SELECT TO authenticated
  USING (public.is_admin_account(auth.uid()));

-- Writes go through service role only, same as telemetry_events.

-- 3. One row per (app, actor, day), so active_users is a COUNT rather than a sum
-- of events.
CREATE TABLE IF NOT EXISTS public.telemetry_active_actors (
  app_id TEXT NOT NULL DEFAULT 'kinetic-canvas',
  actor_user_id UUID NOT NULL,
  date DATE NOT NULL,
  PRIMARY KEY (app_id, actor_user_id, date)
);

ALTER TABLE public.telemetry_active_actors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telemetry_active_actors_admin_select
  ON public.telemetry_active_actors;
CREATE POLICY telemetry_active_actors_admin_select
  ON public.telemetry_active_actors
  FOR SELECT TO authenticated
  USING (public.is_admin_account(auth.uid()));

-- 4. Record a visitor session. Counters are additive so an ingest retry that
-- lands twice overcounts loads rather than losing the session entirely.
CREATE OR REPLACE FUNCTION public.record_visitor_session(
  _app_id TEXT,
  _session_id TEXT,
  _date DATE,
  _page_loads INTEGER DEFAULT 0,
  _page_failures INTEGER DEFAULT 0,
  _errors INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.telemetry_visitor_sessions AS s (
    app_id, session_id, date, page_loads, page_failures, errors
  ) VALUES (
    _app_id, _session_id, _date, _page_loads, _page_failures, _errors
  )
  ON CONFLICT (app_id, session_id, date) DO UPDATE SET
    last_seen_at = now(),
    page_loads = s.page_loads + EXCLUDED.page_loads,
    page_failures = s.page_failures + EXCLUDED.page_failures,
    errors = s.errors + EXCLUDED.errors;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_visitor_session(
  TEXT, TEXT, DATE, INTEGER, INTEGER, INTEGER
) TO service_role;

-- 5. Mark an actor active for a day. Idempotent, so the caller can fire it on
-- every qualifying event without inflating the count.
CREATE OR REPLACE FUNCTION public.mark_actor_active(
  _app_id TEXT,
  _actor_user_id UUID,
  _date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.telemetry_active_actors (app_id, actor_user_id, date)
  VALUES (_app_id, _actor_user_id, _date)
  ON CONFLICT (app_id, actor_user_id, date) DO NOTHING;

  -- Upsert, not UPDATE: an actor can be the first thing recorded for a day, and
  -- a bare UPDATE would match no row and silently drop the count until some
  -- other counter happened to create the rollup.
  INSERT INTO public.telemetry_daily_rollups (app_id, date, active_users)
  VALUES (
    _app_id,
    _date,
    (SELECT COUNT(*) FROM public.telemetry_active_actors
     WHERE app_id = _app_id AND date = _date)
  )
  ON CONFLICT (app_id, date) DO UPDATE SET
    active_users = EXCLUDED.active_users;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_actor_active(TEXT, UUID, DATE) TO service_role;

-- 6. active_users must no longer be summed by the generic rollup bump; it is
-- owned by mark_actor_active above. Every other counter stays additive.
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
    _app_id, _date, _new_users, 0, _content_created, _content_updated,
    _links_created, _link_interactions, _errors_total, _errors_critical
  )
  ON CONFLICT (app_id, date) DO UPDATE SET
    new_users = r.new_users + EXCLUDED.new_users,
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

-- 7. Session health for a date range, aggregated in the database so the result
-- does not depend on a page size.
CREATE OR REPLACE FUNCTION public.telemetry_session_health(
  _app_id TEXT,
  _from DATE,
  _to DATE
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH in_range AS (
    SELECT * FROM public.telemetry_visitor_sessions
    WHERE app_id = _app_id AND date >= _from AND date <= _to
  ),
  totals AS (
    SELECT
      COUNT(DISTINCT session_id) AS unique_visitors,
      COUNT(*) AS session_days,
      COUNT(DISTINCT session_id) FILTER (
        WHERE page_failures > 0 OR errors > 0
      ) AS sessions_with_errors,
      COALESCE(SUM(page_loads), 0) AS total_loads,
      COALESCE(SUM(page_failures), 0) AS total_failures,
      COALESCE(SUM(errors), 0) AS total_errors
    FROM in_range
  ),
  top_errors AS (
    SELECT
      COALESCE(NULLIF(metadata ->> 'message', ''), 'unknown') AS message,
      COUNT(*) AS count
    FROM public.telemetry_events
    WHERE app_id = _app_id
      AND event_type IN ('page.failed', 'session.error')
      -- Explicitly UTC: the ingest buckets sessions by UTC date, so the event
      -- window must use the same boundaries. A bare ::timestamptz would read
      -- these dates in the server's timezone and straddle two days.
      AND occurred_at >= (_from::timestamp AT TIME ZONE 'UTC')
      AND occurred_at < ((_to + 1)::timestamp AT TIME ZONE 'UTC')
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 5
  )
  SELECT jsonb_build_object(
    'uniqueVisitors', t.unique_visitors,
    'sessionDays', t.session_days,
    'sessionsWithErrors', t.sessions_with_errors,
    'totalLoads', t.total_loads,
    'totalFailures', t.total_failures,
    'totalErrors', t.total_errors,
    'failureRate', CASE
      WHEN t.total_loads + t.total_failures > 0
      THEN ROUND(t.total_failures::numeric / (t.total_loads + t.total_failures), 6)
      ELSE 0
    END,
    'topErrors', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('message', message, 'count', count))
       FROM top_errors),
      '[]'::jsonb
    )
  )
  FROM totals t;
$$;

GRANT EXECUTE ON FUNCTION public.telemetry_session_health(TEXT, DATE, DATE)
  TO service_role;

-- 8. Daily unique visitors, for the overview sparkline.
CREATE OR REPLACE FUNCTION public.telemetry_visitors_by_day(
  _app_id TEXT,
  _from DATE,
  _to DATE
)
-- The output columns are deliberately NOT named date/page_loads/page_failures:
-- RETURNS TABLE names are in scope inside the body, so reusing the table's own
-- column names makes every reference to them ambiguous and Postgres rejects the
-- function at creation time.
RETURNS TABLE (day DATE, unique_visitors BIGINT, loads BIGINT, failures BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.date,
    COUNT(DISTINCT s.session_id)::BIGINT,
    COALESCE(SUM(s.page_loads), 0)::BIGINT,
    COALESCE(SUM(s.page_failures), 0)::BIGINT
  FROM public.telemetry_visitor_sessions s
  WHERE s.app_id = _app_id AND s.date >= _from AND s.date <= _to
  GROUP BY s.date
  ORDER BY s.date;
$$;

GRANT EXECUTE ON FUNCTION public.telemetry_visitors_by_day(TEXT, DATE, DATE)
  TO service_role;
