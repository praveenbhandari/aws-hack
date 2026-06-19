/**
 * Ingest SFPD CSV → InsForge hotspots table + local seed file.
 *
 * Usage:
 *   npm run ingest
 *   npm run ingest -- --seed-only   # write data/seed-hotspots.json only
 *   npm run ingest -- --limit 5000  # cap rows for quick demo
 */

import { createReadStream, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { categoryToSeverity, insertHotspotsBatch } from "../src/services/hotspots.js";
import type { RawHotspot } from "../src/services/scoring.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_OUT = join(__dirname, "seed-hotspots.json");

const SF_LAT_MIN = 37.7;
const SF_LAT_MAX = 37.84;
const SF_LON_MIN = -122.52;
const SF_LON_MAX = -122.35;

const args = process.argv.slice(2);
const seedOnly = args.includes("--seed-only");
const limitIdx = args.indexOf("--limit");
const rowLimit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 15_000;

const csvPath = resolve(
  process.env.CRIME_CSV_PATH ??
    join(__dirname, "../../data/Police_Department_Incident_Reports__Historical_2003_to_May_2018_20260619.csv"),
);

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseDate(dateStr: string): string {
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return new Date().toISOString();
  const [, mm, dd, yyyy] = m;
  return new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`).toISOString();
}

async function ingest(): Promise<void> {
  if (!existsSync(csvPath)) {
    console.error("CSV not found:", csvPath);
    process.exit(1);
  }

  console.log("Reading", csvPath, `(limit ${rowLimit})`);

  const rl = createInterface({ input: createReadStream(csvPath, { encoding: "utf-8" }) });
  let headers: string[] = [];
  const hotspots: RawHotspot[] = [];
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) {
      headers = parseCsvLine(line).map((h) => h.replace(/^"|"$/g, ""));
      continue;
    }
    if (hotspots.length >= rowLimit) break;

    const cols = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").replace(/^"|"$/g, "");
    });

    const lat = Number(row.Y);
    const lng = Number(row.X);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    if (lat < SF_LAT_MIN || lat > SF_LAT_MAX || lng < SF_LON_MIN || lng > SF_LON_MAX) continue;

    const category = row.Category || "OTHER OFFENSES";
    hotspots.push({
      id: `sfpd-${row.PdId || lineNum}`,
      lat,
      lng,
      category,
      severity: categoryToSeverity(category),
      occurredAt: parseDate(row.Date || ""),
      source: "sfpd",
    });
  }

  console.log(`Parsed ${hotspots.length} valid SF incidents`);

  writeFileSync(SEED_OUT, JSON.stringify(hotspots, null, 0));
  console.log("Wrote", SEED_OUT);

  if (seedOnly) {
    console.log("Done (--seed-only)");
    return;
  }

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < hotspots.length; i += BATCH) {
    const batch = hotspots.slice(i, i + BATCH);
    try {
      const n = await insertHotspotsBatch(batch);
      inserted += n;
      process.stdout.write(`\rInserted ${inserted}/${hotspots.length}`);
    } catch (e) {
      console.warn("\nInsForge insert batch failed (seed file still available):", e);
      break;
    }
  }
  console.log("\nDone");
}

ingest().catch((e) => {
  console.error(e);
  process.exit(1);
});
