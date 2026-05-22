const fs = require("fs");
const path = require("path");
const { listPredictions } = require("./backtestStore");
const { oddsForInternationalFixture } = require("./oddsApiService");

const PLAYER_STATS_PATH = path.join(process.cwd(), "data", "international", "processed", "world_cup_player_stats.json");
const SQUAD_STATS_PATH = path.join(process.cwd(), "data", "international", "processed", "world_cup_squad_stats.json");
const WORLD_CUP_FIXTURES_PATH = path.join(process.cwd(), "data", "international", "world_cup_2026_fixtures.json");

const TEAM_RATINGS = {
  Argentina: 92,
  France: 91,
  Brazil: 90,
  Spain: 89,
  England: 88,
  Portugal: 87,
  Netherlands: 86,
  Belgium: 84,
  Germany: 84,
  Croatia: 83,
  Uruguay: 82,
  Colombia: 82,
  Morocco: 81,
  Switzerland: 80,
  USA: 79,
  Mexico: 79,
  Japan: 79,
  Senegal: 78,
  Ecuador: 78,
  "IR Iran": 76,
  Austria: 76,
  Denmark: 76,
  "Korea Republic": 75,
  Serbia: 75,
  Sweden: 75,
  Norway: 75,
  Australia: 74,
  "Cote d'Ivoire": 74,
  "Côte d'Ivoire": 74,
  Tunisia: 73,
  Scotland: 73,
  Paraguay: 73,
  Egypt: 73,
  Ghana: 72,
  Algeria: 72,
  Canada: 72,
  Qatar: 71,
  "Saudi Arabia": 71,
  "South Africa": 70,
  "Czechia": 70,
  "Congo DR": 70,
  Panama: 69,
  Uzbekistan: 69,
  Jordan: 67,
  Haiti: 66,
  "New Zealand": 66,
  "Cabo Verde": 66,
  Iraq: 66,
  "Bosnia and Herzegovina": 66,
  "Türkiye": 74,
  "Curaçao": 65,
};

function readRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const data = JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(data.rows) ? data.rows : [];
}

function readFixtureData() {
  if (!fs.existsSync(WORLD_CUP_FIXTURES_PATH)) {
    return { fixtures: [], teams: [], groups: {}, source: null, fixtureCount: 0 };
  }
  return JSON.parse(fs.readFileSync(WORLD_CUP_FIXTURES_PATH, "utf8").replace(/^\uFEFF/, ""));
}

function roundPct(value) {
  return Math.round(value * 1000) / 10;
}

function logistic(value) {
  return 1 / (1 + Math.exp(-value));
}

function ratingFor(team) {
  return TEAM_RATINGS[team] ?? 68;
}

function hostBoost(fixture) {
  const hostTeams = new Set(["Canada", "Mexico", "USA"]);
  const homeBoost = hostTeams.has(fixture.homeTeam) && fixture.hostCountry === fixture.homeCode ? 3 : 0;
  const awayBoost = hostTeams.has(fixture.awayTeam) && fixture.hostCountry === fixture.awayCode ? 3 : 0;
  return homeBoost - awayBoost;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function projectedScore(diff, pick) {
  let homeGoals = clamp(1.15 + diff / 26, 0.4, 2.7);
  let awayGoals = clamp(1.15 - diff / 26, 0.4, 2.7);
  let home = Math.max(0, Math.round(homeGoals));
  let away = Math.max(0, Math.round(awayGoals));
  if (pick === "H" && home <= away) home = away + 1;
  if (pick === "A" && away <= home) away = home + 1;
  if (pick === "D") {
    const drawGoals = Math.max(0, Math.round((homeGoals + awayGoals) / 2));
    home = drawGoals;
    away = drawGoals;
  }
  return `${home}-${away}`;
}

function predictInternationalFixture(fixture) {
  const liveOdds = oddsForInternationalFixture(fixture);
  const homeRating = ratingFor(fixture.homeTeam);
  const awayRating = ratingFor(fixture.awayTeam);
  const diff = homeRating - awayRating + hostBoost(fixture);
  const draw = clamp(0.25 - Math.abs(diff) * 0.004, 0.16, 0.28);
  const homeShare = logistic(diff / 12);
  const home = (1 - draw) * homeShare;
  const away = (1 - draw) * (1 - homeShare);
  const entries = [
    ["H", home],
    ["D", draw],
    ["A", away],
  ].sort((a, b) => b[1] - a[1]);
  const prediction = entries[0][0];
  const confidence = roundPct(entries[0][1]);
  return {
    league: fixture.group,
    season: "2026 World Cup",
    date: fixture.date,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeFlagUrl: fixture.homeFlagUrl,
    awayFlagUrl: fixture.awayFlagUrl,
    matchNumber: fixture.matchNumber,
    group: fixture.group,
    venue: fixture.venue,
    city: fixture.city,
    kickoffUtc: fixture.kickoffUtc,
    kickoffLocal: fixture.kickoffLocal,
    odds: liveOdds?.odds || { homeOdds: "", drawOdds: "", awayOdds: "" },
    oddsSource: liveOdds?.oddsSource || "Model only",
    oddsStatus: liveOdds?.oddsStatus || "Waiting for public odds",
    oddsSourceUrl: liveOdds?.oddsSourceUrl || "",
    hasOdds: Boolean(liveOdds?.odds),
    prediction,
    confidence,
    projectedScore: projectedScore(diff, prediction),
    probabilities: {
      H: home,
      D: draw,
      A: away,
      homeWinPct: roundPct(home),
      drawPct: roundPct(draw),
      awayWinPct: roundPct(away),
    },
    standingContext: {
      source: "international-fixtures",
      sourceName: "FIFA World Cup 2026 fixture feed",
      sourceUrl: readFixtureData().source?.url || "",
      home: { note: `${fixture.group}; baseline rating ${homeRating}` },
      away: { note: `${fixture.group}; baseline rating ${awayRating}` },
    },
    judgment: {
      summary:
        `${prediction === "H" ? fixture.homeTeam : prediction === "A" ? fixture.awayTeam : "Draw"} is the model-only baseline pick for ${fixture.group}.`,
      tableSource: "FIFA World Cup 2026 fixture feed",
      sourceUrl: readFixtureData().source?.url || "",
      factors: [
        `Fixture imported from FIFA schedule: Match ${fixture.matchNumber}, ${fixture.venue}, ${fixture.city}.`,
        `All World Cup 2026 group-stage teams are in scope in international mode.`,
        `Rating signal: ${fixture.homeTeam} ${homeRating}, ${fixture.awayTeam} ${awayRating}${hostBoost(fixture) ? ", host boost applied" : ""}.`,
        "Odds, injuries, final squad news, and fresh team/player form should be layered in as they become available.",
      ],
    },
  };
}

function internationalFixturePredictions() {
  return readFixtureData().fixtures.map(predictInternationalFixture);
}

function emptyGroupRow(team) {
  return {
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    status: "Waiting for matchday 1",
  };
}

function applyGroupResult(table, result) {
  const home = table.get(result.homeTeam);
  const away = table.get(result.awayTeam);
  const homeGoals = Number(result.homeGoals);
  const awayGoals = Number(result.awayGoals);
  if (!home || !away || !Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return false;
  home.played += 1;
  away.played += 1;
  home.goalsFor += homeGoals;
  home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals;
  away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) {
    home.wins += 1;
    away.losses += 1;
    home.points += 3;
  } else if (awayGoals > homeGoals) {
    away.wins += 1;
    home.losses += 1;
    away.points += 3;
  } else {
    home.draws += 1;
    away.draws += 1;
    home.points += 1;
    away.points += 1;
  }
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
  home.status = home.played ? "Group stage active" : home.status;
  away.status = away.played ? "Group stage active" : away.status;
  return true;
}

function settledInternationalResults() {
  return listPredictions()
    .filter((entry) => entry.source === "international-fixture-board")
    .filter((entry) => entry.status === "SETTLED")
    .filter((entry) => Number.isFinite(Number(entry.homeGoals)) && Number.isFinite(Number(entry.awayGoals)));
}

function internationalGroupTables() {
  const fixtureData = readFixtureData();
  const results = settledInternationalResults();
  return Object.entries(fixtureData.groups || {}).map(([group, teams]) => {
    const fixtures = fixtureData.fixtures.filter((fixture) => fixture.groupLetter === group);
    const table = new Map(teams.map((team) => [team, emptyGroupRow(team)]));
    let appliedResults = 0;
    for (const result of results.filter((entry) => fixtures.some((fixture) => fixture.date === entry.date && fixture.homeTeam === entry.homeTeam && fixture.awayTeam === entry.awayTeam))) {
      if (applyGroupResult(table, result)) appliedResults += 1;
    }
    const standings = [...table.values()]
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.localeCompare(b.team);
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
        status: entry.played ? (index < 2 ? "Advancing position" : "Group stage active") : entry.status,
      }));
    return { group, fixtures, standings, appliedResults };
  });
}

function internationalStatus() {
  const playerRows = readRows(PLAYER_STATS_PATH);
  const squadRows = readRows(SQUAD_STATS_PATH);
  const fixtureData = readFixtureData();
  return {
    playerRows: playerRows.length,
    squadRows: squadRows.length,
    players: new Set(playerRows.map((row) => row.Player).filter(Boolean)).size,
    squads: new Set([...playerRows.map((row) => row.Squad), ...squadRows.map((row) => row.Squad)].filter(Boolean)).size,
    seasons: [...new Set([...playerRows.map((row) => row.season), ...squadRows.map((row) => row.season)].filter(Boolean))].sort(),
    hasWorldCupStats: playerRows.length > 0 || squadRows.length > 0,
    hasWorldCupFixtures: fixtureData.fixtures.length > 0,
    fixtureCount: fixtureData.fixtures.length,
    fixtureTeams: fixtureData.teams?.length || 0,
    fixtureGroups: fixtureData.groupCount || Object.keys(fixtureData.groups || {}).length,
    fixtureSource: fixtureData.source || null,
    playerStatsPath: PLAYER_STATS_PATH,
    squadStatsPath: SQUAD_STATS_PATH,
    fixturesPath: WORLD_CUP_FIXTURES_PATH,
  };
}

module.exports = {
  PLAYER_STATS_PATH,
  SQUAD_STATS_PATH,
  WORLD_CUP_FIXTURES_PATH,
  internationalFixturePredictions,
  internationalGroupTables,
  internationalStatus,
  readFixtureData,
};
