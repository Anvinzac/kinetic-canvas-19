export type Preferences = {
  pushOn: boolean;
  privateAccount: boolean;
  reducedMotion: boolean;
  dataSaver: boolean;
  autoplayPreviews: boolean;
  reactionHints: boolean;
  commentFilter: boolean;
  weeklyDigest: boolean;
  audience: "public" | "followers" | "private";
  defaultFormat: "text" | "image" | "video";
};

/** localStorage key for persisted settings preferences. */
export const PREF_KEY = "kinetic.settings.preferences";

/** Defaults applied when nothing is stored or parsing fails. */
export const DEFAULT_PREFS: Preferences = {
  pushOn: true,
  privateAccount: false,
  reducedMotion: false,
  dataSaver: false,
  autoplayPreviews: true,
  reactionHints: true,
  commentFilter: false,
  weeklyDigest: true,
  audience: "public",
  defaultFormat: "text",
};

/**
 * Read settings preferences from localStorage, merged over defaults.
 * Returns defaults during SSR or on parse failure.
 */
export function readPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = window.localStorage.getItem(PREF_KEY);
    if (!stored) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(stored) } as Preferences;
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Persist settings preferences to localStorage.
 */
export function writePreferences(prefs: Preferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
}
