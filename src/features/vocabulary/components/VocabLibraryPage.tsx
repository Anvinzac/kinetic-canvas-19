/**
 * Vocabulary Library: a browsable shelf of additional packs, each focused on a field,
 * a need and a proficiency band. Reads static mock metadata from ../lib/library — no
 * account, no network, no feed wiring yet (the page is a discovery surface, so every
 * pack is marked "Sắp có" rather than offered as a working import).
 *
 * Exports: VocabLibraryPage
 * Depends on: router Link, lucide icons, library data, formatLevelBand, vocabulary.css
 */

import { Link } from "@tanstack/react-router";
import { ArrowLeft, Library as LibraryIcon, Sparkles } from "lucide-react";
import { LIBRARY_GROUPS } from "../lib/library";
import { formatLevelBand } from "../lib/difficulty";
import "../vocabulary.css";

/** Show the curated pack shelves. @returns Public library page. */
export function VocabLibraryPage() {
  return (
    <main className="vocabulary-shell vocab-library-shell">
      <header className="vocab-library-header">
        <Link className="vocab-icon-button" to="/feed" aria-label="Back to the word stream">
          <ArrowLeft size={19} />
        </Link>
        <div>
          <h1 className="vocab-library-title">
            <LibraryIcon size={20} aria-hidden="true" />
            Thư viện từ vựng
          </h1>
          <p className="vocab-library-subtitle">
            Những gói từ vựng chuyên sâu theo lĩnh vực, nhu cầu và trình độ — bổ sung cho dòng ngẫu
            nhiên hằng ngày.
          </p>
        </div>
      </header>

      <div className="vocab-library-body">
        {LIBRARY_GROUPS.map((group) => (
          <section
            className="vocab-library-group"
            key={group.id}
            aria-labelledby={`grp-${group.id}`}
          >
            <div className="vocab-library-group-head">
              <h2 id={`grp-${group.id}`} className="vocab-library-group-title">
                {group.title}
              </h2>
              <p className="vocab-library-group-note">{group.note}</p>
            </div>
            <ul className="vocab-library-grid">
              {group.packs.map((pack) => (
                <li className="vocab-library-pack" key={pack.id}>
                  <div className="vocab-pack-top">
                    <span className="vocab-pack-band">{formatLevelBand(pack.levels)}</span>
                    <span className="vocab-pack-soon">
                      <Sparkles size={12} aria-hidden="true" />
                      Sắp có
                    </span>
                  </div>
                  <h3 className="vocab-pack-name">{pack.name}</h3>
                  <p className="vocab-pack-blurb">{pack.blurb}</p>
                  <ul className="vocab-pack-tags">
                    {pack.tags.map((tag) => (
                      <li className="vocab-pack-tag" key={tag}>
                        {tag}
                      </li>
                    ))}
                  </ul>
                  <p className="vocab-pack-count">~{pack.words.toLocaleString()} từ</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
