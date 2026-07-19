/**
 * Accent (emoji sticker) recommendation lifecycle for create-studio.
 *
 * Exports: useStudioAccents
 * Depends on: create-studio lib/accent-suggestions
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { CanvasSpec } from "@/features/canvas";
import {
  createEmojiSticker,
  getAccentKeyword,
  getAccentRecommendation,
  type AccentRecommendation,
} from "../lib/accent-suggestions";

export type StudioAccentsApi = {
  accentRecommendation: AccentRecommendation | null;
  setAccentRecommendation: Dispatch<SetStateAction<AccentRecommendation | null>>;
  accentLoading: boolean;
  acceptEmojiAccent: () => void;
  rejectAccent: () => void;
  removeAccent: (id: string) => void;
};

type UseStudioAccentsArgs = {
  currentTextPage: string;
  stickers: CanvasSpec["stickers"];
  setSpec: Dispatch<SetStateAction<CanvasSpec>>;
  setPreviewAnimating: Dispatch<SetStateAction<boolean>>;
};

/**
 * Debounced accent suggestions and accept/reject/remove handlers.
 * @param args - Current page text, stickers, and spec mutators
 * @returns Accent UI state and actions
 */
export function useStudioAccents({
  currentTextPage,
  stickers,
  setSpec,
  setPreviewAnimating,
}: UseStudioAccentsArgs): StudioAccentsApi {
  const [accentRecommendation, setAccentRecommendation] = useState<AccentRecommendation | null>(
    null,
  );
  const [accentLoading, setAccentLoading] = useState(false);
  const [dismissedAccentKeyword, setDismissedAccentKeyword] = useState<string | null>(null);

  useEffect(() => {
    const keyword = getAccentKeyword(currentTextPage, dismissedAccentKeyword);
    if (!keyword || stickers?.some((sticker) => sticker.word === keyword)) {
      setAccentRecommendation(null);
      setAccentLoading(false);
      return;
    }

    let cancelled = false;
    setAccentLoading(true);
    const timer = window.setTimeout(() => {
      getAccentRecommendation(keyword).then((recommendation) => {
        if (cancelled) return;
        setAccentRecommendation(recommendation);
        setAccentLoading(false);
      });
    }, 420);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentTextPage, dismissedAccentKeyword, stickers]);

  function acceptEmojiAccent(): void {
    if (!accentRecommendation) return;
    setSpec((s) => ({
      ...s,
      stickers: [
        ...(s.stickers ?? []).filter((sticker) => sticker.word !== accentRecommendation.keyword),
        createEmojiSticker(
          accentRecommendation.keyword,
          accentRecommendation.emoji,
          s.stickers?.length ?? 0,
        ),
      ],
    }));
    setAccentRecommendation(null);
    setDismissedAccentKeyword(accentRecommendation.keyword);
    setPreviewAnimating(false);
  }

  function rejectAccent(): void {
    if (!accentRecommendation) return;
    setDismissedAccentKeyword(accentRecommendation.keyword);
    setAccentRecommendation(null);
  }

  function removeAccent(id: string): void {
    setSpec((s) => ({
      ...s,
      stickers: (s.stickers ?? []).filter((sticker) => sticker.id !== id),
    }));
    setPreviewAnimating(false);
  }

  return {
    accentRecommendation,
    setAccentRecommendation,
    accentLoading,
    acceptEmojiAccent,
    rejectAccent,
    removeAccent,
  };
}
