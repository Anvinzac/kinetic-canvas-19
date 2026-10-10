/**
 * Admin page for managing vocabulary wording presets.
 * Controls the reveal button text and guess lead phrasing used in the vocabulary feed.
 *
 * Exports: WordingManagerPage
 * Depends on: @tanstack/react-query, ../api/wording.functions
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateVocabWording,
  deleteVocabWording,
  listVocabWordings,
  saveVocabWording,
  type VocabWording,
} from "../../api/wording.functions";
import { Check, Edit2, Plus, Save, Trash2, X } from "lucide-react";

const QUERY_KEY = ["admin", "vocab-wordings"];

export function WordingManagerPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: wordings = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => listVocabWordings(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const saveMut = useMutation({
    mutationFn: (wording: {
      id?: string;
      reveal_button: string;
      guess_lead: string | null;
      is_active?: boolean;
    }) => saveVocabWording({ data: { wording } }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteVocabWording({ data: { id } }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => setError(err.message),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => activateVocabWording({ data: { id } }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => setError(err.message),
  });

  const activeWording = wordings.find((w) => w.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Câu chữ</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý câu nút "Reveal" và câu gợi ý đoán từ trong feed vocabulary.
        </p>
      </div>

      {/* Active wording indicator */}
      {activeWording && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary/70">
            Đang sử dụng
          </p>
          <p className="mt-1 text-sm font-medium">{activeWording.reveal_button}</p>
          {activeWording.guess_lead && (
            <p className="mt-1 text-xs text-muted-foreground">{activeWording.guess_lead}</p>
          )}
        </div>
      )}

      {/* Add new wording */}
      <NewWordingForm onSave={(wording) => saveMut.mutate(wording)} isPending={saveMut.isPending} />

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Wording list */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Tất cả ({wordings.length})
          </h2>
        </div>
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : wordings.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Chưa có câu chữ nào. Thêm mới ở trên.
          </p>
        ) : (
          <ul className="divide-y">
            {wordings.map((wording) => (
              <WordingRow
                key={wording.id}
                wording={wording}
                isEditing={editingId === wording.id}
                onEdit={() => setEditingId(wording.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(updated) => saveMut.mutate({ ...updated, id: wording.id })}
                onActivate={() => activateMut.mutate(wording.id)}
                onDelete={() => {
                  if (confirm("Xoá câu chữ này?")) deleteMut.mutate(wording.id);
                }}
                isSaving={saveMut.isPending}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewWordingForm({
  onSave,
  isPending,
}: {
  onSave: (wording: {
    reveal_button: string;
    guess_lead: string | null;
    is_active: boolean;
  }) => void;
  isPending: boolean;
}) {
  const [revealButton, setRevealButton] = useState("Ê, từ này biết nè");
  const [guessLead, setGuessLead] = useState("");
  const [isActive, setIsActive] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revealButton.trim()) return;
    onSave({
      reveal_button: revealButton.trim(),
      guess_lead: guessLead.trim() || null,
      is_active: isActive,
    });
    setRevealButton("Ê, từ này biết nè");
    setGuessLead("");
    setIsActive(false);
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Thêm câu chữ mới
      </h2>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Câu nút Reveal *
          </label>
          <input
            type="text"
            value={revealButton}
            onChange={(e) => setRevealButton(e.target.value)}
            placeholder="Ê, từ này biết nè"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            required
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Câu gợi ý đoán từ (tuỳ chọn)
          </label>
          <textarea
            value={guessLead}
            onChange={(e) => setGuessLead(e.target.value)}
            placeholder="Từ này bắt đầu bằng chữ..."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
            rows={2}
            maxLength={240}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            Kích hoạt ngay
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus size={16} />
            Thêm
          </button>
        </div>
      </div>
    </form>
  );
}

function WordingRow({
  wording,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onActivate,
  onDelete,
  isSaving,
}: {
  wording: VocabWording;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (updated: { reveal_button: string; guess_lead: string | null }) => void;
  onActivate: () => void;
  onDelete: () => void;
  isSaving: boolean;
}) {
  const [revealButton, setRevealButton] = useState(wording.reveal_button);
  const [guessLead, setGuessLead] = useState(wording.guess_lead ?? "");

  const handleSave = () => {
    if (!revealButton.trim()) return;
    onSave({
      reveal_button: revealButton.trim(),
      guess_lead: guessLead.trim() || null,
    });
  };

  if (isEditing) {
    return (
      <li className="px-4 py-3 space-y-3 bg-muted/30">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Câu nút Reveal
          </label>
          <input
            type="text"
            value={revealButton}
            onChange={(e) => setRevealButton(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Câu gợi ý</label>
          <textarea
            value={guessLead}
            onChange={(e) => setGuessLead(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none"
            rows={2}
            maxLength={240}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save size={14} />
            Lưu
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <X size={14} />
            Huỷ
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{wording.reveal_button}</span>
          {wording.is_active && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              Active
            </span>
          )}
        </div>
        {wording.guess_lead && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{wording.guess_lead}</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/60">
          {new Date(wording.updated_at).toLocaleString("vi-VN")}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!wording.is_active && (
          <button
            type="button"
            onClick={onActivate}
            className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="Kích hoạt"
          >
            <Check size={15} />
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
          title="Sửa"
        >
          <Edit2 size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Xoá"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
