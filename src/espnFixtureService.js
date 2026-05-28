const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");
const { listPredictions, updateResult } = require("./backtestStore");
const { mutableDataPath, readJsonWithFallback, repoDataPath, writeFileIfWritable, writeJson } = require("./runtimePaths");

const FIXTURE_PATH = repoDataPath("remaining_fixtures_2025_26_with_odds.csv");
const LIVE_FIXTURE_PATH = mutableDataPath("live_espn_fixtures.json");
const SEEDED_LIVE_FIXTURE_PATH = repoDataPath("live_espn_fixtures.json");
const LIVE_RESULTS_PATH = mutableDataPath("live_espn_results.json");
const SEEDED_LIVE_RESULTS_PATH = repoDataPath("live_espn_results.json");
const USER_AGENT = "Mozilla/5.0 FootballPredictionAI espn-fixture-refresh";

const ESPN_LEAGUES = {
  EPL: "eng.1",
  "La Liga": "esp.1",
  Bundesliga: "ger.1",
  "Ligue 1": "fra.1",
  "Serie A": "ita.1",
  "Champions League": "uefa.champions",
  "Europa League": "uefa.europa",
  "Conference League": "uefa.europa.conf",
  "UEFA Super Cup": "uefa.super_cup",
  "FA Cup": "eng.fa",
  "Carabao Cup": "eng.league_cup",
  "Copa del Rey": "esp.copa_del_rey",
  "DFB-Pokal": "ger.dfb_pokal",
  "Coppa Italia": "ita.coppa_italia",
  "Coupe de France": "fra.coupe_de_france",
  Eredivisie: "ned.1",
  "Primeira Liga": "por.1",
  "Scottish Premiership": "sco.1",
  "Turkish Super Lig": "tur.1",
  "Belgian Pro League": "bel.1",
  "Austrian Bundesliga": "aut.1",
  "Danish Superliga": "den.1",
  Eliteserien: "nor.1",
  Allsvenskan: "swe.1",
  "Swiss Super League": "sui.1",
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
  const finalHeaders = [...new Set([...headers, "date", "league", "homeTeam", "awayTeam", "homeLogoUrl", "awayLogoUrl", "homeRecord", "awayRecord", "homeOdds", "drawOdds", "awayOdds", "oddsSource", "oddsStatus", "oddsSourceUrl", "oddsSnapshotAt", "espnEventId", "kickoffUtc", "fixtureSource"])];
  const output = [finalHeaders.join(","), ...rows.map((row) => finalHeaders.map((header) => csvCell(row[header])).join(","))].join("\n") + "\n";
  writeFileIfWritable(FIXTURE_PATH, output);
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

function logoFromCompetitors(competitors, homeAway) {
  const team = competitors.find((competitor) => competitor.homeAway === homeAway)?.team || {};
  return team.logos?.[0]?.href || team.logo || "";
}

function recordFromCompetitors(competitors, homeAway) {
  const competitor = competitors.find((entry) => entry.homeAway === homeAway) || {};
  return competitor.records?.find((record) => record.type === "total")?.summary || competitor.records?.[0]?.summary || "";
}

function normalizeEspnEvent(event, league, sourceUrl) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const status = event.status?.type || {};
  const homeTeam = normalizeTeamName(teamFromCompetitors(competitors, "home"));
  const awayTeam = normalizeTeamName(teamFromCompetitors(competitors, "away"));
  const kickoff = event.date || competition.date || "";
  return {
    date: kickoff ? kickoff.slice(0, 10) : "",
    league,
    homeTeam,
    awayTeam,
    homeLogoUrl: logoFromCompetitors(competitors, "home"),
    awayLogoUrl: logoFromCompetitors(competitors, "away"),
    homeRecord: recordFromCompetitors(competitors, "home"),
    awayRecord: recordFromCompetitors(competitors, "away"),
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

function competitorByHomeAway(competition, homeAway) {
  return (competition.competitors || []).find((competitor) => competitor.homeAway === homeAway) || {};
}

function scoreForCompetitor(competition, homeAway) {
  const score = competitorByHomeAway(competition, homeAway).score;
  const n = Number(score);
  return Number.isFinite(n) ? n : null;
}

function sourceLink(event, fallbackUrl) {
  const links = event.links || [];
  return links.find((link) => (link.rel || []).includes("summary"))?.href || fallbackUrl;
}

function normalizeEspnResult(event, league, sourceUrl) {
  const competition = event.competitions?.[0] || {};
  const status = event.status?.type || competition.status?.type || {};
  const homeTeam = normalizeTeamName(teamFromCompetitors(competition.competitors || [], "home"));
  const awayTeam = normalizeTeamName(teamFromCompetitors(competition.competitors || [], "away"));
  const kickoff = event.date || competition.date || "";
  const homeGoals = scoreForCompetitor(competition, "home");
  const awayGoals = scoreForCompetitor(competition, "away");
  return {
    date: kickoff ? kickoff.slice(0, 10) : "",
    league,
    homeTeam,
    awayTeam,
    homeGoals,
    awayGoals,
    espnEventId: event.id || competition.id || "",
    kickoffUtc: kickoff,
    completed: Boolean(status.completed),
    statusState: status.state || "",
    statusName: status.name || "",
    statusDetail: status.detail || status.shortDetail || "",
    sourceName: "ESPN public event scoreboard API",
    sourceUrl: sourceLink(event, sourceUrl),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchLeagueScoreboard(league, dateWindow) {
  const code = ESPN_LEAGUES[league];
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${dateWindow}&limit=300`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`ESPN ${league} fixture request failed: ${response.status}`);
  const payload = await response.json();
  return { sourceUrl, events: payload.events || [] };
}

function allEuropeanLeagueNames() {
  return Object.keys(ESPN_LEAGUES);
}

async function fetchLeagueFixtures(league, dateWindow) {
  const { sourceUrl, events } = await fetchLeagueScoreboard(league, dateWindow);
  return events
    .map((event) => normalizeEspnEvent(event, league, sourceUrl))
    .filter((fixture) => fixture.date && fixture.homeTeam && fixture.awayTeam && !fixture.completed);
}

async function fetchLeagueResults(league, dateWindow) {
  const { sourceUrl, events } = await fetchLeagueScoreboard(league, dateWindow);
  return events
    .map((event) => normalizeEspnResult(event, league, sourceUrl))
    .filter((result) => result.completed && result.date && result.homeTeam && result.awayTeam && Number.isFinite(result.homeGoals) && Number.isFinite(result.awayGoals));
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
      byKey.set(existingKey, {
        ...existing,
        homeLogoUrl: existing.homeLogoUrl || fixture.homeLogoUrl,
        awayLogoUrl: existing.awayLogoUrl || fixture.awayLogoUrl,
        homeRecord: existing.homeRecord || fixture.homeRecord,
        awayRecord: existing.awayRecord || fixture.awayRecord,
        espnEventId: existing.espnEventId || fixture.espnEventId,
        kickoffUtc: existing.kickoffUtc || fixture.kickoffUtc,
        fixtureSource: existing.fixtureSource || fixture.fixtureSource,
      });
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
      deduped[existingIndex] = {
        ...keep,
        homeLogoUrl: keep.homeLogoUrl || merge.homeLogoUrl,
        awayLogoUrl: keep.awayLogoUrl || merge.awayLogoUrl,
        homeRecord: keep.homeRecord || merge.homeRecord,
        awayRecord: keep.awayRecord || merge.awayRecord,
        espnEventId: keep.espnEventId || merge.espnEventId,
        kickoffUtc: keep.kickoffUtc || merge.kickoffUtc,
        fixtureSource: keep.fixtureSource || merge.fixtureSource,
      };
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
  writeJson(LIVE_FIXTURE_PATH, snapshot);
  return snapshot;
}

function readResultsSnapshot() {
  return readJsonWithFallback(LIVE_RESULTS_PATH, SEEDED_LIVE_RESULTS_PATH, null);
}

function resultsSnapshotIsFresh(maxAgeMinutes = 3, dateWindow = "") {
  const snapshot = readResultsSnapshot();
  if (!snapshot?.updatedAt) return false;
  if (dateWindow && snapshot.dateWindow !== dateWindow) return false;
  const ageMs = Date.now() - Date.parse(snapshot.updatedAt);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < maxAgeMinutes * 60_000;
}

function resultMatchKey(result) {
  return [result.league, normalizeTeamName(result.homeTeam), normalizeTeamName(result.awayTeam)].join("|").toLowerCase();
}

function predictionMatchesResult(prediction, result) {
  if (prediction.status === "SETTLED") return false;
  if (prediction.source !== "fixture-board") return false;
  if (prediction.espnEventId && result.espnEventId && String(prediction.espnEventId) === String(result.espnEventId)) return true;
  if (resultMatchKey(prediction) !== resultMatchKey(result)) return false;
  return daysBetween(prediction.kickoffUtc || prediction.date, result.kickoffUtc || result.date) <= 2;
}

async function refreshEspnResults({ daysBack = 14, daysForward = 1, force = false } = {}) {
  const maxAgeMinutes = Number(process.env.ESPN_RESULTS_CACHE_MINUTES || 3);
  const dateWindow = dateRange(daysBack, daysForward);
  if (!force && resultsSnapshotIsFresh(maxAgeMinutes, dateWindow)) {
    return { ...readResultsSnapshot(), cached: true };
  }

  const results = [];
  const errors = [];
  for (const league of Object.keys(ESPN_LEAGUES)) {
    try {
      results.push(...await fetchLeagueResults(league, dateWindow));
    } catch (error) {
      errors.push({ league, message: error.message });
    }
  }

  const pending = listPredictions().filter((prediction) => prediction.status !== "SETTLED");
  const settled = [];
  const seenIds = new Set();
  for (const result of results) {
    const match = pending.find((prediction) => predictionMatchesResult(prediction, result));
    if (!match || seenIds.has(match.id)) continue;
    const updated = updateResult(match.id, {
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      settledBy: "espn-auto",
      sourceName: result.sourceName,
      sourceUrl: result.sourceUrl,
      sourceEventId: result.espnEventId,
    });
    if (updated) {
      seenIds.add(match.id);
      settled.push({
        id: updated.id,
        date: updated.date,
        league: updated.league,
        homeTeam: updated.homeTeam,
        awayTeam: updated.awayTeam,
        homeGoals: updated.homeGoals,
        awayGoals: updated.awayGoals,
        prediction: updated.prediction,
        correct: updated.correct,
        sourceUrl: result.sourceUrl,
        espnEventId: result.espnEventId,
      });
    }
  }

  const snapshot = {
    updatedAt: new Date().toISOString(),
    source: "ESPN public event scoreboard API",
    dateWindow,
    checkedLeagues: Object.keys(ESPN_LEAGUES),
    fetched: results.length,
    settled: settled.length,
    results,
    settledPredictions: settled,
    errors,
  };
  writeJson(LIVE_RESULTS_PATH, snapshot);
  return snapshot;
}

module.exports = {
  ESPN_LEAGUES,
  allEuropeanLeagueNames,
  readResultsSnapshot,
  refreshEspnFixtures,
  refreshEspnResults,
};
