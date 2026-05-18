const fs = require("fs");
const path = require("path");

const PLAYER_STATS_PATH = path.join(process.cwd(), "data", "international", "processed", "world_cup_player_stats.json");
const SQUAD_STATS_PATH = path.join(process.cwd(), "data", "international", "processed", "world_cup_squad_stats.json");

function readRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const data = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(data.rows) ? data.rows : [];
}

function internationalStatus() {
  const playerRows = readRows(PLAYER_STATS_PATH);
  const squadRows = readRows(SQUAD_STATS_PATH);
  return {
    playerRows: playerRows.length,
    squadRows: squadRows.length,
    players: new Set(playerRows.map((row) => row.Player).filter(Boolean)).size,
    squads: new Set([...playerRows.map((row) => row.Squad), ...squadRows.map((row) => row.Squad)].filter(Boolean)).size,
    seasons: [...new Set([...playerRows.map((row) => row.season), ...squadRows.map((row) => row.season)].filter(Boolean))].sort(),
    hasWorldCupStats: playerRows.length > 0 || squadRows.length > 0,
    playerStatsPath: PLAYER_STATS_PATH,
    squadStatsPath: SQUAD_STATS_PATH,
  };
}

module.exports = {
  PLAYER_STATS_PATH,
  SQUAD_STATS_PATH,
  internationalStatus,
};
