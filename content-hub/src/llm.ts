import { z } from "zod";

export interface LlmClient {
  readonly name: string;
  completeJson(prompt: string): Promise<unknown>;
}

export class OpenAiJsonClient implements LlmClient {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    private readonly model = "gpt-4.1-mini",
  ) {}

  async completeJson(prompt: string): Promise<unknown> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You turn source material into short, factual kinetic social posts. Return valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  }
}

export class AnthropicJsonClient implements LlmClient {
  readonly name = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model = "claude-haiku-4-5-20251001",
  ) {}

  async completeJson(prompt: string): Promise<unknown> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content:
              "Return valid JSON only. No markdown fences.\n\n" + prompt,
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "{}";
    return JSON.parse(extractJsonObject(text));
  }
}

export class HeuristicBriefClient implements LlmClient {
  readonly name = "heuristic";

  async completeJson(prompt: string): Promise<unknown> {
    const topic = matchLine(prompt, "Topic") || "Culture";
    const title = matchLine(prompt, "Title") || `${topic} signal`;
    const sourceUrl = matchLine(prompt, "URL") || "";
    const text = (matchBlock(prompt, "Source text") || title).replace(/\s+/g, " ").trim();
    const sentences = splitSentences(text);
    const first = sentences[0] || title;
    const second = sentences.find((s) => s !== first) || `A quick ${topic.toLowerCase()} update worth tracking today.`;
    const third = sentences.find((s) => s !== first && s !== second) || "The bigger signal is still developing.";

    return {
      title,
      sourceUrl,
      pages: [
        shorten(first, 96),
        shorten(second, 96),
        shorten(third, 96),
      ],
      hashtags: [`#${topic.replace(/\s+/g, "")}`, "#KineticBrief"],
      emphasis: pickEmphasis(`${title} ${first}`),
    };
  }
}

export const kineticBriefSchema = z.object({
  title: z.string().min(1).max(140),
  sourceUrl: z.string().url().optional(),
  pages: z.array(z.string().min(8).max(140)).min(2).max(6),
  hashtags: z.array(z.string().min(2).max(32)).min(1).max(5),
  emphasis: z.array(z.string().min(2).max(32)).max(6).optional(),
});

export type KineticBrief = z.infer<typeof kineticBriefSchema>;

function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : "{}";
}

function matchLine(input: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = input.match(new RegExp(`${escaped}:\\s*(.+)`));
  return match?.[1]?.trim() ?? "";
}

function matchBlock(input: string, label: string): string {
  const index = input.indexOf(`${label}:`);
  return index === -1 ? "" : input.slice(index + label.length + 1).trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16);
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const sliced = text.slice(0, max - 1);
  return `${sliced.slice(0, Math.max(0, sliced.lastIndexOf(" ")))}.`;
}

function pickEmphasis(text: string): string[] {
  return Array.from(new Set(text.match(/\b[A-Z][a-z]{4,}\b/g) ?? [])).slice(0, 3);
}
