## Why

A live audit of `src/data/{reading,writing,listening}/**` against `src/lib/types.ts` found the JSON is
structurally valid but systematically low-fidelity, and root-causing it against the live source
(ieltstrainingonline.com) shows this is a scraper problem, not a source-content problem:

- **Formatting loss (48/48 reading tests, all writing/listening content):** `scripts/scraper/*.mjs` pull
  text with Cheerio's `.text()`, which drops all HTML structure. `.text()` does not insert a separator at
  element boundaries, so paragraphs that are genuinely separate `<p>` tags on the source page (confirmed
  live on `practice-cam-18-reading-test-01-with-answer`) come out run together in the JSON — e.g.
  `src/data/reading/cam-10-test-1.json` passage 1 contains `"...utilitarian application.Unique to this
  region..."` with zero space between what are two source paragraphs. Bold key terms and bulleted/list
  content are lost the same way.
- **Reading `explanation` empty on all 1,282 questions:** confirmed live that older Cambridge books
  (~10-15) publish a *separate* page linked as "View Answers with Explanations" (e.g.
  `cambridge-ielts-13-reading-test-1-answers-with-explanations/`) with real per-question reasoning that
  `reading.mjs` never fetches — a genuine scraper gap. Confirmed live that newer books (16+, e.g. Cam 18)
  have no such page at all — a real source-content gap, not something scraping harder can fix.
- **Writing sample-answer duplication:** `src/data/writing/test-1.json` task2 `sampleAnswer` is duplicated
  ~4x (the "WRITING TASK 2" label appears 3 times in one field) — a concatenation bug in `writing.mjs`.
- **Listening missing Section 2:** 11/48 files under `src/data/listening/cambridge/*.json` have sections
  `[1, 3, 4]` — `listening.mjs`'s `SECTION|PART N` heading-splitting regex is failing to match some page
  variant for section 2 specifically.
- **`ListeningSection.transcript` is vestigial:** always written as `"""`; the real audioscript text lives
  in `content` (an existing comment in `listening.mjs` documents this), and the UI already reads `content`.
  The dead field is just confusing, not a functional bug.

## What Changes

- **Scraper formatting (reading/writing/listening):** replace flat `.text()` extraction with logic that
  walks each relevant block's child nodes and emits a small, safe markup convention instead of raw HTML:
  `\n\n` between paragraphs (as today), `**text**` for bold/emphasis, and `- text` lines for list items.
  `ReadingPassage.content`, `WritingTask.description`/`prompt`/`sampleAnswer`, and
  `ListeningSection.content` stay `string` in `src/lib/types.ts` (no shape change) — old, already-correct
  plain content keeps rendering exactly as before since it just won't contain `**`/`- ` markers.
- **Rendering:** add one small shared parser/renderer (used by the reading, writing, and listening pages)
  that turns that markup into React elements — split on `\n\n` for paragraphs (as today), plus a
  `**bold**` → `<strong>` and leading `- ` → `<li>` pass. No `dangerouslySetInnerHTML` anywhere; the
  scraped site content never becomes live HTML in the browser.
- **`reading.mjs`:** when a practice page links a "View Answers with Explanations" page, follow it and
  merge the parsed explanation text into the matching `ReadingQuestion.explanation`. When no such link
  exists (newer books), leave `explanation: ""` — the reading page's existing `q.explanation &&` guard
  already hides the explanation block gracefully, so no UI change is needed for that case.
- **`writing.mjs`:** fix the sample-answer collection/concatenation logic so a block's paragraphs are
  captured once, not repeated; re-scrape all writing tests and audit for the same duplication pattern.
- **`listening.mjs`:** fix the `SECTION|PART N` detection so section 2 (and any other section) is no
  longer dropped when a page uses a markup variant the current regex misses; re-scrape the 11 affected
  tests (and any others the fix changes).
- **`src/lib/types.ts`:** drop the always-empty `transcript` field from `ListeningSection` (dead weight;
  `content` already carries the real text and the UI already reads `content`).
- **Re-scrape:** after each scraper fix, force-regenerate the affected JSON (the scrapers' existing
  "skip if file already looks complete" cache check does not know the *content* is malformed, so affected
  output files must be removed or the check bypassed before re-running) and validate with the
  `test-data-auditor` subagent before treating the change as done.

## Capabilities

### New Capabilities
- `content-data-quality`: cross-cutting requirements that scraped practice content (Reading passages,
  Writing task text/sample answers, Listening section content) must preserve source paragraph/emphasis/list
  structure, and that Reading question explanations must be captured whenever the source publishes them.

### Modified Capabilities
(none — no existing capability spec is being changed; this only touches scraper scripts, the data files
they produce, `src/lib/types.ts`, and the render paths that already exist)

## Impact

- **Scraper**: `scripts/scraper/reading.mjs`, `writing.mjs`, `listening.mjs` — parsing logic changes in
  all three; the built-in rate-limit delay is not touched.
- **Data shape**: `src/lib/types.ts` — `ListeningSection.transcript` removed (dead field; JSON files already
  on disk keep the stray `"transcript": ""` key harmlessly until re-scraped, since removing an unused key
  from a TS interface doesn't require migrating already-written JSON). No change to `UserProgress`,
  `ReadingProgress`, or `WritingProgress` — this change doesn't touch progress data at all, so no
  LocalStorage/GitHub-sync migration is needed.
- **Data files**: most of `src/data/reading/*.json`, `src/data/writing/*.json`, and
  `src/data/listening/cambridge/*.json` get regenerated via re-scrape.
- **UI/app-router**: `src/app/reading/[book]/[test]/page.tsx`, `src/app/listening/[book]/[test]/page.tsx`,
  and the writing test page gain the shared markup renderer in place of the current
  `.split("\n\n")`/`whitespace-pre-line` plain-text rendering. No new Next.js 16 API — this is plain
  React rendering, not routing/data-fetching, so nothing needed checking against
  `node_modules/next/dist/docs/`.
