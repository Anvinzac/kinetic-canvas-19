/** Public vocabulary page orchestration. Exports: VocabularyFeedPage. Depends on: controls, stream, reduced-motion preference, font readiness, track rotation. */
import { useCallback, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useScreenWakeLock } from "@/hooks/use-screen-wake-lock";
import { useOrientationGate } from "@/hooks/use-orientation-gate";
import { OrientationGate } from "@/components/OrientationGate";
import type { FeedPage, Presentation, VocabularyFilters } from "../types";
import { DIFFICULTY_ALL } from "../lib/difficulty";
import { useIsAdmin } from "@/features/admin/hooks/useIsAdmin";
import { useFontsReady } from "../hooks/useFontsReady";
import { useTrackRotation } from "../hooks/useTrackRotation";
import { useViewHistory } from "../hooks/useViewHistory";
import { getActiveVocabWording } from "@/features/admin/api/wording.functions";
import { FeedControls } from "./FeedControls";
import { VocabularyStream } from "./VocabularyStream";
import { SavedDrawer } from "./SavedDrawer";
import "../vocabulary.css";

function newSeed(): string {
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
}

/** Every word, no category and no difficulty track. */
const ALL_FILTERS: VocabularyFilters = { topic: "", level: "", difficulty: DIFFICULTY_ALL };

/** Open the word stream without authentication or persistent storage. @returns Public feed and preferences. */
export function VocabularyFeedPage() {
  const [seed, setSeed] = useState(newSeed);
  const [filters, setFilters] = useState<VocabularyFilters>(ALL_FILTERS);
  const [presentation, setPresentation] = useState<Presentation>({
    theme: "mix",
    style: "mix",
    autoplay: true,
  });
  const [metadata, setMetadata] = useState<FeedPage>();
  // The saved drawer suspends the feed behind it rather than navigating away.
  const [savedOpen, setSavedOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  // Video export is an admin tool; for everyone else the control is never rendered
  // and the studio's code is never downloaded.
  const isAdmin = useIsAdmin();
  const [exportOpen, setExportOpen] = useState(false);
  const openExport = useCallback(() => {
    setOptionsOpen(false);
    setExportOpen(true);
  }, []);
  const closeExport = useCallback(() => setExportOpen(false), []);
  const viewHistory = useViewHistory();
  const reducedMotion = !!useReducedMotion();
  // Rotate-to-portrait gate: the feed's whole typography stack is authored for one aspect
  // ratio, and the wide-card landscape layout is still too buggy to ship, so a phone held
  // in landscape gets the opaque cover instead — folded into `suspended` below to actually
  // stop playback behind it. Keep the screen lit only while a scene is active and ungated.
  const orientationGated = useOrientationGate();
  useScreenWakeLock(!orientationGated);
  // The stream still mounts and fetches while fonts load; only the text is held.
  const fontsReady = useFontsReady();
  // Each word that comes on screen is logged to the viewing history and counted
  // towards the current music track's run.
  const music = useTrackRotation();
  const recordView = viewHistory.record;
  // Fetch the active wording preset for the reveal button label
  const { data: activeWording } = useQuery({
    queryKey: ["vocab-active-wording"],
    queryFn: getActiveVocabWording,
    staleTime: 60_000, // Cache for 1 minute
  });
  const handleRecordView = useCallback(
    (wordId: string) => {
      recordView(wordId);
      music.wordStarted();
    },
    [recordView, music],
  );
  const shuffle = () => {
    setSeed(newSeed());
    setOptionsOpen(false);
  };
  return (
    <main className="vocabulary-shell">
      <OrientationGate show={orientationGated} />
      <FeedControls
        metadata={metadata}
        filters={filters}
        presentation={presentation}
        onFilters={(value) => {
          setFilters(value);
          setSeed(newSeed());
        }}
        onPresentation={setPresentation}
        onShuffle={shuffle}
        open={optionsOpen}
        onOpen={setOptionsOpen}
        reducedMotion={reducedMotion}
        historyStats={viewHistory.stats}
        onClearHistory={viewHistory.clear}
        onExport={isAdmin ? openExport : undefined}
      />
      <SavedDrawer open={savedOpen} onOpenChange={setSavedOpen} />
      <VocabularyStream
        key={`${seed}:${filters.topic}:${filters.level}:${filters.difficulty}`}
        seed={seed}
        filters={filters}
        presentation={presentation}
        reducedMotion={reducedMotion}
        suspended={orientationGated || optionsOpen || savedOpen || !fontsReady || exportOpen}
        exportOpen={isAdmin && exportOpen}
        onCloseExport={closeExport}
        history={viewHistory.history}
        onRecordView={handleRecordView}
        onWordEnding={music.wordEnding}
        onClearHistory={viewHistory.clear}
        onMetadata={setMetadata}
        onRestart={shuffle}
        onClearFilters={() => setFilters(ALL_FILTERS)}
        revealButtonLabel={activeWording?.reveal_button}
      />
    </main>
  );
}
