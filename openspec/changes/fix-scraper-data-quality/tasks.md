## 1. Shared content renderer

- [x] 1.1 Add `src/lib/format-content.tsx` exporting a component/function that takes a `string` using the
      `\n\n` paragraph / `**bold**` / `- item` convention and returns React elements (`<p>`, `<strong>`,
      `<ul>/<li>`) with no `dangerouslySetInnerHTML`. Content with none of those markers must render
      byte-for-byte the same as the current `.split("\n\n").map(...)` output.
- [x] 1.2 Swap `src/app/listening/[book]/[test]/page.tsx`'s inline `section.content.split("\n\n")...`
      rendering for the shared renderer.
- [x] 1.3 Swap the equivalent passage-rendering code in `src/app/reading/[book]/[test]/page.tsx` for the
      shared renderer.
- [x] 1.4 Swap the writing task page's description/prompt/sampleAnswer rendering for the shared renderer.
- [x] 1.5 Verify in the browser (dev server): open one already-scraped reading test, one writing test, and
      one listening test and confirm rendering is visually unchanged from before this task (since the
      underlying data has no markers yet). (Verified: no console errors on /reading/10/1, /listening/10/1,
      /writing/1; content renders identically to pre-change output.)

## 2. Reading scraper: preserve formatting + fetch explanations

- [x] 2.1 In `scripts/scraper/reading.mjs`, replace the `$p("p").each(...).text()` paragraph collection
      with logic that walks each `<p>`'s child nodes and emits `**...**` for `<strong>/<b>` runs and plain
      text otherwise, still joined with `\n\n` between paragraphs. Handle `<ul>/<ol><li>` blocks (if any
      appear in passage bodies) as `- ` lines. (Added `nodeToMarkup`/`listToMarkup` helpers; also covers
      `<em>/<i>` as bold since the renderer only distinguishes plain vs. emphasized text.)
- [x] 2.2 Add discovery of a "View Answers with Explanations" link on the practice page (an `<a href>` near
      the toggle-box answer key) and, when found, fetch that page and parse its `N. <explanation>` blocks,
      merging matched explanation text into `ReadingQuestion.explanation` by question id. Leave
      `explanation: ""` when no link is found or a given id has no explanation text on that page.
- [x] 2.3 Dry run: `node scripts/scraper/reading.mjs --book 13 --test 1` (delete the existing output file
      first so the skip-if-exists cache doesn't short-circuit it) and confirm passage 1's content now has a
      real paragraph break where `cam-13-test-1.json` previously ran paragraphs together, and that at least
      one question has a non-empty `explanation`. (Verified: 40/40 questions got explanations for Cam 13
      Test 1 and Cam 10 Test 1; found and fixed two follow-up bugs during this dry run - trailing ad/script
      noise leaking into the last question's explanation, and stray spaces before punctuation from stripped
      inline tags.)
- [ ] 2.4 Delete all `src/data/reading/*.json` and re-run the scraper for all books/tests
      (`node scripts/scraper/reading.mjs`), respecting the existing rate-limit delay. (Running in
      background - all 48 files deleted, full re-scrape in progress.)
- [ ] 2.5 Run the `test-data-auditor` subagent against `src/data/reading/**` and confirm: no more
      zero-separator paragraph joins, explanations present for books ~10-15, empty explanations still
      expected/acceptable for books 16+.

## 3. Writing scraper: fix duplication + preserve formatting

- [ ] 3.1 In `scripts/scraper/writing.mjs`, apply the same child-node-walking formatting fix as 2.1 to the
      task1/task2 description/prompt collection.
- [ ] 3.2 Investigate and fix the sample-answer duplication bug (the `$s("div").text()` + 0.35-ratio split
      around line 61) — confirm the actual duplicate-content mechanism first (selector matching multiple
      overlapping containers, or missing dedup) before changing the split logic.
- [ ] 3.3 Dry run against test 1 (`node scripts/scraper/writing.mjs` — check the script's CLI args for a
      single-test mode, or delete just `test-1.json` first) and confirm `task2.sampleAnswer` in the
      regenerated file is no longer duplicated and formatting markers appear where the source has bold/
      lists.
- [ ] 3.4 Delete all `src/data/writing/*.json` and re-run the scraper for all tests.
- [ ] 3.5 Run the `test-data-auditor` subagent against `src/data/writing/**` and confirm no test shows the
      duplication pattern (repeated task-label text within one field) anywhere, not just test-1.

## 4. Listening scraper: fix missing sections + preserve formatting

- [ ] 4.1 Load the live page for one of the 11 affected tests (start with whichever backs
      `cam-10-test-1.json`) in the browser and inspect the actual markup around its Section 2 heading to
      determine why `/(?:SECTION|PART)\s*(\d)/i` against the split-part heading match is failing to
      register section 2.
- [ ] 4.2 Fix the section-heading detection in `scripts/scraper/listening.mjs` accordingly.
- [ ] 4.3 Apply the same child-node-walking formatting fix as 2.1 to the section-content paragraph
      collection.
- [ ] 4.4 Remove the `transcript: ""` field being written into each section object (paired with the type
      removal in task 5).
- [ ] 4.5 Dry run against the book/test from 4.1 (delete its file first) and confirm section 2 is now
      present with correct `questions: {from, to}` and non-empty content.
- [ ] 4.6 Delete all `src/data/listening/cambridge/*.json` and re-run the scraper for all books/tests.
- [ ] 4.7 Run the `test-data-auditor` subagent against `src/data/listening/cambridge/**` and confirm every
      file has sections numbered 1-4 with no gaps, and no run-together paragraph text.

## 5. Type cleanup

- [ ] 5.1 Remove `transcript` from `ListeningSection` in `src/lib/types.ts` (after task 4's re-scrape lands,
      per design.md's migration order).
- [ ] 5.2 Grep `src/` for any remaining reference to `.transcript` on a listening section and remove it
      (expected: none outside the scraper, per the design.md audit of `progress-context.tsx` and
      `github-sync.ts`).

## 6. Verification

- [ ] 6.1 Run `npm run lint` and confirm no new errors beyond the repo's existing pre-existing lint debt
      (see `openspec/changes/add-listening-practice/tasks.md` 3.1 for the baseline count).
- [ ] 6.2 Start the dev server and manually compare one re-scraped reading test, one writing test, and one
      re-scraped listening test (ideally one of the 11 that gained a section) side-by-side against their
      live source pages, confirming paragraph breaks, bold terms, and lists now match, and that the
      listening test shows all four sections.
- [ ] 6.3 In the browser, open a reading test from an older book (should now show explanations after
      submitting) and one from a newer book (should still show no explanation block, same as before —
      confirm this isn't a broken/blank state, just absent).
