/**
 * The Chay Lá app family, as shown in the ecosystem drawer.
 *
 * MOCK DATA. The URLs are real; the names, taglines and accents are placeholders
 * standing in until each app's own metadata is available. Replace the copy rather
 * than the shape.
 *
 * This app (anh.chayla.app) is deliberately absent — the drawer offers somewhere
 * else to go, so listing the page you are already on is noise.
 *
 * Exports: ECOSYSTEM_APPS, ECOSYSTEM_MAX_APPS, EcosystemApp
 * Depends on: none (leaf module)
 */

export type EcosystemApp = {
  /** Stable key; also the subdomain label. */
  id: string;
  /**
   * Shown on the tile. Keep it short: tiles sit two-up on a phone, and anything
   * past ~12 characters is ellipsised, which made every "Chay Lá · X" name read
   * as the same truncated string. The subdomain form doubles as the address.
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
};

/**
 * The drawer is a shortcut, not a directory: past about ten tiles it stops being
 * scannable at a glance and the grid starts to scroll on a phone.
 */
export const ECOSYSTEM_MAX_APPS = 10;

const APPS: EcosystemApp[] = [
  {
    id: "chayla",
    name: "chayLá",
    tagline: "Trang chủ cả nhà",
    url: "https://chayla.app",
    glyph: "🌿",
    accent: ["#1f9e5a", "#0d6b3c"],
    status: "live",
  },
  {
    id: "hieu",
    name: "hiểu.chayLá",
    tagline: "Hiểu sâu câu chữ",
    url: "https://hieu.chayla.app",
    glyph: "💡",
    accent: ["#f0a722", "#c2560f"],
    status: "live",
  },
  {
    id: "viec",
    name: "việc.chayLá",
    tagline: "Việc làm, kỹ năng",
    url: "https://viec.chayla.app",
    glyph: "💼",
    accent: ["#3b82f6", "#1e3a8a"],
    status: "live",
  },
  {
    id: "qua",
    name: "quà.chayLá",
    tagline: "Quà và phần thưởng",
    url: "https://qua.chayla.app",
    glyph: "🎁",
    accent: ["#ec4899", "#86198f"],
    status: "live",
  },
];

/** The family, capped so the grid always stays glanceable. */
export const ECOSYSTEM_APPS: readonly EcosystemApp[] = APPS.slice(0, ECOSYSTEM_MAX_APPS);
