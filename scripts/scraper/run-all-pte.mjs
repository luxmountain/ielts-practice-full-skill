/**
 * IELTS Scraper (practicepteonline.com) - Run All
 * Scrapes Reading + Listening from Cambridge 10-21
 *
 * Usage:
 *   node scripts/scraper/run-all-pte.mjs                     # Run both
 *   node scripts/scraper/run-all-pte.mjs --only reading      # Run only reading
 *   node scripts/scraper/run-all-pte.mjs --only listening    # Run only listening
 *   node scripts/scraper/run-all-pte.mjs --book 15           # Only book 15
 *   node scripts/scraper/run-all-pte.mjs --book 15 --test 2  # Specific test
 */
import { execSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

const SCRAPERS = [
  { name: "reading", cmd: "node scripts/scraper/reading-pte.mjs" },
  { name: "listening", cmd: "node scripts/scraper/listening-pte.mjs" },
];

const PAUSE_BETWEEN_MS = 15000; // 15s pause between scrapers

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Parse args
const args = process.argv.slice(2);
let onlyList = [];
const extraArgs = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--only" && args[i + 1]) {
    onlyList = args[i + 1].toLowerCase().split(",").map((s) => s.trim());
    i++;
  } else {
    extraArgs.push(args[i]);
  }
}

const toRun = onlyList.length > 0 ? SCRAPERS.filter((s) => onlyList.includes(s.name)) : SCRAPERS;

console.log("╔══════════════════════════════════════════════════╗");
console.log("║   IELTS Scraper (practicepteonline.com)         ║");
console.log("║   Reading + Listening • Cambridge 10-21         ║");
console.log("╚══════════════════════════════════════════════════╝");
console.log(`\nRunning: ${toRun.map((s) => s.name).join(", ")}`);
if (extraArgs.length) console.log(`Args: ${extraArgs.join(" ")}`);
console.log();

const startTime = Date.now();
let ranCount = 0;

for (const scraper of toRun) {
  if (ranCount > 0) {
    console.log(`\n⏸  Pausing ${PAUSE_BETWEEN_MS / 1000}s...\n`);
    await sleep(PAUSE_BETWEEN_MS);
  }

  console.log(`${"═".repeat(50)}`);
  console.log(`▶  ${scraper.name.charAt(0).toUpperCase() + scraper.name.slice(1)} Scraper`);
  console.log(`${"═".repeat(50)}\n`);

  const cmd = extraArgs.length ? `${scraper.cmd} ${extraArgs.join(" ")}` : scraper.cmd;

  try {
    execSync(cmd, { cwd: projectRoot, stdio: "inherit", timeout: 60 * 60 * 1000 });
  } catch (e) {
    console.error(`\n✗ ${scraper.name} scraper failed: ${e.message}\n`);
  }
  ranCount++;
}

const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
console.log(`\n${"═".repeat(50)}`);
console.log(`✓ All done in ${elapsed} minutes`);
console.log(`${"═".repeat(50)}\n`);
