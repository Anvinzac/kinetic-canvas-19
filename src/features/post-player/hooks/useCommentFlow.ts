/**
 * Comment tray, floating chips, and local optimistic comment state.
 *
 * Exports: useCommentFlow
 * Depends on: comment-flow-helpers, comment-text, kinetic-text getStableNumber
 */

import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { getStableNumber } from "@/features/kinetic-text";
import {
  buildCommentFlowKey,
  buildLocalComment,
  buildManualFlyComment,
  filterFloatingComments,
  isValidCommentSubmission,
  mergeChronologicalComments,
} from "../lib/comment-flow-helpers";
import {
  getCommentLabel,
  getCommentStoryGradient,
  getCommentStoryPages,
  limitCommentText,
  normalizeComment,
  shouldFloatComment,
} from "../lib/comment-text";
import type { Comment, FlowComment } from "../types";

export type UseCommentFlowArgs = {
  comments: Comment[];
  postId: string;
  currentUserId: string | null;
  onComment: (chip: string) => void;
  /** Filled by usePostPlayback after useCommentStory mounts (same render). */
  storyIndexApiRef: MutableRefObject<{
    setStoryIndex: Dispatch<SetStateAction<number>>;
    commentStoriesLength: number;
  } | null>;
};

/**
 * @responsibility Manage comment tray input, floating chips, and local optimistic rows.
 */
export function useCommentFlow({
  comments,
  postId,
  currentUserId,
  onComment,
  storyIndexApiRef,
}: UseCommentFlowArgs) {
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const chronologicalComments = useMemo(
    () => mergeChronologicalComments(comments, localComments),
    [comments, localComments],
  );
  const floatingComments = useMemo(
    () => filterFloatingComments(chronologicalComments),
    [chronologicalComments],
  );
  const commentFlowKey = buildCommentFlowKey(floatingComments);

  const [showChips, setShowChips] = useState(false);
  const [showQuickCommentChips, setShowQuickCommentChips] = useState(false);
  const [customComment, setCustomComment] = useState("");
  const [draftCommentPage, setDraftCommentPage] = useState(0);
  const [draftCommentPlayKey, setDraftCommentPlayKey] = useState(0);
  const [activeComment, setActiveComment] = useState<FlowComment | null>(null);
  const [commentOverlapsInfo, setCommentOverlapsInfo] = useState(false);
  const flyId = useRef(0);
  const localCommentId = useRef(0);
  const manualCommentHoldUntil = useRef(0);

  const normalizedCustomComment = normalizeComment(customComment);
  const customCommentHasText = normalizedCustomComment.length > 0;
  const customCommentIsKinetic =
    customCommentHasText && !shouldFloatComment(normalizedCustomComment);
  const draftCommentPages = useMemo(
    () => (customCommentHasText ? getCommentStoryPages(normalizedCustomComment, false) : []),
    [customCommentHasText, normalizedCustomComment],
  );
  const draftCommentPageText = draftCommentPages[draftCommentPage] ?? draftCommentPages[0] ?? "";
  const draftCommentBackground = useMemo(
    () => getCommentStoryGradient(getStableNumber(normalizedCustomComment || "draft") % 8),
    [normalizedCustomComment],
  );
  const activeCommentLabel = activeComment ? getCommentLabel(activeComment.chip) : "";

  function previewSubmittedComment(chipId: string): void {
    const label = getCommentLabel(chipId);
    if (!shouldFloatComment(label)) {
      localCommentId.current += 1;
      const api = storyIndexApiRef.current;
      if (api) api.setStoryIndex(api.commentStoriesLength);
      setLocalComments((items) => [
        ...items,
        buildLocalComment(postId, currentUserId ?? "local", chipId, localCommentId.current),
      ]);
      return;
    }

    flyId.current += 1;
    const { comment, holdMs } = buildManualFlyComment(
      chipId,
      currentUserId ?? "local",
      flyId.current,
    );
    manualCommentHoldUntil.current = Date.now() + holdMs;
    setActiveComment(comment);
  }

  function submitComment(value: string): void {
    const normalized = isValidCommentSubmission(value);
    if (!normalized) return;
    previewSubmittedComment(normalized);
    onComment(normalized);
    setCustomComment("");
    setShowChips(false);
    setShowQuickCommentChips(false);
    setDraftCommentPage(0);
    setDraftCommentPlayKey((key) => key + 1);
  }

  function updateCustomComment(value: string): void {
    const limited = limitCommentText(value);
    const normalized = normalizeComment(limited);
    setCustomComment(limited);
    if (normalized && !shouldFloatComment(normalized)) {
      setShowQuickCommentChips(false);
    }
  }

  return {
    localComments,
    setLocalComments,
    chronologicalComments,
    floatingComments,
    commentFlowKey,
    showChips,
    setShowChips,
    showQuickCommentChips,
    setShowQuickCommentChips,
    customComment,
    setCustomComment,
    draftCommentPage,
    setDraftCommentPage,
    draftCommentPlayKey,
    setDraftCommentPlayKey,
    activeComment,
    setActiveComment,
    commentOverlapsInfo,
    setCommentOverlapsInfo,
    flyId,
    localCommentId,
    manualCommentHoldUntil,
    normalizedCustomComment,
    customCommentHasText,
    customCommentIsKinetic,
    draftCommentPages,
    draftCommentPageText,
    draftCommentBackground,
    activeCommentLabel,
    previewSubmittedComment,
    submitComment,
    updateCustomComment,
  };
}

export type UseCommentFlowResult = ReturnType<typeof useCommentFlow>;
