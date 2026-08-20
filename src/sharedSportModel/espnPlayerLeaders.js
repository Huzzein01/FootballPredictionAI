"use strict";

// Real NBA/NFL player leaderboards from ESPN's free, keyless leaders API —
// the basketball/American-football analog of baseballModel/playerLeaders.js
// (which uses the MLB Stats API instead, since ESPN's leaders endpoint
// doesn't cover MLB the same way). No roster/box-score ingestion pipeline
// exists yet for either sport, so this surfaces league leaders rather than
// fabricating per-player ratings.
const { mutableDataPath, readJsonWithFallback, writeJson } = require("../runtimePaths");

const USER_AGENT = "SportsbooksAnalyst/1.0 espn-player-leaders";

const SPORT_CONFIG = {
  basketball: {
    espnPath: "basketball/nba",
    cacheFile: "basketball_player_leaders.json",
    categories: [
      { key: "pointsPerGame", label: "Points per game" },
      { key: "reboundsPerGame", label: "Rebounds per game" },
      { key: "assistsPerGame", label: "Assists per game" },
      { key: "stealsPerGame", label: "Steals per game" },
      { key: "blocksPerGame", label: "Blocks per game" },
      { key: "3PointsMadePerGame", label: "3-pointers made per game" },
    ],
  },
  "american-football": {
    espnPath: "football/nfl",
    cacheFile: "american_football_player_leaders.json",
    categories: [
      { key: "passingYards", label: "Passing yards" },
      { key: "passingTouchdowns", label: "Passing touchdowns" },
      { key: "rushingYards", label: "Rushing yards" },
      { key: "receivingYards", label: "Receiving yards" },
      { key: "sacks", label: "Sacks" },
      { key: "interceptions", label: "Interceptions" },
    ],
  },
};

async function fetchLeaders(sport) {
  const config = SPORT_CONFIG[sport];
  if (!config) throw new Error(`No ESPN player-leaders config for sport: ${sport}`);
  const sourceUrl = `https://site.api.espn.com/apis/site/v3/sports/${config.espnPath}/leaders`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`ESPN ${sport} leaders request failed: ${response.status}`);
  const payload = await response.json();
  const byKey = new Map((payload.leaders?.categories || []).map((category) => [category.name, category]));
  const categories = config.categories.map((wanted) => {
    const category = byKey.get(wanted.key);
    return {
      key: wanted.key,
      label: wanted.label,
      leaders: (category?.leaders || []).slice(0, 5).map((entry, index) => ({
        rank: index + 1,
        player: entry.athlete?.displayName || "",
        team: entry.team?.displayName || "",
        value: entry.displayValue ?? entry.value ?? "",
      })),
    };
  }).filter((category) => category.leaders.length);
  return {
    sport,
    season: payload.requestedSeason?.displayName || payload.currentSeason?.displayName || "",
    source: { name: "ESPN public leaders API", url: sourceUrl },
    categories,
    fetchedAt: new Date().toISOString(),
  };
}

async function refreshPlayerLeaders(sport) {
  const config = SPORT_CONFIG[sport];
  const data = await fetchLeaders(sport);
  writeJson(mutableDataPath(config.cacheFile), data);
  return data;
}

async function readOrRefreshPlayerLeaders(sport, { refresh = false } = {}) {
  const config = SPORT_CONFIG[sport];
  if (!config) throw new Error(`No ESPN player-leaders config for sport: ${sport}`);
  const cached = readJsonWithFallback(mutableDataPath(config.cacheFile), null, null);
  if (cached && !refresh) return { ...cached, cached: true };
  return refreshPlayerLeaders(sport);
}

module.exports = { readOrRefreshPlayerLeaders, refreshPlayerLeaders };
