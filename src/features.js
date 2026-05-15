const { loadMatches, normalizeTeamName, num } = require("./footballData");
const { MOTIVATION_FEATURE_NAMES, currentStandingFeatures, standingFeaturesFromStatsTable } = require("./leagueContext");
const { PLAYER_FEATURE_NAMES, matchPlayerFeatureRow } = require("./playerStats");

const FEATURE_NAMES = [
  "homeGames",
  "awayGames",
  "homePPG",
  "awayPPG",
  "homeWinRate",
  "awayWinRate",
  "homeGFPerGame",
  "awayGFPerGame",
  "homeGAPerGame",
  "awayGAPerGame",
  "homeShotsPerGame",
  "awayShotsPerGame",
  "homeSOTPerGame",
  "awaySOTPerGame",
  "homeCornersPerGame",
  "awayCornersPerGame",
  "homeCleanSheetRate",
  "awayCleanSheetRate",
  "homeLast5PPG",
  "awayLast5PPG",
  "homeLast5GD",
  "awayLast5GD",
  "ppgDiff",
  "goalDiffPerGameDiff",
  "shotsPerGameDiff",
  "sotPerGameDiff",
  "cornerPerGameDiff",
  "cleanSheetRateDiff",
  "homeElo",
  "awayElo",
  "eloDiff",
  "homeEloExpected",
  "h2hMatches",
  "homeH2HPPG",
  "awayH2HPPG",
  "h2hGoalDiffPerGame",
  ...MOTIVATION_FEATURE_NAMES,
  ...PLAYER_FEATURE_NAMES,
  "marketHomeProb",
  "marketDrawProb",
  "marketAwayProb",
  "marketHomeEdge",
  "marketAwayEdge",
];

function emptyStats(team) {
  return {
    team,
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    gf: 0,
    ga: 0,
    shots: 0,
    sot: 0,
    corners: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
    cleanSheets: 0,
    form: [],
  };
}

function rate(stats, field) {
  return stats.games ? stats[field] / stats.games : 0;
}

function last5Points(stats) {
  const slice = stats.form.slice(-5);
  return slice.length ? slice.reduce((sum, x) => sum + x.points, 0) / slice.length : 0;
}

function last5GD(stats) {
  const slice = stats.form.slice(-5);
  return slice.length ? slice.reduce((sum, x) => sum + x.gf - x.ga, 0) / slice.length : 0;
}

function featureRow(home, away) {
  const homePPG = rate(home, "points");
  const awayPPG = rate(away, "points");
  const homeGFPerGame = rate(home, "gf");
  const awayGFPerGame = rate(away, "gf");
  const homeGAPerGame = rate(home, "ga");
  const awayGAPerGame = rate(away, "ga");
  const homeShotsPerGame = rate(home, "shots");
  const awayShotsPerGame = rate(away, "shots");
  const homeSOTPerGame = rate(home, "sot");
  const awaySOTPerGame = rate(away, "sot");
  const homeCornersPerGame = rate(home, "corners");
  const awayCornersPerGame = rate(away, "corners");
  const homeCleanSheetRate = rate(home, "cleanSheets");
  const awayCleanSheetRate = rate(away, "cleanSheets");
  const homeGDPerGame = homeGFPerGame - homeGAPerGame;
  const awayGDPerGame = awayGFPerGame - awayGAPerGame;

  return [
    home.games,
    away.games,
    homePPG,
    awayPPG,
    rate(home, "wins"),
    rate(away, "wins"),
    homeGFPerGame,
    awayGFPerGame,
    homeGAPerGame,
    awayGAPerGame,
    homeShotsPerGame,
    awayShotsPerGame,
    homeSOTPerGame,
    awaySOTPerGame,
    homeCornersPerGame,
    awayCornersPerGame,
    homeCleanSheetRate,
    awayCleanSheetRate,
    last5Points(home),
    last5Points(away),
    last5GD(home),
    last5GD(away),
    homePPG - awayPPG,
    homeGDPerGame - awayGDPerGame,
    homeShotsPerGame - awayShotsPerGame,
    homeSOTPerGame - awaySOTPerGame,
    homeCornersPerGame - awayCornersPerGame,
    homeCleanSheetRate - awayCleanSheetRate,
  ];
}

function resultPoints(gf, ga) {
  if (gf > ga) return 3;
  if (gf === ga) return 1;
  return 0;
}

function impliedMarket(homeOdds, drawOdds, awayOdds) {
  if (!(homeOdds > 0 && drawOdds > 0 && awayOdds > 0)) return [1 / 3, 1 / 3, 1 / 3];
  const h = homeOdds > 0 ? 1 / homeOdds : 0;
  const d = drawOdds > 0 ? 1 / drawOdds : 0;
  const a = awayOdds > 0 ? 1 / awayOdds : 0;
  const total = h + d + a || 1;
  return [h / total, d / total, a / total];
}

function h2hKey(teamA, teamB) {
  return [teamA, teamB].sort().join("||");
}

function emptyH2H() {
  return { games: 0, byTeam: new Map() };
}

function h2hTeamStats(record, team) {
  if (!record.byTeam.has(team)) record.byTeam.set(team, { points: 0, gf: 0, ga: 0 });
  return record.byTeam.get(team);
}

function h2hFeatures(map, homeTeam, awayTeam) {
  const record = map.get(h2hKey(homeTeam, awayTeam));
  if (!record || record.games === 0) return [0, 0, 0, 0];
  const home = h2hTeamStats(record, homeTeam);
  const away = h2hTeamStats(record, awayTeam);
  return [
    record.games,
    home.points / record.games,
    away.points / record.games,
    (home.gf - home.ga) / record.games,
  ];
}

function updateH2H(map, homeTeam, awayTeam, homeGoals, awayGoals) {
  const key = h2hKey(homeTeam, awayTeam);
  if (!map.has(key)) map.set(key, emptyH2H());
  const record = map.get(key);
  const home = h2hTeamStats(record, homeTeam);
  const away = h2hTeamStats(record, awayTeam);
  const homePoints = resultPoints(homeGoals, awayGoals);
  const awayPoints = resultPoints(awayGoals, homeGoals);
  record.games += 1;
  home.points += homePoints;
  home.gf += homeGoals;
  home.ga += awayGoals;
  away.points += awayPoints;
  away.gf += awayGoals;
  away.ga += homeGoals;
}

function eloExpected(homeElo, awayElo, homeAdvantage = 65) {
  return 1 / (1 + 10 ** ((awayElo - (homeElo + homeAdvantage)) / 400));
}

function updateElo(table, homeTeam, awayTeam, homeGoals, awayGoals, options = {}) {
  const k = options.k ?? 26;
  const homeAdvantage = options.homeAdvantage ?? 65;
  const homeElo = table.get(homeTeam) ?? 1500;
  const awayElo = table.get(awayTeam) ?? 1500;
  const expected = eloExpected(homeElo, awayElo, homeAdvantage);
  const actual = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? 0.5 : 0;
  const change = k * (actual - expected);
  table.set(homeTeam, homeElo + change);
  table.set(awayTeam, awayElo - change);
}

function contextFeatures(eloTable, h2hMap, homeTeam, awayTeam) {
  const homeElo = eloTable.get(homeTeam) ?? 1500;
  const awayElo = eloTable.get(awayTeam) ?? 1500;
  return [
    homeElo,
    awayElo,
    homeElo - awayElo,
    eloExpected(homeElo, awayElo),
    ...h2hFeatures(h2hMap, homeTeam, awayTeam),
  ];
}

function updateStats(stats, gf, ga, shots, sot, corners, fouls, yellows, reds) {
  stats.games += 1;
  stats.gf += gf;
  stats.ga += ga;
  stats.shots += shots;
  stats.sot += sot;
  stats.corners += corners;
  stats.fouls += fouls;
  stats.yellows += yellows;
  stats.reds += reds;
  stats.cleanSheets += ga === 0 ? 1 : 0;
  if (gf > ga) stats.wins += 1;
  else if (gf === ga) stats.draws += 1;
  else stats.losses += 1;
  const points = resultPoints(gf, ga);
  stats.points += points;
  stats.form.push({ points, gf, ga });
}

function buildTrainingRows() {
  const matches = loadMatches();
  const byLeagueSeason = new Map();
  const byLeagueElo = new Map();
  const byLeagueH2H = new Map();
  const rows = [];

  for (const match of matches) {
    const key = `${match.Season}|${match.League}`;
    if (!byLeagueSeason.has(key)) byLeagueSeason.set(key, new Map());
    if (!byLeagueElo.has(match.League)) byLeagueElo.set(match.League, new Map());
    if (!byLeagueH2H.has(match.League)) byLeagueH2H.set(match.League, new Map());
    const table = byLeagueSeason.get(key);
    const eloTable = byLeagueElo.get(match.League);
    const h2hMap = byLeagueH2H.get(match.League);
    const homeTeam = match.HomeTeam;
    const awayTeam = match.AwayTeam;
    if (!table.has(homeTeam)) table.set(homeTeam, emptyStats(homeTeam));
    if (!table.has(awayTeam)) table.set(awayTeam, emptyStats(awayTeam));

    const homeStats = table.get(homeTeam);
    const awayStats = table.get(awayTeam);
    const market = impliedMarket(
      num(match.AvgCH || match.AvgH),
      num(match.AvgCD || match.AvgD),
      num(match.AvgCA || match.AvgA)
    );
    const features = [
      ...featureRow(homeStats, awayStats),
      ...contextFeatures(eloTable, h2hMap, homeTeam, awayTeam),
      ...standingFeaturesFromStatsTable(match.League, table, homeTeam, awayTeam).features,
      ...matchPlayerFeatureRow(match.League, match.Season, homeTeam, awayTeam),
      market[0],
      market[1],
      market[2],
      market[0] - market[1],
      market[2] - market[1],
    ];
    rows.push({
      season: match.Season,
      league: match.League,
      date: match.DateISO,
      homeTeam,
      awayTeam,
      label: match.FTR,
      features,
      sourceFile: match.SourceFile,
    });

    const homeGoals = num(match.FTHG);
    const awayGoals = num(match.FTAG);
    updateStats(homeStats, homeGoals, awayGoals, num(match.HS), num(match.HST), num(match.HC), num(match.HF), num(match.HY), num(match.HR));
    updateStats(awayStats, awayGoals, homeGoals, num(match.AS), num(match.AST), num(match.AC), num(match.AF), num(match.AY), num(match.AR));
    updateElo(eloTable, homeTeam, awayTeam, homeGoals, awayGoals);
    updateH2H(h2hMap, homeTeam, awayTeam, homeGoals, awayGoals);
  }

  return rows;
}

function buildCurrentFeatureVector(league, homeTeamInput, awayTeamInput, odds = {}, season = "2025-26") {
  const homeTeam = normalizeTeamName(homeTeamInput);
  const awayTeam = normalizeTeamName(awayTeamInput);
  const matches = loadMatches().filter((m) => m.League === league);
  const table = new Map();
  const eloTable = new Map();
  const h2hMap = new Map();

  for (const match of matches) {
    if (match.Season === season) {
      if (!table.has(match.HomeTeam)) table.set(match.HomeTeam, emptyStats(match.HomeTeam));
      if (!table.has(match.AwayTeam)) table.set(match.AwayTeam, emptyStats(match.AwayTeam));
      updateStats(table.get(match.HomeTeam), num(match.FTHG), num(match.FTAG), num(match.HS), num(match.HST), num(match.HC), num(match.HF), num(match.HY), num(match.HR));
      updateStats(table.get(match.AwayTeam), num(match.FTAG), num(match.FTHG), num(match.AS), num(match.AST), num(match.AC), num(match.AF), num(match.AY), num(match.AR));
    }
    updateElo(eloTable, match.HomeTeam, match.AwayTeam, num(match.FTHG), num(match.FTAG));
    updateH2H(h2hMap, match.HomeTeam, match.AwayTeam, num(match.FTHG), num(match.FTAG));
  }

  const standingContext = currentStandingFeatures(league, table, homeTeam, awayTeam);

  return {
    homeTeam,
    awayTeam,
    standingContext,
    features: [
      ...featureRow(table.get(homeTeam) || emptyStats(homeTeam), table.get(awayTeam) || emptyStats(awayTeam)),
      ...contextFeatures(eloTable, h2hMap, homeTeam, awayTeam),
      ...standingContext.features,
      ...matchPlayerFeatureRow(league, season, homeTeam, awayTeam),
      ...(() => {
        const market = impliedMarket(num(odds.homeOdds), num(odds.drawOdds), num(odds.awayOdds));
        return [market[0], market[1], market[2], market[0] - market[1], market[2] - market[1]];
      })(),
    ],
  };
}

module.exports = {
  FEATURE_NAMES,
  buildCurrentFeatureVector,
  buildTrainingRows,
};
