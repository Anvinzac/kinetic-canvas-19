# Mapping notes — kinetic-canvas admin telemetry

App slug: `kinetic-canvas`  
Timezone: store UTC; render admin local TZ in the UI.  
Rollup date key: UTC `YYYY-MM-DD`.

## Registration (`user.registered`)

- Source: `profiles.created_at` when a non-system profile is inserted (`ensureProfile` / backfill).
- **Exclude** `profiles.is_system = true` from `new_users` (bots/pipeline accounts are not human registrations).

## Content (`content.created` / `updated` / `deleted`)

| entity_type | Source |
|-------------|--------|
| `post` | `posts` insert (`createPost` / demo `addMockPost`) |
| `comment` | `comments` insert (`addComment` / demo) |
| `agent_content` | when an `agent_content_items` row is marked used/posted (backfill + future hooks) |

- `content.updated`: emitted on profile display_name/bio/avatar updates when those mutations run.
- `content.deleted`: not emitted in v1 (no hard-delete user path).

## Active user (daily rollup)

A profile counts as active on a UTC day if they created ≥1 post **or** ≥1 comment that day.  
Emit-time bump increments `active_users` by at most 1 per actor per day (best-effort; nightly reconcile can refine later).

## Links (Section 5.4) — applicable

- Each post is a shareable link at `/p/$postId`.
- `link.created` on post create.
- `link.interacted` on like (like only, not unlike) and on comment.
- Interaction types in metadata: `like` | `comment` | `share` (share reserved).

## Errors (`error.reported`)

- User-meaningful signal: client/React boundary failures via `reportLovableError` persisted to `telemetry_events` + `admin_error_reports`.
- Not raw infrastructure 5xx logs (those feed health latency/error_rate separately when available).
- Status write allowed: `new` → `acknowledged` → `resolved`.

## System health

- DB ping latency (p50/p95 approximated from recent health samples + current ping).
- `error_rate_pct`: `error.reported` count / (estimated requests) trailing 5 minutes — when request totals are unknown, use errors vs max(errors, 1) soft rate from event volume.
- `queue_depth`: count of `agent_content_items` with status pending/queued (not used).
- DB connection pool metrics: **N/A** (do not hardcode zeros in UI — omit fields).

## Backfill

- One-shot from existing `profiles` (non-system), `posts`, `likes`, `comments` into events + daily rollups.
- History starts from earliest real row; no invented pre-history.

## Admin auth

- `profiles.is_admin` OR `ADMIN_USER_IDS` env (comma-separated auth user UUIDs).
- Demo: admin when `VITE_DEMO_ADMIN=1` (or `true`) while a demo session is active.
