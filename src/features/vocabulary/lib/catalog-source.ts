/**
 * Single source of truth for the vocabulary catalogs the app serves and reads.
 *
 * English = admin-editable `data/catalog.json` merged with every `data/packs/*.json`.
 * Other answer languages live in `data/<locale>/*.json` (compiled with
 * `vocab:import -- <deck> --pack <name> --locale zh`) and are served only on that
 * language's domain (see ./target-language). Locales without a deck fall back to English.
 *
 * Exports: catalog (English), catalogFor
 * Depends on: ../data/catalog.json, ../data/packs/*.json, ../data/<locale>/*.json, ./schema
 */
import baseCatalog from "../data/catalog.json";
import type { Catalog } from "./schema";
import { mergeCatalogs } from "./schema";
import type { TargetLocale } from "./target-language";

function sorted(modules: Record<string, { default: Catalog }>): Catalog[] {
  return Object.keys(modules)
    .sort()
    .map((path) => modules[path]!.default);
}

const enPacks = sorted(
  import.meta.glob<{ default: Catalog }>("../data/packs/*.json", { eager: true }),
);
const zhPacks = sorted(import.meta.glob<{ default: Catalog }>("../data/zh/*.json", { eager: true }));
const koPacks = sorted(import.meta.glob<{ default: Catalog }>("../data/ko/*.json", { eager: true }));
const jaPacks = sorted(import.meta.glob<{ default: Catalog }>("../data/ja/*.json", { eager: true }));

/** The English catalog: base `catalog.json` plus every compiled provider pack. */
export const catalog: Catalog = mergeCatalogs(baseCatalog as Catalog, ...enPacks);

const byLocale: Partial<Record<TargetLocale, Catalog>> = { en: catalog };
const sources: Record<Exclude<TargetLocale, "en">, Catalog[]> = {
  zh: zhPacks,
  ko: koPacks,
  ja: jaPacks,
};

/** @param locale Answer language. @returns That language's catalog, or English when none exists. */
export function catalogFor(locale: TargetLocale): Catalog {
  const cached = byLocale[locale];
  if (cached) return cached;
  const packs = sources[locale as Exclude<TargetLocale, "en">] ?? [];
  const result = packs.length ? mergeCatalogs(packs[0]!, ...packs.slice(1)) : catalog;
  byLocale[locale] = result;
  return result;
}
