/**
 * Read side of the vocabulary review workbench.
 *
 * One query answers the whole page: the requested slice of rows, the facet counts the
 * filter rail needs, and the totals the header reports. Filtering and paging happen
 * here rather than in the browser, so a thousand-word catalog costs one page of rows
 * per request instead of the entire store.
 *
 * Exports: listWorkbenchWords, WorkbenchListResult, workbenchQuerySchema
 * Depends on: @tanstack/react-start, zod, admin gates, workbench rows, workbench-filter
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LEVELS } from "@/features/vocabulary/lib/schema";
import { EXAM_IDS, TOPIC_IDS } from "@/features/vocabulary/lib/taxonomy";
import { WORKBENCH_STATUS_IDS } from "@/features/vocabulary/lib/workbench";
import {
  workbenchExists,
  workbenchWritable,
} from "@/features/vocabulary/api/workbench-store.server";
import { requireAdminAccess } from "../lib/admin-access";
import { requireAdminContext } from "../lib/require-admin";
import {
  countFacets,
  filterRows,
  pageOf,
  sortRows,
  type WorkbenchFacets,
  type WorkbenchRow,
} from "../lib/workbench-filter";
import { buildWorkbenchRows } from "./workbench-rows.server";

const csv = <T extends string>(values: readonly T[]) =>
  z
    .union([z.array(z.enum(values as [T, ...T[]])), z.string()])
    .optional()
    .transform((input) => {
      if (!input) return [] as T[];
      const list = Array.isArray(input) ? input : input.split(",");
      return list.filter((value): value is T => (values as readonly string[]).includes(value));
    });

export const workbenchQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(100_000).default(0),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
  search: z.string().trim().max(64).default(""),
  levels: csv(LEVELS),
  topics: csv(TOPIC_IDS),
  exams: csv(EXAM_IDS),
  statuses: csv(WORKBENCH_STATUS_IDS),
  minOpenReports: z.coerce.number().int().min(0).max(1000).default(0),
  drifted: z
    .enum(["yes", "no"])
    .nullish()
    .transform((value) => (value === "yes" ? true : value === "no" ? false : null)),
  sort: z.enum(["word", "level", "reports", "updated", "status"]).default("word"),
  dir: z.enum(["asc", "desc"]).default("asc"),
});

export type WorkbenchListResult = {
  rows: WorkbenchRow[];
  /** Rows matching the filters, across every page. */
  total: number;
  page: number;
  pageCount: number;
  facets: WorkbenchFacets;
  /** Totals for the whole store, unfiltered, for the page header. */
  storeTotal: number;
  openReportTotal: number;
  driftedTotal: number;
  /** False on a deployment, where the store cannot be written. */
  writable: boolean;
  /** False before the one-time migration has run. */
  exists: boolean;
};

/**
 * One page of the workbench, with facet counts for the filter rail.
 */
export const listWorkbenchWords = createServerFn({ method: "GET" })
  .middleware([requireAdminAccess])
  .inputValidator((input: unknown) => workbenchQuerySchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<WorkbenchListResult> => {
    await requireAdminContext({ authUserId: context.userId });
    const [all, writable, exists] = await Promise.all([
      buildWorkbenchRows(),
      workbenchWritable(),
      workbenchExists(),
    ]);
    const query = { ...data, page: data.page, pageSize: data.pageSize };
    const matching = filterRows(all, query);
    const ordered = sortRows(matching, data.sort, data.dir);
    const { slice, page, pageCount } = pageOf(ordered, data.page, data.pageSize);
    return {
      rows: slice,
      total: matching.length,
      page,
      pageCount,
      facets: countFacets(all, query),
      storeTotal: all.length,
      openReportTotal: all.reduce((sum, row) => sum + row.openReports, 0),
      driftedTotal: all.filter((row) => row.drifted).length,
      writable,
      exists,
    };
  });
