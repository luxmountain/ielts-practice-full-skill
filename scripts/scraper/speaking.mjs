/**
 * IELTS Speaking Scraper
 * Scrapes Speaking Part 1 (42 topics) + Part 2 (100 topics) from ieltstrainingonline.com
 * Usage: node scripts/scraper/speaking.mjs [--part 1|2] [--topic 5] [--from 1] [--to 42]
 */
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../src/data/speaking");
const BASE_URL = "https://ieltstrainingonline.com";
const DELAY_MS = 2500;

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
      if (!res.ok) { if (attempt < retries) { console.log(`  ⟳ HTTP ${res.status}, retry ${attempt}/${retries}...`); await sleep(5000 * attempt); continue; } return null; }
      return await res.text();
    } catch (e) { if (attempt < retries) { console.log(`  ⟳ ${e.message}, retry ${attempt}/${retries}...`); await sleep(5000 * attempt); continue; } console.error(`  Error: ${e.message}`); return null; }
  }
  return null;
}

// Part 1 topic URLs (42 topics)
const PART1_TOPICS = [
  { num: 1, name: "Name", slug: "name" },
  { num: 2, name: "Study/Work", slug: "study-work" },
  { num: 3, name: "Hometown", slug: "hometown" },
  { num: 4, name: "Accommodation", slug: "accommodation" },
  { num: 5, name: "Weather", slug: "weather" },
  { num: 6, name: "Punctual", slug: "punctual" },
  { num: 7, name: "Television", slug: "television" },
  { num: 8, name: "Museum", slug: "museum" },
  { num: 9, name: "Holidays", slug: "holidays" },
  { num: 10, name: "Film", slug: "film" },
  { num: 11, name: "Leisure Time", slug: "leisure-time" },
  { num: 12, name: "Sports", slug: "sports" },
  { num: 13, name: "Fruits", slug: "vegetables-and-fruits" },
  { num: 14, name: "Math", slug: "maths" },
  { num: 15, name: "Sky", slug: "sky" },
  { num: 16, name: "Clothes", slug: "clothes" },
  { num: 17, name: "Weekend", slug: "weekend" },
  { num: 18, name: "Reading", slug: "reading" },
  { num: 19, name: "Sleep", slug: "sleep" },
  { num: 20, name: "Tree", slug: "tree" },
  { num: 21, name: "Newspaper", slug: "newspaper" },
  { num: 22, name: "Text Messages", slug: "text-messages" },
  { num: 23, name: "Memorising", slug: "memorising" },
  { num: 24, name: "Friend", slug: "friend" },
  { num: 25, name: "Travelling", slug: "travelling" },
  { num: 26, name: "Transportation", slug: "transportation" },
  { num: 27, name: "Letters or Emails", slug: "letters-or-emails" },
  { num: 28, name: "Swimming", slug: "swimming" },
  { num: 29, name: "Snacks", slug: "snacks" },
  { num: 30, name: "Photography", slug: "photography" },
  { num: 31, name: "Help", slug: "help" },
  { num: 32, name: "History", slug: "history" },
  { num: 33, name: "Handwriting", slug: "handwriting" },
  { num: 34, name: "Music", slug: "music" },
  { num: 35, name: "Colours", slug: "colours" },
  { num: 36, name: "Teachers", slug: "teachers" },
  { num: 37, name: "Being in a Hurry", slug: "being-in-a-hurry" },
  { num: 38, name: "Being Alone", slug: "being-alone" },
  { num: 39, name: "Team Work", slug: "team-work" },
  { num: 40, name: "Countryside", slug: "countryside" },
  { num: 41, name: "Social Network", slug: "social-network" },
  { num: 42, name: "Hanging out with Friends", slug: "hanging-out-with-friends" },
];

// Part 2 topic URLs (100 topics) - scraped from index page
const PART2_URLS = [
  "ielts-speaking-part-2-topic-describe-a-foreign-country-you-would-like-to-go-to",
  "ielts-speaking-part-2-topic-describe-a-gift-that-you-recently-gave-to-others",
  "ielts-speaking-part-2-topic-describe-an-interesting-song",
  "ielts-speaking-part-2-topic-describe-a-creative-inventor-or-musician",
  "ielts-speaking-part-2-topic-an-interesting-animal",
  "ielts-speaking-part-2-topic-a-meal-you-had-with-your-friends",
  "ielts-speaking-part-2-topic-describe-a-small-business-that-you-would-like-to-open-if-you-had-the-chance",
  "ielts-speaking-part-2-topic-describe-a-time-you-needed-to-use-imagination",
  "ielts-speaking-part-2-topic-describe-what-you-think-would-be-the-perfect-job-for-you",
  "ielts-speaking-part-2-topic-describe-a-magazine-or-newspaper-that-you-like-to-read",
  "ielts-speaking-part-2-topic-describe-a-sport-stadium-thats-important-in-your-city",
  "ielts-speaking-part-2-topic-describe-an-important-holiday-that-is-celebrated-in-your-country",
  "ielts-speaking-part-2-topic-describe-a-difficult-decision-that-you-made",
  "ielts-speaking-part-2-topic-describe-a-place-you-have-visited-that-has-been-affected-by-pollution",
  "ielts-speaking-part-2-topic-describe-a-product-you-bought-that-you-were-happy-with",
  "ielts-speaking-part-2-topic-describe-a-person-much-older-than-you-who-you-admire",
  "ielts-speaking-part-2-topic-describe-a-television-program-that-you-like-to-watch",
  "ielts-speaking-part-2-topic-describe-a-good-friend",
  "ielts-speaking-part-2-topic-describe-a-good-part-of-your-personality-or-character",
  "ielts-speaking-part-2-topic-describe-a-happy-family-event-from-your-childhood",
  "ielts-speaking-part-2-topic-describe-a-time-when-someone-apologized-to-you",
  "ielts-speaking-part-2-topic-describe-a-story-or-novel-you-have-read-that-you-found-to-be-particularly-interesting",
  "ielts-speaking-part-2-topic-describe-some-local-news-that-people-in-your-locality-interested-in",
  "ielts-speaking-part-2-topic-describe-the-first-time-you-used-a-foreign-language-to-communicate",
  "ielts-speaking-part-2-topic-describe-an-occasion-when-you-helped-someone",
  "ielts-speaking-part-2-topic-describe-a-useful-app-or-computer-program-for-a-smart-phone-computer-or-tablet-that-you-have-used",
  "ielts-speaking-part-2-topic-describe-a-garden-you-visited-and-like",
  "ielts-speaking-part-2-topic-describe-an-area-of-subject-that-you-are-interested-in",
  "ielts-speaking-part-2-topic-describe-a-sport-you-have-learned",
  "ielts-speaking-part-2-topic-describe-a-wild-animal",
  "ielts-speaking-part-2-topic-describe-a-time-when-you-were-very-busy",
  "ielts-speaking-part-2-topic-describe-a-new-skill-you-would-like-to-learn",
  "ielts-speaking-part-2-topic-describe-a-short-holiday-that-was-special-for-you",
  "ielts-speaking-part-2-topic-describe-an-activity-you-do-for-your-health-or-fitness",
  "ielts-speaking-part-2-topic-describe-an-antique-or-some-other-old-thing-that-your-family-has-kept-for-a-long-time",
  "ielts-speaking-part-2-topic-describe-a-time-when-you-made-a-mistake",
  "ielts-speaking-part-2-topic-describe-a-time-when-the-weather-caused-you-to-change-your-plan",
  "ielts-speaking-part-2-topic-describe-a-situation-when-you-received-some-useful-advice",
  "ielts-speaking-part-2-topic-describe-an-important-conversation-that-you-had-with-someone",
  "ielts-speaking-part-2-topic-describe-a-street-that-you-like-to-visit",
  "ielts-speaking-part-2-topic-describe-what-you-would-do-if-you-had-a-day-off",
  "ielts-speaking-part-2-topic-describe-a-person-you-were-friendly-to-although-you-did-not-really-like-them",
  "ielts-speaking-part-2-topic-describe-an-experience-you-had-as-a-member-of-a-team",
  "ielts-speaking-part-2-topic-describe-an-outdoor-activity-you-like-to-do",
  "ielts-speaking-part-2-topic-describe-an-advertisement-you-have-seen",
  "ielts-speaking-part-2-topic-describe-a-website-that-you-like-to-visit",
  "ielts-speaking-part-2-topic-describe-a-big-company-that-you-would-like-to-work-in",
  "ielts-speaking-part-2-topic-describe-something-that-you-have-shared-with-others",
  "ielts-speaking-part-2-topic-describe-a-photograph-in-your-home",
  "ielts-speaking-part-2-topic-describe-a-place-where-you-read-and-write",
  "ielts-speaking-part-2-topic-describe-a-cafe-restaurant-that-you-like",
  "ielts-speaking-part-2-topic-describe-a-place-where-you-go-to-relax",
  "ielts-speaking-part-2-topic-describe-an-occasion-when-you-got-up-very-early",
  "ielts-speaking-part-2-topic-describe-a-long-car-journey-you-went-on",
  "ielts-speaking-part-2-topic-describe-an-indoor-game-that-you-played-when-you-were-a-child",
  "ielts-speaking-part-2-topic-describe-a-change-that-you-think-would-improve-your-local-area",
  "ielts-speaking-part-2-topic-describe-a-law-about-the-environment",
  "ielts-speaking-part-2-topic-describe-a-historic-building-that-you-have-visited",
  "ielts-speaking-part-2-topic-describe-a-long-walk-that-you-went-on",
  "ielts-speaking-part-2-topic-describe-a-person-you-know-who-dresses-well",
  "ielts-speaking-part-2-topic-describe-a-person-who-speaks-a-foreign-language-well",
  "ielts-speaking-part-2-topic-describe-a-person-who-travels-a-lot-by-plane",
  "ielts-speaking-part-2-topic-describe-the-member-of-your-family-who-you-spend-the-most-time-with",
  "ielts-speaking-part-2-topic-describe-a-wedding-that-you-have-attended",
  "ielts-speaking-part-2-topic-describe-a-time-when-you-tried-a-new-food-for-the-first-time",
  "ielts-speaking-part-2-topic-describe-an-occasion-when-you-were-surprised-to-meet-someone-you-know",
  "ielts-speaking-part-2-topic-describe-a-time-when-you-waited-for-something",
  "ielts-speaking-part-2-topic-describe-someone-or-something-that-made-a-lot-of-noise",
  "ielts-speaking-part-2-topic-describe-a-motorbike-trip-that-is-interesting",
  "ielts-speaking-part-2-topic-describe-a-film-you-watched-at-home-or-in-a-cinema",
  "ielts-speaking-part-2-topic-describe-a-time-when-you-looked-at-the-sky",
  "ielts-speaking-part-2-topic-describe-a-recent-event-that-made-you-happy",
  "ielts-speaking-part-2-topic-describe-a-polluted-place",
  "ielts-speaking-part-2-topic-describe-a-piece-of-good-news-that-you-received",
  "ielts-speaking-part-2-topic-describe-something-special-that-you-saved-money-to-buy",
  "ielts-speaking-part-2-topic-describe-a-situation-that-made-you-a-little-angry",
  "ielts-speaking-part-2-topic-describe-your-favourite-season-or-time-of-the-year",
  "ielts-speaking-part-2-topic-describe-someone-you-know-who-recently-moved-to-new-accommodation",
  "ielts-speaking-part-2-topic-describe-the-first-time-you-used-a-foreign-language",
  "ielts-speaking-part-2-topic-describe-a-free-time-activity-that-you-like-to-do-after-you-have-finished-your-study-or-work",
  "ielts-speaking-part-2-topic-describe-an-educational-tv-program-that-you-have-seen",
  "ielts-speaking-part-2-topic-describe-a-new-skill-you-would-like-to-learn-2",
  "ielts-speaking-part-2-topic-describe-an-art-or-craft-activity-that-you-did-at-school",
  "ielts-speaking-part-2-topic-describe-a-famous-person-in-your-country",
  "ielts-speaking-part-2-topic-describe-an-article-you-read-in-a-magazine-or-on-the-internet-about-healthy-living",
  "ielts-speaking-part-2-topic-describe-a-time-you-missed-an-important-appointment-for-something",
  "ielts-speaking-part-2-topic-describe-a-team-project-for-study-or-entertainment",
  "ielts-speaking-part-2-topic-describe-a-place-in-other-countries-where-you-would-like-to-work",
  "ielts-speaking-part-2-topic-describe-an-interesting-public-place-in-your-hometown",
  "ielts-speaking-part-2-topic-describe-an-item-that-you-received-and-made-you-happy",
  "ielts-speaking-part-2-topic-describe-an-item-of-electronic-equipment-that-you-would-like-to-have",
  "ielts-speaking-part-2-topic-describe-a-time-when-you-forgot-something-important",
  "ielts-speaking-part-2-topic-describe-a-time-when-you-borrowed-something",
  "ielts-speaking-part-2-topic-describe-a-place-with-a-lot-of-water-that-you-enjoyed-visiting",
  "ielts-speaking-part-2-topic-describe-a-family-that-you-like",
  "ielts-speaking-part-2-topic-describe-a-person-you-know-whose-job-is-important-to-society",
  "ielts-speaking-part-2-topic-describe-someone-in-the-news-who-you-would-like-to-meet",
  "ielts-speaking-part-2-topic-describe-a-special-toy-you-had-in-your-childhood",
  "ielts-speaking-part-2-topic-describe-a-skill-you-learned-when-you-were-a-child",
  "ielts-speaking-part-2-topic-describe-a-short-trip-that-you-frequently-make-but-dislike",
];

function parsePart1(html, topic) {
  const $ = cheerio.load(html);
  const content = $(".entry-content");
  if (!content.length) return null;

  const result = { part: 1, topicNumber: topic.num, topicName: topic.name, questions: [], audioUrl: null, sampleAnswer: "" };

  // Extract questions (numbered list items)
  const questions = [];
  content.find("ol li, p").each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/^\d+\.\s*(.+)/);
    if (match) questions.push(match[1]);
  });
  // Fallback: find numbered questions in paragraphs
  if (questions.length === 0) {
    const allText = content.text();
    const matches = allText.match(/\d+\.\s*[^\n?]+\?/g);
    if (matches) matches.forEach(q => questions.push(q.replace(/^\d+\.\s*/, "")));
  }
  result.questions = questions;

  // Audio URL
  const audioLink = content.find("a[href*='audio.ieltstrainingonline.com'], a[href$='.m4a'], a[href$='.mp3']");
  if (audioLink.length) result.audioUrl = audioLink.attr("href") || null;
  // Also check for audio text in content
  if (!result.audioUrl) {
    const htmlStr = content.html() || "";
    const audioMatch = htmlStr.match(/https?:\/\/audio\.ieltstrainingonline\.com[^\s"<]+/);
    if (audioMatch) result.audioUrl = audioMatch[0];
  }

  // Sample answer - text after "Sample" heading
  const fullText = content.text();
  const sampleIdx = fullText.search(/\bSample\b(?:\s*Recording)?/i);
  if (sampleIdx >= 0) {
    let sample = fullText.slice(sampleIdx);
    // Remove "Sample Recording" or "Sample" header
    sample = sample.replace(/^Sample\s*(?:Recording)?\s*/i, "");
    // Remove audio URL text
    sample = sample.replace(/https?:\/\/[^\s]+/g, "");
    // Remove footer/ad content
    sample = sample.replace(/Advertisements.*/s, "").replace(/Search\s*Search.*/s, "").replace(/Cam Reading Test.*/s, "").trim();
    result.sampleAnswer = sample;
  }

  return result;
}

function parsePart2(html, topicNum, url) {
  const $ = cheerio.load(html);
  const content = $(".entry-content");
  if (!content.length) return null;

  const title = $("h1").first().text().replace(/IELTS Speaking Part 2\s*[–-]\s*Topic:\s*/i, "").trim();
  const result = { part: 2, topicNumber: topicNum, topicName: title, prompt: "", sampleAnswer: "", vocabulary: [] };

  const fullHtml = content.html() || "";
  const fullText = content.text();

  // Extract prompt (the bold/italic cue card text)
  const promptMatch = fullText.match(/(?:Describe|Talk about)[^]*?(?=###\s*Answer|###\s*Sample|\n\n(?:###|Answer|Sample))/i);
  if (promptMatch) {
    result.prompt = promptMatch[0].replace(/Advertisements/g, "").replace(/\s+/g, " ").trim();
  }
  if (!result.prompt) {
    // Try to get from bold text
    const bolds = [];
    content.find("strong, b").each((_, el) => {
      const t = $(el).text().trim();
      if (t.length > 30 && /describe|talk about/i.test(t)) bolds.push(t);
    });
    if (bolds.length) result.prompt = bolds.join("\n");
  }

  // Sample Answer
  const answerIdx = fullText.search(/###?\s*(?:Answer|Sample)/i);
  const vocabIdx = fullText.search(/###?\s*Vocabulary/i);
  if (answerIdx >= 0) {
    const end = vocabIdx > answerIdx ? vocabIdx : fullText.length;
    let answer = fullText.slice(answerIdx, end);
    answer = answer.replace(/^###?\s*(?:Answer|Sample)\s*/i, "");
    answer = answer.replace(/Advertisements/g, "").trim();
    result.sampleAnswer = answer;
  }

  // Vocabulary
  if (vocabIdx >= 0) {
    let vocabText = fullText.slice(vocabIdx);
    vocabText = vocabText.replace(/^###?\s*Vocabulary:?\s*/i, "");
    vocabText = vocabText.replace(/Advertisements.*/s, "").replace(/Search\s*Search.*/s, "").replace(/Cam Reading Test.*/s, "").trim();
    const vocabItems = vocabText.split(/\n\s*-\s*/).filter(v => v.trim().length > 5);
    for (const item of vocabItems) {
      const parts = item.split(/:\s*\[/);
      if (parts.length >= 2) {
        const word = parts[0].replace(/\*+/g, "").trim();
        const rest = parts.slice(1).join(": [");
        const typeMatch = rest.match(/^([^\]]+)\]/);
        const type = typeMatch ? typeMatch[1] : "";
        const definition = rest.replace(/^[^\]]*\]\s*/, "").trim();
        result.vocabulary.push({ word, type, definition });
      } else {
        result.vocabulary.push({ word: item.replace(/\*+/g, "").slice(0, 50).trim(), type: "", definition: item.trim() });
      }
    }
  }

  return result;
}

async function scrapePart1(fromTopic, toTopic) {
  const dir = resolve(DATA_DIR, "part1");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let scraped = 0, failed = 0;
  const topics = PART1_TOPICS.filter(t => t.num >= fromTopic && t.num <= toTopic);

  for (const topic of topics) {
    const outFile = resolve(dir, `topic-${topic.num}.json`);
    if (existsSync(outFile)) {
      try {
        const e = JSON.parse(readFileSync(outFile, "utf-8"));
        if (e.questions?.length > 0) { console.log(`  [skip] Part1 #${topic.num} ${topic.name}`); scraped++; continue; }
      } catch {}
    }

    console.log(`\nScraping Speaking Part 1 #${topic.num}: ${topic.name}...`);
    const url = `${BASE_URL}/ielts-speaking-part-1-topic-${topic.slug}/`;
    const html = await fetchPage(url);
    if (!html || html.length < 2000) { console.log(`  ✗ Not found`); failed++; await sleep(DELAY_MS); continue; }

    const data = parsePart1(html, topic);
    if (!data) { console.log(`  ✗ Parse failed`); failed++; await sleep(DELAY_MS); continue; }

    console.log(`  ✓ ${data.questions.length} questions, audio: ${data.audioUrl ? "✓" : "✗"}, sample: ${data.sampleAnswer.length > 50 ? "✓" : "✗"}`);
    writeFileSync(outFile, JSON.stringify(data, null, 2));
    scraped++; await sleep(DELAY_MS);
  }
  return { scraped, failed };
}

async function scrapePart2(fromTopic, toTopic) {
  const dir = resolve(DATA_DIR, "part2");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let scraped = 0, failed = 0;

  for (let i = fromTopic - 1; i < Math.min(toTopic, PART2_URLS.length); i++) {
    const num = i + 1;
    const outFile = resolve(dir, `topic-${num}.json`);
    if (existsSync(outFile)) {
      try {
        const e = JSON.parse(readFileSync(outFile, "utf-8"));
        if (e.sampleAnswer?.length > 50) { console.log(`  [skip] Part2 #${num}`); scraped++; continue; }
      } catch {}
    }

    console.log(`\nScraping Speaking Part 2 #${num}...`);
    const url = `${BASE_URL}/${PART2_URLS[i]}/`;
    const html = await fetchPage(url);
    if (!html || html.length < 2000) { console.log(`  ✗ Not found`); failed++; await sleep(DELAY_MS); continue; }

    const data = parsePart2(html, num, url);
    if (!data) { console.log(`  ✗ Parse failed`); failed++; await sleep(DELAY_MS); continue; }

    console.log(`  ✓ "${data.topicName.slice(0, 50)}..." prompt: ${data.prompt.length > 10 ? "✓" : "✗"}, sample: ${data.sampleAnswer.length > 50 ? "✓" : "✗"}, vocab: ${data.vocabulary.length}`);
    writeFileSync(outFile, JSON.stringify(data, null, 2));
    scraped++; await sleep(DELAY_MS);
  }
  return { scraped, failed };
}

async function main() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const args = process.argv.slice(2);
  let part = null, topic = null, fromTopic = null, toTopic = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--part" && args[i+1]) part = parseInt(args[i+1]);
    if (args[i] === "--topic" && args[i+1]) topic = parseInt(args[i+1]);
    if (args[i] === "--from" && args[i+1]) fromTopic = parseInt(args[i+1]);
    if (args[i] === "--to" && args[i+1]) toTopic = parseInt(args[i+1]);
  }

  const results = [];

  if (!part || part === 1) {
    const from = topic || fromTopic || 1;
    const to = topic || toTopic || 42;
    console.log(`\n=== Speaking Part 1 (topics ${from}-${to}) ===`);
    results.push(await scrapePart1(from, to));
  }

  if (!part || part === 2) {
    const from = topic || fromTopic || 1;
    const to = topic || toTopic || 100;
    console.log(`\n=== Speaking Part 2 (topics ${from}-${to}) ===`);
    results.push(await scrapePart2(from, to));
  }

  const total = results.reduce((acc, r) => ({ scraped: acc.scraped + r.scraped, failed: acc.failed + r.failed }), { scraped: 0, failed: 0 });
  console.log(`\nDone. Scraped: ${total.scraped}, Failed: ${total.failed}`);
}

main();
