/**
 * Map the visited address to the answer language. Vietnamese UI never varies; only the
 * deck and the page title do. Unknown hosts (preview, localhost, IPs, anh.*) fall back to
 * English and never throw. Host is client-controlled: use it only to pick public content.
 *
 * Exports: TargetLocale, resolveTarget, siteTitle
 */
export type TargetLocale = "en" | "zh" | "ko" | "ja";

const SUBDOMAINS: Record<string, TargetLocale> = {
  hoa: "zh",
  han: "ko",
  nhat: "ja",
  // Punycode forms of hàn / nhật, in case those IDN addresses are attached.
  "xn--hn-ula": "ko",
  "xn--nht-xpa": "ja",
};

/** @param host Host header or location.host (may carry a port). @returns The deck locale. */
export function resolveTarget(host: string | null | undefined): TargetLocale {
  if (!host) return "en";
  const name = host.trim().toLowerCase().replace(/:\d+$/, "");
  const first = name.split(".")[0] ?? "";
  return SUBDOMAINS[first] ?? "en";
}

const TITLES: Record<TargetLocale, string> = {
  en: "Chay Lá - Anh",
  zh: "hoa.chayLá",
  ko: "hàn.chayLá",
  ja: "nhật.chayLá",
};

/** @param locale Deck locale. @returns Page title for that address. */
export function siteTitle(locale: TargetLocale): string {
  return TITLES[locale];
}
