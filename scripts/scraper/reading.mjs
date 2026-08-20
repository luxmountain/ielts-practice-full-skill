/**
 * IELTS Reading Scraper
 * Scrapes Cambridge IELTS 10-21 reading tests from ieltstrainingonline.com
 * Usage: node scripts/scraper/reading.mjs [--book 15] [--test 1]
 */
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../src/data/reading");
const BASE_URL = "https://ieltstrainingonline.com";
const DELAY_MS = 2000;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchPage(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (res.status === 404) return null;
      if (!res.ok) { if (attempt < retries) { console.log(`  ⟳ HTTP ${res.status}, retry ${attempt}/${retries}...`); await sleep(5000 * attempt); continue; } return null; }
      return await res.text();
    } catch (e) { if (attempt < retries) { console.log(`  ⟳ ${e.message}, retry ${attempt}/${retries}...`); await sleep(5000 * attempt); continue; } console.error(`  Error: ${e.message}`); return null; }
  }
  return null;
}

function parseReadingTest(html, book, test) {
  const $ = cheerio.load(html);
  const result = { book, test, title: `Cambridge IELTS ${book} Reading Test ${test}`, passages: [] };
  const content = $(".entry-content");
  if (!content.length) return result;
  const fullHtml = content.html() || "";
  // Only split on real passage headings (an h1-h6 opening tag immediately leading into "READING
  // PASSAGE N"), not on prose that merely mentions "Reading Passage N" mid-sentence (e.g. "based on
  // Reading Passage 1 below" inside a <span>), which the old bare-tag lookahead used to false-split on.
  const passageParts = fullHtml.split(/(?=<h[1-6][^>]*>\s*(?:<[^>]*>\s*)*READING PASSAGE\s*\d)/i);
  // Newer site pages (books 16+) moved the answer key out of the passage/question body entirely into
  // a set of "Passage N" toggle boxes appended after all passages (see extractAnswerKeyBox). Build
  // that map once from the whole document so it can be merged into each passage below.
  const answerKeyBox = extractAnswerKeyBox(fullHtml);
  let num = 0;
  for (const part of passageParts) {
    if (!/READING PASSAGE/i.test(part)) continue;
    num++;
    const $p = cheerio.load(`<div id="root">${part}</div>`);
    const passage = { number: num, title: "", content: "", questions: [] };
    $p("h2, h1").each((_, el) => { const t = $p(el).text().trim(); if (t && !/READING PASSAGE/i.test(t) && !passage.title) passage.title = t; });
    const paras = []; let hitQ = false;
    // Besides an explicit "Questions N-M" header, newer pages (verified live on
    // https://ieltstrainingonline.com/practice-cam-13-reading-test-01-with-answer/) introduce each
    // question block with an instruction line that never contains the literal word "Questions" (e.g.
    // "Complete the table below...", "Do the following statements agree with the information given in
    // Reading Passage 1?"), so relying on that word alone left question prompts/options bleeding into
    // passage.content. Also treat these common IELTS instruction/legend openers as the start of the
    // questions section.
    const questionsHeaderRe = /^Questions?\s*\d|^(Complete|Choose|Do the following|Look at|Which of|Match |Classify|Label|Reading Passage \d has)\b/i;
    $p("p").each((_, el) => { const t = $p(el).text().trim(); if (questionsHeaderRe.test(t) && !/^You should spend/i.test(t)) hitQ = true; if (!hitQ && t.length > 15) { const c = t.replace(/\s*\(Q\d+.*?\)/g, "").replace(/READING PASSAGE\s*\d/i, "").trim(); if (c.length > 15 && !/^You should spend/i.test(c)) paras.push(c); } });
    passage.content = paras.join("\n\n");
    // The last passage's "part" slice runs through the end of the document, which (on newer pages)
    // includes the trailing toggle-box answer key for ALL passages. Cut that off before running the
    // old inline-<strong> extraction so it doesn't pick up other passages' answer-key lines.
    const toggleIdx = part.search(/et_pb_toggle/i);
    passage.questions = extractAnswers(toggleIdx === -1 ? part : part.slice(0, toggleIdx));
    // Determine which question IDs belong to this passage (from its own "Questions X-Y" header) and
    // apply the toggle-box answer key for every ID in that range. The toggle box is the page's
    // published, authoritative answer key, so it wins over inline-extracted answer/type (which can
    // false-positive - e.g. a "Paragraph A"/"Paragraph B" section-label line in the passage prose
    // being mistaken by extractAnswers' bare "N  LETTER" matching-question heuristic for an answer to
    // question N). Any "text" (matching-question clue) already captured by extractAnswers is kept.
    const rangeMatch = part.replace(/<[^>]+>/g, " ").match(/Questions?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]), end = parseInt(rangeMatch[2]);
      const byId = new Map(passage.questions.map((q) => [q.id, q]));
      for (let id = start; id <= end; id++) {
        const boxed = answerKeyBox[id];
        if (!boxed) continue;
        const existing = byId.get(id);
        if (existing) { existing.answer = boxed.answer; existing.type = boxed.type; }
        else { const q = { id, answer: boxed.answer, type: boxed.type, explanation: "" }; passage.questions.push(q); byId.set(id, q); }
      }
      passage.questions.sort((a, b) => a.id - b.id);
    }
    if (passage.content || passage.questions.length > 0) result.passages.push(passage);
  }
  if (result.passages.length === 0) { const allA = extractAnswers(fullHtml); if (allA.length > 0) result.passages.push({ number: 1, title: result.title, content: "", questions: allA }); }
  return result;
}

// Newer pages publish answers as plain "<num>  <value>" lines inside Divi "toggle" boxes titled
// "Passage 1/2/3", appended after all reading passages (e.g. https://ieltstrainingonline.com/practice-cam-18-reading-test-04-with-answer/),
// instead of embedding <strong> answers inline in the question text. Parse that block into an
// { [questionId]: { answer, type } } map. Combined-answer lines like "10&11  C, D" map to two ids.
// Some pages (verified live on https://ieltstrainingonline.com/practice-cam-13-reading-test-01-with-answer/)
// use "<num>. <value>" (period after the number, one answer per <p>) instead of whitespace-separated
// - the separator below accepts either "." or whitespace so both layouts match.
function extractAnswerKeyBox(fullHtml) {
  const map = {};
  const startIdx = fullHtml.search(/et_pb_toggle_content/i);
  if (startIdx === -1) return map;
  const clean = fullHtml.slice(startIdx).replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  for (const rawLine of clean.split("\n")) {
    const t = rawLine.trim();
    if (!t) continue;
    const m = t.match(/^(\d{1,2})(?:\s*&\s*(\d{1,2}))?[.\s]+(.+)$/);
    if (!m) continue;
    const id1 = parseInt(m[1]);
    if (id1 < 1 || id1 > 40) continue;
    const id2 = m[2] ? parseInt(m[2]) : null;
    const valueStr = m[3].trim();
    const values = id2 ? valueStr.split(",").map((v) => v.trim()) : [valueStr];
    const ids = id2 ? [id1, id2] : [id1];
    ids.forEach((id, i) => {
      const v = values[i] || values[0];
      if (!v || id < 1 || id > 40) return;
      let type = "fill-in";
      if (/^(TRUE|FALSE|NOT GIVEN|YES|NO)$/i.test(v)) type = "true-false-ng";
      else if (/^[A-J]$/.test(v)) type = "multiple-choice";
      let answer = v;
      if (type === "true-false-ng") { const up = v.toUpperCase(); answer = up.charAt(0) + up.slice(1).toLowerCase(); }
      else if (type === "multiple-choice") answer = v.toUpperCase();
      else answer = v.charAt(0).toUpperCase() + v.slice(1);
      map[id] = { answer, type };
    });
  }
  return map;
}

function extractAnswers(html) {
  const questions = [];
  // Fill-in: <strong>N</strong>…<strong>answer</strong>…
  let m; const r1 = /<strong>(\d{1,2})<\/strong>\s*[\u2026\.…]+\s*<strong>([^<]+)<\/strong>/g;
  while ((m = r1.exec(html)) !== null) { const id = parseInt(m[1]); let a = m[2].trim().replace(/\s*\(Q\d+.*?\)/g, "").trim(); if (id > 0 && id <= 40 && a.length > 0 && a.length < 100) questions.push({ id, answer: a, type: "fill-in", explanation: "" }); }
  // T/F/NG: <strong>N</strong> text <strong>TRUE|FALSE|NOT GIVEN</strong>
  const r2 = /<strong>(\d{1,2})<\/strong>\s+[^<]+<strong>(TRUE|FALSE|NOT GIVEN|YES|NO)<\/strong>/gi;
  while ((m = r2.exec(html)) !== null) { const id = parseInt(m[1]); if (id > 0 && id <= 40) questions.push({ id, answer: m[2].toUpperCase(), type: "true-false-ng", explanation: "" }); }
  // Matching: N\xa0\xa0 text. LETTER
  const clean = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "\u00a0");
  for (const line of clean.split("\n")) {
    const t = line.trim();
    const mm = t.match(/^(\d{1,2})[\s\u00a0]{2,}(.+?)\.\s+([A-H])\s*$/) || t.match(/^(\d{1,2})[\s\u00a0]{2,}(.{10,}?)\s+([A-H])\s*$/);
    if (mm) { const id = parseInt(mm[1]); if (id > 0 && id <= 40) questions.push({ id, answer: mm[3], type: "matching", text: mm[2].trim(), explanation: "" }); }
    const sm = t.match(/^(\d{1,2})[\s\u00a0]+([A-H])\s*$/);
    if (sm) { const id = parseInt(sm[1]); if (id > 0 && id <= 40) questions.push({ id, answer: sm[2], type: "multiple-choice", explanation: "" }); }
  }
  // Explanations from (Q1) markers
  const expMap = {}; const qr = /\(Q(\d+)(?:[,\s]*Q?(\d+))*\)/g; const txt = html.replace(/<[^>]+>/g, " ");
  while ((m = qr.exec(txt)) !== null) { const ids = [parseInt(m[1])]; if (m[2]) ids.push(parseInt(m[2])); const ctx = txt.slice(Math.max(0, m.index - 150), Math.min(txt.length, m.index + 150)).replace(/\(Q\d+.*?\)/g, "").replace(/\s+/g, " ").trim(); for (const id of ids) if (!expMap[id]) expMap[id] = ctx; }
  for (const q of questions) if (expMap[q.id]) q.explanation = expMap[q.id];
  const seen = new Set();
  return questions.filter((q) => { if (seen.has(q.id)) return false; seen.add(q.id); return true; }).sort((a, b) => a.id - b.id);
}

// The site restructured URLs for the Divi redesign: "practice-cam-{book}-reading-test-{padded}-with-answer/"
// now exists for ALL books 10-20 per the live post-sitemap.xml (confirmed 2026-08-20, e.g.
// https://ieltstrainingonline.com/practice-cam-13-reading-test-01-with-answer/), not just 16+ as
// previously assumed. Book 21 drops the "-with-answer" suffix. The legacy
// "cambridge-ielts-{book}-reading-test-{test}-answers-with-explanations" slug (what discoverUrls'
// listing-page scrape still links to for books 10-15) increasingly 302s to an
// "answers-and-explanations-for-..." page that on some books/tests now contains ONLY the answer
// explanations (no passage text, no "READING PASSAGE" heading at all) - the site appears to have
// split what used to be a single passage+answers page into two. Always prefer this canonical
// "-with-answer" URL; getLegacyReadingUrl is kept only as a last-resort fallback.
function getReadingUrl(book, test) {
  const testStr = String(test).padStart(2, "0");
  if (book === 21) return `${BASE_URL}/practice-cam-21-reading-test-${testStr}/`;
  return `${BASE_URL}/practice-cam-${book}-reading-test-${testStr}-with-answer/`;
}

function getLegacyReadingUrl(book, test) {
  return `${BASE_URL}/cambridge-ielts-${book}-reading-test-${test}-answers-with-explanations/`;
}

async function discoverUrls() {
  const html = await fetchPage(`${BASE_URL}/practice-tests-for-ielts-reading/`);
  if (!html) return {};
  const $ = cheerio.load(html); const urls = {};
  $("a[href]").each((_, el) => { const h = $(el).attr("href") || ""; const m = h.match(/cambridge-ielts-(\d+)-reading-test-(\d+)/); if (m) urls[`${m[1]}-${m[2]}`] = h.startsWith("http") ? h : `${BASE_URL}${h}`; });
  console.log(`  Found ${Object.keys(urls).length} URLs`); return urls;
}

async function scrapeAll(targetBook, targetTest) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  console.log("Discovering URLs..."); const urls = await discoverUrls(); await sleep(1000);
  const books = targetBook ? [targetBook] : Array.from({ length: 12 }, (_, i) => 10 + i);
  let scraped = 0, failed = 0;
  for (const book of books) {
    for (const test of (targetTest ? [targetTest] : [1, 2, 3, 4])) {
      const key = `${book}-${test}`, outFile = resolve(DATA_DIR, `cam-${book}-test-${test}.json`);
      if (existsSync(outFile)) { try { const e = JSON.parse(readFileSync(outFile, "utf-8")); if (e.passages?.reduce((s, p) => s + (p.questions?.length || 0), 0) > 5) { console.log(`  [skip] cam-${book}-test-${test}`); scraped++; continue; } } catch {} }
      console.log(`\nScraping Cam ${book} Test ${test}...`);
      // Try the canonical "-with-answer" URL first (has full passage text + questions). Only fall
      // back to the discovered/legacy listing URL - which on several books/tests now points at an
      // explanations-only page with no passage content - if the canonical page 404s or is emptied.
      let url = getReadingUrl(book, test);
      let html = await fetchPage(url);
      let data = html && html.length >= 5000 ? parseReadingTest(html, book, test) : null;
      if (!data || data.passages.length === 0) {
        await sleep(DELAY_MS);
        const fallbackUrl = urls[key] || getLegacyReadingUrl(book, test);
        console.log(`  ⟳ Canonical URL yielded no passages, trying fallback: ${fallbackUrl}`);
        const fallbackHtml = await fetchPage(fallbackUrl);
        if (fallbackHtml && fallbackHtml.length >= 5000) { url = fallbackUrl; html = fallbackHtml; data = parseReadingTest(html, book, test); }
      }
      if (!html || html.length < 5000 || !data) { console.log(`  ✗ Not found`); failed++; await sleep(DELAY_MS); continue; }
      console.log(`  Found: ${url}`);
      const qc = data.passages.reduce((s, p) => s + p.questions.length, 0);
      console.log(`  ✓ ${data.passages.length} passages, ${qc} questions`);
      writeFileSync(outFile, JSON.stringify(data, null, 2)); scraped++; await sleep(DELAY_MS);
    }
  }
  console.log(`\nDone. Scraped: ${scraped}, Failed: ${failed}`);
}

const args = process.argv.slice(2);
let book = null, test = null;
for (let i = 0; i < args.length; i++) { if (args[i] === "--book" && args[i+1]) book = parseInt(args[i+1]); if (args[i] === "--test" && args[i+1]) test = parseInt(args[i+1]); }
scrapeAll(book, test);
