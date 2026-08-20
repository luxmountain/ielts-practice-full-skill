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
- `src/data/listening/cambridge/*.json` (46 files, checked directly): `{ type, book, test, title,
  sections: [{ number, questions: {from, to}, content, audioUrl, transcript }], answers: {"1": "...",
  ...} }`. `answers` is a flat map keyed by question number as a string, not nested per-section or
  per-passage the way Reading nests questions inside passages.
- Confirmed via `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-params.md` that
  `useParams()` (the client hook Reading's page already uses) is still current in Next.js 16 App Router -
  the new page follows the identical pattern, no new Next.js API surface.

## Goals / Non-Goals

**Goals:**
- Ship a working Listening practice page reusing Reading's established UX patterns (tabs, timer, submit,
  score, explanation toggle, reset) so the app stays visually and behaviorally consistent.
- Keep `UserProgress` backward-compatible: a user with progress saved before this change (locally or via
  GitHub sync) must not lose data or hit a runtime error.
- Fix real audio into the dataset so the feature is actually "Listening" practice, not transcript reading.

**Non-Goals:**
- Per-question `explanation` text for listening questions - not present in the source data; the UI
  degrades the same way Reading already does when `explanation` is empty (hides the block).
- A shared "practice test player" abstraction unifying Reading and Listening pages - out of scope for this
  change; both stay separate pages as Reading already is, to avoid a risky refactor while shipping data +
  UI in the same change. Worth revisiting later if a third practice type is added.
- Re-scraping listening question content/answers - `listening-pte.mjs`'s output for `content`/`answers` is
  correct and shouldn't be touched, only `audioUrl` is patched in place.

## Decisions

**Listening question model stays flat (`answers: Record<number, string>` on the test), not nested inside
sections.** Reading nests `questions[]` inside each `passage`; Listening's existing JSON instead has a
flat `answers` map at the test level and each `section` only carries a `questions: {from, to}` range plus
free-form `content` text (the scraped page text isn't broken into discrete question objects the way
Reading's HTML was). Rather than inventing a per-question breakdown the scraped data doesn't actually have,
`ListeningSection` and `ListeningTest` types will mirror the JSON exactly as scraped, and the practice page
will render one answer input per question number in a section's `{from, to}` range, reading/writing that
answer against the flat `answers` map. This avoids a mismatched type that the real data could never satisfy.

**Fix audio extraction with a source-selector rewrite, not a full re-scrape.** `listening.mjs`'s current
`a[href$='.mp3']` + regex approach is extension-sensitive (misses book 21's `.MP3`, book 15's `.m4a`).
Switching to `audio.wp-audio-shortcode source[src]` (verified live against books 10/14/15/17/21, see
proposal.md) is extension-agnostic since it reads the embed's actual `src` attribute instead of guessing
from URL text. A separate one-off patch path re-fetches only the ieltstrainingonline.com audioscript page
per book/test and writes back just the `audioUrl` fields into the existing JSON, rather than re-running the
full scrape (which pulls from `listening-pte.mjs`/practicepteonline.com and would risk producing different
`content`/`answers` than what's already been validated on disk).

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

- **[Risk] The `audio.wp-audio-shortcode` selector could still miss an edge case on some untested book.**
  → Mitigation: the practice page already handles `audioUrl: null` gracefully (visible "audio not
  available" indicator per the spec's dedicated scenario), so a missed book degrades to "no audio for this
  test" rather than a broken page; not a blocker for shipping.
- **[Risk] Patch script re-fetches 46 live pages against ieltstrainingonline.com.** → Mitigation: reuse the
  existing scraper's rate-limit delay (2-2.5s) unchanged, run once, and only write the `audioUrl` field per
  section (leave `content`/`transcript`/`answers` untouched) so a partial run can be safely re-run
  idempotently.
- **[Risk] Flat `answers` map means a typo'd question number key in scraped JSON silently fails to score
  that question (no type-level guarantee every `{from, to}` number has a matching answer key).** →
  Mitigation: this mirrors a risk Reading already carries in a different shape (already surfaced by the
  audit as real defects in a couple of files); out of scope to add new schema validation in this change,
  but worth a follow-up audit pass after this ships, same as Reading's ongoing data-quality cleanup.

## Migration Plan

1. Land type + `progress-context.tsx` + `github-sync.ts` changes together (all three must move in the same
   commit/PR - a stored-progress migration without the corresponding sync merge update would drop listening
   data on the next GitHub sync).
2. Land the `listening.mjs` selector fix and the audio-backfill patch script.
3. Run the patch script once against the existing 46 (soon 48) files.
4. Land the UI (page, sidebar, dashboard card) last, once real `audioUrl`s are actually in the data - so
   the feature doesn't ship silently audio-less and then need a second pass.

No rollback complexity: everything is additive to `UserProgress`/`src/lib/types.ts`, and the audio-patch
script only ever fills a previously-`null` field, so a bad run can't corrupt already-good data beyond
setting some `audioUrl`s back to `null` (safe to re-run).
