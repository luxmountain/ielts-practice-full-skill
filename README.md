# IELTS Practice Hub

Personal IELTS Reading & Writing practice platform. Data scraped from ieltstrainingonline.com (Cambridge IELTS 10-21 + 99 Writing Practice Tests).

## Features

- **Reading Practice** — Split-view passages + questions, submit & check answers, explanations, timer
- **Writing Practice** — Text editor, real-time word count, timer (20/40 min), save drafts, view sample answers side-by-side
- **Progress Tracking** — LocalStorage + GitHub API sync
- **Statistics** — Activity calendar, score distribution, per-book performance
- **Dark Mode** — Toggle light/dark theme
- **Responsive** — Desktop, tablet, mobile

## Getting Started

```bash
npm install
npm run dev
```

## Scraping Data

```bash
# Reading (Cambridge 10-21)
node scripts/scraper/reading.mjs
node scripts/scraper/reading.mjs --book 15 --test 1

# Writing (99 tests)
node scripts/scraper/writing.mjs
node scripts/scraper/writing.mjs --test 10
node scripts/scraper/writing.mjs --from 1 --to 20
```

**Note:** Source has rate limiting. Run with pauses between sessions (2-2.5s delay built in).

## GitHub Progress Sync

1. Go to Settings page
2. Create a [GitHub PAT](https://github.com/settings/tokens/new?scopes=repo) with `repo` scope
3. Enter token + repo + branch
4. Use Sync/Push/Pull buttons

## Deploy

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/USER/ielts-practice.git
git push -u origin main
npx vercel
```

## Tech Stack

Next.js 16 • TypeScript • Tailwind CSS v4 • Lucide React • Cheerio (scraper)
