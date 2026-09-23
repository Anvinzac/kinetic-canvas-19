/** Public vocabulary page orchestration. Exports: VocabularyFeedPage. Depends on: controls, stream, reduced-motion preference. */
import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { FeedPage, Presentation, VocabularyFilters } from "../types";
import { FeedControls } from "./FeedControls";
import { VocabularyStream } from "./VocabularyStream";
import "../vocabulary.css";

function newSeed(): string {
  const values = new Uint32Array(4);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
}

/** Open the word stream without authentication or persistent storage. @returns Public feed and preferences. */
export function VocabularyFeedPage() {
  const [seed, setSeed] = useState(newSeed);
  const [filters, setFilters] = useState<VocabularyFilters>({ topic: "", level: "" });
  const [presentation, setPresentation] = useState<Presentation>({
    theme: "mix",
    style: "mix",
    autoplay: true,
  });
  const [metadata, setMetadata] = useState<FeedPage>();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const reducedMotion = !!useReducedMotion();
  const shuffle = () => {
    setSeed(newSeed());
    setOptionsOpen(false);
  };
  return (
    <main className="vocabulary-shell">
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
      />
      <VocabularyStream
        key={`${seed}:${filters.topic}:${filters.level}`}
        seed={seed}
        filters={filters}
        presentation={presentation}
        reducedMotion={reducedMotion}
        suspended={optionsOpen}
        onMetadata={setMetadata}
        onRestart={shuffle}
        onClearFilters={() => setFilters({ topic: "", level: "" })}
      />
    </main>
  );
}
