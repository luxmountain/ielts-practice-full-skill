## Context

See proposal.md for motivation. Relevant current state, confirmed by reading the scraper source and by
loading live pages in a browser:

- `scripts/scraper/reading.mjs` `parseReadingTest()`: collects passage paragraphs via
  `$p("p").each((_, el) => paras.push($p(el).text().trim()))` then `paras.join("\n\n")`. `extractAnswers()`
  pulls `explanation` only from inline `(Q1)`-style prose markers, which only exist on older-format pages;
  the newer "toggle box" answer key (`extractAnswerKeyBox`) has no explanation text at all, and the code
  never visits a separate explanations page.
- `scripts/scraper/writing.mjs`: task1/task2 description/prompt collection uses the same `.text()` +
  `paras.join("\n\n")` pattern. The sample-answer split (`sText = $s("div").text()`, then
  `ps.slice(0, mid)`/`ps.slice(mid)` at a hardcoded 0.35 ratio) is the likely source of the duplication bug
  in `test-1.json` — worth confirming exactly during implementation (the `$s("div")` selector may be
  matching a container that includes repeated ad/nav text, or matching multiple nested `div`s whose text
  overlaps).
- `scripts/scraper/listening.mjs` `parseListeningTest()`: splits the full HTML on
  `/(?=<h3[^>]*>...(?:SECTION|PART)\s*\d)/i` into `sectionParts`, then matches each part's own heading with
  `/(?:SECTION|PART)\s*(\d)/i`. For the 11 files missing section 2, the live page for at least one of them
  needs to be inspected to see which markup variant breaks this (e.g. a different heading tag, or a
  heading that repeats a different section's number inside the audio-player widget before the real one).
- Live-confirmed on `practice-cam-13-reading-test-01-with-answer/`: passages render as genuinely separate
  `<p>` paragraphs (browser text extraction inserts implicit whitespace at element boundaries; Cheerio's
  `.text()` does not — this, not missing source content, is the mechanism behind the run-together text).
- Live-confirmed the "View Answers with Explanations" link exists at the bottom of at least Cam 13's
  practice page, pointing to `cambridge-ielts-13-reading-test-1-answers-with-explanations/`, a page whose
  body is a flat list of `N. answer` lines with a full explanation paragraph under *some* (not all)
  question numbers.
- Live-confirmed Cam 18's practice page has no such link or page — the toggle-box answer key is the only
  answer content available for that book.
- `src/app/reading/[book]/[test]/page.tsx` renders `q.explanation` behind a `submitted && showExplanations
  && q.explanation &&` guard — already tolerant of an empty string, no change needed there beyond feeding
  it richer text when available.
- `src/app/listening/[book]/[test]/page.tsx` renders `section.content.split("\n\n").map(...)` with
  `whitespace-pre-line`. This is the pattern the new shared renderer replaces.

## Goals / Non-Goals

**Goals:**
- Preserve real source structure (paragraph breaks, bold emphasis, list items) that the scraper currently
  discards, without introducing an XSS surface (no raw HTML from a third-party site ever reaches
  `dangerouslySetInnerHTML`).
- Recover reading explanations that genuinely exist on the source site (older books) without inventing
  content for books where the source has none.
- Fix the three concrete data bugs (writing duplication, listening missing section, dead transcript field)
  as part of the same scraper hardening pass, since they're discovered by the same audit and touch the
  same files.
- Keep `content`/`description`/`prompt`/`sampleAnswer` as plain `string` in `src/lib/types.ts` — no new
  nested/rich-text type — so this stays a low-risk, additive-in-spirit change.

**Non-Goals:**
- Full HTML/Markdown fidelity (tables, links, images, nested lists) — the source's reading/writing/listening
  content doesn't currently rely on those beyond what's covered by paragraphs/bold/simple bullet lists, and
  `ReadingPassage.content` already handles tabular fill-in-the-blank layouts as prose (existing behavior,
  unchanged here).
- Backfilling explanations for newer books (16+) by any means other than the source's own explanations
  page — no scraping a third-party site, no generating explanations.
- Any change to `UserProgress`/`ReadingProgress`/`WritingProgress` or LocalStorage/GitHub-sync — this
  change is scoped to practice-content data, not user progress.
- A generic rich-text/CMS-style content model — the markup convention introduced here is intentionally the
  minimum needed (paragraphs, bold, bullets), not a general-purpose formatting system.

## Decisions

**Use a minimal, custom markup convention in plain strings — not raw sanitized HTML, not a Markdown
library.** Storing raw scraped HTML (even "sanitized") and rendering it with `dangerouslySetInnerHTML`
would make every reading/writing/listening page a live injection surface for whatever
ieltstrainingonline.com's markup contains, now or on a future re-scrape — not worth the risk for content
that only ever needs paragraphs, bold, and bullets. Pulling in a Markdown parser dependency is more power
than the actual need (three constructs). Instead: the scraper walks each block's child nodes itself and
emits `\n\n` (paragraph break, unchanged from today), `**...**` (bold), and lines starting with `- `
(list item) into the same plain `string` fields that already exist. A small shared renderer (new file,
e.g. `src/lib/format-content.tsx`) turns that string into React elements: split on `\n\n` → `<p>`, then
within each paragraph split on `**` pairs → alternating text/`<strong>`, and a paragraph made entirely of
`- ` lines → a `<ul>`/`<li>` list instead of a `<p>`. Every element is built with JSX from parsed strings —
no `dangerouslySetInnerHTML` at any point. Old already-scraped content with no `**`/`- ` markers renders
identically to today (plain paragraphs), so this is safe to roll out incrementally as tests get
re-scraped.

**`reading.mjs` follows the "View Answers with Explanations" link only when present, and never treats its
absence as a failure.** The link is discovered from the practice page's own DOM (same page already being
parsed for passages/answers), not guessed from a URL pattern, since it's a real `<a href>` on the page
adjacent to the toggle-box answer key. When present, fetch it (same `fetchPage` retry/backoff already
used elsewhere), parse `N. <explanation text, if any>` blocks, and merge into
`ReadingQuestion.explanation` for matching ids only — a question with a bare answer and no explanation on
that page keeps `explanation: ""`, which the UI already renders as "no explanation" gracefully.

**Force-regenerate, don't rely on the scrapers' existing skip-if-exists cache.** All three scrapers skip
re-scraping a book/test whose output file already exists and passes a rough completeness check
(`existsSync` + a question/section count threshold) — a check that says nothing about formatting quality
or explanation completeness. Before re-running scrapers as part of this change's tasks, the affected
output files must be deleted (or the skip check temporarily bypassed) so the fixed parsing logic actually
re-fetches and re-writes them, rather than silently leaving the old, malformed JSON in place.

**Drop `ListeningSection.transcript` from the type rather than repurposing it.** It has never held real
data (always `""`), the UI already reads `content` for the actual transcript text, and there's no
`ListeningProgress`/`UserProgress` dependency on it (confirmed by checking `progress-context.tsx` and
`github-sync.ts` — neither references `transcript`). Already-written JSON files keep the stray key on
disk until they're re-scraped for the formatting fix anyway (harmless — an extra JSON key with no
matching type field is simply ignored by `JSON.parse` + TS access), so no separate migration step is
needed.

## Risks / Trade-offs

- **[Risk] The custom `**bold**`/`- list` convention could collide with source text that legitimately
  contains a literal `**` or a line starting with `- ` (e.g. a hyphenated list in prose).** → Mitigation:
  scope the emitted markers strictly to nodes the scraper identifies as `<strong>`/`<b>` or `<li>` in the
  source HTML (never inferred from plain-text heuristics), so a literal `**` in scraped prose is never
  possible — it would have had to already be a `<strong>` tag to produce that marker. A stray `- ` at the
  start of a real sentence (not from an `<li>`) is scoped out the same way: it's only ever emitted from an
  actual list-item node, never inferred from text starting with a hyphen.
- **[Risk] Re-scraping every affected reading/writing/listening test hits ieltstrainingonline.com with a
  large number of requests.** → Mitigation: the existing per-request delay (2-4s depending on scraper) is
  kept as-is per `openspec/config.yaml`'s rule; tasks below call for a dry run on one book/test per
  scraper before the full re-scrape, matching the project's existing operations guidance.
- **[Trade-off] Explanations remain permanently empty for books 16+ since the source doesn't have them.**
  Accepted — proposal.md and this design treat that as a real content ceiling, not a defect to keep
  chasing.

## Migration Plan

1. Land the shared renderer (`src/lib/format-content.tsx`) and wire it into the reading/writing/listening
   pages first, tested against the *current* (unformatted) data — since old plain content has no
   `**`/`- ` markers, this step is a no-op change in rendered output and can be verified against the app
   before any scraper or data changes land.
2. Fix `reading.mjs`, `writing.mjs`, `listening.mjs` independently (they don't depend on each other);
   dry-run each against one known-affected book/test.
3. Delete/force-regenerate the affected JSON files per scraper and re-run; validate output with the
   `test-data-auditor` subagent before moving to the next scraper.
4. Remove `ListeningSection.transcript` from `src/lib/types.ts` last, after listening data has been
   re-scraped (so nothing depends on the old field shape while listening data is mid-migration).

No rollback complexity beyond `git` — no user-facing progress data is touched, and the renderer degrades
gracefully on unformatted (not-yet-re-scraped) content, so partial completion (e.g. reading re-scraped,
listening not yet) is a safe intermediate state.
