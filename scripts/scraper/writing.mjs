/**
 * IELTS Writing Scraper
 * Scrapes 99 Writing Practice Tests from ieltstrainingonline.com
 * Usage: node scripts/scraper/writing.mjs [--test 10] [--from 1] [--to 99]
 */
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, existsSync, readFileSync, createWriteStream } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../src/data/writing");
const IMAGE_DIR = resolve(__dirname, "../../public/writing-images");
const BASE_URL = "https://ieltstrainingonline.com";
const DELAY_MS = 2500;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchPage(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (res.status === 404) return null;
      if (!res.ok) { if (attempt < retries) { console.log(`  ⟳ HTTP ${res.status}, retry ${attempt}/${retries}...`); await sleep(5000 * attempt); continue; } return null; }
      return await res.text();
    } catch (e) { if (attempt < retries) { console.log(`  ⟳ ${e.message}, retry ${attempt}/${retries}...`); await sleep(5000 * attempt); continue; } console.error(`  Error: ${e.message}`); return null; }
  }
  return null;
}
  try { const res = await fetch(url); if (!res.ok || !res.body) return false; await pipeline(res.body, createWriteStream(filepath)); return true; } catch { return false; }
}

function parseWritingTest(html, testNum) {
  const $ = cheerio.load(html);
  const result = { testNumber: testNum, task1: { instruction: "You should spend about 20 minutes on this task.", description: "", imageUrl: null, sampleAnswer: "" }, task2: { instruction: "You should spend about 40 minutes on this task.", prompt: "", sampleAnswer: "" } };
  const content = $(".entry-content"); if (!content.length) return result;
  const fullHtml = content.html() || "";
  const t1Start = fullHtml.search(/WRITING\s*TASK\s*1/i), t2Start = fullHtml.search(/WRITING\s*TASK\s*2/i), sampleStart = fullHtml.search(/SAMPLE\s*ANSWER/i);

  if (t1Start >= 0) {
    const t1Html = fullHtml.slice(t1Start, t2Start > t1Start ? t2Start : fullHtml.length);
    const $t1 = cheerio.load(`<div>${t1Html}</div>`);
    const bolds = []; $t1("strong, b").each((_, el) => { const t = $t1(el).text().trim(); if (t.length > 20 && !/WRITING TASK|Write at least|You should spend/i.test(t)) bolds.push(t); });
    result.task1.description = bolds.join("\n\n") || "";
    if (!result.task1.description) { const ps = []; $t1("p").each((_, el) => { const t = $t1(el).text().trim(); if (t.length > 20 && !/WRITING TASK|You should spend|Write at least/i.test(t)) ps.push(t); }); result.task1.description = ps.join("\n\n"); }
    const img = $t1("img").first(); if (img.length) result.task1.imageUrl = img.attr("src") || img.attr("data-src") || null;
  }

  if (t2Start >= 0) {
    const t2Html = fullHtml.slice(t2Start, sampleStart > t2Start ? sampleStart : fullHtml.length);
    const $t2 = cheerio.load(`<div>${t2Html}</div>`);
    const bolds = []; $t2("strong, b").each((_, el) => { const t = $t2(el).text().trim(); if (t.length > 20 && !/WRITING TASK|Write at least|You should spend|Give reasons/i.test(t)) bolds.push(t); });
    result.task2.prompt = bolds.join("\n\n") || "";
    if (!result.task2.prompt) { const ps = []; $t2("p").each((_, el) => { const t = $t2(el).text().trim(); if (t.length > 20 && !/WRITING TASK|You should spend/i.test(t)) ps.push(t); }); result.task2.prompt = ps.join("\n\n"); }
  }

  if (sampleStart >= 0) {
    const sampleHtml = fullHtml.slice(sampleStart);
    const $s = cheerio.load(`<div>${sampleHtml}</div>`);
    const sText = $s("div").text();
    const st1 = sText.search(/WRITING\s*TASK\s*1/i), st2 = sText.search(/WRITING\s*TASK\s*2/i);
    if (st1 >= 0 && st2 >= 0) { result.task1.sampleAnswer = sText.slice(st1 + 14, st2).trim(); result.task2.sampleAnswer = sText.slice(st2 + 14).replace(/Advertisements.*/s, "").trim(); }
    else { const ps = []; $s("p").each((_, el) => { const t = $s(el).text().trim(); if (t.length > 30 && !/SAMPLE ANSWER|Advertisements/i.test(t)) ps.push(t); }); const mid = Math.ceil(ps.length * 0.35); result.task1.sampleAnswer = ps.slice(0, mid).join("\n\n"); result.task2.sampleAnswer = ps.slice(mid).join("\n\n"); }
  }
  result.task1.sampleAnswer = result.task1.sampleAnswer.replace(/\(\d+ words\)/g, "").replace(/Advertisements/g, "").trim();
  result.task2.sampleAnswer = result.task2.sampleAnswer.replace(/\(\d+ words\)/g, "").replace(/Advertisements/g, "").trim();
  return result;
}

async function scrapeAll(targetTest, fromTest, toTest) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(IMAGE_DIR)) mkdirSync(IMAGE_DIR, { recursive: true });
  const start = targetTest || fromTest || 1, end = targetTest || toTest || 99;
  let scraped = 0, failed = 0;
  for (let num = start; num <= end; num++) {
    const outFile = resolve(DATA_DIR, `test-${num}.json`);
    if (existsSync(outFile)) { try { const e = JSON.parse(readFileSync(outFile, "utf-8")); if (e.task2?.prompt) { console.log(`  [skip] test-${num}`); scraped++; continue; } } catch {} }
    console.log(`\nScraping Writing Test ${num}...`);
    const urls = [`${BASE_URL}/ielts-writing-practice-test-${num}/`, `${BASE_URL}/ielts-writing-practice-test-${String(num).padStart(2,"0")}/`];
    let html = null, usedUrl = "";
    for (const url of urls) { html = await fetchPage(url); if (html && html.length > 5000) { usedUrl = url; break; } await sleep(500); }
    if (!html) { console.log(`  ✗ Not found`); failed++; await sleep(DELAY_MS); continue; }
    console.log(`  Found: ${usedUrl}`);
    const data = parseWritingTest(html, num);
    if (data.task1.imageUrl) { const ext = data.task1.imageUrl.split(".").pop()?.split("?")[0] || "png"; const lp = `/writing-images/test-${num}-task1.${ext}`; if (await downloadImage(data.task1.imageUrl, resolve(IMAGE_DIR, `test-${num}-task1.${ext}`))) { data.task1.imageUrl = lp; console.log(`  ✓ Image`); } }
    console.log(`  ✓ T1: ${data.task1.description.length > 10 ? "✓" : "✗"}, T2: ${data.task2.prompt.length > 10 ? "✓" : "✗"}, Samples: ${(data.task1.sampleAnswer.length > 50 || data.task2.sampleAnswer.length > 50) ? "✓" : "✗"}`);
    writeFileSync(outFile, JSON.stringify(data, null, 2)); scraped++; await sleep(DELAY_MS);
  }
  console.log(`\nDone. Scraped: ${scraped}, Failed: ${failed}`);
}

const args = process.argv.slice(2);
let targetTest = null, fromTest = null, toTest = null;
for (let i = 0; i < args.length; i++) { if (args[i] === "--test" && args[i+1]) targetTest = parseInt(args[i+1]); if (args[i] === "--from" && args[i+1]) fromTest = parseInt(args[i+1]); if (args[i] === "--to" && args[i+1]) toTest = parseInt(args[i+1]); }
scrapeAll(targetTest, fromTest, toTest);
