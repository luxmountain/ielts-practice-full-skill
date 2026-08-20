## 1. Types and progress plumbing

- [ ] 1.1 Add `ListeningSection` and `ListeningTest` types to `src/lib/types.ts` matching the JSON shape in
      `src/data/listening/cambridge/*.json` (`book`, `test`, `title`, `sections[]` with `number`,
      `questions: {from, to}`, `content`, `audioUrl: string | null`, `transcript`, and a top-level
      `answers: Record<string, string>`); verify by importing an existing listening JSON file in a scratch
      TS snippet and confirming it type-checks against the new interface with no `any`.
- [ ] 1.2 Add `ListeningProgress` type (mirroring `ReadingProgress`) and a `listening:
      Record<string, ListeningProgress>` field on `UserProgress` in `src/lib/types.ts`.
- [ ] 1.3 Update `defaultProgress` and the LocalStorage load effect in `src/lib/progress-context.tsx` to
      backfill `listening: {}` when merging a stored blob that predates this field (`{ ...defaultProgress,
      ...parsed, listening: parsed.listening ?? {} }`); verify by manually seeding `localStorage` with a
      pre-change `UserProgress` JSON blob (no `listening` key) in the browser devtools, reloading the app,
      and confirming no console error and `progress.listening` reads as `{}`.
- [ ] 1.4 Add `updateListeningProgress` / `getListeningProgress` to `progress-context.tsx`'s context value,
      following the existing `updateReadingProgress`/`getReadingProgress` pattern.
- [ ] 1.5 Fold listening into the `stats` memo in `progress-context.tsx` (completed count, contribution to
      `totalTime` and `avgScore`) alongside the existing reading/writing aggregation.
- [ ] 1.6 Add a `listening` branch to `mergeProgress` in `src/lib/github-sync.ts` following the same
      pattern as the existing `reading`/`writing` branches; verify by unit-testing (or manually calling)
      `mergeProgress` with a local and remote `UserProgress` that each have distinct listening entries and
      confirming both survive the merge.

## 2. Audio extraction fix and data backfill

- [ ] 2.1 Rewrite the audio-extraction logic in `scripts/scraper/listening.mjs` to read
      `audio.wp-audio-shortcode source[src]` (falling back to the shortcode's wrapped `<a href>`), stripping
      any `?...` cache-busting query string; verify by running it against Cambridge 10 Test 1, Cambridge 15
      Test 1 (`.m4a`), and Cambridge 21 Test 1 (`.MP3`) and confirming all sections get a non-null
      `audioUrl` in the script's console output.
- [ ] 2.2 Add a patch-only path (new script or a `--patch-audio-only` flag on `listening.mjs`) that fetches
      each book/test's ieltstrainingonline.com audioscript page, extracts just the section `audioUrl`s via
      the fixed logic, and writes them into the existing
      `src/data/listening/cambridge/cam-{book}-test-{test}.json` files in place - leaving `content`,
      `transcript`, and `answers` untouched. Respect the existing 2-2.5s rate-limit delay.
- [ ] 2.3 Run the patch path once across all existing Cambridge listening files (books 10-21, including the
      3 tests scraped separately for this same book range) and verify: `grep -L '"audioUrl": null'` (or
      equivalent) shows every file has at least one non-null `audioUrl`, and spot-check 3 files across
      different books to confirm the audio URL actually loads (`curl -I <url>` returns 200).

## 3. Listening practice page and navigation

- [ ] 3.1 Create `src/app/listening/[book]/[test]/page.tsx` modeled on
      `src/app/reading/[book]/[test]/page.tsx`: load the test JSON via dynamic import, section tabs instead
      of passage tabs, one `<audio>` element per section reading `section.audioUrl` (with a visible "audio
      not available" indicator when `audioUrl` is null), one answer input per question number in each
      section's `{from, to}` range, submit/score computed against the flat `answers` map, explanation
      toggle (safe no-op display since listening data has no per-question explanations), reset, and the
      "test not available" fallback message (mirroring Reading's) when the JSON import fails.
- [ ] 3.2 Wire `getListeningProgress`/`updateListeningProgress` into the new page for resume-on-reopen and
      save-on-submit, matching how the Reading page uses its progress hooks.
- [ ] 3.3 Add a collapsible Listening section to `src/components/Sidebar.tsx` (book/test list, same pattern
      as the existing Reading/Writing sections) linking to `/listening/{book}/{test}`.
- [ ] 3.4 Add a Listening stat card and a quick-start link to `src/app/page.tsx`, following the existing
      Reading/Writing card and link pattern, sourced from the new `stats.listeningCompleted` value.

## 4. Verification

- [ ] 4.1 Run `npm run lint` and confirm it passes with the new files included.
- [ ] 4.2 Start the dev server, open `/listening/10/1` in the browser: confirm the section audio player
      plays, answers can be entered, submitting shows a score and per-question correct/incorrect state, and
      reloading the page restores the submitted state.
- [ ] 4.3 In the browser, open a listening test whose data file doesn't exist yet (e.g. an out-of-range
      book/test) and confirm the "not available" message renders instead of a blank page or thrown error.
- [ ] 4.4 Toggle dark mode and confirm the new page and sidebar section render correctly in both themes,
      consistent with the existing Reading page's dark-mode styling.
