const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");

const LIVE_CONTEXT_PATH = path.join(process.cwd(), "data", "live_league_context.json");
const TEAM_MOTIVES_PATH = path.join(process.cwd(), "data", "team_motives_2025_26.json");

const LEAGUE_RULES = {
  EPL: { totalGames: 38, championsLeagueLine: 4, europeLine: 5, continentalLine: 7, relegationCount: 3 },
  "La Liga": { totalGames: 38, championsLeagueLine: 4, europeLine: 5, continentalLine: 7, relegationCount: 3 },
  Bundesliga: { totalGames: 34, championsLeagueLine: 4, europeLine: 5, continentalLine: 7, relegationCount: 3 },
  "Ligue 1": { totalGames: 34, championsLeagueLine: 4, europeLine: 5, continentalLine: 6, relegationCount: 3 },
};

const MOTIVATION_FEATURE_NAMES = [
  "homeTableRank",
  "awayTableRank",
  "homeTablePoints",
  "awayTablePoints",
  "homeGamesLeft",
  "awayGamesLeft",
  "homeTitleRaceScore",
  "awayTitleRaceScore",
  "homeEuropeRaceScore",
  "awayEuropeRaceScore",
  "homeRelegationBattleScore",
  "awayRelegationBattleScore",
  "homeSecuredTitle",
  "awaySecuredTitle",
  "homeSecuredChampionsLeague",
  "awaySecuredChampionsLeague",
  "homeRecordMotiveScore",
  "awayRecordMotiveScore",
  "homeDeadRubber",
  "awayDeadRubber",
  "motivationScoreDiff",
];

let liveContextCache = null;
let liveContextMtime = 0;
let teamMotivesCache = null;
let teamMotivesMtime = 0;

function rulesForLeague(league) {
  return LEAGUE_RULES[league] || { totalGames: 38, championsLeagueLine: 4, europeLine: 5, continentalLine: 7, relegationCount: 3 };
}

function standingsFromStatsMap(league, table) {
  return [...table.values()]
    .filter((team) => team.games > 0)
    .map((team) => ({
      team: normalizeTeamName(team.team),
      played: team.games,
      points: team.points,
      goalDifference: team.gf - team.ga,
      goalsFor: team.gf,
      wins: team.wins,
      draws: team.draws,
      losses: team.losses,
      league,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.localeCompare(b.team);
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function loadLiveLeagueContext() {
  if (!fs.existsSync(LIVE_CONTEXT_PATH)) return null;
  const stat = fs.statSync(LIVE_CONTEXT_PATH);
  if (!liveContextCache || stat.mtimeMs !== liveContextMtime) {
    liveContextCache = JSON.parse(fs.readFileSync(LIVE_CONTEXT_PATH, "utf8").replace(/^\uFEFF/, ""));
    liveContextMtime = stat.mtimeMs;
  }
  return liveContextCache;
}

function liveStandingsForLeague(league) {
  const context = loadLiveLeagueContext();
  const table = context?.leagues?.[league]?.standings;
  return Array.isArray(table) && table.length ? table : null;
}

function loadTeamMotives() {
  if (!fs.existsSync(TEAM_MOTIVES_PATH)) return { teams: {} };
  const stat = fs.statSync(TEAM_MOTIVES_PATH);
  if (!teamMotivesCache || stat.mtimeMs !== teamMotivesMtime) {
    teamMotivesCache = JSON.parse(fs.readFileSync(TEAM_MOTIVES_PATH, "utf8").replace(/^\uFEFF/, ""));
    teamMotivesMtime = stat.mtimeMs;
  }
  return teamMotivesCache;
}

function manualMotiveForTeam(team) {
  const motives = loadTeamMotives();
  return motives.teams?.[normalizeTeamName(team)] || {};
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function maxPoints(entry, league) {
  const rules = rulesForLeague(league);
  return Number(entry.points || 0) + Math.max(0, rules.totalGames - Number(entry.played || 0)) * 3;
}

function firstOutsideLine(standings, line) {
  return standings[Math.min(line, standings.length - 1)] || null;
}

function securedAboveLine(entry, standings, league, line) {
  if (!entry || Number(entry.rank || 999) > line) return 0;
  const outside = standings.filter((candidate) => Number(candidate.rank || 999) > line);
  if (!outside.length) return 1;
  const bestOutsideMax = Math.max(...outside.map((candidate) => maxPoints(candidate, league)));
  const points = Number(entry.points || 0);
  const gd = Number(entry.goalDifference || 0);
  const strongestOutside = outside.sort((a, b) => maxPoints(b, league) - maxPoints(a, league))[0];
  const gdCushion = gd - Number(strongestOutside?.goalDifference || 0);
  if (points > bestOutsideMax) return 1;
  if (points === bestOutsideMax && gdCushion >= 8) return 1;
  return 0;
}

function canReachLine(entry, standings, league, line) {
  if (!entry) return false;
  const cutoff = standings[Math.max(0, line - 1)] || standings[standings.length - 1];
  return maxPoints(entry, league) >= Number(cutoff?.points || 0);
}

function canFallBelowLine(entry, standings, league, line) {
  if (!entry || Number(entry.rank || 999) > line) return false;
  return !securedAboveLine(entry, standings, league, line);
}

function relegationSafe(entry, standings, league) {
  const rules = rulesForLeague(league);
  const safeLine = Math.max(1, standings.length - rules.relegationCount);
  return securedAboveLine(entry, standings, league, safeLine);
}

function relegationThreat(entry, standings, league) {
  if (!entry) return false;
  const rules = rulesForLeague(league);
  const safeLine = Math.max(1, standings.length - rules.relegationCount);
  const rank = Number(entry.rank || standings.length);
  if (rank > safeLine) return true;
  return !relegationSafe(entry, standings, league) && rank >= safeLine - 3;
}

function teamMotivation(entry, standings, league) {
  if (!entry || !standings.length) {
    return {
      rank: 0,
      points: 0,
      gamesLeft: 0,
      titleRaceScore: 0,
      europeRaceScore: 0,
      relegationBattleScore: 0,
      securedTitle: 0,
      securedChampionsLeague: 0,
      recordMotiveScore: 0,
      manualNote: "",
      deadRubber: 0,
      motivationScore: 0,
      note: "No table context available",
    };
  }

  const rules = rulesForLeague(league);
  const teams = standings.length;
  const gamesLeft = Math.max(0, rules.totalGames - Number(entry.played || 0));
  const leader = standings[0];
  const manual = manualMotiveForTeam(entry.team);
  const championsLeagueLine = Math.min(rules.championsLeagueLine, teams);
  const continentalLine = Math.min(rules.continentalLine, teams);
  const rank = Number(entry.rank || teams);
  const points = Number(entry.points || 0);
  const teamMaxPoints = maxPoints(entry, league);
  const bestOtherMax = Math.max(...standings.filter((candidate) => candidate.team !== entry.team).map((candidate) => maxPoints(candidate, league)));
  const securedTitle = rank === 1 && points > bestOtherMax ? 1 : 0;
  const canWinTitle = !securedTitle && teamMaxPoints >= Number(leader.points || 0);
  const titleGap = rank === 1 ? points - Number((standings[1] || leader).points || points) : Number(leader.points || points) - points;
  const titleRaceScore = canWinTitle ? clamp01((gamesLeft * 3 + 1 - Math.max(0, titleGap)) / Math.max(1, gamesLeft * 3 + 1)) : 0;
  const securedChampionsLeague = securedAboveLine(entry, standings, league, championsLeagueLine);
  const securedEurope = securedAboveLine(entry, standings, league, continentalLine);
  const clCutoff = standings[championsLeagueLine - 1] || standings[standings.length - 1];
  const europeCutoff = standings[continentalLine - 1] || standings[standings.length - 1];
  const clGap = Math.abs(points - Number(clCutoff.points || points));
  const europeGap = Math.abs(points - Number(europeCutoff.points || points));
  const fightingForCl = !securedChampionsLeague && (canReachLine(entry, standings, league, championsLeagueLine) || canFallBelowLine(entry, standings, league, championsLeagueLine));
  const fightingForEurope = !securedEurope && (canReachLine(entry, standings, league, continentalLine) || canFallBelowLine(entry, standings, league, continentalLine));
  const europeRaceScore = fightingForCl
    ? clamp01((gamesLeft * 3 + 1 - clGap) / Math.max(1, gamesLeft * 3 + 1))
    : fightingForEurope
    ? clamp01((gamesLeft * 3 + 1 - europeGap) / Math.max(1, gamesLeft * 3 + 1)) * 0.75
    : 0;
  const relegationBattleScore = relegationThreat(entry, standings, league) ? clamp01((gamesLeft * 3 + 1) / Math.max(1, gamesLeft * 3 + 1)) : 0;
  const recordMotiveScore = Number(manual.recordMotiveScore || 0);
  const deadRubber = gamesLeft <= 3 && !titleRaceScore && !europeRaceScore && !relegationBattleScore && Math.abs(recordMotiveScore) < 0.01 ? 1 : 0;
  const motivationScore =
    titleRaceScore +
    europeRaceScore * 0.7 +
    relegationBattleScore * 0.85 +
    Math.max(0, recordMotiveScore) * 0.55 -
    securedTitle * 0.55 -
    Math.max(0, -recordMotiveScore) * 0.45 -
    deadRubber * 0.35;

  let note = "Mid-table context";
  if (securedTitle) note = "Title secured; rotation risk";
  else if (titleRaceScore > 0) note = "Title race pressure";
  else if (securedChampionsLeague && recordMotiveScore > 0) note = "Qualification secured; player-record motive";
  else if (securedChampionsLeague) note = "Champions League secured; lower team-stakes";
  else if (europeRaceScore > 0) note = fightingForCl ? "Champions League race pressure" : "European-place pressure";
  else if (relegationBattleScore > 0) note = "Relegation pressure";
  else if (recordMotiveScore > 0) note = "Player-record motive";
  else if (deadRubber) note = "Low-table-stakes fixture";

  return {
    rank,
    points,
    gamesLeft,
    maxPoints: teamMaxPoints,
    titleRaceScore,
    europeRaceScore,
    relegationBattleScore,
    securedTitle,
    securedChampionsLeague,
    securedEurope,
    recordMotiveScore,
    manualNote: manual.note || "",
    playerMotives: manual.playerMotives || [],
    deadRubber,
    motivationScore,
    note,
  };
}

function standingFeaturesFromStandings(league, standings, homeTeamInput, awayTeamInput) {
  const homeTeam = normalizeTeamName(homeTeamInput);
  const awayTeam = normalizeTeamName(awayTeamInput);
  const normalized = standings.map((entry) => ({
    ...entry,
    team: normalizeTeamName(entry.team),
    rank: Number(entry.rank || 0),
    played: Number(entry.played || 0),
    points: Number(entry.points || 0),
  }));
  const home = normalized.find((entry) => entry.team === homeTeam);
  const away = normalized.find((entry) => entry.team === awayTeam);
  const homeMotivation = teamMotivation(home, normalized, league);
  const awayMotivation = teamMotivation(away, normalized, league);

  return {
    features: [
      homeMotivation.rank,
      awayMotivation.rank,
      homeMotivation.points,
      awayMotivation.points,
      homeMotivation.gamesLeft,
      awayMotivation.gamesLeft,
      homeMotivation.titleRaceScore,
      awayMotivation.titleRaceScore,
      homeMotivation.europeRaceScore,
      awayMotivation.europeRaceScore,
      homeMotivation.relegationBattleScore,
      awayMotivation.relegationBattleScore,
      homeMotivation.securedTitle,
      awayMotivation.securedTitle,
      homeMotivation.securedChampionsLeague,
      awayMotivation.securedChampionsLeague,
      homeMotivation.recordMotiveScore,
      awayMotivation.recordMotiveScore,
      homeMotivation.deadRubber,
      awayMotivation.deadRubber,
      homeMotivation.motivationScore - awayMotivation.motivationScore,
    ],
    home: homeMotivation,
    away: awayMotivation,
  };
}

function standingFeaturesFromStatsTable(league, table, homeTeam, awayTeam) {
  const standings = standingsFromStatsMap(league, table);
  if (!standings.length) {
    return {
      features: Array(MOTIVATION_FEATURE_NAMES.length).fill(0),
      home: teamMotivation(null, [], league),
      away: teamMotivation(null, [], league),
    };
  }
  return standingFeaturesFromStandings(league, standings, homeTeam, awayTeam);
}

function currentStandingFeatures(league, fallbackTable, homeTeam, awayTeam) {
  const liveContext = loadLiveLeagueContext();
  const leagueContext = liveContext?.leagues?.[league];
  const liveStandings = Array.isArray(leagueContext?.standings) && leagueContext.standings.length ? leagueContext.standings : null;
  if (liveStandings) {
    return {
      ...standingFeaturesFromStandings(league, liveStandings, homeTeam, awayTeam),
      source: "public-standings",
      sourceName: leagueContext.source || "Public standings",
      sourceUrl: leagueContext.sourceUrl || "",
      updatedAt: liveContext.updatedAt || "",
    };
  }
  return { ...standingFeaturesFromStatsTable(league, fallbackTable, homeTeam, awayTeam), source: "local-season-table" };
}

module.exports = {
  LIVE_CONTEXT_PATH,
  MOTIVATION_FEATURE_NAMES,
  currentStandingFeatures,
  loadLiveLeagueContext,
  standingFeaturesFromStandings,
  standingFeaturesFromStatsTable,
  standingsFromStatsMap,
};
