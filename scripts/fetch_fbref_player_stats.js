const fs = require("fs");
const path = require("path");

const RAW_DIR = path.join(process.cwd(), "data", "fbref", "raw");
const ERROR_PATH = path.join(process.cwd(), "data", "fbref", "fetch_errors.json");
const TARGETS_PATH = path.join(process.cwd(), "data", "fbref", "fbref_targets.csv");

const DEFAULT_SEASONS = ["2023-2024", "2024-2025", "2025-2026"];
const COMPS = [
  { league: "EPL", compId: 9, slug: "Premier-League" },
  { league: "LaLiga", compId: 12, slug: "La-Liga" },
  { league: "Bundesliga", compId: 20, slug: "Bundesliga" },
  { league: "Ligue1", compId: 13, slug: "Ligue-1" },
];
const DEFAULT_STAT_TYPES = ["standard", "shooting", "passing", "defense", "possession", "misc", "keepers"];

function optionList(name, fallback) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  const envName = name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase();
  const value = arg ? arg.slice(name.length + 3) : process.env[`FBREF_${envName}`];
  if (!value) return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function optionNumber(name, fallback = 0) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  const envName = name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase();
  const value = arg ? arg.slice(name.length + 3) : process.env[`FBREF_${envName}`];
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function optionBoolean(name, fallback = false) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  const envName = name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase();
  const value = arg ? arg.slice(name.length + 3) : process.env[`FBREF_${envName}`];
  if (value === undefined) return fallback;
  return ["1", "true", "yes"].includes(String(value).trim().toLowerCase());
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tableId(statType) {
  return statType === "keepers" ? "stats_keeper" : `stats_${statType}`;
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .trim();
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function extractTableAsCsv(html, statType) {
  const id = tableId(statType);
  const match = html.match(new RegExp(`<table[^>]+id=["']${id}["'][\\s\\S]*?<\\/table>`, "i"));
  if (!match) return "";
  const table = match[0];
  const bodyRows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) => [...rowMatch[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => stripTags(cell[1])))
    .filter((row) => row.includes("Player") || row.some((cell) => cell && cell !== "Rk"));
  if (!bodyRows.length) return "";

  const headerIndex = bodyRows.findIndex((row) => row.includes("Player") && row.includes("Squad"));
  const header = bodyRows[headerIndex >= 0 ? headerIndex : 0];
  const dataRows = bodyRows.slice(headerIndex + 1).filter((row) => row.length === header.length && !row.includes("Player"));
  return [header, ...dataRows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function fbrefUrl(season, comp, statType) {
  return `https://fbref.com/en/comps/${comp.compId}/${season}/${statType}/players/${season}-${comp.slug}-Stats`;
}

async function fetchOne(season, comp, statType) {
  const url = fbrefUrl(season, comp, statType);
  const file = path.join(RAW_DIR, `${season}_${comp.league}_${statType}.csv`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FootballPredictionAI/1.0; local research)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const csv = extractTableAsCsv(html, statType);
  if (!csv) throw new Error("Could not find the expected FBref stats table in the response");

  fs.writeFileSync(file, csv);
  return { url, file };
}

async function main() {
  ensureDir(RAW_DIR);
  const saved = [];
  const errors = [];
  const limit = optionNumber("limit", 0);
  const seasons = optionList("seasons", DEFAULT_SEASONS);
  const statTypes = optionList("statTypes", DEFAULT_STAT_TYPES);
  const manifestOnly = optionBoolean("manifestOnly", false);
  const targets = seasons.flatMap((season) =>
    COMPS.flatMap((comp) =>
      statTypes.map((statType) => ({
        season,
        league: comp.league,
        statType,
        url: fbrefUrl(season, comp, statType),
        targetFile: path.join(RAW_DIR, `${season}_${comp.league}_${statType}.csv`),
      }))
    )
  );
  let attempted = 0;

  fs.writeFileSync(
    TARGETS_PATH,
    ["season,league,statType,url,targetFile", ...targets.map((target) => [target.season, target.league, target.statType, target.url, target.targetFile].join(","))].join("\n")
  );

  if (manifestOnly) {
    console.log(`Target manifest written to ${TARGETS_PATH}`);
    console.log(`Manifest contains ${targets.length} FBref player-stat tables.`);
    return;
  }

  for (const target of targets) {
    if (limit && attempted >= limit) break;
    attempted += 1;
    const comp = COMPS.find((item) => item.league === target.league);
    try {
      const result = await fetchOne(target.season, comp, target.statType);
      saved.push(result);
      console.log(`Saved ${result.file}`);
      await sleep(6500);
    } catch (error) {
      errors.push({ season: target.season, league: target.league, statType: target.statType, url: target.url, error: error.message });
      console.warn(`Skipped ${target.season} ${target.league} ${target.statType}: ${error.message}`);
      await sleep(6500);
    }
  }

  fs.writeFileSync(ERROR_PATH, JSON.stringify({ saved, errors, targetCount: targets.length, targetsPath: TARGETS_PATH, checkedAt: new Date().toISOString() }, null, 2));
  console.log(`Fetch complete. Saved ${saved.length} tables. Errors written to ${ERROR_PATH}`);
  console.log(`Target manifest written to ${TARGETS_PATH}`);
  if (errors.some((item) => item.error.includes("403"))) {
    console.log("FBref blocked automated access. Download CSVs manually into data/fbref/raw, then run npm run import:fbref.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
