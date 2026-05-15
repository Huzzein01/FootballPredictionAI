const fs = require("fs");
const path = require("path");

const DATA_DIR = "C:\\Users\\adebi\\Downloads\\Football data";

const SEASONS = [
  {
    season: "2020-21",
    files: { EPL: "E0 (5).csv", "La Liga": "SP1 (5).csv", Bundesliga: "D1 (5).csv", "Ligue 1": "F1 (5).csv" },
  },
  {
    season: "2021-22",
    files: { EPL: "E0 (4).csv", "La Liga": "SP1 (4).csv", Bundesliga: "D1 (4).csv", "Ligue 1": "F1 (4).csv" },
  },
  {
    season: "2022-23",
    files: { EPL: "E0 (3).csv", "La Liga": "SP1 (3).csv", Bundesliga: "D1 (3).csv", "Ligue 1": "F1 (3).csv" },
  },
  {
    season: "2023-24",
    files: { EPL: "E0 (2).csv", "La Liga": "SP1 (2).csv", Bundesliga: "D1 (2).csv", "Ligue 1": "F1 (2).csv" },
  },
  {
    season: "2024-25",
    files: { EPL: "E0 (1).csv", "La Liga": "SP1 (1).csv", Bundesliga: "D1 (1).csv", "Ligue 1": "F1 (1).csv" },
  },
  {
    season: "2025-26",
    files: { EPL: "E0.csv", "La Liga": "SP1.csv", Bundesliga: "D1.csv", "Ligue 1": "F1.csv" },
  },
];

const TEAM_ALIASES = {
  "manchester united": "Man United",
  "man united": "Man United",
  "manchester city": "Man City",
  "man city": "Man City",
  chelsea: "Chelsea",
  "real madrid": "Real Madrid",
  "fc barcelona": "Barcelona",
  barcelona: "Barcelona",
  "bayern munich": "Bayern Munich",
  bayern: "Bayern Munich",
  "paris saint-germain": "Paris SG",
  psg: "Paris SG",
  "paris sg": "Paris SG",
  "atletico madrid": "Ath Madrid",
  "atlético madrid": "Ath Madrid",
  "ath madrid": "Ath Madrid",
  "atlético madrid": "Ath Madrid",
  arsenal: "Arsenal",
  "aston villa": "Aston Villa",
  "afc bournemouth": "Bournemouth",
  bournemouth: "Bournemouth",
  brentford: "Brentford",
  "brighton & hove albion": "Brighton",
  brighton: "Brighton",
  burnley: "Burnley",
  "crystal palace": "Crystal Palace",
  liverpool: "Liverpool",
  "nottingham forest": "Nott'm Forest",
  "nott'm forest": "Nott'm Forest",
  sunderland: "Sunderland",
  "tottenham hotspur": "Tottenham",
  tottenham: "Tottenham",
  "athletic club": "Ath Bilbao",
  "ath bilbao": "Ath Bilbao",
  "real betis": "Betis",
  betis: "Betis",
  "real oviedo": "Oviedo",
  oviedo: "Oviedo",
  sevilla: "Sevilla",
  valencia: "Valencia",
  villarreal: "Villarreal",
  "fc cologne": "FC Koln",
  "fc koln": "FC Koln",
  lens: "Lens",
  "paris fc": "Paris FC",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
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
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function readCsv(file) {
  const text = fs.readFileSync(path.join(DATA_DIR, file), "utf8").replace(/^\uFEFF/, "");
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell !== ""));
  const headers = rows.shift();
  return rows.map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ""])));
}

function parseDate(value) {
  const text = String(value).trim();
  const [day, month, year] = text.split(/[/-]/).map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(value) {
  return parseDate(value).toISOString().slice(0, 10);
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTeamName(name) {
  const key = String(name || "").trim().toLowerCase();
  return TEAM_ALIASES[key] || String(name || "").trim();
}

let matchCache = null;

function loadMatches() {
  if (matchCache) return matchCache;
  const all = [];
  for (const season of SEASONS) {
    for (const [league, file] of Object.entries(season.files)) {
      for (const row of readCsv(file)) {
        all.push({
          ...row,
          Season: season.season,
          League: league,
          SourceFile: file,
          DateISO: isoDate(row.Date),
          KickoffSort: `${isoDate(row.Date)} ${row.Time || "00:00"}`,
        });
      }
    }
  }
  matchCache = all.sort((a, b) => a.KickoffSort.localeCompare(b.KickoffSort));
  return matchCache;
}

module.exports = {
  DATA_DIR,
  SEASONS,
  TEAM_ALIASES,
  loadMatches,
  normalizeTeamName,
  num,
  parseDate,
};
