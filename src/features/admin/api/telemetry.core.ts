/**
 * Barrel re-export for telemetry list + mutation core.
 *
 * Exports: CursorPage, ensureDemoSeeded, listEvents, listDailyRollups, listErrorReports,
 *   updateErrorStatus, logAdminAccess
 * Depends on: telemetry.list, telemetry.mutations
 */

export type { CursorPage } from "./telemetry.list";
export {
  ensureDemoSeeded,
  listDailyRollups,
  listErrorReports,
  listEvents,
} from "./telemetry.list";
export { logAdminAccess, updateErrorStatus } from "./telemetry.mutations";
