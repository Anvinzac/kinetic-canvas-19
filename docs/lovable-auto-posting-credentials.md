# Lovable: Auto-posting credentials — where each secret goes

> **UPDATE (self-contained pipeline — no external credentials needed).**
> The producer now runs inside the app. `pg_cron` job
> `kinetic-vocabulary-refill-daily` (22:30 UTC) calls
> `public.request_vocabulary_refill()`, which tops the queue up only when fewer
> than 9 `ready` items remain by POSTing to `/api/public/vocabulary-refill`.
> That route generates fresh words with Lovable AI (`LOVABLE_API_KEY`) and
> enqueues them with the service role. The shared token lives in
> `public.internal_api_keys` (name `vocabulary_refill`) — the only copy, so no
> secret has to be mirrored anywhere.
>
> **Nothing below is required anymore.** GitHub Actions / `content-hub` /
> `SYSTEM_BOT_*` stay supported as an *optional* external producer.
> Root cause of the stall these docs were meant to unblock: the curated
> generator held only 8 words, all already `used`, so the queue was permanently
> empty even though the system-bot login and the 3×/day publish cron were fine.

**Audience:** Lovable Cloud / anyone wiring the scheduled vocabulary content generator  
**Goal:** `content-hub` fills `agent_content_items` → Supabase `pg_cron` publishes as `do_chu_bot` 3×/day (Vietnam time).

> Source of truth for Hub env names: [`content-hub/src/config.ts`](../content-hub/src/config.ts).  
> Do **not** follow old docs that only mention `SUPABASE_SERVICE_ROLE_KEY` for the Hub sink — that path is outdated.

---

## Pipeline (what needs credentials)

```
┌─────────────────────┐     enqueue RPC      ┌──────────────────────┐     pg_cron 3×/day
│ content-hub         │ ──────────────────▶  │ agent_content_items  │ ──────────────────▶ posts
│ (GitHub Actions or  │  system-bot session  │ (ready → used)       │  publish_vocabulary
│  local / Railway)   │                      │                      │  _bot_post()
└─────────────────────┘                      └──────────────────────┘
```

Three places hold secrets:

| Place | What it powers |
|-------|----------------|
| **A. Lovable Cloud / app env** | TanStack app (auth, feed, serverFns, optional HTTP ingest) |
| **B. GitHub Actions secrets** | Daily `content-hub-run` producer (already used in prod) |
| **C. Supabase Auth + SQL** | System bot user + `is_system` flag + publish cron |

---

## A. Lovable Cloud / main app environment

Set these in **Lovable Cloud → project secrets / Connect Supabase** (and mirror in local root `.env` for `npm run dev`).

| Variable | Required? | Where to get it | Put in |
|----------|-----------|-----------------|--------|
| `SUPABASE_URL` | **Yes** | Lovable → Connect Supabase, or Supabase Project Settings → API → Project URL | Lovable secrets + root `.env` |
| `SUPABASE_PUBLISHABLE_KEY` | **Yes** | Same → `anon` / `public` key (JWT) | Lovable secrets + root `.env` |
| `VITE_SUPABASE_URL` | **Yes** (browser) | Same URL as `SUPABASE_URL` | Lovable / Vite env |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Yes** (browser) | Same as publishable/anon key | Lovable / Vite env |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** for server admin paths | Supabase → API → `service_role` (secret) | Lovable **server** secrets only — never `VITE_*` |
| `AGENT_INGEST_API_KEY` | Only if Hub uses `SINK=http` | Generate a long random string (32+ chars) | Lovable server + Hub env (same value) |
| `VITE_DEMO_ADMIN` | Optional | `1` to allow demo `/admin` | Local / Lovable client env |
| `ADMIN_USER_IDS` | Optional | Comma-separated auth UUIDs | Lovable server |

### Lovable checklist (app)

1. Open the project in Lovable → **Connect Supabase** (or confirm already connected).
2. Verify server env includes **`SUPABASE_SERVICE_ROLE_KEY`**. If server logs say *“Connect Supabase in Lovable Cloud”* / missing service role, paste the `service_role` key from the Supabase dashboard.
3. Mirror publishable URL/key into `VITE_*` if the client cannot read non-Vite names.
4. Leave `AGENT_INGEST_API_KEY` empty unless you deliberately switch Hub to HTTP sink.

---

## B. GitHub Actions secrets (content-hub producer)

Repo → **Settings → Secrets and variables → Actions**.  
Workflow: [`.github/workflows/content-hub-run.yml`](../.github/workflows/content-hub-run.yml) (daily ~22:15 UTC).

### Required for default path (`SINK=supabase`, `VOCAB_GENERATOR=curated`)

| Secret name | Required? | Value | Same as… |
|-------------|-----------|-------|----------|
| `SUPABASE_URL` | **Yes** | Project URL | App `SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | **Yes** | anon/public JWT | App `SUPABASE_PUBLISHABLE_KEY` (same string, different name) |
| `SYSTEM_BOT_EMAIL` | **Yes** | Auth user email created in section C | — |
| `SYSTEM_BOT_PASSWORD` | **Yes** | That user’s password | — |

### Optional

| Secret | When needed |
|--------|-------------|
| `SINK` | Set to `http` only if using HTTP ingest (then also `INGEST_URL` + `AGENT_INGEST_API_KEY`) |
| `VOCAB_GENERATOR` | Set to `claude` to use LLM vocab (then `ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL`) |
| `ANTHROPIC_API_KEY` | Claude vocab generator |
| `VOCAB_CRON` / `VOCAB_BATCH` | Override producer cadence/batch (local `serve` / if workflow passes them) |

**Do not** put `SUPABASE_SERVICE_ROLE_KEY` in GitHub for the default Hub sink — Hub logs in as the system bot with the anon key.

---

## C. Supabase: create system bot + verify cron

### C1. Create Auth user (Lovable Auth UI or Supabase Authentication → Users)

1. Create user with email + password, e.g. `system-bot@yourdomain.com`.
2. Save email/password → these become `SYSTEM_BOT_EMAIL` / `SYSTEM_BOT_PASSWORD` (GitHub + local Hub `.env`).

### C2. Mark profile as system (SQL Editor)

```sql
-- After the auth user exists and has a profiles row (sign-in once or ensureProfile):
UPDATE public.profiles
SET is_system = true
WHERE auth_user_id = (
  SELECT id FROM auth.users
  WHERE email = 'system-bot@yourdomain.com'  -- ← your email
);

-- Confirm
SELECT id, username, is_system, auth_user_id
FROM public.profiles
WHERE is_system = true;
```

If no profile row yet: sign in once as that user in the app, or insert a profile linked to `auth.users.id`.

### C3. Confirm publisher bot + cron

```sql
-- Vocabulary publisher identity
SELECT id, username, is_system FROM public.profiles WHERE username = 'do_chu_bot';

-- Cron should be active (3×/day UTC → ~08:00 / 14:00 / 20:00 Vietnam)
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'kinetic-vocabulary-bot-3x-daily';

-- Queue health
SELECT status, count(*)
FROM public.agent_content_items
WHERE source_key = 'vocabulary.en_vi'
GROUP BY 1
ORDER BY 1;
```

If cron is missing/inactive, re-apply migrations under `supabase/migrations/` (especially vocabulary cron repair + scope-to-vocabulary).

---

## D. Local Content Hub (optional)

Only needed to produce from your machine (prod already uses GitHub Actions).

```bash
cd content-hub
cp .env.example .env
# edit .env — see table below
npm install
npm run run
```

| Variable | Required for `SINK=supabase` | Notes |
|----------|------------------------------|-------|
| `SINK` | No (default `supabase`) | `supabase` or `http` |
| `SUPABASE_URL` | **Yes** | Same project |
| `SUPABASE_ANON_KEY` | **Yes** | = publishable/anon key |
| `SYSTEM_BOT_EMAIL` | **Yes** | Section C |
| `SYSTEM_BOT_PASSWORD` | **Yes** | Section C |
| `VOCAB_GENERATOR` | No (default `curated`) | `curated` needs no API key |
| `ANTHROPIC_API_KEY` | If `claude` | Anthropic console |
| `INGEST_URL` + `AGENT_INGEST_API_KEY` | If `SINK=http` | Must match Lovable app |

---

## Quick “where do I paste this?” map

| Credential from Supabase / Auth | Lovable app | GitHub Actions | `content-hub/.env` |
|---------------------------------|-------------|----------------|--------------------|
| Project URL | `SUPABASE_URL`, `VITE_SUPABASE_URL` | `SUPABASE_URL` | `SUPABASE_URL` |
| anon / publishable key | `SUPABASE_PUBLISHABLE_KEY`, `VITE_…` | `SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` |
| service_role key | `SUPABASE_SERVICE_ROLE_KEY` only | — | — |
| System bot email | — | `SYSTEM_BOT_EMAIL` | `SYSTEM_BOT_EMAIL` |
| System bot password | — | `SYSTEM_BOT_PASSWORD` | `SYSTEM_BOT_PASSWORD` |
| Random ingest API key | `AGENT_INGEST_API_KEY` (if HTTP) | same (if HTTP) | same (if HTTP) |
| Anthropic key | — | if Claude vocab | if Claude vocab |

---

## Smoke test

1. **Producer:** Actions → `content-hub-run` → Run workflow (or `cd content-hub && npm run run`). Expect success; queue `ready` count increases.
2. **Consumer:** After a Vietnam slot (or `SELECT public.publish_vocabulary_bot_post(now());` as a privileged role), a new `do_chu_bot` post appears in the feed.
3. **App:** Live login still works; no console errors about missing Supabase env.

---

## Common failures

| Symptom | Likely missing |
|---------|----------------|
| Hub: `Missing required environment variable: SUPABASE_ANON_KEY` | GitHub/local Hub secret name wrong (use `SUPABASE_ANON_KEY`, not only publishable name) |
| Hub: `auth failed` | Wrong `SYSTEM_BOT_*` or user not confirmed |
| Hub enqueue 401/403 | Profile not `is_system = true`, or RLS/migrations not applied |
| App: Connect Supabase / missing service role | `SUPABASE_SERVICE_ROLE_KEY` not in Lovable server env |
| Cron runs but no posts | Empty `ready` queue, or slot already published today |
| Docs say use service_role for Hub curl | Outdated — prefer system-bot session (see [`agent-content-service.md`](./agent-content-service.md)) |

---

## Related files

- Hub config: [`content-hub/src/config.ts`](../content-hub/src/config.ts)
- Hub env template: [`content-hub/.env.example`](../content-hub/.env.example)
- App ingest (HTTP path): [`src/lib/agent-content.functions.ts`](../src/lib/agent-content.functions.ts)
- Feed contract overview: [`docs/agent-content-service.md`](./agent-content-service.md)
- GH workflow: [`.github/workflows/content-hub-run.yml`](../.github/workflows/content-hub-run.yml)
