const fs = require("fs");
const path = require("path");

const RAW_DIR = path.join(process.cwd(), "data", "fbref", "raw");
const PROCESSED_DIR = path.join(process.cwd(), "data", "fbref", "processed");
const JSON_PATH = path.join(PROCESSED_DIR, "fbref_player_stats.json");
const CSV_PATH = path.join(PROCESSED_DIR, "fbref_player_stats.csv");

const LEAGUE_NAMES = {
  EPL: "EPL",
  LaLiga: "La Liga",
  Bundesliga: "Bundesliga",
  Ligue1: "Ligue 1",
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length) row.push(cell);
  if (row.length) rows.push(row);
  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ""));
}

function uniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((header) => {
    const clean = String(header || "").trim() || "Blank";
    const count = seen.get(clean) || 0;
    seen.set(clean, count + 1);
    return count ? `${clean}_${count + 1}` : clean;
  });
}

function normalizeSeason(season) {
  const match = season.match(/^(\d{4})-(\d{4})$/);
  if (!match) return season;
  return `${match[1]}-${match[2].slice(2)}`;
}

function metadataFromFile(fileName) {
  const match = fileName.match(/^(\d{4}-\d{4})_(EPL|LaLiga|Bundesliga|Ligue1)_([a-z]+)\.csv$/i);
  if (!match) return null;
  const leagueKey = Object.keys(LEAGUE_NAMES).find((key) => key.toLowerCase() === match[2].toLowerCase());
  return {
    season: normalizeSeason(match[1]),
    fbrefSeason: match[1],
    league: LEAGUE_NAMES[leagueKey],
    statType: match[3].toLowerCase(),
  };
}

function rowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

function importFile(filePath) {
  const fileName = path.basename(filePath);
  const meta = metadataFromFile(fileName);
  if (!meta) {
    return { rows: [], warning: `Skipped ${fileName}: expected name like 2025-2026_EPL_standard.csv` };
  }

  const rows = parseCsv(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  const headerIndex = rows.findIndex((row) => row.includes("Player") && row.includes("Squad"));
  if (headerIndex < 0) {
    return { rows: [], warning: `Skipped ${fileName}: could not find Player/Squad header row` };
  }

  const headers = uniqueHeaders(rows[headerIndex]);
  const importedRows = rows
    .slice(headerIndex + 1)
    .filter((row) => row.length && row[headers.indexOf("Player")] && row[headers.indexOf("Player")] !== "Player")
    .map((row) => ({
      ...meta,
      sourceFile: fileName,
      ...rowObject(headers, row),
    }));

  return { rows: importedRows };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))];
  fs.writeFileSync(CSV_PATH, lines.join("\n"));
}

function main() {
  ensureDir(RAW_DIR);
  ensureDir(PROCESSED_DIR);

  const files = fs.readdirSync(RAW_DIR).filter((file) => file.toLowerCase().endsWith(".csv"));
  const warnings = [];
  const rows = [];

  for (const file of files) {
    const result = importFile(path.join(RAW_DIR, file));
    if (result.warning) warnings.push(result.warning);
    rows.push(...result.rows);
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify({ importedAt: new Date().toISOString(), rows }, null, 2));
  if (rows.length) writeCsv(rows);
  else fs.writeFileSync(CSV_PATH, "season,league,statType,Player,Squad\n");

  for (const warning of warnings) console.warn(warning);
  console.log(`Imported ${rows.length} FBref player-stat rows from ${files.length} CSV file(s).`);
  console.log(`JSON: ${JSON_PATH}`);
  console.log(`CSV: ${CSV_PATH}`);
}

main();
