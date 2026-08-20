# Data model & progress storage

- There is no backend/database. Practice content is static JSON under
  `src/data/{reading,writing,listening}/`, typed by `src/lib/types.ts`
  (`ReadingTest`, `ReadingPassage`, `ReadingQuestion`, `WritingTest`, `WritingTask`).
  Treat `src/lib/types.ts` as the source of truth for that shape — update it first if a
  field needs to change, then update the JSON and the readers together.
- User progress (`UserProgress`, `ReadingProgress`, `WritingProgress`) lives in the browser's
  LocalStorage, managed by `src/lib/progress-context.tsx` (a React context). Any shape change
  to these types must stay readable for progress a real user already has saved — either keep
  it backward-compatible or add an explicit migration in the context provider.
- Optional GitHub sync (`src/lib/github-sync.ts`) pushes/pulls that same progress JSON to a
  user's own repo via a PAT they enter in Settings. It's a thin client of the same shape —
  don't let it drift from what `progress-context.tsx` writes to LocalStorage.
- New content (new Cambridge book/test, new writing test) is added by running the scraper
  scripts under `scripts/scraper/`, not by hand-authoring JSON — see the `ielts-scraper`
  subagent for that workflow, and `test-data-auditor` to validate the output before it's wired
  into the app.
