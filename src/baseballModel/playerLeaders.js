"use strict";

// Real MLB player leaderboards, sourced from the same free, keyless MLB
// Stats API used elsewhere for schedules/results (historicalDataset.js,
// multiSportDataService.js). No roster/box-score ingestion pipeline exists
// yet for individual player game logs, so this surfaces season-to-date
// league leaders rather than fabricating per-player ratings.
const { mutableDataPath, readJsonWithFallback, writeJson } = require("../runtimePaths");

const USER_AGENT = "SportsbooksAnalyst/1.0 baseball-player-leaders";
const CACHE_PATH = mutableDataPath("baseball_player_leaders.json");

const HITTING_CATEGORIES = [
  { key: "homeRuns", label: "Home runs" },
  { key: "battingAverage", label: "Batting average" },
  { key: "onBasePlusSlugging", label: "OPS" },
  { key: "runsBattedIn", label: "RBI" },
  { key: "stolenBases", label: "Stolen bases" },
];
const PITCHING_CATEGORIES = [
  { key: "earnedRunAverage", label: "ERA" },
  { key: "strikeouts", label: "Strikeouts" },
  { key: "wins", label: "Wins" },
  { key: "saves", label: "Saves" },
];

async function fetchCategory(category, season, limit = 5) {
  const sourceUrl = `https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=${category.key}&season=${encodeURIComponent(season)}&sportId=1&limit=${limit}`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`MLB leaders request for ${category.key} failed: ${response.status}`);
  const payload = await response.json();
  const leaders = payload.leagueLeaders?.[0]?.leaders || [];
  return {
    key: category.key,
    label: category.label,
    leaders: leaders.map((entry) => ({
      rank: entry.rank,
      player: entry.person?.fullName || "",
      team: entry.team?.name || "",
      value: entry.value,
    })),
  };
}

async function refreshPlayerLeaders(season) {
  const categories = [...HITTING_CATEGORIES, ...PITCHING_CATEGORIES];
  const results = [];
  const errors = [];
  for (const category of categories) {
    try {
      results.push(await fetchCategory(category, season));
    } catch (error) {
      errors.push({ category: category.key, message: error.message });
    }
  }
  const byKey = Object.fromEntries(results.map((result) => [result.key, result]));
  const data = {
    season,
    source: { name: "MLB Stats API", url: "https://statsapi.mlb.com/api/v1/stats/leaders" },
    hitting: HITTING_CATEGORIES.map((category) => byKey[category.key]).filter(Boolean),
    pitching: PITCHING_CATEGORIES.map((category) => byKey[category.key]).filter(Boolean),
    errors,
    fetchedAt: new Date().toISOString(),
  };
  writeJson(CACHE_PATH, data);
  return data;
}

async function readOrRefreshPlayerLeaders(season, { refresh = false } = {}) {
  const cached = readJsonWithFallback(CACHE_PATH, null, null);
  if (cached && !refresh && cached.season === String(season)) return { ...cached, cached: true };
  return refreshPlayerLeaders(String(season));
}

module.exports = { readOrRefreshPlayerLeaders, refreshPlayerLeaders };
