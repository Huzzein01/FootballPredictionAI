const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");
const { fetchApiFootball } = require("./liveData");

const API_FOOTBALL_PLAYER_STATS_PATH = path.join(process.cwd(), "data", "api_football", "player_stats.json");

const LEAGUE_IDS = {
  EPL: 39,
  "La Liga": 140,
  Bundesliga: 78,
  "Ligue 1": 61,
  "Serie A": 135,
  MLS: 253,
  "Saudi Pro League": 307,
  "Brasileirao Serie A": 71,
};

function defaultCache() {
  return { updatedAt: "", provider: "API-Football", rows: [], refreshes: [] };
}

function readApiFootballPlayerStats() {
  if (!fs.existsSync(API_FOOTBALL_PLAYER_STATS_PATH)) return defaultCache();
  try {
    const data = JSON.parse(fs.readFileSync(API_FOOTBALL_PLAYER_STATS_PATH, "utf8").replace(/^\uFEFF/, ""));
    return {
      ...defaultCache(),
      ...data,
      rows: Array.isArray(data.rows) ? data.rows : [],
      refreshes: Array.isArray(data.refreshes) ? data.refreshes : [],
    };
  } catch {
    return defaultCache();
  }
}

function writeApiFootballPlayerStats(cache) {
  fs.mkdirSync(path.dirname(API_FOOTBALL_PLAYER_STATS_PATH), { recursive: true });
  fs.writeFileSync(API_FOOTBALL_PLAYER_STATS_PATH, JSON.stringify({ ...cache, updatedAt: new Date().toISOString() }, null, 2));
}

function seasonYear(season = "2025-26") {
  const match = String(season).match(/^(\d{4})/);
  return match ? Number(match[1]) : new Date().getUTCFullYear();
}

function normalizeSearchName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function playerNameKey(name) {
  return normalizeSearchName(name).toLowerCase();
}

function profileKey(profile) {
  return `${profile.id}|${profile.league}|${normalizeTeamName(profile.team)}|${playerNameKey(profile.player)}`;
}

function samePlayer(left, right) {
  const l = playerNameKey(left);
  const r = playerNameKey(right);
  return l === r || l.includes(r) || r.includes(l);
}

function sameTeam(left, right) {
  return normalizeTeamName(left) === normalizeTeamName(right);
}

function pickBestPlayerResponse(profile, responses = []) {
  const exactTeam = responses.find((item) => {
    const stat = (item.statistics || []).find((entry) => sameTeam(entry.team?.name, profile.team));
    return samePlayer(item.player?.name, profile.player) && stat;
  });
  if (exactTeam) return exactTeam;

  return responses.find((item) => samePlayer(item.player?.name, profile.player)) || responses[0] || null;
}

function statForProfile(profile, response) {
  return (
    (response.statistics || []).find((entry) => sameTeam(entry.team?.name, profile.team)) ||
    (response.statistics || []).find((entry) => Number(entry.league?.id) === Number(LEAGUE_IDS[profile.league])) ||
    response.statistics?.[0] ||
    null
  );
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function rowBase(profile, response, stat, season) {
  const minutes = numeric(stat.games?.minutes);
  const nineties = minutes ? minutes / 90 : numeric(stat.games?.appearences);
  return {
    season,
    league: profile.league,
    Squad: normalizeTeamName(profile.team),
    Player: profile.player,
    Pos: stat.games?.position || profile.position || "",
    MP: numeric(stat.games?.appearences),
    Starts: numeric(stat.games?.lineups),
    Min: minutes,
    "90s": Number(nineties.toFixed(1)),
    ApiFootballSource: "true",
    ApiFootballPlayerId: response.player?.id || "",
    ApiFootballTeamId: stat.team?.id || "",
    ApiFootballLeagueId: stat.league?.id || "",
    ApiFootballUpdatedAt: new Date().toISOString(),
  };
}

function rowsFromResponse(profile, response, season) {
  const stat = statForProfile(profile, response);
  if (!stat) return [];

  const base = rowBase(profile, response, stat, season);
  const rows = [
    {
      ...base,
      statType: "standard",
      Gls: numeric(stat.goals?.total),
      Ast: numeric(stat.goals?.assists),
      "G+A": numeric(stat.goals?.total) + numeric(stat.goals?.assists),
    },
    {
      ...base,
      statType: "shooting",
      Gls: numeric(stat.goals?.total),
      Sh: numeric(stat.shots?.total),
      SoT: numeric(stat.shots?.on),
    },
  ];

  if (profile.role === "Goalkeeper") {
    rows.push({
      ...base,
      statType: "goalkeeping",
      Saves: numeric(stat.goals?.saves),
      GoalsAgainst: numeric(stat.goals?.conceded),
    });
  }

  return rows;
}

function cacheIsFresh(cache, season, maxAgeMinutes) {
  const refresh = (cache.refreshes || []).find((entry) => entry.season === season);
  if (!refresh?.updatedAt) return false;
  const ageMs = Date.now() - Date.parse(refresh.updatedAt);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < maxAgeMinutes * 60_000;
}

function stableRows(rows) {
  return JSON.stringify(
    [...rows].sort((a, b) =>
      [a.season, a.league, a.Squad, a.Player, a.statType].join("|").localeCompare([b.season, b.league, b.Squad, b.Player, b.statType].join("|"))
    )
  );
}

function replaceSeasonRows(existingRows, season, nextRows) {
  if (!nextRows.length) return existingRows;
  const nextProfiles = new Set(nextRows.map((row) => `${row.season}|${row.league}|${row.Squad}|${row.Player}`));
  return [
    ...existingRows.filter((row) => !nextProfiles.has(`${row.season}|${row.league}|${row.Squad}|${row.Player}`)),
    ...nextRows,
  ];
}

function errorsText(errors) {
  if (!errors) return "";
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) return errors.map(errorsText).join(" ");
  if (typeof errors === "object") return Object.values(errors).map(errorsText).join(" ");
  return String(errors);
}

function planBlocked(errors) {
  const text = errorsText(errors);
  return /free plans do not have access/i.test(text);
}

function rateLimited(errors) {
  const text = errorsText(errors);
  return /429|rate limit|too many requests/i.test(text);
}

async function refreshApiFootballPlayerStats({ profiles = [], season = "2025-26", force = false } = {}) {
  const cache = readApiFootballPlayerStats();
  const maxAgeMinutes = Number(process.env.API_FOOTBALL_PLAYER_CACHE_MINUTES || 30);
  if (!force && cacheIsFresh(cache, season, maxAgeMinutes)) {
    const refresh = (cache.refreshes || []).find((entry) => entry.season === season) || {};
    return { ...refresh, cached: true, changed: false, rows: cache.rows.filter((row) => row.season === season) };
  }

  const apiSeason = seasonYear(season);
  const rows = [];
  const updatedProfiles = [];
  const errors = [];
  let checked = 0;

  for (const profile of profiles) {
    const leagueId = LEAGUE_IDS[profile.league];
    if (!leagueId) continue;
    checked += 1;
    const search = encodeURIComponent(normalizeSearchName(profile.player));
    let payload = null;
    try {
      payload = await fetchApiFootball(`/players?league=${leagueId}&season=${apiSeason}&search=${search}`);
    } catch (error) {
      errors.push({ profileId: profile.id, player: profile.player, league: profile.league, errors: { request: error.message } });
      if (rateLimited(error.message)) break;
      continue;
    }
    if (Object.keys(payload.errors || {}).length) {
      errors.push({ profileId: profile.id, player: profile.player, league: profile.league, errors: payload.errors });
      if (planBlocked(payload.errors) || rateLimited(payload.errors)) break;
      continue;
    }

    const response = pickBestPlayerResponse(profile, payload.response || []);
    if (!response) {
      errors.push({ profileId: profile.id, player: profile.player, league: profile.league, errors: { lookup: "No player match returned" } });
      continue;
    }

    const profileRows = rowsFromResponse(profile, response, season);
    if (!profileRows.length) {
      errors.push({ profileId: profile.id, player: profile.player, league: profile.league, errors: { stats: "No statistics returned" } });
      continue;
    }
    rows.push(...profileRows);
    updatedProfiles.push({ id: profile.id, player: profile.player, profileKey: profileKey(profile) });
  }

  const previousRows = cache.rows || [];
  const mergedRows = replaceSeasonRows(previousRows, season, rows);
  const changed = stableRows(previousRows) !== stableRows(mergedRows);
  const latestRefresh = {
    provider: "API-Football",
    season,
    apiSeason,
    updatedAt: new Date().toISOString(),
    checked,
    updatedProfiles: updatedProfiles.length,
    rowCount: rows.length,
    errors,
    status: errors.some((entry) => planBlocked(entry.errors))
      ? "BLOCKED_BY_PLAN"
      : errors.some((entry) => rateLimited(entry.errors))
      ? "RATE_LIMITED"
      : rows.length
      ? "UPDATED"
      : "NO_ROWS",
  };
  const refreshes = [...(cache.refreshes || []).filter((entry) => entry.season !== season), latestRefresh];
  writeApiFootballPlayerStats({ ...cache, provider: "API-Football", rows: mergedRows, refreshes });

  return { ...latestRefresh, cached: false, changed, rows };
}

module.exports = {
  API_FOOTBALL_PLAYER_STATS_PATH,
  readApiFootballPlayerStats,
  refreshApiFootballPlayerStats,
};
