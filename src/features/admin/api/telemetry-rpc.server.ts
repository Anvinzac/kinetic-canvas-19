/**
 * Typed wrappers for the visitor-session RPCs added in
 * 20261008120000_telemetry_visitor_sessions.sql.
 *
 * src/integrations/supabase/types.ts is generated and already lags several
 * migrations, so these functions are absent from its `Database` type. Rather than
 * casting the whole client to `any` at each call site — which would also stop
 * checking the argument names, the part most likely to drift from the SQL — each
 * RPC gets one wrapper with its real signature declared here.
 *
 * Exports: recordVisitorSession, fetchSessionHealth
 * Depends on: supabase admin (lazily, server only)
 */

type RpcResult<T> = { data: T; error: { message: string } | null };

/** The subset of the client these RPCs need, with arguments kept checked. */
type TelemetryRpcClient = {
  rpc(
    fn: "record_visitor_session",
    args: {
      _app_id: string;
      _session_id: string;
      _date: string;
      _page_loads?: number;
      _page_failures?: number;
      _errors?: number;
    },
  ): Promise<RpcResult<null>>;
  rpc(
    fn: "telemetry_session_health",
    args: { _app_id: string; _from: string; _to: string },
  ): Promise<RpcResult<unknown>>;
};

async function rpcClient(): Promise<TelemetryRpcClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as TelemetryRpcClient;
}

/**
 * Upsert the session row for one UTC day, adding the given counter deltas.
 * @param args App, session, date and the per-day counters to add.
 * @throws When the RPC reports an error.
 */
export async function recordVisitorSession(args: {
  appId: string;
  sessionId: string;
  date: string;
  pageLoads?: number;
  pageFailures?: number;
  errors?: number;
}): Promise<void> {
  const client = await rpcClient();
  const { error } = await client.rpc("record_visitor_session", {
    _app_id: args.appId,
    _session_id: args.sessionId,
    _date: args.date,
    _page_loads: args.pageLoads ?? 0,
    _page_failures: args.pageFailures ?? 0,
    _errors: args.errors ?? 0,
  });
  if (error) throw new Error(error.message);
}

/**
 * Aggregate visitor-session metrics for an inclusive date range.
 * @param args App id and YYYY-MM-DD bounds.
 * @returns The raw JSONB payload, for the caller to normalize.
 * @throws When the RPC reports an error.
 */
export async function fetchSessionHealth(args: {
  appId: string;
  from: string;
  to: string;
}): Promise<unknown> {
  const client = await rpcClient();
  const { data, error } = await client.rpc("telemetry_session_health", {
    _app_id: args.appId,
    _from: args.from,
    _to: args.to,
  });
  if (error) throw new Error(error.message);
  return data;
}
