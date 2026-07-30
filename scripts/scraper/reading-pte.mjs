/**
 * IELTS Reading Scraper (practicepteonline.com)
 * Scrapes Cambridge IELTS 10-21 academic reading tests
 * Usage:
 *   node scripts/scraper/reading-pte.mjs
 *   node scripts/scraper/reading-pte.mjs --book 15
 *   node scripts/scraper/reading-pte.mjs --book 15 --test 1
 */
import * as cheerio from "cheerio";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../src/data/reading");
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
 * Discover test URLs from a book's index page.
 * Returns { reading: [url1, url2, url3, url4], listening: [...] }
 */
async function discoverBookUrls(book) {
  // Handle different URL patterns for book index pages
  let bookUrl;
  if (book === 19) {
    bookUrl = `${BASE_URL}/official-ielts-book-19/`;
  } else {
    bookUrl = `${BASE_URL}/official-ielts-tests-book-${book}/`;
  }

  console.log(`  Fetching book index: ${bookUrl}`);
  const html = await fetchPage(bookUrl);
  if (!html) return { reading: [], listening: [] };

  const $ = cheerio.load(html);
  const reading = [];
  const listening = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim().toLowerCase();
    const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Match academic reading links (exclude general reading)
    if (
      (text.includes("reading") || href.includes("reading")) &&
      !text.includes("general") &&
      !href.includes("general") &&
      href.includes("ielts-reading-test-")
    ) {
      reading.push(fullUrl);
    }

    // Match listening links
    if (
      (text.includes("listening") || href.includes("listening")) &&
      href.includes("ielts-listening-test-")
    ) {
      listening.push(fullUrl);
    }
  });

  return { reading, listening };
}

/**
 * Parse reading test page into structured data
 */
function parseReadingTest(html, book, test) {
  const $ = cheerio.load(html);
  const content = $(".entry-content");
  if (!content.length) return null;

  const result = {
    book,
    test,
    title: `Cambridge IELTS ${book} Reading Test ${test}`,
    passages: [],
  };

  // Get full text and identify passage boundaries
  const fullText = content.text();
  const fullHtml = content.html() || "";

  // Split into passages by detecting passage titles (bold text before questions)
  // Strategy: find all bold/strong elements, identify passage headings vs question text
  const paragraphs = [];
  content.find("p").each((_, el) => {
    paragraphs.push({
      html: $(el).html() || "",
      text: $(el).text().trim(),
    });
  });

  // Find passage boundaries: look for the "Questions X-Y" pattern to split passages
  // Each passage has: title + content paragraphs + questions section
  const passageData = splitIntoPassages(paragraphs);

  for (let i = 0; i < passageData.length; i++) {
    const pd = passageData[i];
    const passage = {
      number: i + 1,
      title: pd.title,
      content: pd.content,
      questions: pd.questions,
    };
    result.passages.push(passage);
  }

  // Extract answers from "Show Answers" section
  const answers = extractAnswers(fullText);
  if (answers.length > 0) {
    distributeAnswers(result.passages, answers);
  }

  return result;
}

/**
 * Split paragraphs into passage groups
 */
function splitIntoPassages(paragraphs) {
  const passages = [];
  let currentPassage = null;
  let inQuestions = false;
  let questionBuffer = [];

  for (const p of paragraphs) {
    const text = p.text;

    // Skip empty
    if (!text || text.length < 2) continue;

    // Skip navigation/meta text
    if (/^IELTS (MASTER|Reading Test)/i.test(text)) continue;
    if (/For Pdf Version/i.test(text)) continue;
    if (/practicepteonline/i.test(text)) continue;

    // Detect "Questions X-Y" header - marks start of questions for current passage
    if (/^Questions?\s*\d+/i.test(text)) {
      inQuestions = true;
      questionBuffer.push(text);
      continue;
    }

    // Detect "Show Answers" - end of all content
    if (/^Show Answers$/i.test(text)) break;

    // If we're in questions mode, accumulate question text
    if (inQuestions) {
      // Check if this looks like a new passage title (bold, short, not a question option)
      if (isNewPassageTitle(text, p.html) && questionBuffer.length > 0) {
        // Save questions to current passage and start new passage
        if (currentPassage) {
          currentPassage.questionsRaw = questionBuffer.join("\n");
          passages.push(currentPassage);
        }
        currentPassage = { title: text, contentParts: [], questions: [], questionsRaw: "" };
        questionBuffer = [];
        inQuestions = false;
        continue;
      }
      questionBuffer.push(text);
      continue;
    }

    // Detect new passage title - first significant bold text after questions end
    if (!currentPassage || isNewPassageTitle(text, p.html)) {
      // Save previous passage
      if (currentPassage) {
        if (questionBuffer.length > 0) {
          currentPassage.questionsRaw = questionBuffer.join("\n");
          questionBuffer = [];
        }
        passages.push(currentPassage);
      }
      currentPassage = { title: text, contentParts: [], questions: [], questionsRaw: "" };
      inQuestions = false;
      continue;
    }

    // Regular content paragraph
    if (currentPassage && !inQuestions) {
      currentPassage.contentParts.push(text);
    }
  }

  // Push last passage
  if (currentPassage) {
    if (questionBuffer.length > 0) {
      currentPassage.questionsRaw = questionBuffer.join("\n");
    }
    passages.push(currentPassage);
  }

  // Post-process: convert contentParts to content string, parse questions
  return passages
    .filter((p) => p.contentParts.length > 0 || p.questionsRaw.length > 0)
    .map((p) => ({
      title: p.title,
      content: p.contentParts.join("\n\n"),
      questions: parseQuestions(p.questionsRaw),
    }));
}

/**
 * Heuristic: is this paragraph a new passage title?
 */
function isNewPassageTitle(text, html) {
  // Must be bold/strong
  if (!/<strong|<b>/i.test(html)) return false;
  // Must be relatively short (titles are usually < 100 chars)
  if (text.length > 150) return false;
  // Must not look like a question option
  if (/^[A-H]\s/i.test(text) && text.length < 5) return false;
  // Must not be a question number
  if (/^\d{1,2}\s*[.)]/.test(text)) return false;
  // Must not look like answer instructions
  if (/^(TRUE|FALSE|NOT GIVEN|YES|NO)/i.test(text)) return false;
  if (/^Questions?\s*\d/i.test(text)) return false;
  if (/^(Complete|Choose|Do the|Match|Write|Which|Look at)/i.test(text)) return false;
  return true;
}

/**
 * Parse question text into structured question objects
 */
function parseQuestions(rawText) {
  if (!rawText) return [];
  const questions = [];
  const lines = rawText.split("\n");

  let currentGroup = { type: "", instruction: "", items: [] };

  for (const line of lines) {
    // Detect question group header
    if (/^Questions?\s*(\d+)/i.test(line)) {
      currentGroup = { type: detectQuestionType(line), instruction: line, items: [] };
      continue;
    }

    // Individual question items (numbered)
    const numMatch = line.match(/^(\d{1,2})[.\s)]\s*(.*)/);
    if (numMatch) {
      const id = parseInt(numMatch[1]);
      if (id >= 1 && id <= 40) {
        questions.push({
          id,
          type: currentGroup.type || "unknown",
          text: numMatch[2].trim() || line.trim(),
          answer: "",
          explanation: "",
        });
      }
      continue;
    }

    // Multiple choice options (A, B, C, D...)
    const optMatch = line.match(/^([A-H])\s+(.+)/);
    if (optMatch && questions.length > 0) {
      const lastQ = questions[questions.length - 1];
      if (!lastQ.options) lastQ.options = [];
      lastQ.options.push({ letter: optMatch[1], text: optMatch[2].trim() });
    }
  }

  return questions;
}

function detectQuestionType(headerText) {
  const t = headerText.toLowerCase();
  if (t.includes("true") || t.includes("false") || t.includes("not given")) return "true-false-ng";
  if (t.includes("yes") || t.includes("no")) return "yes-no-ng";
  if (t.includes("complete") || t.includes("fill") || t.includes("write one word")) return "fill-in";
  if (t.includes("match")) return "matching";
  if (t.includes("choose") || t.includes("correct letter")) return "multiple-choice";
  if (t.includes("which section") || t.includes("which paragraph")) return "matching";
  return "fill-in";
}

/**
 * Extract answers from the bottom "Show Answers" section
 * Handles multiple formats:
 *   1. <ol><li> structured HTML (book 21+)
 *   2. "1. Answer\n2. Answer\n..." line-based
 *   3. "1. Answer2. Answer3. Answer..." concatenated
 */
function extractAnswers(fullText, $, content) {
  const answers = [];

  // Method 1: Try parsing <ol><li> in the hidden answers div
  if ($ && content) {
    const olItems = [];
    content.find("ol li").each((_, el) => {
      olItems.push($(el).text().trim());
    });
    if (olItems.length >= 30) {
      for (let i = 0; i < olItems.length && i < 40; i++) {
        const answer = olItems[i].replace(/\s+/g, " ").trim();
        if (answer.length > 0 && answer.length < 150) {
          answers.push({ id: i + 1, answer });
        }
      }
      if (answers.length >= 30) return answers;
    }
  }

  // Method 2: line-based extraction from text
  const answerIdx = fullText.indexOf("Show Answers");
  if (answerIdx === -1) return answers;

  const answerText = fullText.slice(answerIdx + "Show Answers".length).trim();
  const lines = answerText.split("\n").filter((l) => l.trim());

  if (lines.length >= 20) {
    answers.length = 0;
    for (const line of lines) {
      const t = line.trim();
      const m = t.match(/^(\d{1,2})[.\s)]+\s*(.+)/);
      if (m) {
        const id = parseInt(m[1]);
        let answer = m[2].trim();
        if (id >= 1 && id <= 40 && answer.length > 0 && answer.length < 150) {
          answers.push({ id, answer });
        }
      }
    }
    if (answers.length >= 30) return answers;
  }

  // Method 3: concatenated format "1. Answer2. Answer3. Answer..."
  answers.length = 0;
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
      answers.push({ id: expected, answer });
    }
  }

  return answers;
}

/**
 * Distribute answers to passage questions
 */
function distributeAnswers(passages, answers) {
  const answerMap = new Map(answers.map((a) => [a.id, a.answer]));

  for (const passage of passages) {
    for (const q of passage.questions) {
      if (answerMap.has(q.id)) {
        q.answer = answerMap.get(q.id);
      }
    }
  }
}

/**
 * Alternative simpler parser: split by passage markers in raw text
 */
function parseReadingTestSimple(html, book, test) {
  const $ = cheerio.load(html);
  const content = $(".entry-content");
  if (!content.length) return null;

  const result = {
    book,
    test,
    title: `Cambridge IELTS ${book} Reading Test ${test}`,
    passages: [],
  };

  const fullText = content.text();

  // Extract answers first
  const answers = extractAnswers(fullText, $, content);
  const answerMap = new Map(answers.map((a) => [a.id, a.answer]));

  // Get all text before "Show Answers"
  const mainText = fullText.split("Show Answers")[0];

  // Split into passages by finding patterns like:
  // Bold title followed by paragraph content, then "Questions X-Y"
  // We'll use a different approach: find all "Questions X-Y" headers to determine passage boundaries
  const questionHeaders = [...mainText.matchAll(/Questions?\s*(\d{1,2})[\s–-]+(\d{1,2})/gi)];

  if (questionHeaders.length === 0) {
    // Fallback: treat as single passage
    result.passages.push({
      number: 1,
      title: result.title,
      content: mainText.slice(0, 2000),
      questions: answers.map((a) => ({
        id: a.id,
        answer: a.answer,
        type: guessType(a.answer),
        explanation: "",
      })),
    });
    return result;
  }

  // Group questions into passages (roughly Q1-13 = P1, Q14-26 = P2, Q27-40 = P3)
  // Use question header positions to split text
  const passageBreaks = findPassageBreaks(questionHeaders);

  // Get content between start and first question header for each passage
  const allParagraphs = [];
  content.find("p, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    const html = $(el).html() || "";
    const tagName = $(el).prop("tagName")?.toLowerCase() || "p";
    if (text.length > 0) {
      // Treat h2/h3 as if they were bold (they are passage titles)
      const effectiveHtml = tagName === "h2" || tagName === "h3" ? `<strong>${html}</strong>` : html;
      allParagraphs.push({ text, html: effectiveHtml });
    }
  });

  // Identify passage titles: bold short text that is followed by a long paragraph (actual content)
  // After finding a title, skip at least 5 paragraphs before looking for next (to skip question sections)
  const passageTitles = [];
  let skipUntil = 0;
  for (let i = 0; i < allParagraphs.length && passageTitles.length < 3; i++) {
    if (i < skipUntil) continue;
    const p = allParagraphs[i];
    if (
      /<strong/.test(p.html) &&
      p.text.length < 80 &&
      p.text.length > 3 &&
      !/^Questions?\s*\d/i.test(p.text) &&
      !/^(TRUE|FALSE|NOT GIVEN|YES|NO|IELTS|Show|For Pdf)/i.test(p.text) &&
      !/^(Complete|Choose|Do the|Match|Write|Which|Look|List of)/i.test(p.text) &&
      !/practicepteonline/i.test(p.text) &&
      !/^\d{1,2}[.)\s]/.test(p.text) &&
      !/^[A-H]\s/.test(p.text)
    ) {
      // Check: next paragraph should be long content (>100 chars) indicating passage start
      const nextP = allParagraphs[i + 1];
      if (nextP && nextP.text.length > 100) {
        // Skip if this title contains/is contained by a previous title (subtitle detection)
        const isDuplicate = passageTitles.some(
          (prev) =>
            p.text.toLowerCase().includes(prev.toLowerCase()) ||
            prev.toLowerCase().includes(p.text.toLowerCase())
        );
        if (!isDuplicate) {
          passageTitles.push(p.text);
          // Skip ahead to avoid picking up question-section subtitles
          skipUntil = i + 5;
        }
      }
    }
  }

  // Build passages: use first 3 titles and content between them
  for (let i = 0; i < Math.min(3, passageBreaks.length); i++) {
    const qRange = passageBreaks[i];
    const passage = {
      number: i + 1,
      title: passageTitles[i] || `Passage ${i + 1}`,
      content: "",
      questions: [],
    };

    // Build questions from answer map for this range
    for (let qId = qRange.from; qId <= qRange.to; qId++) {
      const answer = answerMap.get(qId) || "";
      passage.questions.push({
        id: qId,
        answer,
        type: guessType(answer),
        explanation: "",
      });
    }

    result.passages.push(passage);
  }

  // Now extract passage content by finding text between passage titles
  const contentText = mainText;
  for (let i = 0; i < result.passages.length; i++) {
    const title = result.passages[i].title;
    const titleIdx = contentText.indexOf(title);
    if (titleIdx === -1) continue;

    // Find end: next passage title or first question of this passage
    let endIdx = contentText.length;
    if (i + 1 < result.passages.length) {
      const nextTitle = result.passages[i + 1].title;
      const nextIdx = contentText.indexOf(nextTitle, titleIdx + title.length);
      if (nextIdx > 0) endIdx = nextIdx;
    }

    // Find "Questions" header within this passage section
    const passageSection = contentText.slice(titleIdx + title.length, endIdx);
    const qHeaderIdx = passageSection.search(/Questions?\s*\d{1,2}/i);
    const passageContent = qHeaderIdx > 0 ? passageSection.slice(0, qHeaderIdx) : passageSection;

    result.passages[i].content = passageContent
      .trim()
      .replace(/\s*\n\s*\n\s*/g, "\n\n")
      .replace(/^\s+/gm, "");
  }

  return result;
}

function findPassageBreaks(questionHeaders) {
  // Standard IELTS reading always has 3 passages.
  // The question ranges vary but typically:
  //   Passage 1: Q1-13 (3-4 question groups)
  //   Passage 2: Q14-26 or Q14-27
  //   Passage 3: Q27-40 or Q28-40
  // 
  // Strategy: find the largest "gap" in question group starts to split into 3
  // But since headers are always consecutive in IELTS, just use standard splits.
  
  if (questionHeaders.length === 0) {
    return [
      { from: 1, to: 13 },
      { from: 14, to: 26 },
      { from: 27, to: 40 },
    ];
  }

  // Get all "from" values to detect natural breaks
  const starts = questionHeaders.map((m) => parseInt(m[1]));
  const ends = questionHeaders.map((m) => parseInt(m[2]));

  // Find the header that starts at 14 or nearest to it (passage 2 start)
  const p2StartIdx = starts.findIndex((s) => s >= 14);
  // Find the header that starts at 27 or nearest (passage 3 start)
  const p3StartIdx = starts.findIndex((s) => s >= 27);

  const p1To = p2StartIdx > 0 ? starts[p2StartIdx] - 1 : 13;
  const p2To = p3StartIdx > 0 ? starts[p3StartIdx] - 1 : 26;
  const p3To = Math.max(...ends, 40);

  return [
    { from: 1, to: p1To },
    { from: p1To + 1, to: p2To },
    { from: p2To + 1, to: p3To },
  ];
}

function guessType(answer) {
  if (!answer) return "fill-in";
  const a = answer.toUpperCase().trim();
  if (a === "TRUE" || a === "FALSE" || a === "NOT GIVEN") return "true-false-ng";
  if (a === "YES" || a === "NO") return "yes-no-ng";
  if (/^[A-H]$/.test(a)) return "multiple-choice";
  if (/^[A-H],\s*[A-H]$/.test(a)) return "multiple-choice";
  return "fill-in";
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function scrapeAll(targetBook, targetTest) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const books = targetBook ? [targetBook] : Array.from({ length: 12 }, (_, i) => 10 + i);
  let scraped = 0;
  let failed = 0;
  let skipped = 0;

  for (const book of books) {
    console.log(`\n═══ Cambridge IELTS ${book} ═══`);

    // Discover URLs from book index page
    const urls = await discoverBookUrls(book);
    await sleep(DELAY_MS);

    if (urls.reading.length === 0) {
      console.log(`  ✗ No reading test URLs found for book ${book}`);
      failed += 4;
      continue;
    }

    console.log(`  Found ${urls.reading.length} reading tests`);

    const tests = targetTest ? [targetTest] : [1, 2, 3, 4];

    for (const test of tests) {
      const testIdx = test - 1;
      const outFile = resolve(DATA_DIR, `cam-${book}-test-${test}.json`);

      // Skip if already has good data
      if (existsSync(outFile)) {
        try {
          const existing = JSON.parse(readFileSync(outFile, "utf-8"));
          const qCount = existing.passages?.reduce((s, p) => s + (p.questions?.length || 0), 0) || 0;
          if (qCount >= 30) {
            console.log(`  [skip] cam-${book}-test-${test} (${qCount} questions)`);
            skipped++;
            continue;
          }
        } catch {}
      }

      if (testIdx >= urls.reading.length) {
        console.log(`  ✗ cam-${book}-test-${test}: no URL (only ${urls.reading.length} tests found)`);
        failed++;
        continue;
      }

      const url = urls.reading[testIdx];
      console.log(`  Scraping cam-${book}-test-${test}...`);
      console.log(`    URL: ${url}`);

      const html = await fetchPage(url);
      if (!html || html.length < 5000) {
        console.log(`    ✗ Failed to fetch or content too short`);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const data = parseReadingTestSimple(html, book, test);
      if (!data || data.passages.length === 0) {
        console.log(`    ✗ Failed to parse passages`);
        failed++;
        await sleep(DELAY_MS);
        continue;
      }

      const qCount = data.passages.reduce((s, p) => s + p.questions.length, 0);
      const contentLen = data.passages.reduce((s, p) => s + p.content.length, 0);
      console.log(
        `    ✓ ${data.passages.length} passages, ${qCount} questions, ${contentLen} chars content`
      );

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
