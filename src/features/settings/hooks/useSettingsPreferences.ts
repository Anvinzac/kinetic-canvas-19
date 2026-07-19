/**
 * Persist settings preferences in localStorage with hydrate-then-write semantics.
 *
 * Exports: useSettingsPreferences (prefs state + setters used by SettingsPage)
 * Depends on: features/settings/lib/preferences
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  DEFAULT_PREFS,
  readPreferences,
  writePreferences,
  type Preferences,
} from "../lib/preferences";

export type SettingsPreferencesApi = {
  prefs: Preferences;
  setPrefs: Dispatch<SetStateAction<Preferences>>;
  resetPreferences: () => void;
};

/**
 * Load preferences on mount, then write them back whenever they change.
 * @returns prefs, setPrefs, and resetPreferences (resets to DEFAULT_PREFS)
 */
export function useSettingsPreferences(): SettingsPreferencesApi {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPrefs(readPreferences());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writePreferences(prefs);
  }, [hydrated, prefs]);

  function resetPreferences(): void {
    setPrefs(DEFAULT_PREFS);
  }

  return { prefs, setPrefs, resetPreferences };
}
