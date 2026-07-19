/**
 * Public barrel re-exports for this feature module.
 *
 * Exports: SettingsPage, AboutPage, DEFAULT_PREFS, PREF_KEY, readPreferences, writePreferences, Preferences
 * Depends on: ./components/SettingsPage, ./components/AboutPage, ./lib/preferences
 */

export { SettingsPage } from "./components/SettingsPage";
export { AboutPage } from "./components/AboutPage";
export {
  DEFAULT_PREFS,
  PREF_KEY,
  readPreferences,
  writePreferences,
  type Preferences,
} from "./lib/preferences";
