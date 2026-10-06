/**
 * The vocabulary review workbench: the page a crawl's output is judged on.
 *
 * Its whole query — search, the three grouping axes, report pressure, sort and page —
 * lives in the URL, so the server returns one page of rows rather than the catalog, a
 * filtered queue is a link, and a saved queue is just those parameters under a name.
 *
 * Exports: VocabularyWorkbenchPage
 * Depends on: useWorkbench, workbench panels, workbench-params
 */

import { useWorkbench } from "../../hooks/useWorkbench";
import { activeWorkbenchParams, countActiveFilters, splitAxis } from "../../lib/workbench-params";
import { PublishPanel } from "./PublishPanel";
import { WorkbenchBulkBar } from "./WorkbenchBulkBar";
import { WorkbenchFilterRail } from "./WorkbenchFilterRail";
import { WorkbenchSavedViews } from "./WorkbenchSavedViews";
import { WorkbenchTable } from "./WorkbenchTable";

const NO_FACETS = { levels: {}, topics: {}, exams: {}, statuses: {} };

/**
 * Review workbench page.
 * @returns the workbench UI
 */
export function VocabularyWorkbenchPage(): React.ReactElement {
  const bench = useWorkbench();
  const { search, list, readOnly } = bench;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Vocabulary workbench</h2>
          <p className="text-sm text-muted-foreground">
            {list.data
              ? `${list.data.total} of ${list.data.storeTotal} words · ${list.data.openReportTotal} open reports · ${list.data.driftedTotal} edited since publish`
              : "Loading…"}
          </p>
        </div>
        <input
          type="search"
          placeholder="Search word or Vietnamese text…"
          className="w-72 rounded border border-border bg-background px-3 py-1.5 text-sm"
          defaultValue={search.q ?? ""}
          onChange={(event) => bench.setFilter({ q: event.target.value || undefined })}
        />
      </header>

      {readOnly && (
        <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          This server has no writable filesystem, so the workbench is read-only here. Review words
          with <code>npm run dev</code> locally, then publish, commit and deploy.
        </p>
      )}

      {list.data && !list.data.exists && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs">
          <span className="text-muted-foreground">
            The workbench has not been built yet. Import the published catalog to start reviewing.
          </span>
          <button
            type="button"
            className="rounded-md bg-foreground px-2.5 py-1.5 font-medium text-background disabled:opacity-40"
            disabled={bench.pending.migrate || readOnly}
            onClick={bench.runMigrate}
          >
            Import catalog
          </button>
          {bench.migrateError && <span className="text-red-500">{bench.migrateError}</span>}
        </div>
      )}

      {bench.error && (
        <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-500">{bench.error}</p>
      )}

      <WorkbenchSavedViews
        currentParams={activeWorkbenchParams(search)}
        activeViewId={bench.activeView}
        readOnly={readOnly}
        onOpen={bench.openView}
      />

      <div className="flex flex-col gap-5 sm:flex-row">
        <WorkbenchFilterRail
          facets={list.data?.facets ?? NO_FACETS}
          selected={{
            levels: splitAxis(search.levels),
            topics: splitAxis(search.topics),
            exams: splitAxis(search.exams),
            statuses: splitAxis(search.statuses),
          }}
          minOpenReports={search.reports ?? 0}
          drift={search.drift}
          openReportTotal={list.data?.openReportTotal ?? 0}
          driftedTotal={list.data?.driftedTotal ?? 0}
          activeCount={countActiveFilters(search)}
          onToggle={bench.toggleFilter}
          onReports={(value) => bench.setFilter({ reports: value || undefined })}
          onDrift={(value) => bench.setFilter({ drift: value })}
          onClear={bench.clearFilters}
        />

        <WorkbenchTable
          rows={bench.rows}
          loading={list.isLoading}
          selected={bench.selected}
          sort={search.sort ?? "word"}
          dir={search.dir ?? "asc"}
          page={list.data?.page ?? 0}
          pageCount={list.data?.pageCount ?? 1}
          total={list.data?.total ?? 0}
          readOnly={readOnly}
          savingId={bench.saving}
          savedId={bench.saved}
          onSort={bench.setSort}
          onSelect={bench.toggleSelect}
          onSelectPage={bench.selectPage}
          onPage={bench.goPage}
          onSave={bench.saveField}
          onStatus={bench.setStatus}
          onRegenerate={bench.regenerateField}
        />
      </div>

      <PublishPanel readOnly={readOnly} onPublished={bench.refresh} />

      <WorkbenchBulkBar
        selectedCount={bench.selected.size}
        matchingTotal={list.data?.total ?? 0}
        wholeQuerySelected={bench.wholeQuery}
        pending={bench.pending.bulk}
        onSelectAllMatching={bench.selectAllMatching}
        onClear={bench.clearSelection}
        onApply={bench.applyBulk}
      />
    </div>
  );
}
