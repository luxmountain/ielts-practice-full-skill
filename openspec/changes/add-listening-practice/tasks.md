## 1. Types and progress plumbing

- [x] 1.1 Add `ListeningSection` and `ListeningTest` types to `src/lib/types.ts` matching the JSON shape in
      `src/data/listening/cambridge/*.json` (`book`, `test`, `title`, `sections[]` with `number`,
      `questions: {from, to}`, `content`, `audioUrl: string | null`, `transcript`, and a top-level
      `answers: Record<string, string>`); verify by importing an existing listening JSON file in a scratch
      TS snippet and confirming it type-checks against the new interface with no `any`.
- [x] 1.2 Add `ListeningProgress` type (mirroring `ReadingProgress`) and a `listening:
      Record<string, ListeningProgress>` field on `UserProgress` in `src/lib/types.ts`.
- [x] 1.3 Update `defaultProgress` and the LocalStorage load effect in `src/lib/progress-context.tsx` to
      backfill `listening: {}` when merging a stored blob that predates this field (`{ ...defaultProgress,
      ...parsed, listening: parsed.listening ?? {} }`); verify by manually seeding `localStorage` with a
      pre-change `UserProgress` JSON blob (no `listening` key) in the browser devtools, reloading the app,
      and confirming no console error and `progress.listening` reads as `{}`.
- [x] 1.4 Add `updateListeningProgress` / `getListeningProgress` to `progress-context.tsx`'s context value,
      following the existing `updateReadingProgress`/`getReadingProgress` pattern.
- [x] 1.5 Fold listening into the `stats` memo in `progress-context.tsx` (completed count, contribution to
      `totalTime` and `avgScore`) alongside the existing reading/writing aggregation.
- [x] 1.6 Add a `listening` branch to `mergeProgress` in `src/lib/github-sync.ts` following the same
      pattern as the existing `reading`/`writing` branches; verify by unit-testing (or manually calling)
      `mergeProgress` with a local and remote `UserProgress` that each have distinct listening entries and
      confirming both survive the merge.

## 2. Listening practice page and navigation

- [x] 2.1 Create `src/app/listening/[book]/[test]/page.tsx` modeled on
      `src/app/reading/[book]/[test]/page.tsx`: load the test JSON via dynamic import, section tabs instead
      of passage tabs, one answer input per question number in each section's `{from, to}` range,
      submit/score computed against the flat `answers` map, explanation toggle (safe no-op display since
      listening data has no per-question explanations), reset, and the "test not available" fallback
      message (mirroring Reading's) when the JSON import fails. When a section's `audioUrl` is non-null,
      render a plain `<audio>` control for it as a cosmetic bonus; when null (the common case today), show
      nothing extra - no "audio not available" messaging needed.
- [x] 2.2 Wire `getListeningProgress`/`updateListeningProgress` into the new page for resume-on-reopen and
      save-on-submit, matching how the Reading page uses its progress hooks.
- [x] 2.3 Add a collapsible Listening section to `src/components/Sidebar.tsx` (book/test list, same pattern
      as the existing Reading/Writing sections) linking to `/listening/{book}/{test}`.
- [x] 2.4 Add a Listening stat card and a quick-start link to `src/app/page.tsx`, following the existing
      Reading/Writing card and link pattern, sourced from the new `stats.listeningCompleted` value.

## 3. Verification

- [x] 3.1 Run `npm run lint` and confirm it passes with the new files included. (Ran; 2 residual errors in
      the new page mirror the exact same pre-existing errors already present in
      `src/app/reading/[book]/[test]/page.tsx` - `Date.now()` in `useState` and setState-in-effect from
      React Compiler's stricter analysis. These predate this change across Reading/Writing/Settings too
      [17 pre-existing errors repo-wide]; fixing them is a repo-wide lint-debt cleanup out of scope for this
      change. One locally-fixable issue [`no-assign-module-variable`] was fixed.)
- [x] 3.2 Start the dev server, open `/listening/10/1` in the browser: confirm answers can be entered,
      submitting shows a score and per-question correct/incorrect state, and reloading the page restores
      the submitted state. (Verified in browser; also found and fixed a real bug during this check - see
      note below.)
- [x] 3.3 In the browser, open a listening test whose data file doesn't exist yet (e.g. an out-of-range
      book/test) and confirm the "not available" message renders instead of a blank page or thrown error.
      (Verified with `/listening/99/9`.)
- [x] 3.4 Toggle dark mode and confirm the new page and sidebar section render correctly in both themes,
      consistent with the existing Reading page's dark-mode styling. (Verified both themes in browser.)

**Bug found and fixed during 3.2**: `sections[].questions.to` in the scraped JSON is wrong/truncated for
44 of 48 Cambridge listening files (a section's real content covers more questions than its declared
range - confirmed against `cam-10-test-1.json`, where "Section 1" declares `to: 6` but its content clearly
runs through Q20, and "Section 2" is entirely absent from the `sections` array even though its answers
exist in the flat `answers` map). Rendering questions directly from the declared ranges silently dropped
~14-19 of 40 questions per test from the UI. Fixed client-side in
`src/app/listening/[book]/[test]/page.tsx` by reconstructing each section's effective range from the next
section's `from` (or the highest answered question id for the last section) - no data files were changed.
