const fs = require("fs");
const path = require("path");

const DEFAULT_FILES = [
  "C:\\Users\\adebi\\Downloads\\Thunderbit_c19bd0_20260514_055000.csv",
  "C:\\Users\\adebi\\Downloads\\Thunderbit_c19bd0_20260514_053813.csv",
  "C:\\Users\\adebi\\Downloads\\Thunderbit_c19bd0_20260514_062338.csv",
];

const PROCESSED_DIR = path.join(process.cwd(), "data", "fbref", "processed");
const JSON_PATH = path.join(PROCESSED_DIR, "fbref_player_stats.json");
const CSV_PATH = path.join(PROCESSED_DIR, "fbref_player_stats.csv");

const SQUAD_MAP = {
  "Manchester United": { squad: "Man United", league: "EPL" },
  "Manchester City": { squad: "Man City", league: "EPL" },
  "Real Madrid": { squad: "Real Madrid", league: "La Liga" },
};

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

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function num(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function rowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
}

function loadExistingRows() {
  if (!fs.existsSync(JSON_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  return Array.isArray(data.rows) ? data.rows : [];
}

function thunderbitRowToFbref(row, sourceFile) {
  const squadInfo = SQUAD_MAP[row.Squad] || { squad: row.Squad, league: "" };
  const matches = num(row["Matches Played"]);
  const goals = num(row.Goals);

  return {
    season: "2025-26",
    fbrefSeason: "2025-2026",
    league: squadInfo.league,
    statType: "standard",
    sourceFile,
    Player: row["Player Name"],
    PlayerURL: row["Player URL"],
    Nation: row.Nationality,
    Pos: row.Position,
    Squad: squadInfo.squad,
    Age: row.Age,
    Born: row["Year of Birth"],
    MP: matches,
    "90s": matches,
    Gls: goals,
    Ast: "",
    Sh: "",
    SoT: "",
    ThunderbitSource: "true",
  };
}

function importFile(filePath) {
  const rows = parseCsv(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1)
    .map((row) => rowObject(headers, row))
    .filter((row) => row["Player Name"] && row.Squad)
    .map((row) => thunderbitRowToFbref(row, path.basename(filePath)));
}

function writeCsv(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))];
  fs.writeFileSync(CSV_PATH, lines.join("\n"));
}

function rowKey(row) {
  return [row.season, row.league, row.Squad, row.Player, row.statType, row.sourceFile].join("||").toLowerCase();
}

function main() {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });

  const imported = [];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.warn(`Skipped missing file: ${file}`);
      continue;
    }
    imported.push(...importFile(file));
  }

  const combined = [...loadExistingRows(), ...imported];
  const seen = new Set();
  const rows = combined.filter((row) => {
    const key = rowKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(JSON_PATH, JSON.stringify({ importedAt: new Date().toISOString(), rows }, null, 2));
  writeCsv(rows);

  console.log(`Imported ${imported.length} Thunderbit player rows.`);
  console.log(`Processed player-stat rows now available: ${rows.length}`);
  console.log(`JSON: ${JSON_PATH}`);
  console.log(`CSV: ${CSV_PATH}`);
}

main();
