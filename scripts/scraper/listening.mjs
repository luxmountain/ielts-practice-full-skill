/**
 * IELTS Listening Scraper
 * Scrapes Practice Tests (1-50) + Cambridge Tests (10-21) audioscripts from ieltstrainingonline.com
 * Usage: node scripts/scraper/listening.mjs [--type practice|cam] [--test 5] [--from 1] [--to 50]
 *        node scripts/scraper/listening.mjs --type cam --book 15 --test 2
 */
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../src/data/listening");
const BASE_URL = "https://ieltstrainingonline.com";
const DELAY_MS = 4000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchPage(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000)
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        if (attempt < retries) { console.log(`  ⟳ HTTP ${res.status}, retry ${attempt}/${retries}...`); await sleep(5000 * attempt); continue; }
        return null;
      }
      return await res.text();
    } catch (e) {
      if (attempt < retries) { console.log(`  ⟳ ${e.message}, retry ${attempt}/${retries}...`); await sleep(5000 * attempt); continue; }
      console.error(`  Error: ${e.message}`); return null;
    }
  }
  return null;
}

// Cambridge listening URL patterns (books 10-21, tests 1-4)
function getCamUrl(book, test) {
  const testStr = String(test).padStart(2, "0");
  if (book === 21) return `${BASE_URL}/audioscripts-cam-21-listening-test-${testStr}/`;
  if (book >= 17 && book <= 20) return `${BASE_URL}/audioscripts-cambridge-ielts-0${book}-listening-test-${testStr}/`;
  if (book === 16) return `${BASE_URL}/audio-script-cambridge-ielts-16-listening-test-${testStr}/`;
  if (book === 15) return `${BASE_URL}/audio-script-cambridge-ielts-15-listening-test-${testStr}/`;
  if (book === 14) return `${BASE_URL}/transcript-cambridge-ielts-14-listening-test-${testStr}/`;
  // books 10-13
  return `${BASE_URL}/audio-script-cambridge-ielts-${book}-listening-test-${testStr}/`;
}

function getPracticeUrl(testNum) {
  const testStr = String(testNum).padStart(2, "0");
  return `${BASE_URL}/audioscript-ielts-listening-practice-test-${testStr}/`;
}

function parseListeningTest(html, meta) {
  const $ = cheerio.load(html);
  const content = $(".entry-content");
  if (!content.length) return null;

  const result = { ...meta, sections: [], answers: {} };
  const fullHtml = content.html() || "";
  const fullText = content.text();

  // Extract audio URLs
  const audioUrls = [];
  content.find("a[href$='.mp3'], a[href*='wp-content/uploads']").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.includes(".mp3")) audioUrls.push(href);
  });
  // Also scan raw HTML for mp3 links
  const mp3Matches = fullHtml.match(/https?:\/\/[^\s"<]+\.mp3/g) || [];
  mp3Matches.forEach(u => { if (!audioUrls.includes(u)) audioUrls.push(u); });

  // Split by sections
  const sectionParts = fullHtml.split(/(?=<h3[^>]*>\s*(?:<[^>]*>)*\s*SECTION\s*\d)/i);
  let sectionNum = 0;

  for (const part of sectionParts) {
    if (!/SECTION\s*\d/i.test(part)) continue;
    sectionNum++;
    const $s = cheerio.load(`<div>${part}</div>`);
    const section = { number: sectionNum, audioUrl: audioUrls[sectionNum - 1] || null, transcript: "" };

    // Get transcript text
    const paras = [];
    $s("p").each((_, el) => {
      const t = $s(el).text().trim();
      if (t.length > 5 && !/^Advertisements$/i.test(t) && !/Listening Practice Test \d+/i.test(t)) {
        paras.push(t);
      }
    });
    section.transcript = paras.join("\n\n");
    if (section.transcript.length > 50) result.sections.push(section);
  }

  // Extract answers - look for answer section at bottom
  const answerMatch = fullText.match(/(?:Section\s*1|##### Section 1)([\s\S]*?)$/i);
  if (answerMatch) {
    const answerText = answerMatch[0];
    // Parse individual answers: number followed by answer text
    const answerLines = answerText.split("\n");
    let currentSection = 0;
    for (const line of answerLines) {
      const secMatch = line.match(/Section\s*(\d)/i);
      if (secMatch) { currentSection = parseInt(secMatch[1]); continue; }
      const aMatch = line.trim().match(/^(\d{1,2})\s+(.+)/);
      if (aMatch) {
        const qNum = parseInt(aMatch[1]);
        const answer = aMatch[2].trim();
        if (qNum >= 1 && qNum <= 40 && answer.length > 0 && answer.length < 100) {
          result.answers[qNum] = answer;
        }
      }
    }
  }

  return result;
}

async function scrapePracticeTests(fromTest, toTest) {
  const dir = resolve(DATA_DIR, "practice");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let scraped = 0, failed = 0;
  for (let num = fromTest; num <= toTest; num++) {
    const outFile = resolve(dir, `test-${num}.json`);
    if (existsSync(outFile)) {
      try {
        const e = JSON.parse(readFileSync(outFile, "utf-8"));
        if (e.sections?.length > 0) { console.log(`  [skip] Practice Test ${num}`); scraped++; continue; }
      } catch {}
    }

    console.log(`\nScraping Listening Practice Test ${num}...`);
    const url = getPracticeUrl(num);
    const html = await fetchPage(url);
    if (!html || html.length < 3000) { console.log(`  ✗ Not found (${url})`); failed++; await sleep(DELAY_MS); continue; }

    const data = parseListeningTest(html, { type: "practice", testNumber: num, title: `Listening Practice Test ${num}` });
    if (!data || data.sections.length === 0) { console.log(`  ✗ No sections parsed`); failed++; await sleep(DELAY_MS); continue; }

    console.log(`  ✓ ${data.sections.length} sections, ${Object.keys(data.answers).length} answers, audio: ${data.sections.filter(s => s.audioUrl).length}`);
    writeFileSync(outFile, JSON.stringify(data, null, 2));
    scraped++; await sleep(DELAY_MS);
  }
  return { scraped, failed };
}

async function scrapeCamTests(targetBook, targetTest) {
  const dir = resolve(DATA_DIR, "cambridge");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let scraped = 0, failed = 0;
  const books = targetBook ? [targetBook] : Array.from({ length: 12 }, (_, i) => 10 + i);

  for (const book of books) {
    const tests = targetTest ? [targetTest] : [1, 2, 3, 4];
    for (const test of tests) {
      const outFile = resolve(dir, `cam-${book}-test-${test}.json`);
      if (existsSync(outFile)) {
        try {
          const e = JSON.parse(readFileSync(outFile, "utf-8"));
          if (e.sections?.length > 0) { console.log(`  [skip] Cam ${book} Test ${test}`); scraped++; continue; }
        } catch {}
      }

      console.log(`\nScraping Cambridge ${book} Listening Test ${test}...`);
      const url = getCamUrl(book, test);
      const html = await fetchPage(url);
      if (!html || html.length < 3000) { console.log(`  ✗ Not found (${url})`); failed++; await sleep(DELAY_MS); continue; }

      const data = parseListeningTest(html, { type: "cambridge", book, test, title: `Cambridge IELTS ${book} Listening Test ${test}` });
      if (!data || data.sections.length === 0) { console.log(`  ✗ No sections parsed`); failed++; await sleep(DELAY_MS); continue; }

      console.log(`  ✓ ${data.sections.length} sections, ${Object.keys(data.answers).length} answers`);
      writeFileSync(outFile, JSON.stringify(data, null, 2));
      scraped++; await sleep(DELAY_MS);
    }
  }
  return { scraped, failed };
}

async function main() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const args = process.argv.slice(2);
  let type = null, test = null, fromTest = null, toTest = null, book = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type" && args[i+1]) type = args[i+1];
    if (args[i] === "--test" && args[i+1]) test = parseInt(args[i+1]);
    if (args[i] === "--from" && args[i+1]) fromTest = parseInt(args[i+1]);
    if (args[i] === "--to" && args[i+1]) toTest = parseInt(args[i+1]);
    if (args[i] === "--book" && args[i+1]) book = parseInt(args[i+1]);
  }

  const results = [];

  if (!type || type === "practice") {
    const from = test || fromTest || 1;
    const to = test || toTest || 50;
    console.log(`\n=== Listening Practice Tests (${from}-${to}) ===`);
    results.push(await scrapePracticeTests(from, to));
  }

  if (!type || type === "cam") {
    console.log(`\n=== Cambridge Listening Tests (Book ${book || "10-21"}) ===`);
    results.push(await scrapeCamTests(book, test));
  }

  const total = results.reduce((acc, r) => ({ scraped: acc.scraped + r.scraped, failed: acc.failed + r.failed }), { scraped: 0, failed: 0 });
  console.log(`\nDone. Scraped: ${total.scraped}, Failed: ${total.failed}`);
}

main();
