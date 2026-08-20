## Why

Cambridge IELTS Listening data for books 10-21 already exists as JSON (`src/data/listening/cambridge/`,
46 of 48 tests, with 2 more being scraped separately), but the app has no way to actually practice
Listening: no route, no types, no progress tracking, and no audio player. The Reading feature is fully
built (route, types, LocalStorage progress); Listening is data with no product on top of it. Users who
want to practice Listening alongside Reading (the original ask) currently can't.

Separately, an investigation into the existing Listening JSON found that all 46 files have `audioUrl: null`
on every section — not because no audio exists, but because of two scraper bugs: (1) the data on disk was
actually produced by `listening-pte.mjs` (scrapes practicepteonline.com), which hardcodes `audioUrl: null`
and never attempts extraction, while the intended `listening.mjs` (scrapes ieltstrainingonline.com, which
does embed real per-section `<audio class="wp-audio-shortcode">` tags) was never the one that ran; and
(2) `listening.mjs`'s own extraction selector only matches lowercase `.mp3` links, missing book 21's
`.MP3` and book 15's `.m4a`. A Listening practice feature without playable audio would just be a
transcript-reading exercise, not Listening practice, so fixing audio extraction is in scope here too.

## What Changes

- Add `ListeningTest` and `ListeningSection` types to `src/lib/types.ts`, matching the existing JSON shape
  in `src/data/listening/cambridge/*.json` (`book`, `test`, `title`, `sections[]` with `number`,
  `questions: {from, to}`, `content`, `audioUrl`, `transcript`, and a top-level `answers` map).
- Add `ListeningProgress` type (mirrors `ReadingProgress`) and a `listening: Record<string, ListeningProgress>`
  slice on `UserProgress`. **BREAKING (data shape)**: existing `UserProgress` JSON already saved in a real
  user's LocalStorage/GitHub sync predates this field — `progress-context.tsx` must backfill
  `listening: {}` on load so old saved progress keeps working.
- Add `updateListeningProgress` / `getListeningProgress` to `progress-context.tsx` and fold listening stats
  (completed count, avg score, time) into the existing `stats` object consumed by the dashboard.
- Add `src/app/listening/[book]/[test]/page.tsx`: a test-taking page modeled on
  `src/app/reading/[book]/[test]/page.tsx` — section tabs (instead of passage tabs), an `<audio>` player per
  section (falls back to a "no audio available" note if `audioUrl` is still null for a given file),
  fill-in-the-blank answer inputs keyed by question number, submit/score/reset, and explanation toggle
  (explanations are not present in the current data, so this starts empty/hidden, same graceful behavior
  Reading already has for missing explanations).
- Add a Listening section to `src/components/Sidebar.tsx` (collapsible book/test list, same pattern as
  Reading/Writing) and a Listening stat card + quick-start link on `src/app/page.tsx`.
- Fix `scripts/scraper/listening.mjs` audio extraction to read `audio.wp-audio-shortcode source[src]`
  (falling back to the shortcode's wrapped `<a href>`) instead of guessing at link text/extension — this
  is extension-agnostic and was verified live against books 10/14/15/17/21.
- Add a small one-off patch script (or a `--patch-audio-only` mode on `listening.mjs`) to backfill the
  corrected `audioUrl` into the 46 (soon 48) already-scraped JSON files in place, without touching their
  existing `content`/`answers`, since those were scraped correctly by `listening-pte.mjs` and shouldn't be
  re-fetched and risk drifting.

## Capabilities

### New Capabilities
- `listening-practice`: End-to-end Listening practice — data types, LocalStorage progress tracking, the
  test-taking UI with audio playback, and navigation/dashboard integration for Cambridge books 10-21.

### Modified Capabilities
(none — no existing capability specs are being changed; Reading/Writing behavior is untouched)

## Impact

- **Data shape**: `src/lib/types.ts` gains `ListeningTest`, `ListeningSection`, `ListeningProgress`; `UserProgress`
  gains a `listening` field. Must stay backward-compatible for progress already saved by real users — see
  migration note above and in `design.md`.
- **Scraper**: `scripts/scraper/listening.mjs` audio-extraction logic changes (selector fix, verified
  against Next.js-unrelated static HTML from ieltstrainingonline.com — not a Next.js concern). A new
  patch/backfill path touches the 46 existing `src/data/listening/cambridge/*.json` files in place
  (audioUrl field only).
- **UI/app-router**: New route `src/app/listening/[book]/[test]`. Confirmed against
  `node_modules/next/dist/docs/` that dynamic route params and client-component data loading follow the
  same pattern already used by `src/app/reading/[book]/[test]/page.tsx` (Next.js 16, App Router) — no new
  Next.js 16 API is introduced beyond what Reading already relies on.
- **Sidebar/dashboard**: `src/components/Sidebar.tsx` and `src/app/page.tsx` gain a Listening section,
  additive only.
