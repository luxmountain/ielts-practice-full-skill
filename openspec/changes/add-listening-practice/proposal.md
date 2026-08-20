## Why

Cambridge IELTS Listening data for books 10-21 now exists as complete, validated JSON
(`src/data/listening/cambridge/`, all 48 tests, correct section content and answer keys), but the app has
no way to actually practice Listening: no route, no types, no progress tracking. The Reading feature is
fully built (route, types, LocalStorage progress); Listening is data with no product on top of it. Users
who want to practice Listening alongside Reading (the original ask) currently can't.

Audio playback is explicitly out of scope: the user will source and listen to the actual audio themselves
separately. What they need from the app is correct test data they can work through - section prompts,
question text, and answers to check against - the same way Reading already works. (Most of the 48
Listening files still have `audioUrl: null` per section - this is a known, accepted gap, not a defect to
fix here.)

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
  `src/app/reading/[book]/[test]/page.tsx` — section tabs (instead of passage tabs), fill-in-the-blank
  answer inputs keyed by question number, submit/score/reset, and explanation toggle (explanations are not
  present in the current data, so this starts empty/hidden, same graceful behavior Reading already has for
  missing explanations). If a section's `audioUrl` happens to be non-null, render a plain `<audio>` control
  for it as a bonus - purely cosmetic, not a tracked requirement, and a no-op when absent (the common case
  today).
- Add a Listening section to `src/components/Sidebar.tsx` (collapsible book/test list, same pattern as
  Reading/Writing) and a Listening stat card + quick-start link on `src/app/page.tsx`.

## Capabilities

### New Capabilities
- `listening-practice`: End-to-end Listening practice — data types, LocalStorage progress tracking, the
  test-taking UI, and navigation/dashboard integration for Cambridge books 10-21. Audio playback is not
  part of this capability's tracked behavior.

### Modified Capabilities
(none — no existing capability specs are being changed; Reading/Writing behavior is untouched)

## Impact

- **Data shape**: `src/lib/types.ts` gains `ListeningTest`, `ListeningSection`, `ListeningProgress`; `UserProgress`
  gains a `listening` field. Must stay backward-compatible for progress already saved by real users — see
  migration note above and in `design.md`.
- **Scraper**: none. No scraper changes in this change - the existing `src/data/listening/cambridge/*.json`
  files are used as-is.
- **UI/app-router**: New route `src/app/listening/[book]/[test]`. Confirmed against
  `node_modules/next/dist/docs/` that dynamic route params and client-component data loading follow the
  same pattern already used by `src/app/reading/[book]/[test]/page.tsx` (Next.js 16, App Router) — no new
  Next.js 16 API is introduced beyond what Reading already relies on.
- **Sidebar/dashboard**: `src/components/Sidebar.tsx` and `src/app/page.tsx` gain a Listening section,
  additive only.
