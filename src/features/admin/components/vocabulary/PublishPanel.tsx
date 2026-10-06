/**
 * The publish gate: compiles approved words into the catalog readers are served.
 *
 * A dry run always comes first, because publishing rewrites the served deck. The
 * compile refuses a deck that would not validate, so a bad edit cannot reach the feed;
 * what it cannot do is skip a deploy — the served catalog is bundled at build time.
 *
 * Exports: PublishPanel
 * Depends on: React, TanStack Query, lucide-react, publish server function
 */

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { getWorkbenchStatus } from "@/features/vocabulary/lib/workbench";
import { publishCatalog, type PublishResult } from "../../api/publish.functions";

/**
 * Publish control plus the dry-run summary it insists on first.
 * @param props.readOnly - true where the filesystem cannot be written
 * @param props.onPublished - called after a successful write, to refetch the list
 * @returns publish panel UI
 */
export function PublishPanel({
  readOnly,
  onPublished,
}: {
  readOnly: boolean;
  onPublished: () => void;
}): React.ReactElement {
  const [preview, setPreview] = useState<PublishResult | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => publishCatalog({ data: { dryRun } }),
    onSuccess: (result) => {
      setPreview(result);
      if (result.written) onPublished();
    },
  });

  const skipped = Object.entries(preview?.skipped ?? {});

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-40"
          disabled={run.isPending}
          onClick={() => run.mutate(true)}
        >
          {run.isPending ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
          Check publish
        </button>
        {preview && !preview.written && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background disabled:opacity-40"
            disabled={run.isPending || readOnly}
            onClick={() => run.mutate(false)}
          >
            Publish {preview.publishing} words
          </button>
        )}
      </div>

      {run.isError && (
        <p className="rounded bg-red-500/10 px-2.5 py-1.5 text-xs text-red-500">
          {run.error.message}
        </p>
      )}

      {preview && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            {preview.written ? "Published" : "Would publish"}{" "}
            <strong className="text-foreground">{preview.publishing}</strong> approved words
            {preview.changed > 0 && `, ${preview.changed} new to the catalog`}.
          </p>
          {skipped.length > 0 && (
            <p>
              Held back:{" "}
              {skipped
                .map(([status, count]) => `${count} ${getWorkbenchStatus(status)?.en ?? status}`)
                .join(", ")}
              .
            </p>
          )}
          <p className="font-mono text-[10px]">
            revision {preview.revision}
            {preview.previousRevision && preview.previousRevision !== preview.revision
              ? ` (was ${preview.previousRevision})`
              : " — unchanged"}
          </p>
          {preview.written && (
            <p className="text-amber-600">
              Written to catalog.json. Commit and deploy for readers to see it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
