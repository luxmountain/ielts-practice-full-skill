/**
 * IELTS Scraper - Run All
 * Scrapes all 4 skills: Reading, Writing, Speaking, Listening
 *
 * Usage:
 *   node scripts/scraper/run-all.mjs                    # Run all scrapers
 *   node scripts/scraper/run-all.mjs --only listening   # Run only listening
 *   node scripts/scraper/run-all.mjs --skip reading,writing  # Skip some
 *   node scripts/scraper/run-all.mjs --only listening --book 14  # Pass extra args
 */
import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const SCRAPERS = [
  { name: "reading", cmd: "node scripts/scraper/reading.mjs" },
  { name: "writing", cmd: "node scripts/scraper/writing.mjs" },
  { name: "speaking", cmd: "node scripts/scraper/speaking.mjs" },
  { name: "listening", cmd: "node scripts/scraper/listening.mjs" },
];

const PAUSE_BETWEEN_MS = 30000; // 30s pause between scrapers to avoid rate-limit

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Parse args
const args = process.argv.slice(2);
let skipList = [];
let onlyList = [];
const extraArgs = []; // pass-through args like --book, --test, --from, --to, --type

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--skip" && args[i + 1]) {
    skipList = args[i + 1].toLowerCase().split(",").map(s => s.trim());
    i++;
  } else if (args[i] === "--only" && args[i + 1]) {
    onlyList = args[i + 1].toLowerCase().split(",").map(s => s.trim());
    i++;
  } else {
    extraArgs.push(args[i]);
  }
}

function shouldRun(name) {
  if (onlyList.length > 0) return onlyList.includes(name);
  if (skipList.length > 0) return !skipList.includes(name);
  return true;
}

const toRun = SCRAPERS.filter(s => shouldRun(s.name));

console.log("╔══════════════════════════════════════════════════╗");
console.log("║   IELTS Practice - Scrape All Data              ║");
console.log("╚══════════════════════════════════════════════════╝");
console.log(`\nRunning: ${toRun.map(s => s.name).join(", ")}`);
if (extraArgs.length) console.log(`Extra args: ${extraArgs.join(" ")}`);
console.log();

const startTime = Date.now();
let ranCount = 0;

for (const scraper of toRun) {
  // Pause between scrapers (not before first)
  if (ranCount > 0) {
    console.log(`\n⏸  Pausing ${PAUSE_BETWEEN_MS / 1000}s before next scraper...\n`);
    await sleep(PAUSE_BETWEEN_MS);
  }

  console.log(`${"═".repeat(50)}`);
  console.log(`▶  ${scraper.name.charAt(0).toUpperCase() + scraper.name.slice(1)} Scraper`);
  console.log(`${"═".repeat(50)}\n`);

  const cmd = extraArgs.length ? `${scraper.cmd} ${extraArgs.join(" ")}` : scraper.cmd;

  try {
    execSync(cmd, { cwd: projectRoot, stdio: "inherit", timeout: 45 * 60 * 1000 });
  } catch (e) {
    console.error(`\n✗ ${scraper.name} scraper failed: ${e.message}\n`);
  }
  ranCount++;
}

const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
console.log(`\n${"═".repeat(50)}`);
console.log(`✓ All done in ${elapsed} minutes`);
console.log(`${"═".repeat(50)}\n`);
