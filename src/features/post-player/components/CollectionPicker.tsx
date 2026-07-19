/**
 * Long-press collection/tag picker overlay for saving a post.
 *
 * Exports: CollectionPicker
 * Depends on: framer-motion, lucide-react X
 */

import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactElement } from "react";

const PLACEHOLDER_FOLDERS = [
  { id: "favorites", label: "Favorites", emoji: "\u2764\ufe0f" },
  { id: "inspiration", label: "Inspiration", emoji: "\u2728" },
  { id: "read-later", label: "Read Later", emoji: "\ud83d\udcda" },
  { id: "design", label: "Design", emoji: "\ud83c\udfa8" },
  { id: "code", label: "Code", emoji: "\ud83d\udcbb" },
  { id: "research", label: "Research", emoji: "\ud83d\udd2c" },
  { id: "archive", label: "Archive", emoji: "\ud83d\udcc1" },
  { id: "tutorials", label: "Tutorials", emoji: "\ud83c\udf93" },
  { id: "entertainment", label: "Fun", emoji: "\ud83c\udfad" },
];

const PLACEHOLDER_TAGS = [
  "Motivational",
  "Technical",
  "Creative",
  "Educational",
  "Entertaining",
  "News",
  "Lifestyle",
  "Tutorial",
  "Deep Dive",
  "Quick Tip",
];

export type CollectionPickerProps = {
  selectedFolders: Set<string>;
  selectedTags: Set<string>;
  onToggleFolder: (id: string) => void;
  onToggleTag: (tag: string) => void;
  onSave: () => void;
  onClose: () => void;
};

/**
 * @responsibility Overlay to pick folders/tags when long-pressing like.
 */
export function CollectionPicker({
  selectedFolders,
  selectedTags,
  onToggleFolder,
  onToggleTag,
  onSave,
  onClose,
}: CollectionPickerProps): ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="absolute inset-0 z-50"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-[136px] right-6 w-[min(304px,calc(100%-5.5rem))] origin-[78%_100%]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-[62px] right-10 h-[62px] w-5"
        >
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-[#171717] via-[#171717]/85 to-transparent shadow-[0_0_16px_rgba(0,0,0,0.4)]" />
          <span className="absolute bottom-0 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-[#171717] shadow-[6px_-6px_22px_rgba(0,0,0,0.28)] ring-1 ring-white/10" />
        </span>
        <div className="relative flex max-h-[min(58dvh,430px)] flex-col overflow-hidden rounded-2xl bg-[#171717]/95 shadow-[0_18px_55px_rgba(0,0,0,0.58)] ring-1 ring-white/10 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h3 className="text-sm font-black text-white">Save</h3>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/45">
                collections · tags
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20"
              aria-label="Close collection picker"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
              Folders
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PLACEHOLDER_FOLDERS.map((folder) => {
                const isSelected = selectedFolders.has(folder.id);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onToggleFolder(folder.id)}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 transition active:scale-95 ${
                      isSelected
                        ? "border-white/[0.45] bg-white/[0.16] shadow-[0_0_16px_rgba(255,255,255,0.08)]"
                        : "border-white/10 bg-white/[0.06] hover:bg-white/10"
                    }`}
                  >
                    <span className="text-base">{folder.emoji}</span>
                    <span
                      className={`max-w-full truncate text-[10px] font-bold leading-none ${
                        isSelected ? "text-white" : "text-white/[0.62]"
                      }`}
                    >
                      {folder.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mb-2 mt-4 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDER_TAGS.map((tag) => {
                const isSelected = selectedTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(tag)}
                    className={`rounded-full border px-2.5 py-1.5 text-[11px] font-bold transition active:scale-95 ${
                      isSelected
                        ? "border-white/[0.45] bg-white/[0.22] text-white"
                        : "border-white/10 bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white/75"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/10 px-3 py-3">
            <button
              type="button"
              onClick={onSave}
              disabled={selectedFolders.size === 0 && selectedTags.size === 0}
              className="w-full rounded-full bg-white py-2.5 text-sm font-black text-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
            >
              save
              {selectedFolders.size + selectedTags.size > 0
                ? ` ${selectedFolders.size + selectedTags.size}`
                : ""}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

}
