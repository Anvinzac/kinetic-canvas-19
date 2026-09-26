/** Public navigation and stream/presentation controls. Exports: FeedControls. Depends on: router, presets, transport types. */
import { Link } from "@tanstack/react-router";
import { useId, useRef } from "react";
import { Pause, Play, Shuffle, SlidersHorizontal, X } from "lucide-react";
import { STYLES, THEMES } from "../lib/presets";
import { LEVELS, type NarrativeStyle, type VocabularyLevel } from "../lib/schema";
import type { FeedPage, Presentation, VocabularyFilters } from "../types";

/** Control word selection separately from appearance. @param props Settings and callbacks. @returns Public header and options panel. */
export function FeedControls({
  metadata,
  filters,
  presentation,
  onFilters,
  onPresentation,
  onShuffle,
  open,
  onOpen,
  reducedMotion,
}: {
  metadata?: FeedPage;
  filters: VocabularyFilters;
  presentation: Presentation;
  onFilters: (value: VocabularyFilters) => void;
  onPresentation: (value: Presentation) => void;
  onShuffle: () => void;
  open: boolean;
  onOpen: (value: boolean) => void;
  reducedMotion: boolean;
}) {
  const panelId = useId();
  const toggleButton = useRef<HTMLButtonElement>(null);
  // Difficulty is the primary control, so keep the chips visible before metadata arrives.
  const levelOptions: VocabularyLevel[] = metadata?.levels?.length ? metadata.levels : [...LEVELS];
  const close = () => {
    onOpen(false);
    toggleButton.current?.focus();
  };
  return (
    <header className="vocab-toolbar">
      <div className="vocab-toolbar-row">
        <Link className="vocab-brand" to="/feed" aria-label="WordCrawler vocabulary home">
          word<span>crawler</span>
          <small>A little English, endlessly.</small>
        </Link>
        <div className="vocab-toolbar-actions">
          <button
            className="vocab-icon-button"
            type="button"
            disabled={reducedMotion}
            onClick={() => onPresentation({ ...presentation, autoplay: !presentation.autoplay })}
            aria-label={presentation.autoplay && !reducedMotion ? "Pause stream" : "Play stream"}
            aria-pressed={presentation.autoplay && !reducedMotion}
          >
            {presentation.autoplay && !reducedMotion ? <Pause size={19} /> : <Play size={19} />}
          </button>
          <button
            className="vocab-icon-button"
            type="button"
            onClick={onShuffle}
            aria-label="Shuffle words and start a new stream"
          >
            <Shuffle size={19} />
          </button>
          <button
            className="vocab-icon-button"
            type="button"
            ref={toggleButton}
            onClick={() => (open ? close() : onOpen(true))}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? "Close feed options" : "Open feed options"}
          >
            {open ? <X size={20} /> : <SlidersHorizontal size={19} />}
          </button>
        </div>
      </div>
      {open && (
        <section
          id={panelId}
          className="vocab-options"
          aria-label="Feed options"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <div className="vocab-level-switch" role="group" aria-label="Difficulty">
            <span className="vocab-group-label">Difficulty</span>
            <div className="vocab-level-chips">
              <button
                type="button"
                aria-pressed={filters.level === ""}
                data-active={filters.level === "" || undefined}
                onClick={() => onFilters({ ...filters, level: "" })}
              >
                All
              </button>
              {levelOptions.map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={filters.level === level}
                  data-active={filters.level === level || undefined}
                  onClick={() =>
                    onFilters({ ...filters, level: filters.level === level ? "" : level })
                  }
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <p className="vocab-options-summary">
            {metadata
              ? `${metadata.total.toLocaleString()} distinct words in this catalog.`
              : "Your word stream is loading."}{" "}
            Every completed deck reshuffles.
          </p>
          <div className="vocab-options-secondary">
            <span className="vocab-group-label">Category, theme and reveal</span>
            <div className="vocab-select-grid">
              <label>
                Category
                <select
                  value={filters.topic}
                  onChange={(event) => onFilters({ ...filters, topic: event.target.value })}
                >
                  <option value="">All categories</option>
                  {metadata?.topics.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Theme
                <select
                  value={presentation.theme}
                  onChange={(event) =>
                    onPresentation({ ...presentation, theme: event.target.value })
                  }
                >
                  <option value="mix">Mix themes</option>
                  {THEMES.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reveal
                <select
                  value={presentation.style}
                  onChange={(event) =>
                    onPresentation({
                      ...presentation,
                      style: event.target.value as NarrativeStyle | "mix",
                    })
                  }
                >
                  <option value="mix">Mix reveals</option>
                  {STYLES.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <label className="vocab-autoplay">
            <input
              type="checkbox"
              checked={presentation.autoplay && !reducedMotion}
              disabled={reducedMotion}
              onChange={(event) =>
                onPresentation({ ...presentation, autoplay: event.target.checked })
              }
            />{" "}
            Autoplay the stream
          </label>
          <p className="vocab-options-summary">
            {reducedMotion
              ? "Reduced motion is on. Clues advance manually."
              : "Clues and words play automatically for a full-screen stream. Turn off to pause."}
          </p>
          <nav aria-label="Site navigation" className="vocab-site-links">
            <Link to="/community">Community</Link>
            <Link to="/auth">Sign in</Link>
            <button type="button" onClick={close}>
              Back to words
            </button>
          </nav>
        </section>
      )}
    </header>
  );
}
