# KineMedia (kinetic-canvas-19)

TanStack Start app for kinetic status posts: compose, publish, and play typography-first statuses.

## Quick start

```bash
npm install
npm run dev
```

Use **Continue as demo** on `/auth` to explore without Supabase.

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
