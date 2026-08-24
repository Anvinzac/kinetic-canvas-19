# KineMedia (kinetic-canvas-19)

TanStack Start app for kinetic status posts: compose, publish, and play typography-first statuses.

## Quick start

```bash
npm install
npm run dev
```

Use **Continue as demo** on `/auth` to explore without Supabase.

## Admin dashboard

Embedded at `/admin` (telemetry contract under `/api/admin/telemetry/*`).

- Demo: set `VITE_DEMO_ADMIN=1`, start a demo session, open `/admin`.
- Live: set `profiles.is_admin = true` or `ADMIN_USER_IDS` (auth user UUIDs).
- Mapping judgments: [`MAPPING_NOTES.md`](./MAPPING_NOTES.md)

## Auto-posting (vocabulary bot)

Scheduled content: **content-hub** fills the queue → Supabase cron publishes as `do_chu_bot`.

**Lovable / credentials map:** [`docs/lovable-auto-posting-credentials.md`](./docs/lovable-auto-posting-credentials.md)  
Feed contract: [`docs/agent-content-service.md`](./docs/agent-content-service.md)  
Hub package: [`content-hub/`](./content-hub/)

## For developers (especially new contributors)

Read **[ARCHITECTURE.md](./ARCHITECTURE.md)** first. It explains:

- which `src/features/*` folder owns each screen
- demo vs live data
- the file-size budget (routes ≤ 80, components ≤ 200, lib ≤ 250)

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Vite/TanStack Start server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Related

- Content ingest worker: [`content-hub/`](./content-hub/) (separate package)
