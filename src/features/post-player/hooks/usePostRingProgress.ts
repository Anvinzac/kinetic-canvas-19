/**
 * Corner-ring like long-press and collection-picker state.
 *
 * Exports: usePostRingProgress
 * Depends on: react pointer events
 */

import {
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { FlowComment } from "../types";

export type UsePostRingProgressArgs = {
  onLike: () => void;
  setIsPaused: Dispatch<SetStateAction<boolean>>;
  setActionMenuOpen: Dispatch<SetStateAction<boolean>>;
  setShowChips: Dispatch<SetStateAction<boolean>>;
  setActiveComment: Dispatch<SetStateAction<FlowComment | null>>;
};

export type UsePostRingProgressResult = {
  showCollectionPicker: boolean;
  setShowCollectionPicker: Dispatch<SetStateAction<boolean>>;
  selectedFolders: Set<string>;
  selectedTags: Set<string>;
  handleLikePointerDown: (e: ReactPointerEvent) => void;
  handleLikePointerUp: (e: ReactPointerEvent) => void;
  handleLikePointerCancel: () => void;
  handleToggleFolder: (id: string) => void;
  handleToggleTag: (tag: string) => void;
  handleCollectionSave: () => void;
  handleCollectionClose: () => void;
  resetCollectionPicker: () => void;
};

/**
 * Own long-press → collection picker flow from the like ring button.
 * @param args - UsePostRingProgressArgs fields
 * @returns Hook API for callers
 */
export function usePostRingProgress({
  onLike,
  setIsPaused,
  setActionMenuOpen,
  setShowChips,
  setActiveComment,
}: UsePostRingProgressArgs): UsePostRingProgressResult {
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  function handleLikePointerDown(e: ReactPointerEvent): void {
    e.stopPropagation();
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      setShowChips(false);
      setActionMenuOpen(false);
      setActiveComment(null);
      setShowCollectionPicker(true);
      setIsPaused(true);
    }, 520);
  }

  function handleLikePointerUp(e: ReactPointerEvent): void {
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!didLongPressRef.current) {
      onLike();
    }
  }

  function handleLikePointerCancel(): void {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleToggleFolder(id: string): void {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleTag(tag: string): void {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function handleCollectionSave(): void {
    setShowCollectionPicker(false);
    setIsPaused(false);
  }

  function handleCollectionClose(): void {
    setShowCollectionPicker(false);
    setIsPaused(false);
  }

  function resetCollectionPicker(): void {
    setShowCollectionPicker(false);
    setSelectedFolders(new Set());
    setSelectedTags(new Set());
  }

  return {
    showCollectionPicker,
    setShowCollectionPicker,
    selectedFolders,
    selectedTags,
    handleLikePointerDown,
    handleLikePointerUp,
    handleLikePointerCancel,
    handleToggleFolder,
    handleToggleTag,
    handleCollectionSave,
    handleCollectionClose,
    resetCollectionPicker,
  };
}
