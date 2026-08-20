const fs = require("fs");
const path = require("path");
const { mutableDataPath, readJsonWithFallback, writeJson } = require("./runtimePaths");

const CACHE_DIR = mutableDataPath("multi_sport");
const USER_AGENT = "SportsbooksAnalyst/1.0 public-schedule-import";

function safeSeason(value) {
  return String(value || "").replace(/[^0-9-]/g, "").slice(0, 12);
}

function cachePath(sport, season) {
  return path.join(CACHE_DIR, `${sport}_${safeSeason(season)}.json`);
}

function toIsoDate(value) {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

function summarize(sport, league, season, games, sourceUrl, errors = []) {
  const complete = games.filter((game) => game.completed);
  return {
    sport,
    league,
    season,
    games,
    summary: {
      games: games.length,
      completedGames: complete.length,
      scheduledGames: games.length - complete.length,
      teams: new Set(games.flatMap((game) => [game.homeTeam, game.awayTeam]).filter(Boolean)).size,
    },
    source: { name: sport === "baseball" ? "MLB Stats API" : "ESPN public scoreboard API", url: sourceUrl },
    fetchedAt: new Date().toISOString(),
    errors,
  };
}

async function fetchMlbSeason(season) {
  const year = String(season).slice(0, 4);
  const sourceUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${encodeURIComponent(year)}&hydrate=linescore`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`MLB schedule request failed: ${response.status}`);
  const payload = await response.json();
  // gameType "R" is MLB's own regular-season marker. Without this filter the
  // schedule endpoint also returns spring training, the All-Star Game, the
  // World Baseball Classic, and exhibition games against non-MLB opponents
  // (e.g. "United States", minor-league affiliates), which pollute standings
  // built from this data with teams that aren't part of the MLB season.
  const games = (payload.dates || []).flatMap((day) => (day.games || [])
    .filter((game) => game.gameType === "R")
    .map((game) => {
      const status = game.status?.detailedState || "Scheduled";
      const completed = Boolean(game.status?.abstractGameState === "Final" || game.status?.codedGameState === "F");
      return {
        id: `mlb:${game.gamePk}`,
        sport: "baseball",
        league: "MLB",
        season: year,
        date: day.date || toIsoDate(game.gameDate),
        kickoffUtc: game.gameDate || "",
        homeTeam: game.teams?.home?.team?.name || "",
        awayTeam: game.teams?.away?.team?.name || "",
        homeScore: Number.isFinite(game.teams?.home?.score) ? game.teams.home.score : null,
        awayScore: Number.isFinite(game.teams?.away?.score) ? game.teams.away.score : null,
        completed,
        status,
        venue: game.venue?.name || "",
      };
    })).filter((game) => game.homeTeam && game.awayTeam && game.date);
  return summarize("baseball", "MLB", year, games, sourceUrl);
}

async function fetchNbaSeason(season) {
  const startYear = Number(String(season).slice(0, 4));
  if (!Number.isFinite(startYear)) throw new Error("NBA season must begin with a four-digit year");
  const dates = `${startYear}1001-${startYear + 1}0630`;
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dates}&limit=1000`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`NBA schedule request failed: ${response.status}`);
  const payload = await response.json();
  const games = (payload.events || []).map((event) => {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((team) => team.homeAway === "home") || {};
    const away = competitors.find((team) => team.homeAway === "away") || {};
    const completed = Boolean(event.status?.type?.completed || competition.status?.type?.completed);
    return {
      id: `nba:${event.id}`,
      sport: "basketball",
      league: "NBA",
      season: `${startYear}-${String(startYear + 1).slice(-2)}`,
      date: toIsoDate(event.date || competition.date),
      kickoffUtc: event.date || competition.date || "",
      homeTeam: home.team?.displayName || "",
      awayTeam: away.team?.displayName || "",
      homeScore: completed && Number.isFinite(Number(home.score)) ? Number(home.score) : null,
      awayScore: completed && Number.isFinite(Number(away.score)) ? Number(away.score) : null,
      completed,
      status: event.status?.type?.detail || competition.status?.type?.detail || "Scheduled",
      venue: competition.venue?.fullName || "",
    };
  }).filter((game) => game.homeTeam && game.awayTeam && game.date);
  return summarize("basketball", "NBA", `${startYear}-${String(startYear + 1).slice(-2)}`, games, sourceUrl);
}

async function fetchNflSeason(season) {
  const startYear = Number(String(season).slice(0, 4));
  if (!Number.isFinite(startYear)) throw new Error("NFL season must begin with a four-digit year");
  const dates = `${startYear}0801-${startYear + 1}0301`;
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dates}&limit=1000`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`NFL schedule request failed: ${response.status}`);
  const payload = await response.json();
  const games = (payload.events || []).map((event) => {
    const competition = event.competitions?.[0] || {};
    const competitors = competition.competitors || [];
    const home = competitors.find((team) => team.homeAway === "home") || {};
    const away = competitors.find((team) => team.homeAway === "away") || {};
    const completed = Boolean(event.status?.type?.completed || competition.status?.type?.completed);
    return {
      id: `nfl:${event.id}`,
      sport: "americanFootball",
      league: "NFL",
      season: `${startYear}-${String(startYear + 1).slice(-2)}`,
      date: toIsoDate(event.date || competition.date),
      kickoffUtc: event.date || competition.date || "",
      homeTeam: home.team?.displayName || "",
      awayTeam: away.team?.displayName || "",
      homeScore: completed && Number.isFinite(Number(home.score)) ? Number(home.score) : null,
      awayScore: completed && Number.isFinite(Number(away.score)) ? Number(away.score) : null,
      completed,
      status: event.status?.type?.detail || competition.status?.type?.detail || "Scheduled",
      venue: competition.venue?.fullName || "",
    };
  }).filter((game) => game.homeTeam && game.awayTeam && game.date);
  return summarize("americanFootball", "NFL", `${startYear}-${String(startYear + 1).slice(-2)}`, games, sourceUrl);
}

async function refreshSportSeason(sport, season) {
  const normalizedSport = sport === "baseball" ? "baseball" : sport === "basketball" ? "basketball" : sport === "american-football" ? "american-football" : "";
  if (!normalizedSport) throw new Error("Only baseball, basketball, and american-football imports are available here");
  const data = normalizedSport === "baseball" ? await fetchMlbSeason(season)
    : normalizedSport === "basketball" ? await fetchNbaSeason(season)
    : await fetchNflSeason(season);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  writeJson(cachePath(normalizedSport, season), data);
  return data;
}

async function readOrRefreshSportSeason(sport, season, { refresh = false } = {}) {
  const cached = readJsonWithFallback(cachePath(sport, season), null, null);
  if (cached && !refresh) return { ...cached, cached: true };
  return refreshSportSeason(sport, season);
}

module.exports = { readOrRefreshSportSeason, refreshSportSeason };
