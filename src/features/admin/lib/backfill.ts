/**
 * Barrel for telemetry backfill (demo seed + live one-shot).
 *
 * Exports: seedDemoTelemetryFromMock, backfillTelemetryFromSources
 * Depends on: backfill-demo, backfill-live
 */

export { seedDemoTelemetryFromMock } from "./backfill-demo";
export { backfillTelemetryFromSources } from "./backfill-live";
