/**
 * Comment tray, floating chips, and local optimistic comment state.
 *
 * Exports: useCommentFlow
 * Depends on: comment-text helpers, kinetic-text getWords, PostCard types
 */

import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { getStableNumber, getWords } from "@/features/kinetic-text";
import {
  MAX_COMMENT_CHARS,
  MAX_COMMENT_WORDS,
  getCommentFlightDuration,
  getCommentLabel,
  getCommentStoryGradient,
  getCommentStoryPages,
  getFloatingCommentLabel,
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

export type UseCommentFlowResult = {
  localComments: Comment[];
  setLocalComments: Dispatch<SetStateAction<Comment[]>>;
  chronologicalComments: Comment[];
  floatingComments: Comment[];
  commentFlowKey: string;
  showChips: boolean;
  setShowChips: Dispatch<SetStateAction<boolean>>;
  showQuickCommentChips: boolean;
  setShowQuickCommentChips: Dispatch<SetStateAction<boolean>>;
  customComment: string;
  setCustomComment: Dispatch<SetStateAction<string>>;
  draftCommentPage: number;
  setDraftCommentPage: Dispatch<SetStateAction<number>>;
  draftCommentPlayKey: number;
  setDraftCommentPlayKey: Dispatch<SetStateAction<number>>;
  activeComment: FlowComment | null;
  setActiveComment: Dispatch<SetStateAction<FlowComment | null>>;
  commentOverlapsInfo: boolean;
  setCommentOverlapsInfo: Dispatch<SetStateAction<boolean>>;
  flyId: MutableRefObject<number>;
  localCommentId: MutableRefObject<number>;
  manualCommentHoldUntil: MutableRefObject<number>;
  normalizedCustomComment: string;
  customCommentHasText: boolean;
  customCommentIsKinetic: boolean;
  draftCommentPages: string[];
  draftCommentPageText: string;
  draftCommentBackground: string;
  activeCommentLabel: string;
  previewSubmittedComment: (chipId: string) => void;
  submitComment: (value: string) => void;
  updateCustomComment: (value: string) => void;
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
}: UseCommentFlowArgs): UseCommentFlowResult {
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const chronologicalComments = useMemo(
    () =>
      [...comments, ...localComments].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [comments, localComments],
  );
  const floatingComments = useMemo(
    () =>
      chronologicalComments.filter((comment) =>
        shouldFloatComment(getCommentLabel(comment.chip_id)),
      ),
    [chronologicalComments],
  );
  const commentFlowKey = floatingComments
    .map((comment) => `${comment.id}:${comment.created_at}:${comment.chip_id}`)
    .join("|");

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
        {
          id: `local-comment-${localCommentId.current}`,
          post_id: postId,
          user_id: currentUserId ?? "local",
          chip_id: chipId,
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }

    flyId.current += 1;
    manualCommentHoldUntil.current =
      Date.now() + getCommentFlightDuration(getFloatingCommentLabel(getCommentLabel(chipId))) + 700;
    setActiveComment({
      key: `local-${flyId.current}`,
      chip: chipId,
      created_at: new Date().toISOString(),
      user_id: currentUserId ?? "local",
    });
  }

  function submitComment(value: string): void {
    const normalized = normalizeComment(value);
    if (
      !normalized ||
      normalized.length > MAX_COMMENT_CHARS ||
      getWords(normalized).length > MAX_COMMENT_WORDS
    ) {
      return;
    }
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
