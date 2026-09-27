/**
 * Vocabulary admin page: inline-editable word catalog with auto-save.
 *
 * Exports: VocabularyWordsPage
 * Depends on: TanStack Query, EditableCell, vocabulary server functions
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  adminVocabularyQueryOptions,
  adminVocabularyCompletedQueryOptions,
} from "../../api/queries";
import {
  updateVocabularyWord,
  markVocabularyWordDone,
  type VocabWordRow,
} from "../../api/vocabulary.functions";
import { LEVELS } from "@/features/vocabulary/lib/schema";
import { EditableCell } from "./EditableCell";
import { adminKeys } from "../../api/keys";
import { Check } from "lucide-react";

type SaveStatus = { id: string; state: "saving" | "saved" | "error" };
type VocabUpdate = {
  id: string;
  word?: string;
  def_vi?: string;
  lead_vi?: string;
  anticipate_vi?: string;
  topic?: string;
  level?: string | null;
};

const PAGE_SIZE = 20;

/**
 * Full catalog editor with tap-to-edit cells, automatic persistence,
 * 20-word pagination, and a "Done" action to stage words for cloud sync.
 * @returns vocabulary management page
 */
export function VocabularyWordsPage(): React.ReactElement {
  const queryClient = useQueryClient();
  const words = useQuery(adminVocabularyQueryOptions());
  const completedCount = useQuery(adminVocabularyCompletedQueryOptions());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<SaveStatus | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: VocabUpdate) => updateVocabularyWord({ data: input }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.vocabulary() });
      const previous = queryClient.getQueryData<VocabWordRow[]>(adminKeys.vocabulary());
      queryClient.setQueryData<VocabWordRow[]>(adminKeys.vocabulary(), (old) =>
        old?.map((w) => (w.id === vars.id ? { ...w, ...vars, updated_at: new Date().toISOString() } : w)),
      );
      setStatus({ id: vars.id, state: "saving" });
      return { previous };
    },
    onSuccess: (_data, vars) => {
      setStatus({ id: vars.id, state: "saved" });
      setTimeout(() => setStatus(null), 1500);
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(adminKeys.vocabulary(), ctx.previous);
      setStatus({ id: vars.id, state: "error" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.vocabulary() }),
  });

  const doneMutation = useMutation({
    mutationFn: async (id: string) => markVocabularyWordDone({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.vocabulary() });
      queryClient.invalidateQueries({ queryKey: adminKeys.vocabularyCompleted() });
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return words.data ?? [];
    return (words.data ?? []).filter(
      (w) =>
        w.word.includes(q) ||
        w.def_vi.toLowerCase().includes(q) ||
        w.topic.includes(q) ||
        (w.level ?? "").toLowerCase().includes(q),
    );
  }, [words.data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageWords = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const save = (id: string, field: string, value: string) => {
    mutation.mutate({ id, [field]: value } as VocabUpdate);
  };

  const saveLevel = (id: string, level: string) => {
    mutation.mutate({ id, level: level || null } as VocabUpdate);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Vocabulary Words</h2>
          <p className="text-sm text-muted-foreground">
            {filtered.length} words · {completedCount.data ?? 0} done — tap cells to edit
          </p>
        </div>
        <input
          type="search"
          placeholder="Search words, topics, levels…"
          className="rounded border border-border bg-background px-3 py-1.5 text-sm w-72"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {status?.state === "error" && (
        <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-500">
          Failed to save changes. Please try again.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium w-28">Word</th>
              <th className="px-3 py-2 font-medium min-w-[200px]">Definition (Vi)</th>
              <th className="px-3 py-2 font-medium min-w-[160px]">Lead (Vi)</th>
              <th className="px-3 py-2 font-medium min-w-[140px]">Teaser (Vi)</th>
              <th className="px-3 py-2 font-medium w-24">Topic</th>
              <th className="px-3 py-2 font-medium w-16">Level</th>
              <th className="px-3 py-2 font-medium w-14">Done</th>
            </tr>
          </thead>
          <tbody>
            {words.isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : pageWords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {filtered.length === 0 ? "All words reviewed!" : "No matches"}
                </td>
              </tr>
            ) : (
              pageWords.map((word) => (
                <WordRow
                  key={word.id}
                  word={word}
                  isSaving={status?.id === word.id && status.state === "saving"}
                  justSaved={status?.id === word.id && status.state === "saved"}
                  onSave={save}
                  onSaveLevel={saveLevel}
                  onDone={(id) => doneMutation.mutate(id)}
                  isMarkingDone={doneMutation.isPending}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {currentPage + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WordRow({
  word,
  isSaving,
  justSaved,
  onSave,
  onSaveLevel,
  onDone,
  isMarkingDone,
}: {
  word: VocabWordRow;
  isSaving: boolean;
  justSaved: boolean;
  onSave: (id: string, field: string, value: string) => void;
  onSaveLevel: (id: string, level: string) => void;
  onDone: (id: string) => void;
  isMarkingDone: boolean;
}) {
  const rowClass = justSaved
    ? "bg-green-500/5 border-b border-border/60"
    : isSaving
      ? "bg-yellow-500/5 border-b border-border/60"
      : "border-b border-border/60";

  return (
    <tr className={rowClass}>
      <td className="px-1 py-1 font-medium">
        <EditableCell value={word.word} onSave={(v) => onSave(word.id, "word", v)} placeholder="word" />
      </td>
      <td className="px-1 py-1">
        <EditableCell value={word.def_vi} onSave={(v) => onSave(word.id, "def_vi", v)} multiline placeholder="definition" />
      </td>
      <td className="px-1 py-1">
        <EditableCell value={word.lead_vi} onSave={(v) => onSave(word.id, "lead_vi", v)} placeholder="lead text" />
      </td>
      <td className="px-1 py-1">
        <EditableCell value={word.anticipate_vi} onSave={(v) => onSave(word.id, "anticipate_vi", v)} placeholder="teaser before reveal" />
      </td>
      <td className="px-1 py-1">
        <EditableCell value={word.topic} onSave={(v) => onSave(word.id, "topic", v)} placeholder="topic" />
      </td>
      <td className="px-1 py-1">
        <select
          className="rounded border-none bg-transparent px-2 py-1 text-sm hover:bg-muted/60 cursor-pointer"
          value={word.level ?? ""}
          onChange={(e) => onSaveLevel(word.id, e.target.value)}
        >
          <option value="">—</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </td>
      <td className="px-1 py-1 text-center">
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-green-500/10 hover:text-green-600 transition-colors disabled:opacity-40"
          onClick={() => onDone(word.id)}
          disabled={isMarkingDone}
          aria-label={`Mark "${word.word}" as done`}
          title="Mark as done — moves to completed staging file"
        >
          <Check size={16} />
        </button>
      </td>
    </tr>
  );
}
