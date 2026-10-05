/**
 * Data binding for the harmonized palette collection.
 *
 * Holds the single JSON import so ./palettes stays free of data dependencies and
 * remains runnable under bare Node for validation scripts. Every stored row is
 * normalized and contrast-repaired on load, which is what stops an admin edit
 * from shipping an unreadable label.
 *
 * Exports: PALETTES, PALETTE_SWATCHES, getPalette
 * Depends on: ./palettes, ./data/palettes.json
 */

import { ensureReadablePalette, normalizePalette, paletteSwatches, type Palette } from "./palettes";
import seededPalettes from "./data/palettes.json";

/** The curated collection, repaired on load so a conflicting edit can never render. */
export const PALETTES: Palette[] = (seededPalettes as Palette[]).map((palette) =>
  ensureReadablePalette(normalizePalette(palette)),
);

/** Look a palette up by id. @param id Palette id. @returns Match or undefined. @pure true */
export function getPalette(id: string | null | undefined): Palette | undefined {
  if (!id) return undefined;
  return PALETTES.find((palette) => palette.id === id);
}

/** Swatch list for single-color pickers, derived from the live collection. @pure true */
export const PALETTE_SWATCHES: string[] = paletteSwatches(PALETTES);
