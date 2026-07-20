# KineMedia architecture (for novices)

This app is a kinetic status composer + feed. Code is organized by **feature**, not by “all hooks in one folder.”

## Where do I change X?

| I want to change… | Edit here |
|-------------------|-----------|
| Feed list / like / comment | `src/features/social/` + `src/features/post-player/` |
| PostCard player UI / layers | `src/features/post-player/components/` |
| PostCard playback / export hooks | `src/features/post-player/hooks/` |
| PostCard pure timing / meta / geometry | `src/features/post-player/lib/` |
| Create studio page shell | `src/features/create-studio/CreateStudioPage.tsx` |
| Create panels / preview UI | `src/features/create-studio/components/` |
| Create composer / publish hooks | `src/features/create-studio/hooks/` |
| Create templates / pages / accents | `src/features/create-studio/lib/` |
| Discover / search / follow / me | `src/features/discovery/` |
| Profile grid / edit profile | `src/features/profile/` |
| Settings preferences UI | `src/features/settings/` |
| Text motion / emphasis / VN lines | `src/features/kinetic-text/` |
| Gradients, serialize, contrast | `src/features/canvas/` |
| Offline demo seed / mock APIs | `src/features/demo/` |
| Demo vs live session flag | `src/features/session/` |
| Embedded admin dashboard / telemetry | `src/features/admin/` (+ `/admin` routes, `MAPPING_NOTES.md`) |
| Shared demo/live branching | `src/shared/api-client/` |
| Shared DTOs (Post, Profile, …) | `src/shared/types/` |
| Route URLs only (thin) | `src/routes/` |

## Folder roles inside a feature

```
features/<name>/
  api/          Query keys, queryOptions, serverFns, prefetch
  components/   UI only (aim ≤ 200 lines)
  hooks/        React state / effects (not pure rules)
  lib/          Pure TypeScript rules (aim ≤ 250 lines, no React)
  types.ts      Feature-local types
```

**Rule of thumb:** if it decides *what* happens (score, paginate, validate), put it in `lib/`. If it decides *how it looks*, put it in `components/`. If it talks to the network or mock store, put it in `api/`.

## Demo vs live

- **Demo:** localStorage session (`features/session`). Data comes from `features/demo` (no Supabase required).
- **Live:** real auth + TanStack `createServerFn` + Supabase.

Prefer branching through:

```ts
import { runDataMode } from "@/shared/api-client";

await runDataMode({
  demo: () => getMockFeed(),
  live: () => getFeed(),
});
```

Do **not** sprinkle `isDemoSession() ? … : …` inside big UI files.

## Complexity budget (hard limits)

| Kind | Max lines |
|------|----------:|
| Route file | 80 |
| Component | 200 (soft 150) |
| `lib/` file | 250 |

Generated / shadcn UI (`src/components/ui/*`, `routeTree.gen.ts`) are exempt.

## Documentation standard

Every feature/shared file should start with a short file header (purpose, exports, depends on). Every exported function should say what it does, `@param`, `@returns` — not just repeat the type name.

## Smoke checklist after structural changes

1. Demo: splash → feed scroll → like → comment → create publish → appear in feed  
2. Discover search + open a profile  
3. Settings toggles + edit profile  
4. Live (if logged in): auth → feed → post permalink → sign out  
