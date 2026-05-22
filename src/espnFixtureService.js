const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");

const FIXTURE_PATH = path.join(process.cwd(), "data", "remaining_fixtures_2025_26_with_odds.csv");
const LIVE_FIXTURE_PATH = path.join(process.cwd(), "data", "live_espn_fixtures.json");
const USER_AGENT = "Mozilla/5.0 FootballPredictionAI espn-fixture-refresh";

const ESPN_LEAGUES = {
  EPL: "eng.1",
  "La Liga": "esp.1",
  Bundesliga: "ger.1",
  "Ligue 1": "fra.1",
  "Serie A": "ita.1",
};

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

function readFixtureCsv() {
  if (!fs.existsSync(FIXTURE_PATH)) return { headers: [], rows: [] };
  const lines = fs.readFileSync(FIXTURE_PATH, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || "");
  const rows = lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
  return { headers, rows };
}

function writeFixtureCsv(headers, rows) {
  const finalHeaders = [...new Set([...headers, "date", "league", "homeTeam", "awayTeam", "homeOdds", "drawOdds", "awayOdds", "oddsSource", "oddsStatus", "oddsSourceUrl", "oddsSnapshotAt", "espnEventId", "kickoffUtc", "fixtureSource"])];
  const output = [finalHeaders.join(","), ...rows.map((row) => finalHeaders.map((header) => csvCell(row[header])).join(","))].join("\n") + "\n";
  fs.writeFileSync(FIXTURE_PATH, output);
}

function fixtureKey(fixture) {
  return [fixture.date, fixture.league, normalizeTeamName(fixture.homeTeam), normalizeTeamName(fixture.awayTeam)].join("|").toLowerCase();
}

function matchupKey(fixture) {
  return [fixture.league, normalizeTeamName(fixture.homeTeam), normalizeTeamName(fixture.awayTeam)].join("|").toLowerCase();
}

function daysBetween(a, b) {
  const aTime = Date.parse(a || "");
  const bTime = Date.parse(b || "");
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return Infinity;
  return Math.abs(aTime - bTime) / 86_400_000;
}

function yyyymmdd(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function dateRange(daysBack = 7, daysForward = 75) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + daysForward);
  return `${yyyymmdd(start)}-${yyyymmdd(end)}`;
}

function teamFromCompetitors(competitors, homeAway) {
  return competitors.find((competitor) => competitor.homeAway === homeAway)?.team?.displayName || "";
}

function normalizeEspnEvent(event, league, sourceUrl) {
  const competition = event.competitions?.[0] || {};
  const status = event.status?.type || {};
  const homeTeam = normalizeTeamName(teamFromCompetitors(competition.competitors || [], "home"));
  const awayTeam = normalizeTeamName(teamFromCompetitors(competition.competitors || [], "away"));
  const kickoff = event.date || competition.date || "";
  return {
    date: kickoff ? kickoff.slice(0, 10) : "",
    league,
    homeTeam,
    awayTeam,
    homeOdds: "",
    drawOdds: "",
    awayOdds: "",
    oddsSource: "ESPN public event API",
    oddsStatus: "Waiting for odds",
    oddsSourceUrl: sourceUrl,
    oddsSnapshotAt: "",
    espnEventId: event.id || competition.id || "",
    kickoffUtc: kickoff,
    fixtureSource: "ESPN public event API",
    statusState: status.state || "",
    statusName: status.name || "",
    completed: Boolean(status.completed),
  };
}

async function fetchLeagueFixtures(league, dateWindow) {
  const code = ESPN_LEAGUES[league];
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${dateWindow}&limit=300`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`ESPN ${league} fixture request failed: ${response.status}`);
  const payload = await response.json();
  return (payload.events || [])
    .map((event) => normalizeEspnEvent(event, league, sourceUrl))
    .filter((fixture) => fixture.date && fixture.homeTeam && fixture.awayTeam && !fixture.completed);
}

async function refreshEspnFixtures({ daysBack = 7, daysForward = 75 } = {}) {
  const dateWindow = dateRange(daysBack, daysForward);
  const fetched = [];
  const errors = [];
  for (const league of Object.keys(ESPN_LEAGUES)) {
    try {
      fetched.push(...await fetchLeagueFixtures(league, dateWindow));
    } catch (error) {
      errors.push({ league, message: error.message });
    }
  }

  const { headers, rows } = readFixtureCsv();
  const byKey = new Map(rows.map((row) => [fixtureKey(row), { ...row }]));
  const byMatchup = new Map();
  for (const row of rows) {
    const key = matchupKey(row);
    if (!byMatchup.has(key)) byMatchup.set(key, []);
    byMatchup.get(key).push(row);
  }
  let inserted = 0;
  let updated = 0;
  for (const fixture of fetched) {
    const key = fixtureKey(fixture);
    const existing =
      byKey.get(key) ||
      (byMatchup.get(matchupKey(fixture)) || []).find((row) => daysBetween(row.date, fixture.date) <= 2);
    if (existing) {
      const existingKey = fixtureKey(existing);
      byKey.delete(existingKey);
      byKey.set(existingKey, { ...existing, espnEventId: existing.espnEventId || fixture.espnEventId, kickoffUtc: existing.kickoffUtc || fixture.kickoffUtc, fixtureSource: existing.fixtureSource || fixture.fixtureSource });
      updated += 1;
    } else {
      byKey.set(key, fixture);
      inserted += 1;
    }
  }
  const deduped = [];
  for (const row of [...byKey.values()].sort((a, b) => {
    const dateDiff = Date.parse(a.date || "") - Date.parse(b.date || "");
    if (dateDiff) return dateDiff;
    return String(a.fixtureSource || "").localeCompare(String(b.fixtureSource || ""));
  })) {
    const existingIndex = deduped.findIndex((candidate) => matchupKey(candidate) === matchupKey(row) && daysBetween(candidate.date, row.date) <= 2);
    if (existingIndex >= 0) {
      const existing = deduped[existingIndex];
      const keep = existing.homeOdds || !row.homeOdds ? existing : row;
      const merge = keep === existing ? row : existing;
      deduped[existingIndex] = { ...keep, espnEventId: keep.espnEventId || merge.espnEventId, kickoffUtc: keep.kickoffUtc || merge.kickoffUtc, fixtureSource: keep.fixtureSource || merge.fixtureSource };
    } else {
      deduped.push(row);
    }
  }
  const mergedRows = deduped.sort((a, b) => `${a.date} ${a.league} ${a.homeTeam}`.localeCompare(`${b.date} ${b.league} ${b.homeTeam}`));
  if (inserted || updated) writeFixtureCsv(headers, mergedRows);

  const snapshot = {
    updatedAt: new Date().toISOString(),
    source: "ESPN public event scoreboard API",
    dateWindow,
    checkedLeagues: Object.keys(ESPN_LEAGUES),
    fetched: fetched.length,
    inserted,
    updated,
    errors,
    fixtures: fetched,
  };
  fs.writeFileSync(LIVE_FIXTURE_PATH, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

module.exports = {
  ESPN_LEAGUES,
  refreshEspnFixtures,
};
