/**
 * Feature barrel for embedded admin dashboard.
 *
 * Exports: AdminShell, section pages, APP_ID
 * Depends on: admin components
 */

export { AdminShell } from "./components/AdminShell";
export { OverviewPage } from "./components/overview/OverviewPage";
export { UsersPage } from "./components/users/UsersPage";
export { ContentPage } from "./components/content/ContentPage";
export { LinksPage } from "./components/links/LinksPage";
export { ErrorsPage } from "./components/errors/ErrorsPage";
export { SystemPage } from "./components/system/SystemPage";
export { VocabularyWordsPage } from "./components/vocabulary/VocabularyWordsPage";
export { TemplateManagerPage } from "./components/templates/TemplateManagerPage";
export { LlmSettingsPage } from "./components/llm/LlmSettingsPage";
export { AmbientMusicPage } from "./components/ambient/AmbientMusicPage";
export { APP_ID } from "./types/telemetry";
export { isDemoAdminEnabled } from "./lib/require-admin";
