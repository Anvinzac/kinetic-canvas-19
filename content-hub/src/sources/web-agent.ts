import { createHash } from "node:crypto";
import { normalizeContentKey, type ContentItem } from "../contract.ts";
import type { KineticBrief, LlmClient } from "../llm.ts";
import { kineticBriefSchema } from "../llm.ts";
import type { ProduceContext, SourceAdapter } from "./types.ts";

export interface WebSourceTarget {
  label: string;
  url: string;
}

export interface WebAgentTopic {
  sourceKey: string;
  topic: string;
  itemType: "web_brief";
  language: "en" | "vi";
  style: "energetic" | "poetic" | "editorial";
  targets: WebSourceTarget[];
}

interface ExtractedPage {
  title: string;
  url: string;
  text: string;
}

const MAX_SOURCE_CHARS = 5000;

export class WebAgentSource implements SourceAdapter {
  readonly itemType = "web_brief";

  constructor(
    readonly topicConfig: WebAgentTopic,
    private readonly llm: LlmClient,
  ) {}

  get sourceKey(): string {
    return this.topicConfig.sourceKey;
  }

  async produce(count: number, ctx: ProduceContext): Promise<ContentItem[]> {
    const targets = shuffle(this.topicConfig.targets).slice(0, Math.max(count * 2, count));
    const items: ContentItem[] = [];

    for (const target of targets) {
      if (items.length >= count) break;

      try {
        const page = await fetchAndExtract(target.url);
        if (page.text.length < 200) {
          ctx.log.warn("skipping page with too little extractable text", { url: target.url });
          continue;
        }

        const brief = await this.buildBrief(page);
        items.push(this.toContentItem(brief, page));
      } catch (err) {
        ctx.log.warn("web target failed", { label: target.label, url: target.url, error: String(err) });
      }
    }

    return items;
  }

  private async buildBrief(page: ExtractedPage): Promise<KineticBrief> {
    const json = await this.llm.completeJson(
      [
        `Topic: ${this.topicConfig.topic}`,
        `Language: ${this.topicConfig.language}`,
        `Style: ${this.topicConfig.style}`,
        `Title: ${page.title}`,
        `URL: ${page.url}`,
        "",
        "Create one kinetic post from this source.",
        "Rules:",
        "- Use only facts supported by the source text.",
        "- Return JSON with title, sourceUrl, pages, hashtags, emphasis.",
        "- pages: 3 to 5 short sentences, each suitable for a 9:16 kinetic status.",
        "- Keep each page below 14 words when possible.",
        "- hashtags: concise, no spaces.",
        "- emphasis: exact words or short phrases that appear in pages.",
        "",
        `Source text: ${page.text.slice(0, MAX_SOURCE_CHARS)}`,
      ].join("\n"),
    );

    const jsonObject = typeof json === "object" && json !== null ? json : {};
    const parsed = kineticBriefSchema.parse({
      ...jsonObject,
      sourceUrl: page.url,
    });

    return parsed;
  }

  private toContentItem(brief: KineticBrief, page: ExtractedPage): ContentItem {
    const keyBase = `${page.url}:${brief.title}:${brief.pages.join("|")}`;

    return {
      sourceKey: this.sourceKey,
      itemType: this.itemType,
      contentKey: normalizeContentKey(`${this.topicConfig.topic}:${hashKey(keyBase)}`),
      payload: {
        topic: this.topicConfig.topic,
        title: brief.title,
        source_url: page.url,
        source_domain: mainDomain(page.url),
        pages: brief.pages,
        hashtags: brief.hashtags,
        emphasis: brief.emphasis ?? [],
        style: this.topicConfig.style,
        language: this.topicConfig.language,
      },
    };
  }
}

export const DEFAULT_WEB_AGENT_TOPICS: WebAgentTopic[] = [
  {
    sourceKey: "web.sports",
    topic: "Sports",
    itemType: "web_brief",
    language: "en",
    style: "energetic",
    targets: [
      { label: "ESPN", url: "https://www.espn.com/" },
      { label: "The Athletic", url: "https://www.nytimes.com/athletic/" },
      { label: "BBC Sport", url: "https://www.bbc.com/sport" },
    ],
  },
  {
    sourceKey: "web.entertainment",
    topic: "Entertainment",
    itemType: "web_brief",
    language: "en",
    style: "energetic",
    targets: [
      { label: "Variety", url: "https://variety.com/" },
      { label: "Billboard", url: "https://www.billboard.com/" },
      { label: "The Hollywood Reporter", url: "https://www.hollywoodreporter.com/" },
    ],
  },
  {
    sourceKey: "web.technology",
    topic: "Technology",
    itemType: "web_brief",
    language: "en",
    style: "editorial",
    targets: [
      { label: "The Verge", url: "https://www.theverge.com/" },
      { label: "TechCrunch", url: "https://techcrunch.com/" },
      { label: "Wired", url: "https://www.wired.com/" },
    ],
  },
  {
    sourceKey: "web.food",
    topic: "Food",
    itemType: "web_brief",
    language: "en",
    style: "poetic",
    targets: [
      { label: "Eater", url: "https://www.eater.com/" },
      { label: "Food52", url: "https://food52.com/" },
      { label: "Bon Appetit", url: "https://www.bonappetit.com/" },
    ],
  },
  {
    sourceKey: "web.travel",
    topic: "Travel",
    itemType: "web_brief",
    language: "en",
    style: "poetic",
    targets: [
      { label: "Lonely Planet", url: "https://www.lonelyplanet.com/" },
      { label: "Condé Nast Traveler", url: "https://www.cntraveler.com/" },
      { label: "Travel + Leisure", url: "https://www.travelandleisure.com/" },
    ],
  },
  {
    sourceKey: "web.design",
    topic: "Design",
    itemType: "web_brief",
    language: "en",
    style: "editorial",
    targets: [
      { label: "Dezeen", url: "https://www.dezeen.com/" },
      { label: "Design Milk", url: "https://design-milk.com/" },
      { label: "Smashing Magazine", url: "https://www.smashingmagazine.com/" },
    ],
  },
];

export function parseWebAgentTopics(raw: string | undefined): WebAgentTopic[] {
  if (!raw) return DEFAULT_WEB_AGENT_TOPICS;
  const parsed = JSON.parse(raw) as WebAgentTopic[];
  return parsed.map((topic) => ({
    ...topic,
    itemType: "web_brief",
    targets: topic.targets.filter((target) => /^https?:\/\//.test(target.url)),
  }));
}

async function fetchAndExtract(url: string): Promise<ExtractedPage> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "KineMediaContentHub/0.1 (+https://example.com; bot content research; contact site owner to opt out)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const title = extractTitle(html) || mainDomain(url);
  const text = extractReadableText(html);
  return { title, url, text };
}

function extractTitle(html: string): string {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
}

function extractReadableText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  return decodeHtml(withoutNoise.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
}

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function mainDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".");
    return parts.length > 2 ? parts.slice(-2).join(".") : host;
  } catch {
    return "";
  }
}

function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 24);
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}
