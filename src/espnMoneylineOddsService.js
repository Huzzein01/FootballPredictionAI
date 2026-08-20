"use strict";

// Free, keyless 2-way (no draw) moneyline odds for baseball/basketball/NFL,
// sourced from the same ESPN public scoreboard endpoint family as
// espnOddsService.js (soccer's 3-way version) and multiSportDataService.js
// (schedule import). Kept separate because the odds shape has no `draw` key
// and each sport uses a different ESPN sport path.
const { mutableDataPath, readJsonWithFallback, writeJson } = require("./runtimePaths");
const path = require("path");
const fs = require("fs");

const USER_AGENT = "SportsbooksAnalyst/1.0 espn-moneyline-odds";
const CACHE_DIR = mutableDataPath("multi_sport");

const SPORT_PATHS = {
  baseball: "baseball/mlb",
  basketball: "basketball/nba",
  "american-football": "football/nfl",
};

function decimalFromAmerican(value) {
  const text = String(value ?? "").replace(/[^\d+-]/g, "");
  const n = Number(text);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function eventIdFromGameId(gameId) {
  const match = String(gameId || "").match(/:(\d+)$/);
  return match ? match[1] : null;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamDateKey(homeTeam, awayTeam, date) {
  return `${String(date || "").slice(0, 10)}|${normalizeName(homeTeam)}|${normalizeName(awayTeam)}`;
}

function oddsFromEspnCompetition(competition) {
  const entries = competition?.odds || [];
  for (const entry of entries) {
    if (!entry) continue;
    const moneyline = entry.moneyline;
    if (!moneyline) continue;
    const homeOdds = decimalFromAmerican(moneyline.home?.close?.odds ?? moneyline.home?.open?.odds);
    const awayOdds = decimalFromAmerican(moneyline.away?.close?.odds ?? moneyline.away?.open?.odds);
    if (!homeOdds || !awayOdds) continue;
    return {
      homeOdds: homeOdds.toFixed(2),
      awayOdds: awayOdds.toFixed(2),
      providerName: entry.provider?.displayName || entry.provider?.name || "ESPN sportsbook partner",
      sourceUrl: entry.link?.href || "",
    };
  }
  return null;
}

function dateRange(daysBack = 3, daysForward = 45) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + daysForward);
  const stamp = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");
  return `${stamp(start)}-${stamp(end)}`;
}

async function fetchOddsByEventId(sport, { daysBack = 3, daysForward = 45 } = {}) {
  const sportPath = SPORT_PATHS[sport];
  if (!sportPath) return new Map();
  const dateWindow = dateRange(daysBack, daysForward);
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${dateWindow}&limit=500`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`ESPN ${sport} scoreboard failed: ${response.status}`);
  const payload = await response.json();
  const oddsByEventId = new Map();
  const oddsByTeamDate = new Map();
  for (const event of payload.events || []) {
    const competition = event.competitions?.[0];
    const odds = oddsFromEspnCompetition(competition);
    if (!odds) continue;
    const enriched = { ...odds, sourceUrl: odds.sourceUrl || sourceUrl };
    oddsByEventId.set(String(event.id || competition?.id || ""), enriched);
    const competitors = competition?.competitors || [];
    const home = competitors.find((team) => team.homeAway === "home")?.team?.displayName;
    const away = competitors.find((team) => team.homeAway === "away")?.team?.displayName;
    const date = (event.date || competition?.date || "").slice(0, 10);
    if (home && away && date) oddsByTeamDate.set(teamDateKey(home, away, date), enriched);
  }
  return { oddsByEventId, oddsByTeamDate };
}

function seasonCachePaths(sport) {
  if (!fs.existsSync(CACHE_DIR)) return [];
  return fs.readdirSync(CACHE_DIR)
    .filter((name) => name.startsWith(`${sport}_`) && name.endsWith(".json"))
    .map((name) => path.join(CACHE_DIR, name));
}

// Fills homeOdds/awayOdds directly onto the cached schedule games (the same
// data/multi_sport/<sport>_<season>.json files forecastService.js reads for
// its season data), matched by the numeric ESPN event id embedded in each
// game's id (e.g. "nba:401812480" -> "401812480").
async function refreshMoneylineOdds(sport, options = {}) {
  if (!SPORT_PATHS[sport]) return { sport, skipped: true, checked: 0, updated: 0 };
  const { oddsByEventId, oddsByTeamDate } = await fetchOddsByEventId(sport, options);
  let checked = 0;
  let updated = 0;
  const filePaths = seasonCachePaths(sport);
  for (const filePath of filePaths) {
    const data = readJsonWithFallback(filePath, null, null);
    if (!data?.games?.length) continue;
    let changed = false;
    for (const game of data.games) {
      if (game.completed) continue;
      checked += 1;
      const eventId = eventIdFromGameId(game.id);
      // ESPN-sourced games (basketball/NFL) carry ESPN's own numeric id, so
      // match by id first; MLB Stats API games (baseball) use a different id
      // scheme entirely, so those fall back to team+date matching.
      const odds = (eventId && oddsByEventId.get(eventId)) || oddsByTeamDate.get(teamDateKey(game.homeTeam, game.awayTeam, game.date));
      if (!odds) continue;
      game.homeOdds = odds.homeOdds;
      game.awayOdds = odds.awayOdds;
      game.oddsSource = `ESPN (${odds.providerName})`;
      game.oddsSourceUrl = odds.sourceUrl;
      game.oddsSnapshotAt = new Date().toISOString();
      updated += 1;
      changed = true;
    }
    if (changed) writeJson(filePath, data);
  }
  return { sport, checked, updated, events: oddsByEventId.size };
}

async function refreshAllMoneylineOdds(options = {}) {
  const results = [];
  for (const sport of Object.keys(SPORT_PATHS)) {
    try {
      results.push(await refreshMoneylineOdds(sport, options));
    } catch (error) {
      results.push({ sport, error: error.message });
    }
  }
  return { checked: results.reduce((sum, r) => sum + (r.checked || 0), 0), updated: results.reduce((sum, r) => sum + (r.updated || 0), 0), sports: results };
}

// Games already carry homeOdds/awayOdds (decimal) once refreshMoneylineOdds
// has run, so forecastService.js's oddsEvents param can be built directly
// from the season data without a second odds-matching pass.
function oddsEventsFromGames(games = []) {
  return games
    .filter((game) => game.homeOdds && game.awayOdds)
    .map((game) => ({
      homeTeam: game.homeTeam, awayTeam: game.awayTeam, date: game.date, eventId: eventIdFromGameId(game.id),
      provider: game.oddsSource || "ESPN",
      odds: { homeDecimal: Number(game.homeOdds), awayDecimal: Number(game.awayOdds) },
    }));
}

module.exports = { refreshMoneylineOdds, refreshAllMoneylineOdds, oddsEventsFromGames };
