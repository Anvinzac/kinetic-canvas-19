/**
 * Module providing DEMO_AUTH_USER_ID, DEMO_SESSION_KEY, startDemoSession, endDemoSession.
 *
 * Exports: DEMO_AUTH_USER_ID, DEMO_SESSION_KEY, startDemoSession, endDemoSession, getDemoSession, isDemoSession, getDemoRouteUser
 * Depends on: none (leaf module)
 */

export const DEMO_AUTH_USER_ID = "00000000-0000-4000-8000-000000000000";
export const DEMO_SESSION_KEY = "kinetic.demo.session";

type DemoSession = {
  userId: string;
  startedAt: string;
};

/**
 * @responsibility Access browser localStorage when available (SSR-safe).
 * @outputs localStorage or null on the server
 * @sideEffects none
 */
function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

/**
 * Start a local demo session so the app can run without Supabase auth.
 * @returns Persisted demo session payload
 */
export function startDemoSession(): DemoSession {
  const session: DemoSession = {
    userId: DEMO_AUTH_USER_ID,
    startedAt: new Date().toISOString(),
  };
  getStorage()?.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Clear the local demo session (e.g. on sign-out).
 * @returns Function result
 */
export function endDemoSession(): void {
  getStorage()?.removeItem(DEMO_SESSION_KEY);
}

/**
 * Read and validate the persisted demo session, if any.
 * @returns Demo session or null when missing/invalid
 */
export function getDemoSession(): DemoSession | null {
  const raw = getStorage()?.getItem(DEMO_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DemoSession>;
    if (!parsed.userId) return null;
    return {
      userId: parsed.userId,
      startedAt: parsed.startedAt ?? new Date().toISOString(),
    };
  } catch {
    endDemoSession();
    return null;
  }
}

/**
 * Report whether the current browser session is demo mode.
 * @returns true when a valid demo session exists
 */
export function isDemoSession(): boolean {
  return getDemoSession() !== null;
}

/**
 * Provide a synthetic auth user object for route `beforeLoad` in demo mode.
 * @returns Minimal user-shaped object matching Supabase auth user fields used by routes
 */
export function getDemoRouteUser(): {
  id: string;
  aud: string;
  role: string;
  email: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
} {
  return {
    id: DEMO_AUTH_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "demo@kinetic.local",
    app_metadata: {},
    user_metadata: { full_name: "Demo Creator" },
  };
}
