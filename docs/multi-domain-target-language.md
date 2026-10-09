# One deployment, many domains: target language from the Host header

**Status: implementation handoff, deliberately deferred to roughly January 2027.** The feed
teaches English answers to Vietnamese readers. The plan is to keep the Vietnamese side
exactly as it is and swap the ANSWER language per domain — `han.chayla.app` serves a Korean
deck, `nhat.chayla.app` a Japanese one — so each audience gets its own memorable URL while
there is still one repository, one deployment and one place to fix a bug.

Nothing here is scheduled. Written 2026-10-09, after tracing the live data path and
confirming the hosting constraints. The deck work itself is gated on
[cjk-korean-hint-equivalents.md](./cjk-korean-hint-equivalents.md); read that first.

## The axis, stated precisely

Two independent variables, and only one of them moves:

|                                 | varies per domain?                 |
| ------------------------------- | ---------------------------------- |
| Hint / UI language (Vietnamese) | **no** — byte-identical everywhere |
| Target language (the answer)    | **yes** — en / ko / ja / zh        |

So `defVi`, `leadVi`, `anticipateVi`, `usageVi` and all 45 files carrying hardcoded
Vietnamese stay untouched. What generalises is the English side: `word`, `ipa`,
`usage[].en`, and `LearningStage.lang` (currently a closed `"vi" | "en"` union,
`lib/stages.ts:19`).

Because the Vietnamese UI is identical across variants, there is no translation divergence
to justify separate repositories. The variants differ in a data file and a script strategy.

## The decision, and what was ruled out

Two shapes were considered:

- **A — one project, many custom domains.** One deployment; server reads the request host
  and picks the dataset per request.
- **B — one repo, several projects.** Same repo deployed N times, each with its own domain
  and a build-time `VITE_TARGET_LANG` selecting the dataset.

**B was ruled out by the platform, not by preference.** B is the simpler engineering (no
runtime plumbing, no cache keying, each bundle carries only its own deck) and was the
original recommendation. It does not work on Lovable.

Reported by Lovable on 2026-10-09, against a Pro plan — **re-confirm before building, plans
and platforms change**:

| Question                               | Answer                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Multiple custom domains on one project | Yes. No documented limit, no per-domain fee.                                             |
| Several projects from the same repo    | **No.** Git sync links one project to one repo; copies must be remixed and then drift.   |
| Per-project build-time `VITE_*`        | **No.** `VITE_*` lives in the committed `.env`; Secrets are server-side, not build-time. |
| Subdomain-only attach                  | Yes. Apex may live elsewhere.                                                            |
| `Host` header in server handlers       | Yes. Nitro/TanStack handlers receive the full `Request`.                                 |

Rows 2 and 3 are what kill B. Option A needs no per-deployment environment at all, since the
locale arrives with the request.

### DNS recipe

`anh.chayla.app` is already attached this way and is the working reference. For each new
subdomain: an `A` record to `185.158.133.1` (or a CNAME setup behind a proxy), plus the
`_lovable` TXT verification record. TLS is issued automatically after verification.

**Unset the primary domain.** This is the single configuration step most likely to waste a
day. Lovable designates one domain as primary and 301-redirects the others to it. Leave that
in place and every domain serves the primary's deck, the `Host` branch never fires, and it
looks like the routing code is broken when the request never arrived.

## The current data path

Traced 2026-10-09:

```
browser  fetch("/api/public/vocabulary?…")        ← RELATIVE url
      →  routes/api/public/vocabulary.ts:6        ← already receives `request`
      →  api/endpoint.server.ts  vocabularyResponse(request)
      →  api/catalog.server.ts   readVocabularyPage()
      →  lib/catalog-source.ts                    ← ONE catalog, baked at build time
```

Two properties make A cheap:

- The client fetches by **relative URL**, so a page served from `han.chayla.app` already
  calls that host's own API. No client change is needed for the feed.
- The route handler already passes `request` into the endpoint, so the hostname is in scope
  at exactly the boundary that reads the catalog. Nothing new has to be plumbed into routing.

The blocker is `lib/catalog-source.ts`: a module-level constant merging
`data/catalog.json` with an eager `import.meta.glob` of `data/packs/*.json`. One catalog per
bundle.

## What to implement

### Phase 1 — the seam (safe to land before any second deck exists)

1. **Host → target resolver.** A leaf module mapping hostname to target language. It must
   tolerate a port (`localhost:5195`), Lovable preview hostnames, uppercase, a bare IP, and
   a missing header. **Unknown host returns today's deck and never throws** — a resolver
   that throws on an unrecognised host breaks dev and preview while production looks fine.
2. **Unit test for the resolver**, covering the real domain, an unknown host, a host with a
   port, and an absent header. This matters more than usual: with one dataset the only path
   that can be exercised is the fallback, so the N>1 branch would otherwise ship untested.
3. **Fix the `pools` cache key.** `api/catalog.server.ts:37` keys on
   `${topic}:${level}:${difficulty}` with no revision or locale. Correct today with one
   catalog; the moment a second deck exists it hands one language's word indices to another
   language's request. `orders` is already safe — its key includes `catalog.revision`
   (`catalog.server.ts:86`). Add the revision to the pools key.

Phase 1 changes no behaviour and removes the one trap that would otherwise surface as
"sometimes the wrong words appear" rather than as a clean failure.

### Phase 2 — when a second deck exists

4. **Locale-key the catalog.** `lib/catalog-source.ts` becomes a map (`data/<locale>/…`)
   exposing `catalogFor(locale)` instead of a single `catalog` export.
5. **Thread the locale** through `vocabularyResponse(request)` → `readVocabularyPage(…,
locale)`.
6. **Reach the client.** `lib/saved-words.ts:11` builds `wordsById` from the baked catalog at
   module scope, so the resolved locale has to be injected at SSR. Decide at the same time
   how to handle bundle size: the glob is `eager`, so without a change every domain's client
   bundle ships every language's deck. Either make the glob lazy, or drop the baked map and
   resolve saved words through the API.
7. **Raise the cache caps.** `pools` is capped at 16 and `orders` at 8. With the locale in
   the key those caps are shared across locales, so effective per-locale capacity falls and
   the miss rate rises. Raise them in proportion to the number of live decks.

## Things that are NOT risks (checked, so they are not re-investigated)

- **Request latency.** The resolver is one string lookup per request against a header; the
  catalog is already a module constant. Next to `matchingPool` scanning every word on a cold
  key, it is unmeasurable.
- **CDN cross-contamination.** Every response from the feed endpoint carries
  `Cache-Control: no-store` (`api/endpoint.server.ts:59`), so no shared cache can serve one
  domain's deck to another. The only cache in play is the in-process Maps above.
- **Cursor leakage across domains.** `revision` is derived from the catalog and travels in
  the cursor. Different decks produce different revisions, so a cursor carried from one
  domain to another is rejected with a 409 — correct behaviour, already implemented.
- **SEO duplicate content.** The decks genuinely differ per domain.

## Things that ARE risks

- **`Host` is client-controlled.** Harmless for deck selection, since all deck content is
  public. Never let it reach anything trust-related — this app has admin and Supabase
  surfaces on the same origin.
- **Per-origin client state does not cross domains.** There are 12 `kinetic.*` localStorage
  keys (`vocab.reactions`, `vocab.reported`, `vocab.ambient`, `settings.preferences`,
  `session.id`, the demo keys). A student using two domains gets two independent saved lists
  and looks like a new user on each. For separately marketed courses that is arguably
  correct, but it should be a decision rather than a discovery. Shared progress would need
  accounts through Supabase, which the single-deployment shape already allows.

## Gating: the deck itself is the real project

Phases 1 and 2 are perhaps a day. The Korean deck is not, and it is blocked on the clue
mechanism. Reproduced against current code on 2026-10-09:

| answer              | masked usage example               | leaks?  | hint shown                       | tokens |
| ------------------- | ---------------------------------- | ------- | -------------------------------- | ------ |
| `negotiate` (today) | `We need to _____ a better price.` | no      | "Gồm 9 chữ cái, bắt đầu bằng N"  | 7      |
| `국밥` (ko)         | `저는 점심으로 국밥을 먹었어요.`   | **YES** | "Gồm 2 chữ cái, bắt đầu bằng 국" | 4      |
| `銀行` (zh)         | `我去銀行看看。`                   | **YES** | "Gồm 2 chữ cái, bắt đầu bằng 銀" | **1**  |
| `銀行` (ja)         | `私は銀行に行きます。`             | **YES** | "Gồm 2 chữ cái, bắt đầu bằng 銀" | **1**  |

Two findings that go beyond what the CJK document records:

- **Korean leaks too.** That document flags Korean as unaffected on _tokenization_, which is
  correct (4 tokens). Masking still fails: `국밥` is followed by the particle `을`, which is
  `\p{L}`, so the `(?![\p{L}])` lookahead in `answerPattern` (`lib/schema.ts:90`) fails
  exactly as neighbouring Han characters defeat it. Agglutinative particles break the
  boundary assertion. Korean is still the cheapest first language, but it is not free, and
  the masking fix must land **before** Korean ships, not before Japanese as that document
  sequences it.
- **The hint inverts from clue to giveaway.** "bắt đầu bằng N" reveals 11% of `negotiate`;
  "bắt đầu bằng 銀" reveals 50% of a two-character word, and calls a hanzi a "chữ cái".

Reproduce with the snippet in the CJK document's blocker section, or re-derive from
`lib/stages.ts:96-101` and `lib/schema.ts:90`.

## Open questions for whoever picks this up

- Has Lovable's answer on rows 2 and 3 changed? If per-project build vars ever arrive,
  option B becomes simpler than A and this plan should be revisited.
- How large will a mature deck be? That decides step 6 — a few hundred words makes the eager
  glob a non-issue; a few thousand per language does not.
- Should the saved-words list be per-domain (current behaviour, free) or shared across
  domains (needs accounts)? This is a product decision, not a technical one.
