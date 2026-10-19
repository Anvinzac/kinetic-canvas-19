/**
 * What a recorder may rely on when driving /export/$code.
 *
 * A leaf module on purpose. This is the surface something OUTSIDE this repo depends on, so
 * it has to be readable without pulling in the component — which reaches the catalog, which
 * is assembled with import.meta.glob and exists only inside Vite. A guard that cannot
 * import the contract is a guard nobody runs.
 *
 * Treat the names here as published. Renaming one breaks whatever is recording, at
 * whatever hour it runs, with nobody watching; scripts/check-export-frame.ts is what makes
 * that break loud and immediate instead.
 *
 * On `<body>`:
 *   data-export-phase  "loading" | "ready" | "playing" | "done" | "missing"
 *   data-export-word   the headword, once resolved
 *   data-export-size   "<width>x<height>", the exact frame the stage is drawn at
 *
 * The stage element carries `data-export-stage` and is EXACTLY the preset's aspect, so a
 * recorder crops to that element and needs to know nothing else about the layout.
 *
 * The sequence is: loading → ready (first frame painted, nothing moving) → playing (after
 * the start event) → done (the card finished its last page). A driver waits for `ready`,
 * begins recording, dispatches `start`, and stops on `done`.
 *
 * Exports: EXPORT_CONTRACT, ExportPhase
 * Depends on: none (leaf module)
 */

export const EXPORT_CONTRACT = {
  phases: ["loading", "ready", "playing", "done", "missing"] as const,
  stageAttribute: "data-export-stage",
  startEvent: "vocab-export-start",
} as const;

export type ExportPhase = (typeof EXPORT_CONTRACT.phases)[number];
