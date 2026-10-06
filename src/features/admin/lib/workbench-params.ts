/**
 * Translates between the workbench's URL parameters and the query the server takes.
 *
 * The URL is the single home of the workbench's query, which is what makes a filtered
 * queue linkable and a saved queue nothing more than a stored set of these parameters.
 *
 * Exports: splitAxis, toggleAxis, toWorkbenchQuery, activeWorkbenchParams, countActiveFilters
 * Depends on: ./search-schema (types only)
 */

import { WORKBENCH_PARAM_KEYS, type AdminSearch } from "./search-schema";

/** Read one comma-separated axis off the URL. @pure true */
export function splitAxis(value: string | undefined): string[] {
  return (value ?? "").split(",").filter(Boolean);
}

/**
 * Add or remove one value from a comma-separated axis.
 * @param value - the current axis parameter
 * @param entry - the value to toggle
 * @returns The new parameter, or undefined when the axis is now empty
 * @pure true
 */
export function toggleAxis(value: string | undefined, entry: string): string | undefined {
  const current = splitAxis(value);
  const next = current.includes(entry)
    ? current.filter((item) => item !== entry)
    : [...current, entry];
  return next.length ? next.join(",") : undefined;
}

/**
 * Build the server query from the URL.
 * @param search - validated admin search params
 * @returns The payload for `listWorkbenchWords`
 * @pure true
 */
export function toWorkbenchQuery(search: AdminSearch): Record<string, string | number> {
  const query: Record<string, string | number> = {
    page: search.page ?? 0,
    pageSize: search.size ?? 50,
    search: search.q ?? "",
    minOpenReports: search.reports ?? 0,
    sort: search.sort ?? "word",
    dir: search.dir ?? "asc",
  };
  for (const key of ["levels", "topics", "exams", "statuses"] as const) {
    if (search[key]) query[key] = search[key]!;
  }
  if (search.drift) query.drifted = search.drift;
  return query;
}

/**
 * The filter parameters a saved queue stores, leaving out page position.
 * @param search - validated admin search params
 * @returns Only the set filter params, as strings
 * @pure true
 */
export function activeWorkbenchParams(search: AdminSearch): Record<string, string> {
  const params: Record<string, string> = {};
  for (const key of WORKBENCH_PARAM_KEYS) {
    const value = search[key];
    if (value !== undefined && value !== "" && value !== null) params[key] = String(value);
  }
  return params;
}

/**
 * How many filters are narrowing the list, for the "clear" affordance.
 * @param search - validated admin search params
 * @returns Count of active narrowing filters
 * @pure true
 */
export function countActiveFilters(search: AdminSearch): number {
  return (
    splitAxis(search.levels).length +
    splitAxis(search.topics).length +
    splitAxis(search.exams).length +
    splitAxis(search.statuses).length +
    (search.q ? 1 : 0) +
    (search.reports ? 1 : 0) +
    (search.drift ? 1 : 0)
  );
}
