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
 * @responsibility Start a local demo session so the app can run without Supabase auth.
 * @outputs Persisted demo session payload
 * @sideEffects Writes `DEMO_SESSION_KEY` to localStorage
 */
export function startDemoSession() {
  const session: DemoSession = {
    userId: DEMO_AUTH_USER_ID,
    startedAt: new Date().toISOString(),
  };
  getStorage()?.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * @responsibility Clear the local demo session (e.g. on sign-out).
 * @sideEffects Removes `DEMO_SESSION_KEY` from localStorage
 */
export function endDemoSession() {
  getStorage()?.removeItem(DEMO_SESSION_KEY);
}

/**
 * @responsibility Read and validate the persisted demo session, if any.
 * @outputs Demo session or null when missing/invalid
 * @sideEffects Clears corrupt session entries
 */
export function getDemoSession() {
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
 * @responsibility Report whether the current browser session is demo mode.
 * @outputs true when a valid demo session exists
 * @pure false — reads localStorage
 */
export function isDemoSession() {
  return getDemoSession() !== null;
}

/**
 * @responsibility Provide a synthetic auth user object for route `beforeLoad` in demo mode.
 * @outputs Minimal user-shaped object matching Supabase auth user fields used by routes
 * @pure true
 */
export function getDemoRouteUser() {
  return {
    id: DEMO_AUTH_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "demo@kinetic.local",
    app_metadata: {},
    user_metadata: { full_name: "Demo Creator" },
  };
}
