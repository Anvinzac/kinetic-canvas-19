/**
 * The Chay Lá siblings: the same feed, one per answer language.
 *
 * NOT invented. Every entry here is a host the app itself already resolves —
 * `SUBDOMAINS` in features/vocabulary/lib/target-language.ts maps exactly these labels to
 * exactly these decks, and one deployment serves all of them. If a label here stops
 * matching that map, the tile sends a reader to a host that answers in English.
 *
 * The four placeholder apps this replaced (chayLá, hiểu, việc, quà) were marked MOCK in
 * this file's own header and were never real.
 *
 * `anh` is in the list even though it is this page's own host, because which host IS this
 * page now varies: on duc.chayla.app the sibling worth offering is Anh, not Đức. The
 * drawer filters the current one out at render time rather than this file hard-coding an
 * absence that is only true on one deployment.
 *
 * Exports: ECOSYSTEM_APPS, ECOSYSTEM_MAX_APPS, EcosystemApp
 * Depends on: ../../vocabulary/lib/target-language (TYPE only, itself a leaf — so this
 *   stays a leaf at runtime)
 */

import type { TargetLocale } from "@/features/vocabulary/lib/target-language";

export type EcosystemApp = {
  /** Stable key, and the subdomain label. Must match SUBDOMAINS in target-language.ts. */
  id: string;
  /**
   * The deck this sibling answers in. Carried on the record rather than kept in a second
   * map beside it, so "which tile is the page already open" has one answer and a guard can
   * check it against resolveTarget. check-ecosystem-apps is what does.
   */
  locale: TargetLocale;
  /**
   * Shown on the tile. Keep it short: tiles sit three-up, and anything past ~12
   * characters is ellipsised. The language's Vietnamese name is both the shortest and
   * the clearest thing to put here.
   */
  name: string;
  /** One line of Vietnamese explaining what the app is for. */
  tagline: string;
  url: string;
  /** Glyph drawn on the tile until real icon art exists. */
  glyph: string;
  /** Two hex stops for the tile's gradient. */
  accent: [string, string];
  /** "soon" renders the tile as unvisitable, with no link. */
  status: "live" | "soon";
  /** A paragraph for the store page. */
  description: string;
  /** Captions for the store page's screenshot frames. No real images exist yet, so each
   *  frame is drawn from the app's own accent and glyph. */
  shots: string[];
};

/**
 * The drawer is a shortcut, not a directory: past about ten tiles it stops being
 * scannable at a glance and the grid starts to scroll on a phone.
 */
export const ECOSYSTEM_MAX_APPS = 10;

const APPS: EcosystemApp[] = [
  {
    id: "anh",
    locale: "en",
    name: "Anh",
    tagline: "Từ vựng tiếng Anh",
    url: "https://anh.chayla.app",
    glyph: "🇬🇧",
    accent: ["#3b82f6", "#1e3a8a"],
    status: "live",
    description: "Dòng từ vựng tiếng Anh, giải nghĩa bằng tiếng Việt.",
    shots: ["Dòng từ vựng", "Từ đã lưu", "Tuỳ chọn"],
  },
  {
    id: "duc",
    locale: "de",
    name: "Đức",
    tagline: "Từ vựng tiếng Đức",
    url: "https://duc.chayla.app",
    glyph: "🇩🇪",
    accent: ["#f5c542", "#b4330f"],
    status: "live",
    description: "Dòng từ vựng tiếng Đức, giải nghĩa bằng tiếng Việt.",
    shots: ["Dòng từ vựng", "Từ đã lưu", "Tuỳ chọn"],
  },
  {
    id: "phap",
    locale: "fr",
    name: "Pháp",
    tagline: "Từ vựng tiếng Pháp",
    url: "https://phap.chayla.app",
    glyph: "🇫🇷",
    accent: ["#4f7ce0", "#1b2f73"],
    status: "live",
    description: "Dòng từ vựng tiếng Pháp, giải nghĩa bằng tiếng Việt.",
    shots: ["Dòng từ vựng", "Từ đã lưu", "Tuỳ chọn"],
  },
  {
    id: "tbn",
    locale: "es",
    name: "TBN",
    tagline: "Từ vựng tiếng Tây Ban Nha",
    url: "https://tbn.chayla.app",
    glyph: "🇪🇸",
    accent: ["#f0a722", "#aa1f1f"],
    status: "live",
    description: "Dòng từ vựng tiếng Tây Ban Nha, giải nghĩa bằng tiếng Việt.",
    shots: ["Dòng từ vựng", "Từ đã lưu", "Tuỳ chọn"],
  },
  {
    id: "hoa",
    locale: "zh",
    name: "Hoa",
    tagline: "Từ vựng tiếng Hoa",
    url: "https://hoa.chayla.app",
    glyph: "🇨🇳",
    accent: ["#e2453c", "#8a1410"],
    status: "live",
    description: "Dòng từ vựng tiếng Hoa, giải nghĩa bằng tiếng Việt.",
    shots: ["Dòng từ vựng", "Từ đã lưu", "Tuỳ chọn"],
  },
  {
    id: "nhat",
    locale: "ja",
    name: "Nhật",
    tagline: "Từ vựng tiếng Nhật",
    url: "https://nhat.chayla.app",
    glyph: "🇯🇵",
    accent: ["#f17c9a", "#9b1535"],
    status: "live",
    description: "Dòng từ vựng tiếng Nhật, giải nghĩa bằng tiếng Việt.",
    shots: ["Dòng từ vựng", "Từ đã lưu", "Tuỳ chọn"],
  },
  {
    id: "han",
    locale: "ko",
    name: "Hàn",
    tagline: "Từ vựng tiếng Hàn",
    url: "https://han.chayla.app",
    glyph: "🇰🇷",
    accent: ["#5aa9e6", "#1b3f8f"],
    status: "live",
    description: "Dòng từ vựng tiếng Hàn, giải nghĩa bằng tiếng Việt.",
    shots: ["Dòng từ vựng", "Từ đã lưu", "Tuỳ chọn"],
  },
];

/** The family, capped so the grid always stays glanceable. */
export const ECOSYSTEM_APPS: readonly EcosystemApp[] = APPS.slice(0, ECOSYSTEM_MAX_APPS);
