# Content Hub

An **independent** content-feeder service. It produces normalized content items —
vocabulary today, news / recipes / job notices next — and delivers them into the
app's `agent_content_items` queue, where the app's scheduled bots drain them.

It depends on the app through exactly **one contract** (`src/contract.ts`) and one
**sink**. It imports no app code, no TanStack, and (unless you pick the Supabase
sink) no Supabase. You can host it anywhere and swap the backend without touching
any adapter.

## Architecture

```
 source adapters        runner          sink
 ┌─────────────┐                     ┌──────────────────┐
 │ vocabulary  │─┐                   │ SupabaseRpcSink   │→ enqueue RPC ─┐
 │ news (todo) │─┤─ produce() ─ N ─→ │   or              │               │  app's
 │ recipes …   │─┘   ContentItem[]   │ HttpIngestSink    │→ /api/...  ───┤  queue
 └─────────────┘                     └──────────────────┘               ▼
                                                          agent_content_items (ready)
                                                                  │ 3×/day
                                                          publish_*_bot_post → posts
```

- **`SourceAdapter`** (`src/sources/types.ts`) — one per content type. `produce(count)`
  returns normalized `ContentItem`s. Adding a type = adding one file.
- **`Sink`** (`src/sinks/types.ts`) — where items go. `SupabaseRpcSink` (default) or
  `HttpIngestSink` (app-owned endpoint). Swap with the `SINK` env var.
- **`ContentItem`** (`src/contract.ts`) — the stable seam: `{ sourceKey, itemType,
  contentKey, payload, availableAt? }`. The only thing both sides agree on.

The queue dedups on `(source_key, content_key)`, so delivery is idempotent — the Hub
never needs perfect local memory.

## Run

```bash
cp .env.example .env      # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install

# one-shot (use this from platform cron): produce + deliver once
npm run run               # all sources
npm run run -- vocabulary.en_vi 5   # one source, 5 items

# long-running scheduler (node-cron, for a persistent host)
npm run serve
```

## Add a new content type (news, recipes, jobs, …)

1. Register the source in the DB once: insert a row into `agent_content_sources`
   (`key`, `label`, `item_type`) and add the source to the app's ingest allowlist
   (`ALLOWED_SOURCE_KEYS` in `src/lib/agent-content.functions.ts`).
2. Copy `src/sources/vocabulary.ts` → `src/sources/news.ts`, implement `produce()`
   to return `ContentItem`s with your own `payload` shape.
3. Add it to `buildRegistry()` in `src/config.ts` with a `cron` + `batchSize`.
4. On the **app side**, add a consumer/renderer for the new `item_type` that turns
   the payload into a canvas (see "Consumer" below).

That's it — the runner, sinks, scheduler, and transport are reused unchanged.

## Consumer (app side) — render per `item_type`

The Hub only produces data. Turning a payload into a kinetic post is the app's job.
Vocabulary already has a renderer (`publish_vocabulary_bot_post`). As content types
multiply, move rendering out of plpgsql into a TypeScript publisher that reuses the
frontend's `serializeCanvas` + pagination, keyed on `item_type` — keep the SQL layer
to "claim + insert".

## Hosting

Built to be portable (Dockerfile included):

- **Persistent host (recommended):** Railway, Fly.io, or Render — run `serve`.
- **Serverless cron:** Cloudflare Workers Cron, GitHub Actions, or AWS Lambda +
  EventBridge — trigger `run` on a schedule (no always-on process needed).

Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AGENT_INGEST_API_KEY`)
live only in the host's env — never in the app bundle.

## Environment

See `.env.example`. Key switches: `SINK` (supabase|http), `VOCAB_GENERATOR`
(curated|claude), `VOCAB_CRON`, `VOCAB_BATCH`.
