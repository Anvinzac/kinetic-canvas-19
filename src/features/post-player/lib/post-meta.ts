/**
 * Post meta: hashtags, view counts, dates, article preview, and share URLs.
 *
 * Exports: getPostHashtags, getPostViewCount, formatCompactCount, getArticlePreview, getPostShareUrl, format*Date*
 * Depends on: lib/canvas CanvasSpec/CanvasLinkPreview, kinetic-text getStableNumber/getWords, Post type
 */

import type { CanvasLinkPreview, CanvasSpec } from "@/features/canvas";
import { getStableNumber, getWords } from "@/features/kinetic-text";
import type { Post } from "../types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "in",
  "is", "it", "its", "of", "on", "or", "so", "the", "to", "you", "your",
]);

/**
 * Compute posthashtags.
 * @param text - text argument
 * @param postType - postType argument
 * @param pages? - pages? argument
 * @returns Computed value
 */
export function getPostHashtags(text: string, postType: string, pages?: string[]): string[] {
  const explicitTags = Array.from(text.matchAll(/#([a-z0-9][a-z0-9_-]{1,24})/gi)).map((match) =>
    normalizeHashtag(match[1]),
  );
  // Never derive a tag from the final page of a multi-page post — it is the
  // reveal/punchline (e.g. a guessing game's answer), and tagging it would spoil
  // the mystery right under the post.
  const tagSource = pages && pages.length > 1 ? pages.slice(0, -1).join(" "): text;
  const textTags = getWords(tagSource)
    .map(normalizeHashtag)
    .filter((tag) => tag.length >= 4 && !STOP_WORDS.has(tag));
  const typeTag = normalizeHashtag(postType);
  const tags = [...explicitTags, ...textTags, typeTag, "kinetic"];
  return Array.from(new Set(tags.filter(Boolean))).slice(0, 3);
}

/**
 * normalizeHashtag helper
 * @param value - value argument
 * @returns Computed value
 */
export function normalizeHashtag(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
}

/**
 * Compute postviewcount.
 * @param post - post argument
 * @param likes - likes argument
 * @param comments - comments argument
 * @returns Computed value
 */
export function getPostViewCount(post: Post, likes: number, comments: number): number {
  const timestamp = new Date(post.created_at).getTime();
  const ageHours = Number.isNaN(timestamp) ? 24 : Math.max(1, (Date.now() - timestamp) / 3_600_000);
  const seed = getStableNumber(post.id);
  const base = 280 + (seed % 6800);
  const recencyLift = Math.round(1800 / Math.sqrt(ageHours));
  return Math.max(24, base + recencyLift + likes * 73 + comments * 41);
}

/**
 * formatCompactCount helper
 * @param count - count argument
 * @returns Computed value
 */
export function formatCompactCount(count: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: count < 10_000 ? 1 : 0,
  }).format(count);
}

/**
 * Compute postshareurl.
 * @param postId - postId argument
 * @returns Computed value
 */
export function getPostShareUrl(postId: string): string {
  if (typeof window === "undefined") return `/p/${postId}`;
  return `${window.location.origin}/p/${postId}`;
}

/**
 * formatShortDateTime helper
 * @param iso - iso argument
 * @returns Computed value
 */
export function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "now";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * formatPostDate helper
 * @param iso - iso argument
 * @returns Computed value
 */
export function formatPostDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "posted";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  "ac.uk",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.uk",
  "com.au",
  "com.br",
  "com.mx",
  "com.sg",
  "com.vn",
  "net.au",
  "org.au",
  "org.uk",
]);

/**
 * Compute articlepreview.
 * @param spec - spec argument
 * @param media - media argument
 * @returns Computed value
 */
export function getArticlePreview(spec: CanvasSpec, media: string[]): CanvasLinkPreview | null {
  if (spec.link?.url) {
    return {
      ...spec.link,
      host: getMainDomainFromUrl(spec.link.url, spec.link.host),
    };
  }
  const url = media[0];
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const title = spec.text.replace(/\s+/g, " ").trim() || "Linked article";
    return {
      url: parsed.toString(),
      host: getMainDomain(parsed.hostname),
      title: title.length > 72 ? `${title.slice(0, 69).trim()}...` : title,
    };
  } catch {
    return null;
  }
}

function getMainDomainFromUrl(url: string, fallbackHost = ""): string {
  try {
    return getMainDomain(new URL(url).hostname);
  } catch {
    return getMainDomain(fallbackHost);
  }
}

function getMainDomain(hostname: string): string {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (!host || host === "localhost" || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return host;

  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;

  const secondLevelSuffix = labels.slice(-2).join(".");
  if (COMMON_SECOND_LEVEL_SUFFIXES.has(secondLevelSuffix) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
}

