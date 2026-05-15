const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const DATA_DIR = "C:\\Users\\adebi\\Downloads\\Football data";
const OUT_FILE = path.join(DATA_DIR, "Football_MultiClub_Dataset_2023-2026_CLEAN.xlsx");

const seasons = [
  {
    season: "2023-24",
    files: {
      EPL: "E0 (2).csv",
      "La Liga": "SP1 (2).csv",
      Bundesliga: "D1 (2).csv",
      "Ligue 1": "F1 (2).csv",
    },
  },
  {
    season: "2024-25",
    files: {
      EPL: "E0 (1).csv",
      "La Liga": "SP1 (1).csv",
      Bundesliga: "D1 (1).csv",
      "Ligue 1": "F1 (1).csv",
    },
  },
  {
    season: "2025-26",
    files: {
      EPL: "E0.csv",
      "La Liga": "SP1.csv",
      Bundesliga: "D1.csv",
      "Ligue 1": "F1.csv",
    },
  },
];

const clubs = [
  { display: "Manchester United", csv: "Man United", league: "EPL" },
  { display: "Chelsea", csv: "Chelsea", league: "EPL" },
  { display: "Manchester City", csv: "Man City", league: "EPL" },
  { display: "Real Madrid", csv: "Real Madrid", league: "La Liga" },
  { display: "FC Barcelona", csv: "Barcelona", league: "La Liga" },
  { display: "Bayern Munich", csv: "Bayern Munich", league: "Bundesliga" },
  { display: "Paris Saint-Germain", csv: "Paris SG", league: "Ligue 1" },
];

function readCsv(file) {
  const text = fs.readFileSync(path.join(DATA_DIR, file), "utf8").replace(/^\uFEFF/, "");
  const rows = parseCsv(text);
  const headers = rows.shift();
  return rows
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ""])));
}

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

function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const parsed = XLSX.SSF.parse_date_code(Number(text));
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const [day, month, year] = text.split(/[/-]/).map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(value) {
  const d = parseDate(value);
  return d.toISOString().slice(0, 10);
}

function asNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resultFor(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor < goalsAgainst) return "L";
  return "D";
}

function pointsFor(result) {
  if (result === "W") return 3;
  if (result === "D") return 1;
  return 0;
}

function blankRecord(team) {
  return { Team: team, MP: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
}

function rankTable(table) {
  return [...table.values()]
    .map((r) => ({ ...r, GD: r.GF - r.GA }))
    .sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.Team.localeCompare(b.Team))
    .map((r, i) => ({ Position: i + 1, ...r }));
}

function updateTable(table, match) {
  const home = match.HomeTeam;
  const away = match.AwayTeam;
  if (!table.has(home)) table.set(home, blankRecord(home));
  if (!table.has(away)) table.set(away, blankRecord(away));

  const h = table.get(home);
  const a = table.get(away);
  const hg = asNumber(match.FTHG);
  const ag = asNumber(match.FTAG);
  const hr = resultFor(hg, ag);
  const ar = resultFor(ag, hg);

  h.MP += 1; h.GF += hg; h.GA += ag; h[hr] += 1; h.Pts += pointsFor(hr); h.GD = h.GF - h.GA;
  a.MP += 1; a.GF += ag; a.GA += hg; a[ar] += 1; a.Pts += pointsFor(ar); a.GD = a.GF - a.GA;
}

function buildStandingSnapshots(matches) {
  const table = new Map();
  const snapshots = new Map();
  const sorted = [...matches].sort((a, b) => parseDate(a.Date) - parseDate(b.Date) || String(a.Time).localeCompare(String(b.Time)));

  for (const match of sorted) {
    updateTable(table, match);
    const ranked = rankTable(table);
    for (const row of ranked) {
      snapshots.set(`${match.Date}|${match.HomeTeam}|${match.AwayTeam}|${row.Team}`, row);
    }
  }
  return { snapshots, finalTable: rankTable(table) };
}

function teamMatchRows(matches, snapshots, season, league, club) {
  const teamMatches = matches
    .filter((m) => m.HomeTeam === club.csv || m.AwayTeam === club.csv)
    .sort((a, b) => parseDate(a.Date) - parseDate(b.Date) || String(a.Time).localeCompare(String(b.Time)));

  return teamMatches.map((m, i) => {
    const isHome = m.HomeTeam === club.csv;
    const gf = asNumber(isHome ? m.FTHG : m.FTAG);
    const ga = asNumber(isHome ? m.FTAG : m.FTHG);
    const result = resultFor(gf, ga);
    const standing = snapshots.get(`${m.Date}|${m.HomeTeam}|${m.AwayTeam}|${club.csv}`) || blankRecord(club.csv);

    return {
      Season: season,
      League: league,
      Team: club.display,
      Matchday: i + 1,
      Date: isoDate(m.Date),
      Time: m.Time,
      Venue: isHome ? "Home" : "Away",
      Opponent: isHome ? m.AwayTeam : m.HomeTeam,
      HomeTeam: m.HomeTeam,
      AwayTeam: m.AwayTeam,
      GoalsFor: gf,
      GoalsAgainst: ga,
      TotalGoals: gf + ga,
      Result: result,
      Points: pointsFor(result),
      TeamShots: asNumber(isHome ? m.HS : m.AS),
      OpponentShots: asNumber(isHome ? m.AS : m.HS),
      TeamShotsOnTarget: asNumber(isHome ? m.HST : m.AST),
      OpponentShotsOnTarget: asNumber(isHome ? m.AST : m.HST),
      TeamCorners: asNumber(isHome ? m.HC : m.AC),
      OpponentCorners: asNumber(isHome ? m.AC : m.HC),
      TeamFouls: asNumber(isHome ? m.HF : m.AF),
      OpponentFouls: asNumber(isHome ? m.AF : m.HF),
      TeamYellowCards: asNumber(isHome ? m.HY : m.AY),
      OpponentYellowCards: asNumber(isHome ? m.AY : m.HY),
      TeamRedCards: asNumber(isHome ? m.HR : m.AR),
      OpponentRedCards: asNumber(isHome ? m.AR : m.HR),
      HalfTimeGoalsFor: asNumber(isHome ? m.HTHG : m.HTAG),
      HalfTimeGoalsAgainst: asNumber(isHome ? m.HTAG : m.HTHG),
      HalfTimeResult: isHome ? m.HTR : (m.HTR === "H" ? "A" : m.HTR === "A" ? "H" : m.HTR),
      Referee: m.Referee,
      StandingPositionAfterMatch: standing.Position ?? null,
      StandingPlayedAfterMatch: standing.MP ?? null,
      StandingWinsAfterMatch: standing.W ?? null,
      StandingDrawsAfterMatch: standing.D ?? null,
      StandingLossesAfterMatch: standing.L ?? null,
      StandingGF_AfterMatch: standing.GF ?? null,
      StandingGA_AfterMatch: standing.GA ?? null,
      StandingGD_AfterMatch: standing.GD ?? null,
      StandingPointsAfterMatch: standing.Pts ?? null,
      H2H_Key: [club.csv, isHome ? m.AwayTeam : m.HomeTeam].sort().join(" vs "),
      SourceFile: seasons.find((s) => s.season === season).files[league],
    };
  });
}

function safeSheetName(name) {
  return name.replace(/[:\\/?*\[\]]/g, "").slice(0, 31);
}

function addSheet(workbook, name, rows) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(name));
}

const workbook = XLSX.utils.book_new();
const readmeRows = [
  { Field: "Generated", Value: new Date().toISOString() },
  { Field: "Source directory", Value: DATA_DIR },
  { Field: "Coverage", Value: "League match results and team match stats for 2023-24, 2024-25, and partial 2025-26 through source-file dates." },
  { Field: "Target clubs", Value: clubs.map((c) => c.display).join(", ") },
  { Field: "Player stats", Value: "Not present in the provided CSV files. Player-stat sheets are included as templates with SourceStatus = Missing source file." },
  { Field: "Standing method", Value: "League table recomputed after each match using points, goal difference, goals for, then team name." },
];
addSheet(workbook, "README", readmeRows);

const auditRows = [];

for (const season of seasons) {
  for (const [league, file] of Object.entries(season.files)) {
    const matches = readCsv(file);
    const { snapshots, finalTable } = buildStandingSnapshots(matches);
    addSheet(
      workbook,
      `Standings_${season.season}_${league}`,
      finalTable.map((r) => ({ Season: season.season, League: league, ...r, SourceFile: file }))
    );

    for (const club of clubs.filter((c) => c.league === league)) {
      const rows = teamMatchRows(matches, snapshots, season.season, league, club);
      addSheet(workbook, `${club.display}_${season.season}`, rows);
      auditRows.push({
        Season: season.season,
        League: league,
        Team: club.display,
        SourceFile: file,
        MatchRows: rows.length,
        FirstMatch: rows[0]?.Date || "",
        LastMatch: rows.at(-1)?.Date || "",
      });
    }
  }

  const playerRows = clubs.map((club) => ({
    Season: season.season,
    League: club.league,
    Team: club.display,
    Player: "",
    Position: "",
    Goals: "",
    Assists: "",
    CleanSheets: "",
    AvgRating: "",
    SourceStatus: "Missing source file in provided directory",
    SuggestedSource: "Add player-season export from FBref/Statbunker/SofaScore/WhoScored, then fill or join by Season + Team + Player.",
  }));
  addSheet(workbook, `PlayerStats_${season.season}`, playerRows);
}

addSheet(workbook, "Source_Audit", auditRows);

XLSX.writeFile(workbook, OUT_FILE, { bookType: "xlsx" });
console.log(OUT_FILE);
