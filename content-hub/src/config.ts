import type { Logger } from "./logger.ts";
import type { Sink } from "./sinks/types.ts";
import { SupabaseRpcSink } from "./sinks/supabase-rpc.ts";
import { HttpIngestSink } from "./sinks/http-ingest.ts";
import type { SourceAdapter } from "./sources/types.ts";
import {
  CuratedVocabularyGenerator,
  ClaudeVocabularyGenerator,
  VocabularySource,
  type VocabularyGenerator,
} from "./sources/vocabulary.ts";

export interface ScheduledSource {
  adapter: SourceAdapter;
  /** node-cron expression (UTC). The producer tops up the queue on this cadence. */
  cron: string;
  /** How many fresh items to generate per run. */
  batchSize: number;
}

export interface Registry {
  sink: Sink;
  sources: ScheduledSource[];
}

export function buildRegistry(log: Logger): Registry {
  const sink = buildSink(log);
  const sources: ScheduledSource[] = [
    {
      adapter: new VocabularySource(buildVocabularyGenerator(log)),
      // Produce nightly; the consumer drains 3×/day, so a small daily batch keeps
      // the queue buffered. Override with VOCAB_CRON / VOCAB_BATCH.
      cron: env("VOCAB_CRON", "0 22 * * *"),
      batchSize: intEnv("VOCAB_BATCH", 5),
    },
    // Add news / recipes / jobs here: one more ScheduledSource per content type.
  ];
  return { sink, sources };
}

function buildSink(log: Logger): Sink {
  const kind = env("SINK", "supabase");
  if (kind === "http") {
    const sink = new HttpIngestSink(requireEnv("INGEST_URL"), requireEnv("AGENT_INGEST_API_KEY"));
    log.info("sink configured", { sink: sink.name });
    return sink;
  }
  const sink = new SupabaseRpcSink(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
  log.info("sink configured", { sink: sink.name });
  return sink;
}

function buildVocabularyGenerator(log: Logger): VocabularyGenerator {
  if (env("VOCAB_GENERATOR", "curated") === "claude") {
    const gen = new ClaudeVocabularyGenerator(requireEnv("ANTHROPIC_API_KEY"), env("CLAUDE_MODEL", "claude-haiku-4-5-20251001"));
    log.info("vocabulary generator", { generator: gen.name, model: env("CLAUDE_MODEL", "claude-haiku-4-5-20251001") });
    return gen;
  }
  const gen = new CuratedVocabularyGenerator();
  log.info("vocabulary generator", { generator: gen.name });
  return gen;
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function intEnv(name: string, fallback: number): number {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) ? v : fallback;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}
