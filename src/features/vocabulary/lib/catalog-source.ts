/**
 * Single source of truth for the vocabulary catalog the app serves and reads.
 *
 * Merges the admin-editable base `data/catalog.json` with every compiled third-party
 * pack in `data/packs/*.json` into one in-memory `Catalog`. Both the server read
 * boundary (`api/catalog.server.ts`) and the client-side saved-word lookups
 * (`lib/saved-words.ts`) import from here, so there is exactly one merge and the feed
 * and the saved list can never disagree about which words exist.
 *
 * Adding a provider pack is a no-code operation: compile the deck with
 * `npm run vocab:import -- <deck.json> --pack <name>` (which validates it through
 * `normalizeDeck` and writes `data/packs/<name>.json`), then rebuild/restart. The base
 * `catalog.json` stays the only admin-editable store; packs are read-only and are
 * de-duplicated against it (base wins) by `mergeCatalogs`.
 *
 * Exports: catalog
 * Depends on: ../data/catalog.json, ../data/packs/*.json, ./schema
 */
import baseCatalog from "../data/catalog.json";
import type { Catalog } from "./schema";
import { mergeCatalogs } from "./schema";

// Vite eagerly inlines every compiled pack at build time (works for the SSR/Nitro bundle
// too). Keys are sorted so merge order — and therefore the derived revision, the
// deterministic pagination and the saved-word lookups — never depends on how the
// filesystem happens to enumerate the directory. An empty/absent packs folder simply
// yields no packs, leaving the base catalog untouched.
const packModules = import.meta.glob<{ default: Catalog }>("../data/packs/*.json", {
  eager: true,
});
const packs = Object.keys(packModules)
  .sort()
  .map((path) => packModules[path]!.default);

/** The merged catalog: base `catalog.json` plus every compiled provider pack. */
export const catalog: Catalog = mergeCatalogs(baseCatalog as Catalog, ...packs);
