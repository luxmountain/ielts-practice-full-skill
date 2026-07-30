/**
 * IELTS Listening Scraper (practicepteonline.com)
 * Scrapes Cambridge IELTS 10-21 listening tests (questions + answers, no audio)
 * Usage:
 *   node scripts/scraper/listening-pte.mjs
 *   node scripts/scraper/listening-pte.mjs --book 15
 *   node scripts/scraper/listening-pte.mjs --book 15 --test 1
 */
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../src/data/listening/cambridge");
const BASE_URL = "https://practicepteonline.com";
const DELAY_MS = 2500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        if (attempt < retries) {
          console.log(`  ⟳ HTTP ${res.status}, retry ${attempt}/${retries}...`);
          await sleep(5000 * attempt);
          continue;
        }
        return null;
      }
      return await res.text();
    } catch (e) {
      if (attempt < retries) {
        console.log(`  ⟳ ${e.message}, retry ${attempt}/${retries}...`);
        await sleep(5000 * attempt);
        continue;
      }
      console.error(`  Error: ${e.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Discover listening test URLs from a book's index page
 */
async function discoverBookUrls(book) {
  let bookUrl;
  if (book === 19) {
    bookUrl = `${BASE_URL}/official-ielts-book-19/`;
  } else {
    bookUrl = `${BASE_URL}/official-ielts-tests-book-${book}/`;
  }

  console.log(`  Fetching book index: ${bookUrl}`);
  const html = await fetchPage(bookUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const listening = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    if (href.includes("ielts-listening-test-")) {
      listening.push(fullUrl);
    }
  });

  return listening;
}

/**
 * Parse listening test page into structured data
 */
function parseListeningTest(html, book, test) {
  const $ = cheerio.load(html);
  const content = $(".entry-content");
  if (!content.length) return null;

  const result = {
    type: "cambridge",
    book,
    test,
    title: `Cambridge IELTS ${book} Listening Test ${test}`,
    sections: [],
    answers: {},
  };

  const fullText = content.text();

  // Extract answers from "Show Answers" section
  // Method 1: Parse <ol><li> structured HTML
  const olItems = [];
  content.find("ol li").each((_, el) => {
    olItems.push($(el).text().trim());
  });
  if (olItems.length >= 30) {
    for (let i = 0; i < olItems.length && i < 40; i++) {
      const answer = olItems[i].replace(/\s+/g, " ").trim();
      if (answer.length > 0 && answer.length < 150) {
        result.answers[i + 1] = answer;
      }
    }
  }

  // Method 2: text-based fallback
  if (Object.keys(result.answers).length < 30) {
    const answerIdx = fullText.indexOf("Show Answers");
    if (answerIdx > -1) {
      result.answers = {};
      const answerText = fullText.slice(answerIdx + "Show Answers".length).trim();

      // Try line-based first
      const lines = answerText.split("\n").filter((l) => l.trim());
      if (lines.length >= 20) {
        for (const line of lines) {
          const t = line.trim();
          const m = t.match(/^(\d{1,2})[.\s)]+\s*(.+)/);
          if (m) {
            const id = parseInt(m[1]);
            let answer = m[2].trim();
            if (id >= 1 && id <= 40 && answer.length > 0 && answer.length < 150) {
              result.answers[id] = answer;
            }
          }
        }
      }

      // Fallback: concatenated format "1. Answer2. Answer..."
      if (Object.keys(result.answers).length < 30) {
        result.answers = {};
        let remaining = answerText;
        for (let expected = 1; expected <= 40; expected++) {
          const prefix = `${expected}.`;
          const prefixIdx = remaining.indexOf(prefix);
          if (prefixIdx === -1) continue;
          remaining = remaining.slice(prefixIdx + prefix.length);
          const nextPrefix = `${expected + 1}.`;
          const nextIdx = remaining.indexOf(nextPrefix);
          let answer;
          if (nextIdx > 0) {
            answer = remaining.slice(0, nextIdx).trim();
          } else {
            answer = remaining.trim().split(/\n/)[0]?.trim() || remaining.trim();
          }
          answer = answer.replace(/\s+/g, " ").trim();
          if (answer.length > 0 && answer.length < 150) {
            result.answers[expected] = answer;
          }
        }
      }
    }
  }

  // Split content into 4 parts/sections
  const partHeaders = [];
  content.find("p, h2, h3, h4").each((_, el) => {
    const text = $(el).text().trim();
    if (/^Part\s*\d\s*:/i.test(text) || /^\*\*Part\s*\d/i.test(text) || /^Section\s*\d/i.test(text)) {
      partHeaders.push({ text, index: partHeaders.length });
    }
  });

  // Get all paragraphs
  const allParagraphs = [];
  content.find("p").each((_, el) => {
    allParagraphs.push($(el).text().trim());
  });

  // Identify part boundaries by searching for "Part N:" pattern
  const mainText = fullText.split("Show Answers")[0];
  const partMatches = [...mainText.matchAll(/Part\s*(\d)\s*:\s*Questions?\s*(\d+)[\s–-]+(\d+)/gi)];

  if (partMatches.length >= 2) {
    // Parse sections based on Part markers
    for (let i = 0; i < partMatches.length; i++) {
      const partNum = parseInt(partMatches[i][1]);
      const qFrom = parseInt(partMatches[i][2]);
      const qTo = parseInt(partMatches[i][3]);

      const startIdx = partMatches[i].index;
      const endIdx = i + 1 < partMatches.length ? partMatches[i + 1].index : mainText.length;
      const sectionText = mainText.slice(startIdx, endIdx);

      const section = {
        number: partNum,
        questions: { from: qFrom, to: qTo },
        content: sectionText.trim(),
        audioUrl: null,
        transcript: "",
      };

      result.sections.push(section);
    }
  } else {
    // Fallback: just store the full question text as one section
    // and split by standard IELTS listening: Q1-10, Q11-20, Q21-30, Q31-40
    const standardParts = [
      { number: 1, from: 1, to: 10 },
      { number: 2, from: 11, to: 20 },
      { number: 3, from: 21, to: 30 },
      { number: 4, from: 31, to: 40 },
    ];

    for (const part of standardParts) {
      result.sections.push({
        number: part.number,
        questions: { from: part.from, to: part.to },
        content: "",
        audioUrl: null,
        transcript: "",
      });
    }
  }

  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function scrapeAll(targetBook, targetTest) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const books = targetBook ? [targetBook] : Array.from({ length: 12 }, (_, i) => 10 + i);
  let scraped = 0;
  let failed = 0;
  let skipped = 0;

  for (const book of books) {
    console.log(`\n═══ Cambridge IELTS ${book} (Listening) ═══`);

    // Discover URLs from book index page
    const urls = await discoverBookUrls(book);
    await sleep(DELAY_MS);

    if (urls.length === 0) {
      console.log(`  ✗ No listening test URLs found for book ${book}`);
      failed += 4;
      continue;
    }

    console.log(`  Found ${urls.length} listening tests`);

    const tests = targetTest ? [targetTest] : [1, 2, 3, 4];

    for (const test of tests) {
      const testIdx = test - 1;
      const outFile = resolve(DATA_DIR, `cam-${book}-test-${test}.json`);

      // Skip if already has good data
      if (existsSync(outFile)) {
        try {
          const existing = JSON.parse(readFileSync(outFile, "utf-8"));
          const ansCount = Object.keys(existing.answers || {}).length;
          if (ansCount >= 30) {
            console.log(`  [skip] cam-${book}-test-${test} (${ansCount} answers)`);
            skipped++;
            continue;
          }
        } catch {}
      }

      if (testIdx >= urls.length) {
        console.log(`  ✗ cam-${book}-test-${test}: no URL (only ${urls.length} tests found)`);
        failed++;
        continue;
      }

      const url = urls[testIdx];
      console.log(`  Scraping cam-${book}-test-${test}...`);
      console.log(`    URL: ${url}`);

      const html = await fetchPage(url);
      if (!html || html.length < 3000) {
        console.log(`    ✗ Failed to fetch or content too short`);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const data = parseListeningTest(html, book, test);
      if (!data) {
        console.log(`    ✗ Failed to parse`);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const ansCount = Object.keys(data.answers).length;
      console.log(`    ✓ ${data.sections.length} sections, ${ansCount} answers`);

      writeFileSync(outFile, JSON.stringify(data, null, 2));
      scraped++;
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n════════════════════════════════`);
  console.log(`Done. Scraped: ${scraped}, Skipped: ${skipped}, Failed: ${failed}`);
}

// Parse CLI args
const args = process.argv.slice(2);
let book = null;
let test = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--book" && args[i + 1]) book = parseInt(args[i + 1]);
  if (args[i] === "--test" && args[i + 1]) test = parseInt(args[i + 1]);
}

scrapeAll(book, test);
