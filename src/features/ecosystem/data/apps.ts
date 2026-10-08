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
  /** A paragraph for the store page. MOCK copy. */
  description: string;
  /** Captions for the store page's screenshot frames. No real images exist yet,
   *  so each frame is drawn from the app's own accent and glyph. MOCK. */
  shots: string[];
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
    description:
      "Nhà chung của cả hệ sinh thái Chay Lá. Từ đây bạn mở được mọi app con, theo dõi tiến độ học và nhận thông báo khi có nội dung mới.",
    shots: ["Trang chủ", "Danh sách app", "Hồ sơ của bạn"],
  },
  {
    id: "hieu",
    name: "hiểu.chayLá",
    tagline: "Hiểu sâu câu chữ",
    url: "https://hieu.chayla.app",
    glyph: "💡",
    accent: ["#f0a722", "#c2560f"],
    status: "live",
    description:
      "Đọc hiểu theo từng câu, từng chữ. Mỗi đoạn văn được tách nhỏ, chú giải ngữ pháp và từ vựng ngay tại chỗ, không cần tra từ điển bên ngoài.",
    shots: ["Đoạn văn có chú giải", "Ngân hàng ngữ pháp", "Bài luyện hằng ngày"],
  },
  {
    id: "viec",
    name: "việc.chayLá",
    tagline: "Việc làm, kỹ năng",
    url: "https://viec.chayla.app",
    glyph: "💼",
    accent: ["#3b82f6", "#1e3a8a"],
    status: "live",
    description:
      "Tiếng Anh cho người đi làm: email, họp hành, phỏng vấn và mô tả công việc. Học theo tình huống thật, không học thuộc lòng.",
    shots: ["Mẫu email", "Luyện phỏng vấn", "Từ vựng theo ngành"],
  },
  {
    id: "qua",
    name: "quà.chayLá",
    tagline: "Quà và phần thưởng",
    url: "https://qua.chayla.app",
    glyph: "🎁",
    accent: ["#ec4899", "#86198f"],
    status: "live",
    description:
      "Đổi chuỗi ngày học lấy quà thật. Càng giữ được thói quen lâu, phần thưởng càng lớn — và bạn có thể tặng lại cho bạn bè.",
    shots: ["Kho quà", "Chuỗi ngày học", "Tặng bạn bè"],
  },
];

/** The family, capped so the grid always stays glanceable. */
export const ECOSYSTEM_APPS: readonly EcosystemApp[] = APPS.slice(0, ECOSYSTEM_MAX_APPS);
