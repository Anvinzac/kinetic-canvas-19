/**
 * A sketch of a social app's interface laid over the export preview, so it is
 * obvious at a glance what would cover the card once the clip is posted. Preview
 * only: it is never mounted while a take is being recorded.
 *
 * Positions are percentages of the frame, traced from each app's layout on a
 * 9:16 screen. It is a guide, not a replica — phones differ by a few pixels.
 *
 * Exports: ExportGuides
 * Depends on: lucide-react, ../lib/export-presets
 */

import type { CSSProperties } from "react";
import { Bookmark, Heart, MessageCircle, Music2, Plus, Search, Send, Share2 } from "lucide-react";
import type { ExportPreset } from "../lib/export-presets";

const percent = (value: number) => `${value * 100}%`;

/**
 * Draw the platform interface and the preset's clear zone.
 * @param props.preset - the layout being previewed
 * @returns Overlay, or null for presets with no interface on top of the video
 */
export function ExportGuides({ preset }: { preset: ExportPreset }) {
  const { safe, guide } = preset;
  const zone = {
    top: percent(safe.top),
    right: percent(safe.right),
    bottom: percent(safe.bottom),
    left: percent(safe.left),
  } as CSSProperties;
  return (
    <div className="vocab-export-guides" data-guide={guide} aria-hidden="true">
      {/* The clear zone: everything outside it is tinted, so the margin a preset
          keeps is visible even where the app draws nothing. */}
      <div className="vocab-export-zone" style={zone}>
        <span>clear zone</span>
      </div>
      {guide === "tiktok" && (
        <>
          <div className="vocab-export-topbar">
            <span>Following</span>
            <strong>For You</strong>
            <Search size={15} />
          </div>
          <div className="vocab-export-rail" style={{ top: "47%", bottom: "13%" }}>
            <i className="vocab-export-avatar">
              <Plus size={9} />
            </i>
            <Heart size={22} fill="currentColor" />
            <MessageCircle size={22} fill="currentColor" />
            <Bookmark size={22} fill="currentColor" />
            <Share2 size={22} fill="currentColor" />
            <i className="vocab-export-disc" />
          </div>
          <div className="vocab-export-caption" style={{ bottom: "8.5%", right: "20%" }}>
            <strong>@anh.chayla</strong>
            <span>Caption text can run to a second line before it is cut… more</span>
            <em>
              <Music2 size={10} /> original sound · anh.chayLá
            </em>
          </div>
          <div className="vocab-export-nav">Home · Friends · ＋ · Inbox · Profile</div>
        </>
      )}
      {guide === "reels" && (
        <>
          <div className="vocab-export-topbar" data-align="start">
            <strong>Reels</strong>
            <Search size={15} />
          </div>
          <div className="vocab-export-rail" style={{ top: "65%", bottom: "9%" }}>
            <Heart size={22} />
            <MessageCircle size={22} />
            <Send size={22} />
            <Bookmark size={22} />
            <i className="vocab-export-disc" />
          </div>
          <div className="vocab-export-caption" style={{ bottom: "8.5%", right: "18%" }}>
            <strong>anh.chayla · Follow</strong>
            <span>Caption, hashtags and the audio line stack up from the bottom… more</span>
            <em>
              <Music2 size={10} /> Original audio
            </em>
          </div>
          <div className="vocab-export-nav">Home · Video · Marketplace · Profile</div>
        </>
      )}
    </div>
  );
}
