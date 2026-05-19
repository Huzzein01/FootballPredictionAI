const fs = require("fs");
const path = require("path");
const { listPredictions } = require("./backtestStore");
const { normalizeTeamName } = require("./footballData");

const LIVE_CONTEXT_PATH = path.join(process.cwd(), "data", "live_league_context.json");
const PLAYED_RESULTS_PATH = path.join(process.cwd(), "data", "played_results.json");
const USER_AGENT = "Mozilla/5.0 FootballPredictionAI standings-refresh";

const LEAGUE_RULES = {
  EPL: { totalGames: 38, sourceCode: "eng.1", name: "English Premier League" },
  "La Liga": { totalGames: 38, sourceCode: "esp.1", name: "La Liga" },
  Bundesliga: { totalGames: 34, sourceCode: "ger.1", name: "Bundesliga" },
  "Ligue 1": { totalGames: 34, sourceCode: "fra.1", name: "Ligue 1" },
};

const SEASON_META = {
  "2025-26": { espnSeason: "2025", available: true, current: true, label: "2025-26" },
  "2024-25": { espnSeason: "2024", available: true, current: false, label: "2024-25 archive" },
  "2023-24": { espnSeason: "2023", available: true, current: false, label: "2023-24 archive" },
  "2022-23": { espnSeason: "2022", available: true, current: false, label: "2022-23 archive" },
  "2021-22": { espnSeason: "2021", available: true, current: false, label: "2021-22 archive" },
  "2020-21": { espnSeason: "2020", available: true, current: false, label: "2020-21 archive" },
  "2026-27": { espnSeason: "2026", available: false, current: false, label: "2026-27" },
};

function seasonMeta(season = "2025-26") {
  return SEASON_META[season] || SEASON_META["2025-26"];
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function statMap(entry) {
  return Object.fromEntries((entry.stats || []).map((stat) => [stat.name, stat.value]));
}

function standingsUrl(league, season = "2025-26") {
  const code = LEAGUE_RULES[league]?.sourceCode;
  if (!code) return "";
  return `https://site.web.api.espn.com/apis/v2/sports/soccer/${code}/standings?region=us&lang=en&contentorigin=espn&season=${seasonMeta(season).espnSeason}`;
}

function parseEspnStandings(league, payload) {
  const entries = payload?.children?.[0]?.standings?.entries || payload?.standings?.entries || [];
  return entries
    .map((entry, index) => {
      const stats = statMap(entry);
      return {
        rank: numeric(stats.rank) || index + 1,
        team: normalizeTeamName(entry.team?.displayName || entry.team?.name || entry.team?.shortDisplayName || ""),
        sourceTeam: entry.team?.displayName || entry.team?.name || "",
        played: numeric(stats.gamesPlayed),
        wins: numeric(stats.wins),
        draws: numeric(stats.ties),
        losses: numeric(stats.losses),
        points: numeric(stats.points),
        goalsFor: numeric(stats.pointsFor),
        goalsAgainst: numeric(stats.pointsAgainst),
        goalDifference: numeric(stats.pointDifferential),
        league,
      };
    })
    .filter((entry) => entry.team);
}

async function fetchLeagueStandings(league, season = "2025-26") {
  const sourceUrl = standingsUrl(league, season);
  if (!sourceUrl) return null;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return null;
  const payload = await response.json();
  const standings = parseEspnStandings(league, payload);
  if (!standings.length) return null;
  return {
    name: LEAGUE_RULES[league].name,
    source: "ESPN public standings API",
    sourceUrl,
    season,
    standings,
    notes: tableNotes(league, standings),
  };
}

function loadLiveLeagueContext() {
  if (!fs.existsSync(LIVE_CONTEXT_PATH)) return { updatedAt: "", season: "2025-26", leagues: {} };
  return JSON.parse(fs.readFileSync(LIVE_CONTEXT_PATH, "utf8").replace(/^\uFEFF/, ""));
}

function writeLiveLeagueContext(context) {
  fs.mkdirSync(path.dirname(LIVE_CONTEXT_PATH), { recursive: true });
  fs.writeFileSync(LIVE_CONTEXT_PATH, JSON.stringify(context, null, 2));
}

function tableSignature(context) {
  return JSON.stringify({
    season: context.season || "2025-26",
    policy: context.policy || "",
    leagues: context.leagues || {},
  });
}

async function refreshLiveLeagueContext() {
  const existing = loadLiveLeagueContext();
  const leagues = { ...(existing.leagues || {}) };
  const refreshed = [];
  for (const league of Object.keys(LEAGUE_RULES)) {
    try {
      const data = await fetchLeagueStandings(league);
      if (!data) continue;
      leagues[league] = data;
      refreshed.push(league);
    } catch {
      // Keep the last usable table if the public feed is unavailable.
    }
  }
  const policy =
    "Live standings are refreshed from public tables, then fixture-ledger results settled after the public snapshot are layered on top for current motivation and title-race judgment.";
  const context = {
    ...existing,
    updatedAt: new Date().toISOString(),
    season: "2025-26",
    policy,
    leagues,
  };
  const nextContext = refreshed.length && tableSignature(context) !== tableSignature(existing) ? context : existing;
  if (nextContext === context) writeLiveLeagueContext(context);
  return { context: nextContext, refreshed };
}

async function archivedLeagueTables(season = "2025-26") {
  const meta = seasonMeta(season);
  if (!meta.available) {
    return {
      updatedAt: "",
      generatedAt: new Date().toISOString(),
      season,
      unavailable: true,
      message: `${season} league data is not available yet. Import the new season fixtures and tables once they are released.`,
      leagues: {},
      refreshed: [],
    };
  }
  if (meta.current) {
    const { context, refreshed } = await refreshLiveLeagueContext();
    return { ...effectiveTables(context), season, refreshed };
  }
  const leagues = {};
  const refreshed = [];
  for (const league of Object.keys(LEAGUE_RULES)) {
    try {
      const data = await fetchLeagueStandings(league, season);
      if (!data) continue;
      leagues[league] = {
        ...data,
        standings: rankTable(league, new Map(data.standings.map((entry) => [normalizeTeamName(entry.team), { ...entry, ledgerDelta: { played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 } }]))),
        totalGames: LEAGUE_RULES[league]?.totalGames || 38,
        trackedResultsApplied: 0,
      };
      refreshed.push(league);
    } catch {
      // Keep archive response partial if one league feed is unavailable.
    }
  }
  return {
    updatedAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    season,
    sourcePolicy: "Archived club tables are loaded from public ESPN season standings and are not layered with current fixture-ledger results.",
    leagues,
    refreshed,
  };
}

function loadVerifiedPlayedResults() {
  if (!fs.existsSync(PLAYED_RESULTS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(PLAYED_RESULTS_PATH, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(data.results) ? data.results : [];
}

function ledgerResultsAfter(snapshotAt) {
  const snapshotTime = Date.parse(snapshotAt || "");
  return listPredictions()
    .filter((entry) => entry.status === "SETTLED")
    .filter((entry) => Number.isFinite(Number(entry.homeGoals)) && Number.isFinite(Number(entry.awayGoals)))
    .filter((entry) => {
      if (!Number.isFinite(snapshotTime)) return true;
      const settledTime = Date.parse(entry.settledAt || entry.createdAt || "");
      return Number.isFinite(settledTime) && settledTime > snapshotTime;
    })
    .map((entry) => ({
      date: entry.date,
      league: entry.league,
      homeTeam: entry.homeTeam,
      awayTeam: entry.awayTeam,
      homeGoals: Number(entry.homeGoals),
      awayGoals: Number(entry.awayGoals),
      sourceName: "Fixture ledger",
      sourceUrl: "",
      settledAt: entry.settledAt || entry.createdAt || "",
    }));
}

function allTrackedResults(snapshotAt) {
  const ledger = ledgerResultsAfter(snapshotAt);
  const verified = snapshotAt ? [] : loadVerifiedPlayedResults().map((entry) => ({ ...entry, verified: true }));
  const seen = new Set();
  return [...verified, ...ledger].filter((result) => {
    const key = [result.date, result.league, normalizeTeamName(result.homeTeam), normalizeTeamName(result.awayTeam)].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return result.league && result.homeTeam && result.awayTeam;
  });
}

function ensureTeam(table, team) {
  const normalized = normalizeTeamName(team);
  if (!table.has(normalized)) {
    table.set(normalized, {
      team: normalized,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      ledgerDelta: { played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 },
    });
  }
  return table.get(normalized);
}

function applyResult(table, result) {
  const home = ensureTeam(table, result.homeTeam);
  const away = ensureTeam(table, result.awayTeam);
  const homeGoals = Number(result.homeGoals);
  const awayGoals = Number(result.awayGoals);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return;

  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;
  home.ledgerDelta.played += 1;
  away.ledgerDelta.played += 1;
  home.ledgerDelta.goalsFor += homeGoals;
  home.ledgerDelta.goalsAgainst += awayGoals;
  away.ledgerDelta.goalsFor += awayGoals;
  away.ledgerDelta.goalsAgainst += homeGoals;

  if (homeGoals > awayGoals) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
    home.ledgerDelta.points += 3;
  } else if (homeGoals < awayGoals) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
    away.ledgerDelta.points += 3;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
    home.ledgerDelta.points += 1;
    away.ledgerDelta.points += 1;
  }
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
}

function rankTable(league, table) {
  return [...table.values()]
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.localeCompare(b.team);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1, league }));
}

function maxPoints(entry, league) {
  return Number(entry.points || 0) + Math.max(0, (LEAGUE_RULES[league]?.totalGames || 38) - Number(entry.played || 0)) * 3;
}

function tableNotes(league, standings) {
  if (!standings.length) return ["Waiting for standings data."];
  const leader = standings[0];
  const second = standings[1];
  const leaderMaxThreat = second ? maxPoints(second, league) : 0;
  const notes = [];
  if (Number(leader.points || 0) > leaderMaxThreat) {
    notes.push(`${leader.team} have secured the title; remove title-race pressure from remaining league fixtures.`);
  } else if (second) {
    notes.push(`${leader.team} lead ${second.team} by ${Number(leader.points || 0) - Number(second.points || 0)} points; title race remains live.`);
  }
  const rules = LEAGUE_RULES[league] || { totalGames: 38 };
  const gamesLeft = standings.map((entry) => Math.max(0, rules.totalGames - Number(entry.played || 0)));
  if (gamesLeft.every((left) => left === 0)) notes.push("League campaign complete; future predictions should use final-table context.");
  return notes;
}

function effectiveTables(context = loadLiveLeagueContext()) {
  const snapshotAt = context.updatedAt || "";
  const results = allTrackedResults(snapshotAt);
  const leagues = {};
  for (const [league, data] of Object.entries(context.leagues || {})) {
    const table = new Map((data.standings || []).map((entry) => [normalizeTeamName(entry.team), { ...entry, team: normalizeTeamName(entry.team), ledgerDelta: { played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 } }]));
    for (const result of results.filter((item) => item.league === league)) applyResult(table, result);
    const standings = rankTable(league, table);
    leagues[league] = {
      ...data,
      standings,
      notes: tableNotes(league, standings),
      trackedResultsApplied: results.filter((item) => item.league === league).length,
      totalGames: LEAGUE_RULES[league]?.totalGames || 38,
    };
  }
  return {
    updatedAt: context.updatedAt || "",
    generatedAt: new Date().toISOString(),
    sourcePolicy: context.policy || "",
    leagues,
  };
}

module.exports = {
  archivedLeagueTables,
  effectiveTables,
  refreshLiveLeagueContext,
};
