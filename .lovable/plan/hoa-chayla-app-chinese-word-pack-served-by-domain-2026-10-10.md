# hoa.chayla.app — Chinese word pack served by domain

## Goal
One app, many addresses. Each address picks its own word pack and page title, with the Vietnamese side unchanged everywhere:

| Address | Word pack | Page title |
|---|---|---|
| anh.chayla.app (and any unknown address, preview, localhost) | English (today's deck) | Chay Lá - Anh (unchanged) |
| hoa.chayla.app | Chinese (the 25-word pack you uploaded) | hoa.chayLá |
| hàn / nhật later | Korean / Japanese | hàn.chayLá / nhật.chayLá |

Opening hoa.chayla.app goes straight to the Chinese words. It needs no settings or switch.

## What changes for you
1. Connect **hoa.chayla.app** in Domains (same way anh.chayla.app is connected), and **unset the primary domain**. Otherwise it redirects to anh and always shows English.
2. Saved words and hearts are kept separately on each address. That matches how the app works today.

## Steps
1. **Store the Chinese pack separately.** Validate the upload and save it as its own Chinese deck, kept apart from the English packs so it never mixes into anh.
2. **Address → language lookup.** A small lookup turns the visited address into a language (`hoa` → zh, `han` → ko, `nhat` → ja). Unknown addresses fall back to English and never fail. It handles ports and capital letters.
3. **Pick the deck for each visit.** The word feed reads the address on every request and serves that language's deck. Word-list caches are labelled by deck, so English and Chinese words can't swap.
4. **Saved words page.** It looks up words in the deck for the current address instead of the fixed English one.
5. **Page title per address.** The title, description and share titles come from the language (e.g. "hoa.chayLá"). The rest of the page stays the same.
6. **Chinese word display.** The pack's examples already include the `_____` blank, so the answer stays hidden. Adjust the hint so it doesn't say "Gồm 2 chữ cái, bắt đầu bằng 嫉" (that gives away half the word). Use a Chinese hint instead, such as the number of characters plus the pinyin tone outline.
7. **Tests.** Add tests for the address lookup (hoa, anh, unknown address, address with port, no address) and one test that a hoa request returns only Chinese words.

## Technical details
- New `lib/target-language.ts`: `resolveTarget(host): "en" | "zh" | "ko" | "ja"`, with a pure fallback to `"en"`.
- `lib/catalog-source.ts` → `catalogFor(locale)`. English = `catalog.json` + `data/packs/*.json` (unchanged glob). Chinese = `data/zh/*.json`, compiled with `vocab:import` and `--locale zh`.
- `catalog.server.ts`: thread the locale through `readVocabularyPage`. The pools key gets `catalog.revision`, and cache caps go up.
- `endpoint.server.ts`: `vocabularyResponse(request)` resolves the locale from `request.headers.get("host")`. The client fetch stays relative, so it needs no change.
- The root `head()` reads the locale through a server fn (request host), and the client receives the locale from the root loader for `saved-words.ts`. Lazy-load the per-locale deck so the anh bundle doesn't ship Chinese.
- The Host header only selects public content, never anything to do with access or admin.
- Update `docs/multi-domain-target-language.md` and `AGENTS.md` with the decision.
