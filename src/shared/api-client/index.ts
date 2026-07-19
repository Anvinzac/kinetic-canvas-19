/**
 * Shared API client facade for demo/live branching.
 *
 * Exports: runDataMode, pickDataMode, isDemoDataMode
 * Depends on: features/session
 */

export {
  isDemoDataMode,
  pickDataMode,
  runDataMode,
  type DataModeBranches,
} from "./run-data-mode";
