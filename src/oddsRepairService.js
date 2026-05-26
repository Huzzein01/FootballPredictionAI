const fs = require("fs");
const path = require("path");
const { repoDataPath, writeFileIfWritable } = require("./runtimePaths");

const FIXTURE_PATH = repoDataPath("remaining_fixtures_2025_26_with_odds.csv");
const USER_AGENT = "Mozilla/5.0 FootballPredictionAI odds-refresh";

const PUBLIC_ODDS_SEEDS = [
  {
    date: "2026-05-24",
    league: "La Liga",
    homeTeam: "Valencia",
    awayTeam: "Barcelona",
    homeOdds: "3.60",
    drawOdds: "3.90",
    awayOdds: "1.85",
    oddsSource: "Tips.GG",
    oddsStatus: "Public odds refreshed",
    oddsSourceUrl: "https://tips.gg/matches/football/24-05-2026/valencia-vs-barcelona/05-00/odds/",
    note: "Current public 1X2 line found online; Tips.GG listed Bet365 at Valencia 3.60, Draw 3.90, Barcelona 1.85.",
  },
  {
    date: "2026-05-24",
    league: "EPL",
    homeTeam: "Sunderland",
    awayTeam: "Chelsea",
    homeOdds: "3.60",
    drawOdds: "3.60",
    awayOdds: "1.95",
    oddsSource: "Tips.GG",
    oddsStatus: "Public odds refreshed",
    oddsSourceUrl: "https://tips.gg/matches/football/24-05-2026/sunderland-vs-chelsea/03-00/odds/",
    note: "Current public 1X2 line found online; Tips.GG listed Bet365 at Sunderland 3.60, Draw 3.60, Chelsea 1.95.",
  },
  {
    date: "2026-05-17",
    league: "Ligue 1",
    homeTeam: "Nantes",
    awayTeam: "Toulouse",
    homeOdds: "2.78",
    drawOdds: "3.39",
    awayOdds: "2.78",
    oddsSource: "SportyTrader",
    oddsStatus: "Public odds fallback",
    oddsSourceUrl: "https://www.sportytrader.com/en/odds/nantes-toulouse-7679427/",
    note: "The Odds API no longer lists the closed market; SportyTrader archived best 1X2 odds at Nantes 2.78, Draw 3.39, Toulouse 2.78.",
  },
];

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function fixtureKey(fixture) {
  return [fixture.date, fixture.league, fixture.homeTeam, fixture.awayTeam].map((part) => String(part || "").trim().toLowerCase()).join("|");
}

function hasUsableOdds(row) {
  return [row.homeOdds, row.drawOdds, row.awayOdds].every((value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 && number <= 20;
  });
}

function readFixtureCsv() {
  if (!fs.existsSync(FIXTURE_PATH)) return { headers: [], rows: [] };
  const lines = fs.readFileSync(FIXTURE_PATH, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || "");
  const rows = lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
  return { headers, rows };
}

function writeFixtureCsv(headers, rows) {
  const output = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n") + "\n";
  writeFileIfWritable(FIXTURE_PATH, output);
}

function moneylineToDecimal(value) {
  const text = String(value || "").replace(/[^\d+-]/g, "");
  const number = Number(text);
  if (!Number.isFinite(number) || number === 0) return "";
  return (number > 0 ? 1 + number / 100 : 1 + 100 / Math.abs(number)).toFixed(2);
}

function fractionToDecimal(value) {
  const match = String(value || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return "";
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return "";
  return (1 + numerator / denominator).toFixed(2);
}

function oddsFromText(text, fixture) {
  const plain = String(text || "").replace(/\s+/g, " ");
  const teamPattern = `${fixture.homeTeam}[^\\d+-]+([+-]\\d{2,4}|\\d+\\.\\d{2}|\\d+\\/\\d+)[^A-Za-z]+Draw[^\\d+-]+([+-]\\d{2,4}|\\d+\\.\\d{2}|\\d+\\/\\d+)[^A-Za-z]+${fixture.awayTeam}[^\\d+-]+([+-]\\d{2,4}|\\d+\\.\\d{2}|\\d+\\/\\d+)`;
  const genericPattern = `${fixture.homeTeam}.*?${fixture.awayTeam}.*?([+-]\\d{2,4}|\\d+\\.\\d{2}|\\d+\\/\\d+).*?([+-]\\d{2,4}|\\d+\\.\\d{2}|\\d+\\/\\d+).*?([+-]\\d{2,4}|\\d+\\.\\d{2}|\\d+\\/\\d+)`;
  const match = plain.match(new RegExp(teamPattern, "i")) || plain.match(new RegExp(genericPattern, "i"));
  if (!match) return null;
  const convert = (value) => (String(value).includes("/") ? fractionToDecimal(value) : String(value).startsWith("+") || String(value).startsWith("-") ? moneylineToDecimal(value) : Number(value).toFixed(2));
  const odds = {
    homeOdds: convert(match[1]),
    drawOdds: convert(match[2]),
    awayOdds: convert(match[3]),
  };
  return hasUsableOdds(odds) ? odds : null;
}

async function fetchPublicOdds(seed) {
  if (!seed.oddsSourceUrl) return null;
  try {
    const response = await fetch(seed.oddsSourceUrl, { headers: { "user-agent": USER_AGENT } });
    if (!response.ok) return null;
    const text = await response.text();
    return oddsFromText(text, seed);
  } catch {
    return null;
  }
}

async function refreshMissingOdds({ force = false } = {}) {
  const { headers, rows } = readFixtureCsv();
  if (!headers.length || !rows.length) return { checked: 0, updated: 0, fixtures: [] };
  const seedByKey = new Map(PUBLIC_ODDS_SEEDS.map((seed) => [fixtureKey(seed), seed]));
  const fixtures = [];

  for (const row of rows) {
    if (!force && hasUsableOdds(row)) continue;
    const seed = seedByKey.get(fixtureKey(row));
    if (!seed) continue;
    const fetchedOdds = await fetchPublicOdds(seed);
    const odds = fetchedOdds || seed;
    row.homeOdds = odds.homeOdds;
    row.drawOdds = odds.drawOdds;
    row.awayOdds = odds.awayOdds;
    row.oddsSource = seed.oddsSource;
    row.oddsStatus = seed.oddsStatus;
    row.oddsSourceUrl = seed.oddsSourceUrl;
    row.oddsSnapshotAt = new Date().toISOString();
    fixtures.push({
      date: row.date,
      league: row.league,
      fixture: `${row.homeTeam} vs ${row.awayTeam}`,
      homeOdds: row.homeOdds,
      drawOdds: row.drawOdds,
      awayOdds: row.awayOdds,
      oddsSource: row.oddsSource,
      oddsSourceUrl: row.oddsSourceUrl,
      fetchedLive: Boolean(fetchedOdds),
    });
  }

  if (fixtures.length) writeFixtureCsv(headers, rows);
  return { checked: rows.filter((row) => seedByKey.has(fixtureKey(row))).length, updated: fixtures.length, fixtures };
}

module.exports = {
  refreshMissingOdds,
};
