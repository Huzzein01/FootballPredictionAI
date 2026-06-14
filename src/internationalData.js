const fs = require("fs");
const path = require("path");
const { listPredictions } = require("./backtestStore");
const { oddsForInternationalFixture } = require("./oddsApiService");
const { mutableDataPath, readJsonWithFallback } = require("./runtimePaths");
const { weatherContextForFixture } = require("./weatherService");
const { getTuning } = require("./modelTuning");

const PLAYER_STATS_PATH = path.join(process.cwd(), "data", "international", "processed", "world_cup_player_stats.json");
const SQUAD_STATS_PATH = path.join(process.cwd(), "data", "international", "processed", "world_cup_squad_stats.json");
const WORLD_CUP_FIXTURES_PATH = path.join(process.cwd(), "data", "international", "world_cup_2026_fixtures.json");
const INTL_FRIENDLY_RESULTS_PATH = mutableDataPath("international", "friendly_results.json");

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

/**
 * Historical World Cup tournament pedigree + recent continental performance.
 * Applied only in knockout rounds (fixture.isKnockout === true) via ratingFor().
 *
 * Sources:
 *   WC titles  — Brazil 5, Germany 4, Italy 4, Argentina 3, France 2, England/Uruguay/Spain 1
 *   2022 WC    — Argentina champion, France finalist, Morocco 4th (best African run ever)
 *   2024       — Spain: Euros winner; Argentina: Copa América winner
 *   Croatia    — 2018 WC finalist, 2022 3rd place
 *   Colombia   — 2024 Copa América finalist
 */
const WC_TOURNAMENT_PRESTIGE = {
  Argentina:   8,  // 3× WC champion (1978, 1986, 2022); Copa América 2024 winner
  France:      7,  // 2× WC champion (1998, 2018); 2022 WC finalist; Euros 2024 finalist
  Brazil:      7,  // 5× WC champion; always a top-4 contender
  Germany:     6,  // 4× WC champion; consistently deep runs
  Spain:       6,  // 1× WC champion (2010); 3× Euros; Euros 2024 winner
  England:     4,  // 1× WC champion (1966); SF/QF in 2018, 2022
  Uruguay:     3,  // 2× WC champion (early era); perennial Copa América force
  Netherlands: 3,  // 3× WC finalist (never won); consistent deep runs
  Croatia:     4,  // 2018 WC finalist; 2022 WC 3rd place
  Morocco:     4,  // 2022 WC 4th place — best African run in history
  Portugal:    2,  // 2006 4th place; 2022 QF; elite individual talent
  Colombia:    2,  // 2024 Copa América finalist; rising continental power
  Mexico:      1,  // 6× R16 exits; 2026 co-host advantage
  USA:         1,  // 2026 host nation; improving programme
  Senegal:     1,  // 2022 R16; growing African power
  Japan:       1,  // 2022 R16; most successful Asian WC nation
};

const FRIENDLY_TRAINING_PATH = path.join(process.cwd(), "data", "international", "processed", "friendly_training_summary.json");
const FIFA_RANKINGS_PATH = path.join(process.cwd(), "data", "international", "fifa_rankings.json");

let fifaRankingsCache = null;
// FIFA Men's World Ranking snapshot (inside.fifa.com), refreshed by
// scripts/fetchFifaRankings.js. Names follow the FIFA convention, which is
// what the World Cup fixture feed uses, so no aliasing is required here.
function readFifaRankings() {
  if (fifaRankingsCache) return fifaRankingsCache;
  if (!fs.existsSync(FIFA_RANKINGS_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(FIFA_RANKINGS_PATH, "utf8").replace(/^﻿/, ""));
    fifaRankingsCache = {
      ...data,
      byTeam: new Map((data.rankings || []).map((row) => [row.team, row])),
    };
  } catch (_) {
    fifaRankingsCache = null;
  }
  return fifaRankingsCache;
}

// Converts FIFA ranking points (~800–1900) onto the model's 60–95 rating
// scale. Anchors: 1880 pts ≈ rating 92 (Spain/France/Argentina tier),
// 1280 pts ≈ rating 65 (lowest-ranked WC qualifier tier).
function fifaPointsToRating(points) {
  const scaled = 65 + ((points - 1280) / (1880 - 1280)) * 27;
  return Math.max(55, Math.min(95, scaled));
}

// Movement signal from the latest ranking update (captures the most recent
// official results window): points gained/lost since the previous release,
// clamped to ±cap rating points (cap is tunable).
function fifaMovementNudge(row, cap = 1.5) {
  const delta = Number(row.points) - Number(row.previousPoints);
  if (!Number.isFinite(delta)) return 0;
  return Math.max(-cap, Math.min(cap, delta / 10));
}

// ESPN scoreboard names \u2192 FIFA fixture-feed names. Without this map the
// friendly-form signal silently missed USA, Korea Republic, IR Iran,
// C\u00F4te d'Ivoire, Cabo Verde, and Bosnia and Herzegovina entirely.
const INTL_TEAM_ALIASES = {
  "United States": "USA",
  "South Korea": "Korea Republic",
  "Korea": "Korea Republic",
  "Iran": "IR Iran",
  "Ivory Coast": "C\u00F4te d'Ivoire",
  "Cote d'Ivoire": "C\u00F4te d'Ivoire",
  "Cape Verde": "Cabo Verde",
  "Cape Verde Islands": "Cabo Verde",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "Bosnia": "Bosnia and Herzegovina",
  "Turkey": "T\u00FCrkiye",
  "Turkiye": "T\u00FCrkiye",
  "Czech Republic": "Czechia",
  "DR Congo": "Congo DR",
  "Curacao": "Cura\u00E7ao",
};

function normalizeIntlTeam(name) {
  const trimmed = String(name || "").trim();
  return INTL_TEAM_ALIASES[trimmed] || trimmed;
}

let friendlyTrainingCache = null;
let friendlyTrainingCacheMtime = 0;
// Continuous-training output (friendlies down-weighted at 0.6 + live World
// Cup results at full weight). Cache keyed on file mtime so a rebuild after
// each settled WC match takes effect immediately without a restart.
function readFriendlyTraining() {
  const livePath = mutableDataPath("international", "processed", "friendly_training_summary.json");
  const activePath = fs.existsSync(livePath) ? livePath : FRIENDLY_TRAINING_PATH;
  if (!fs.existsSync(activePath)) return null;
  const mtime = fs.statSync(activePath).mtimeMs;
  if (friendlyTrainingCache && mtime === friendlyTrainingCacheMtime) return friendlyTrainingCache;
  try {
    friendlyTrainingCache = JSON.parse(fs.readFileSync(activePath, "utf8").replace(/^\uFEFF/, ""));
    friendlyTrainingCacheMtime = mtime;
  } catch (_) {
    friendlyTrainingCache = null;
  }
  return friendlyTrainingCache;
}

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

/**
 * Returns the effective rating for a team.
 * In knockout rounds (includePrestige=true) the WC_TOURNAMENT_PRESTIGE bonus
 * is added so historically dominant nations have a stronger edge late on.
 */
function ratingFor(team, includePrestige = false, tuning = getTuning()) {
  const base = TEAM_RATINGS[team] ?? 68;
  // Blend the hand-tuned prior with the live FIFA World Ranking. The blend
  // weight and the latest-release movement cap are auto-tuned (defaults:
  // 45% FIFA points, ±1.5 movement nudge).
  const fifaRow = readFifaRankings()?.byTeam?.get(normalizeIntlTeam(team));
  const blend = Math.max(0, Math.min(1, Number(tuning.fifaBlend ?? 0.45)));
  const movementCap = Number(tuning.fifaMovementCap ?? 1.5);
  const blended = fifaRow
    ? base * (1 - blend) + fifaPointsToRating(fifaRow.points) * blend + fifaMovementNudge(fifaRow, movementCap)
    : base;
  if (!includePrestige) return blended;
  return blended + (WC_TOURNAMENT_PRESTIGE[team] ?? 0);
}

// Read the ESPN-fetched international friendly results from disk.
function readFriendlyResults() {
  const snapshot = readJsonWithFallback(INTL_FRIENDLY_RESULTS_PATH, null, null);
  return Array.isArray(snapshot?.results) ? snapshot.results : [];
}

// ±4-point form delta from pre-WC friendlies. Prefers the prebuilt training
// summary (down-weighted for friendly seriousness + recency-weighted); falls
// back to an inline computation over the raw ESPN results, with team-name
// normalization so every WC squad's friendlies are matched.
function friendlyFormAdjustment(team, results) {
  const fifaName = normalizeIntlTeam(team);
  const trained = readFriendlyTraining();
  const trainedEntry = trained?.teams?.[fifaName];
  if (trainedEntry && trainedEntry.matches >= 2) return trainedEntry.weightedFormDelta;

  const relevant = results
    .filter((r) => normalizeIntlTeam(r.homeTeam) === fifaName || normalizeIntlTeam(r.awayTeam) === fifaName)
    .slice(-8);
  if (relevant.length < 2) return 0;
  let points = 0;
  for (const r of relevant) {
    const isHome = normalizeIntlTeam(r.homeTeam) === fifaName;
    const scored = isHome ? r.homeGoals : r.awayGoals;
    const conceded = isHome ? r.awayGoals : r.homeGoals;
    if (scored > conceded) points += 3;
    else if (scored === conceded) points += 1;
  }
  const ratio = points / (relevant.length * 3); // [0, 1]
  const delta = ratio * 2 - 1; // [-1, +1]
  // Friendlies are softer evidence than competitive matches — cap at ±4 but
  // discount the inline (unweighted) path to 60% seriousness.
  return Math.round(delta * 4 * 0.6 * 10) / 10;
}

// Memoized group-standings lookup (team -> points/played/rank), rebuilt only
// when the settled-result count changes. Powers the motivation signal.
let standingsLookupCache = null;
let standingsLookupSettledCount = -1;
function groupStandingsLookup() {
  const settledCount = settledInternationalResults().length;
  if (standingsLookupCache && settledCount === standingsLookupSettledCount) return standingsLookupCache;
  const lookup = new Map();
  try {
    for (const { group, standings } of internationalGroupTables()) {
      const groupSize = standings.length;
      standings.forEach((row, index) => {
        lookup.set(normalizeIntlTeam(row.team), { points: row.points, played: row.played, rank: index + 1, groupSize, group });
      });
    }
  } catch (_) { /* before any results, motivation is neutral */ }
  standingsLookupCache = lookup;
  standingsLookupSettledCount = settledCount;
  return lookup;
}

// Motivation ("motives") signal for group-stage matches: as the group unfolds,
// teams chasing qualification press harder while safe teams rotate. Returns a
// home-minus-away rating nudge bounded to ±2, scaled by matchday and the
// tunable motivationWeight. Neutral on matchday 1 (no standings signal yet).
function motivationAdjustment(fixture, weight = 1) {
  if (fixture.isKnockout || !weight) return 0;
  const lookup = groupStandingsLookup();
  const teamMotive = (team) => {
    const row = lookup.get(normalizeIntlTeam(team));
    if (!row || row.played < 1) return 0;
    const matchdayFactor = Math.min(1, row.played / 2); // ramps to MD3
    // Distance from the ~4-point safety line, normalized to [0,1].
    const need = Math.max(0, Math.min(1, (4 - row.points) / 4));
    let motive = need * matchdayFactor;            // desperation boost
    if (row.points >= 6) motive -= 0.5 * matchdayFactor; // already through → rotation
    return motive;
  };
  const net = teamMotive(fixture.homeTeam) - teamMotive(fixture.awayTeam);
  return clamp(net * weight, -2, 2);
}

function hostBoost(fixture, boost = 3) {
  const hostTeams = new Set(["Canada", "Mexico", "USA"]);
  const homeBoost = hostTeams.has(fixture.homeTeam) && fixture.hostCountry === fixture.homeCode ? boost : 0;
  const awayBoost = hostTeams.has(fixture.awayTeam) && fixture.hostCountry === fixture.awayCode ? boost : 0;
  return homeBoost - awayBoost;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function projectedScore(diff, pick, scoreSlope = 26) {
  let homeGoals = clamp(1.15 + diff / scoreSlope, 0.4, 2.7);
  let awayGoals = clamp(1.15 - diff / scoreSlope, 0.4, 2.7);
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

function predictInternationalFixture(fixture, friendlyResults = []) {
  const tuning = getTuning();
  const liveOdds = oddsForInternationalFixture(fixture);
  const homeFormAdj = friendlyFormAdjustment(fixture.homeTeam, friendlyResults);
  const awayFormAdj = friendlyFormAdjustment(fixture.awayTeam, friendlyResults);
  // isKnockout flag activates the WC_TOURNAMENT_PRESTIGE bonus for deep rounds
  const includePrestige = !!fixture.isKnockout;
  const homeRating = ratingFor(fixture.homeTeam, includePrestige, tuning) + homeFormAdj;
  const awayRating = ratingFor(fixture.awayTeam, includePrestige, tuning) + awayFormAdj;
  const weather = weatherContextForFixture(fixture);
  const motive = motivationAdjustment(fixture, tuning.motivationWeight);
  const diff = homeRating - awayRating + hostBoost(fixture, tuning.hostBoost) + weather.netDiffImpact + motive;
  const draw = clamp(tuning.drawBase - Math.abs(diff) * tuning.drawSlope, tuning.drawMin, tuning.drawMax);
  const homeShare = logistic(diff / tuning.logisticSteepness);
  const home = (1 - draw) * homeShare;
  const away = (1 - draw) * (1 - homeShare);
  const entries = [
    ["H", home],
    ["D", draw],
    ["A", away],
  ].sort((a, b) => b[1] - a[1]);
  const prediction = entries[0][0];
  const confidence = roundPct(entries[0][1]);
  // Every fixture carries odds: live sportsbook prices when available,
  // otherwise model-derived fair prices from the trained probabilities
  // (4% overround so they read like a realistic book).
  const fairPrice = (p) => (1 / (Math.min(0.95, Math.max(0.04, p)) * 1.04)).toFixed(2);
  const modelFairOdds = { homeOdds: fairPrice(home), drawOdds: fairPrice(draw), awayOdds: fairPrice(away) };
  const fifaData = readFifaRankings();
  const homeFifa = fifaData?.byTeam?.get(normalizeIntlTeam(fixture.homeTeam));
  const awayFifa = fifaData?.byTeam?.get(normalizeIntlTeam(fixture.awayTeam));
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
    odds: liveOdds?.odds || modelFairOdds,
    oddsSource: liveOdds?.oddsSource || "Model fair odds (FIFA-ranking + friendly-trained probabilities)",
    oddsStatus: liveOdds?.oddsStatus || "No public sportsbook line yet — model-derived fair price shown",
    oddsSourceUrl: liveOdds?.oddsSourceUrl || "https://inside.fifa.com/fifa-world-ranking/men",
    hasOdds: true,
    oddsType: liveOdds?.odds ? "sportsbook" : "model-fair",
    prediction,
    confidence,
    projectedScore: projectedScore(diff, prediction, tuning.scoreSlope),
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
      home: {
        note: `${fixture.group}; baseline rating ${homeRating.toFixed(1)}; squad climate tier ${weather.home.climateScore.toFixed(1)}`,
        weatherAdj: weather.home.total,
      },
      away: {
        note: `${fixture.group}; baseline rating ${awayRating.toFixed(1)}; squad climate tier ${weather.away.climateScore.toFixed(1)}`,
        weatherAdj: weather.away.total,
      },
      weather: {
        venueTier: weather.venueTier,
        heatRisk: weather.heatRisk,
        dominantStressor: weather.dominantStressor,
        altitudeM: weather.altitudeM,
        hasAC: weather.hasAC,
        netDiffImpact: weather.netDiffImpact,
        // Per-team climate sub-scores consumed by the weatherBadge() UI.
        home: { team: weather.home.team, climateScore: weather.home.climateScore, total: weather.home.total },
        away: { team: weather.away.team, climateScore: weather.away.climateScore, total: weather.away.total },
      },
    },
    judgment: {
      summary:
        `${prediction === "H" ? fixture.homeTeam : prediction === "A" ? fixture.awayTeam : "Draw"} is the model-only baseline pick for ${fixture.group}.`,
      tableSource: "FIFA World Cup 2026 fixture feed",
      sourceUrl: readFixtureData().source?.url || "",
      factors: [
        `Fixture imported from FIFA schedule: Match ${fixture.matchNumber}, ${fixture.venue}, ${fixture.city}.`,
        `All World Cup 2026 group-stage teams are in scope in international mode.`,
        `Rating signal: ${fixture.homeTeam} ${homeRating.toFixed(1)}, ${fixture.awayTeam} ${awayRating.toFixed(1)}${hostBoost(fixture, tuning.hostBoost) ? ", host boost applied" : ""}${homeFormAdj || awayFormAdj ? ` (friendly form: ${fixture.homeTeam} ${homeFormAdj >= 0 ? "+" : ""}${homeFormAdj}, ${fixture.awayTeam} ${awayFormAdj >= 0 ? "+" : ""}${awayFormAdj})` : ""}.`,
        homeFifa && awayFifa
          ? `FIFA World Ranking (${fifaData.rankingDate || "latest release"}): ${fixture.homeTeam} #${homeFifa.rank} (${Math.round(homeFifa.points)} pts, ${homeFifa.points >= homeFifa.previousPoints ? "+" : ""}${(homeFifa.points - homeFifa.previousPoints).toFixed(1)}), ${fixture.awayTeam} #${awayFifa.rank} (${Math.round(awayFifa.points)} pts, ${awayFifa.points >= awayFifa.previousPoints ? "+" : ""}${(awayFifa.points - awayFifa.previousPoints).toFixed(1)}).`
          : "FIFA World Ranking data not available for this pairing.",
        weather.summaryFactor,
        "Odds, injuries, final squad news, and fresh team/player form should be layered in as they become available.",
      ],
    },
  };
}

function internationalFixturePredictions() {
  const friendlyResults = readFriendlyResults();
  return readFixtureData().fixtures.map((f) => predictInternationalFixture(f, friendlyResults));
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

/**
 * Structural result prediction for backtest/tuning: ratings (prior + FIFA)
 * driven through the tunable logistic + draw model on a neutral footing
 * (no host boost / weather, since historical friendlies carry no venue
 * metadata). The per-team friendly-form delta is intentionally excluded to
 * avoid circular leakage when scoring against the friendly corpus itself.
 * Returns "H" | "D" | "A".
 */
function scoredPickForTuning(homeTeam, awayTeam, tuning = getTuning()) {
  const homeRating = ratingFor(homeTeam, false, tuning);
  const awayRating = ratingFor(awayTeam, false, tuning);
  const diff = homeRating - awayRating;
  const draw = clamp(tuning.drawBase - Math.abs(diff) * tuning.drawSlope, tuning.drawMin, tuning.drawMax);
  const homeShare = logistic(diff / tuning.logisticSteepness);
  const home = (1 - draw) * homeShare;
  const away = (1 - draw) * (1 - homeShare);
  const entries = [["H", home], ["D", draw], ["A", away]].sort((a, b) => b[1] - a[1]);
  return { pick: entries[0][0], confidence: entries[0][1] * 100 };
}

function predictResultForTuning(homeTeam, awayTeam, tuning = getTuning()) {
  return scoredPickForTuning(homeTeam, awayTeam, tuning).pick;
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
  predictInternationalFixture,  // exported for knockout-round simulation in tournamentProjection.js
  predictResultForTuning,       // exported for the auto-tuner backtest
  scoredPickForTuning,          // pick + confidence, for high-confidence accuracy
  normalizeIntlTeam,
  readFriendlyTraining,
};
