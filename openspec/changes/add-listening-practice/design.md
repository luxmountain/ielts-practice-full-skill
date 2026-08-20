## Context

See proposal.md for motivation. Relevant current state:

- `src/lib/types.ts` has `ReadingTest`/`ReadingPassage`/`ReadingQuestion` and `ReadingProgress`, but no
  Listening equivalents. `UserProgress` only has `reading` and `writing` keys.
- `src/lib/progress-context.tsx` loads `UserProgress` from LocalStorage with `JSON.parse(stored)` and no
  merge against `defaultProgress` — any key missing from a stored blob stays missing on the live object.
  `progress.reading[key]` / `progress.writing[key]` are accessed directly (no optional chaining), so a
  missing top-level key would throw at first read.
- `src/lib/github-sync.ts`'s `mergeProgress` explicitly builds its merged object field-by-field
  (`reading`, `writing`) — it does not spread unknown keys through, so a new `listening` key needs to be
  added there explicitly or sync will silently drop it.
- `src/data/listening/cambridge/*.json` (48 files, all validated - complete sections, complete answers):
  `{ type, book, test, title, sections: [{ number, questions: {from, to}, content, audioUrl, transcript }],
  answers: {"1": "...", ...} }`. `answers` is a flat map keyed by question number as a string, not nested
  per-section or per-passage the way Reading nests questions inside passages. Most files have `audioUrl:
  null` on every section - accepted as-is; audio is out of scope for this change (see proposal.md - Why).
- Confirmed via `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md` that
  `useParams()` (the client hook Reading's page already uses) is still current in Next.js 16 App Router -
  the new page follows the identical pattern, no new Next.js API surface.

## Goals / Non-Goals

**Goals:**
- Ship a working Listening practice page reusing Reading's established UX patterns (tabs, timer, submit,
  score, explanation toggle, reset) so the app stays visually and behaviorally consistent.
- Keep `UserProgress` backward-compatible: a user with progress saved before this change (locally or via
  GitHub sync) must not lose data or hit a runtime error.

**Non-Goals:**
- Audio playback as a tracked feature - the user listens to audio outside the app; the practice page only
  needs to show section/question text and let the user check their answers. If a section's `audioUrl`
  happens to be set, a plain `<audio>` control may render as a cosmetic bonus, but this is not validated,
  not backfilled, and not a requirement.
- Per-question `explanation` text for listening questions - not present in the source data; the UI
  degrades the same way Reading already does when `explanation` is empty (hides the block).
- A shared "practice test player" abstraction unifying Reading and Listening pages - out of scope for this
  change; both stay separate pages as Reading already is, to avoid a risky refactor while shipping data +
  UI in the same change. Worth revisiting later if a third practice type is added.
- Any scraper changes - `src/data/listening/cambridge/*.json` is already complete and validated; this
  change only builds UI on top of it.

## Decisions

**Listening question model stays flat (`answers: Record<number, string>` on the test), not nested inside
sections.** Reading nests `questions[]` inside each `passage`; Listening's existing JSON instead has a
flat `answers` map at the test level and each `section` only carries a `questions: {from, to}` range plus
free-form `content` text (the scraped page text isn't broken into discrete question objects the way
Reading's HTML was). Rather than inventing a per-question breakdown the scraped data doesn't actually have,
`ListeningSection` and `ListeningTest` types will mirror the JSON exactly as scraped, and the practice page
will render one answer input per question number in a section's `{from, to}` range, reading/writing that
answer against the flat `answers` map. This avoids a mismatched type that the real data could never satisfy.

**`UserProgress` migration happens in `progress-context.tsx`'s load effect, not via a version field.**
On load, merge the parsed stored object over `defaultProgress` (`{ ...defaultProgress, ...parsed, listening:
parsed.listening ?? {} }`) instead of using the parsed object directly. This is the same shape of fix
needed regardless of how many future slices get added, keeps existing `reading`/`writing` data untouched,
and avoids introducing a schema-version concept for a single additive field.

**`github-sync.ts`'s `mergeProgress` gets a `listening` branch added explicitly**, following the exact
same last-write-wins-by-timestamp-absence pattern already used for `reading`/`writing` (it currently has no
per-entry timestamp to compare, so it takes remote unless local already has that key - matching existing
behavior, not introducing a new merge strategy).

## Risks / Trade-offs

- **[Risk] Flat `answers` map means a typo'd question number key in scraped JSON silently fails to score
  that question (no type-level guarantee every `{from, to}` number has a matching answer key).** →
  Mitigation: this mirrors a risk Reading already carries in a different shape (already surfaced by the
  audit as real defects in a couple of files); out of scope to add new schema validation in this change,
  but worth a follow-up audit pass after this ships, same as Reading's ongoing data-quality cleanup.

## Migration Plan

1. Land type + `progress-context.tsx` + `github-sync.ts` changes together (all three must move in the same
   commit/PR - a stored-progress migration without the corresponding sync merge update would drop listening
   data on the next GitHub sync).
2. Land the UI (page, sidebar, dashboard card) on top of that, using the existing validated data as-is.

No rollback complexity: everything is additive to `UserProgress`/`src/lib/types.ts`, and no data files are
modified by this change.
