export const DEMO_AUTH_USER_ID = "00000000-0000-4000-8000-000000000000";
export const DEMO_SESSION_KEY = "kinetic.demo.session";

type DemoSession = {
  userId: string;
  startedAt: string;
};

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function startDemoSession() {
  const session: DemoSession = {
    userId: DEMO_AUTH_USER_ID,
    startedAt: new Date().toISOString(),
  };
  getStorage()?.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function endDemoSession() {
  getStorage()?.removeItem(DEMO_SESSION_KEY);
}

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

export function isDemoSession() {
  return getDemoSession() !== null;
}

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
