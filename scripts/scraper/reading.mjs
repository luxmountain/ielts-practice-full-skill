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
  const passageParts = fullHtml.split(/(?=<[^>]*>\s*(?:<[^>]*>\s*)*READING PASSAGE\s*\d)/i);
  let num = 0;
  for (const part of passageParts) {
    if (!/READING PASSAGE/i.test(part)) continue;
    num++;
    const $p = cheerio.load(`<div id="root">${part}</div>`);
    const passage = { number: num, title: "", content: "", questions: [] };
    $p("h2, h1").each((_, el) => { const t = $p(el).text().trim(); if (t && !/READING PASSAGE/i.test(t) && !passage.title) passage.title = t; });
    const paras = []; let hitQ = false;
    $p("p").each((_, el) => { const t = $p(el).text().trim(); if (/^Questions?\s*\d/i.test(t)) hitQ = true; if (!hitQ && t.length > 15) { const c = t.replace(/\s*\(Q\d+.*?\)/g, "").replace(/READING PASSAGE\s*\d/i, "").trim(); if (c.length > 15 && !/^You should spend/i.test(c)) paras.push(c); } });
    passage.content = paras.join("\n\n");
    passage.questions = extractAnswers(part);
    if (passage.content || passage.questions.length > 0) result.passages.push(passage);
  }
  if (result.passages.length === 0) { const allA = extractAnswers(fullHtml); if (allA.length > 0) result.passages.push({ number: 1, title: result.title, content: "", questions: allA }); }
  return result;
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
      const url = urls[key] || `${BASE_URL}/cambridge-ielts-${book}-reading-test-${test}-answers-with-explanations/`;
      const html = await fetchPage(url);
      if (!html || html.length < 5000) { console.log(`  ✗ Not found`); failed++; await sleep(DELAY_MS); continue; }
      console.log(`  Found: ${url}`);
      const data = parseReadingTest(html, book, test);
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
