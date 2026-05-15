const fs = require("fs");
const path = require("path");
const { buildCurrentFeatureVector } = require("./features");
const { loadMatches } = require("./footballData");
const { predictProba } = require("./model");

const MODEL_PATH = path.join(process.cwd(), "model", "football_match_model.json");
const FIXTURE_PATH = path.join(process.cwd(), "data", "remaining_fixtures_2025_26_with_odds.csv");

let modelCache = null;
let modelMtime = 0;

function loadModel() {
  const stat = fs.statSync(MODEL_PATH);
  if (!modelCache || stat.mtimeMs !== modelMtime) {
    modelCache = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));
    modelMtime = stat.mtimeMs;
  }
  return modelCache;
}

function pct(value) {
  return Number((value * 100).toFixed(1));
}

function bestLabel(probabilities) {
  return Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
}

function normalizeProbabilities(probabilities) {
  const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(Object.entries(probabilities).map(([label, value]) => [label, value / total]));
}

function applyMotivationAdjustment(probabilities, standingContext) {
  const home = standingContext?.home || {};
  const away = standingContext?.away || {};
  const motivationDiff = Number(home.motivationScore || 0) - Number(away.motivationScore || 0);
  const homeRotationRisk = Number(home.securedTitle || 0) + Number(home.deadRubber || 0) * 0.5;
  const awayRotationRisk = Number(away.securedTitle || 0) + Number(away.deadRubber || 0) * 0.5;
  const homePressure =
    Number(home.titleRaceScore || 0) +
    Number(home.europeRaceScore || 0) * 0.7 +
    Number(home.relegationBattleScore || 0) * 0.85 +
    Math.max(0, Number(home.recordMotiveScore || 0)) * 0.35;
  const awayPressure =
    Number(away.titleRaceScore || 0) +
    Number(away.europeRaceScore || 0) * 0.7 +
    Number(away.relegationBattleScore || 0) * 0.85 +
    Math.max(0, Number(away.recordMotiveScore || 0)) * 0.35;
  const homeShift = motivationDiff * 0.045 - homeRotationRisk * 0.055 + awayRotationRisk * 0.035 + (homePressure - awayPressure) * 0.025;
  const awayShift = -motivationDiff * 0.045 - awayRotationRisk * 0.055 + homeRotationRisk * 0.035 + (awayPressure - homePressure) * 0.025;
  const drawShift = Math.max(homeRotationRisk, awayRotationRisk) * 0.025;

  return normalizeProbabilities({
    H: Math.max(0.03, probabilities.H + homeShift),
    D: Math.max(0.03, probabilities.D + drawShift),
    A: Math.max(0.03, probabilities.A + awayShift),
  });
}

function hasUsableOdds(odds) {
  return [odds.homeOdds, odds.drawOdds, odds.awayOdds].every((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0;
  });
}

function projectedScore(prediction, probabilities, hasOdds) {
  const confidence = probabilities[prediction];
  const drawPressure = probabilities.D;

  if (prediction === "D") return drawPressure > 0.34 ? "1-1" : "2-2";

  const favoriteGoals = confidence > 0.66 ? 3 : 2;
  const underdogGoals = confidence > 0.58 && hasOdds ? 0 : 1;

  if (prediction === "H") return `${favoriteGoals}-${underdogGoals}`;
  return `${underdogGoals}-${favoriteGoals}`;
}

function predictMatch(input) {
  const model = loadModel();
  const odds = {
    homeOdds: input.homeOdds,
    drawOdds: input.drawOdds,
    awayOdds: input.awayOdds,
  };
  const hasOdds = hasUsableOdds(odds);
  const vector = buildCurrentFeatureVector(input.league, input.homeTeam, input.awayTeam, odds, input.season || "2025-26");
  const modelProbabilities = predictProba(model, vector.features);
  const probabilities = applyMotivationAdjustment(modelProbabilities, vector.standingContext);
  const prediction = bestLabel(probabilities);

  return {
    league: input.league,
    season: input.season || "2025-26",
    date: input.date || "",
    homeTeam: vector.homeTeam,
    awayTeam: vector.awayTeam,
    odds,
    oddsSource: input.oddsSource || "",
    oddsSourceUrl: input.oddsSourceUrl || "",
    oddsSnapshotAt: input.oddsSnapshotAt || "",
    oddsStatus: input.oddsStatus || (hasOdds ? "Public odds found" : "No public odds found yet"),
    hasOdds,
    prediction,
    confidence: pct(probabilities[prediction]),
    projectedScore: projectedScore(prediction, probabilities, hasOdds),
    featureVector: vector.features,
    standingContext: vector.standingContext,
    probabilities: {
      H: probabilities.H,
      D: probabilities.D,
      A: probabilities.A,
      modelH: modelProbabilities.H,
      modelD: modelProbabilities.D,
      modelA: modelProbabilities.A,
      homeWinPct: pct(probabilities.H),
      drawPct: pct(probabilities.D),
      awayWinPct: pct(probabilities.A),
    },
    model: {
      type: model.type,
      trainedAt: model.trainedAt,
      dataCoverage: model.dataCoverage,
      metrics: model.metrics,
      hyperparameters: model.hyperparameters,
    },
  };
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

function loadRemainingFixtures() {
  if (!fs.existsSync(FIXTURE_PATH)) return [];
  const [headerLine, ...lines] = fs.readFileSync(FIXTURE_PATH, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(headerLine);

  return lines
    .map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])))
    .filter((fixture) => fixture.date && fixture.league && fixture.homeTeam && fixture.awayTeam)
    .map((fixture) => ({ ...fixture, season: "2025-26" }));
}

function fixturePredictionBoard() {
  const predictions = loadRemainingFixtures().map((fixture) => predictMatch(fixture));
  return predictions.sort((a, b) => `${a.date} ${a.league} ${a.homeTeam}`.localeCompare(`${b.date} ${b.league} ${b.homeTeam}`));
}

function teamsByLeague() {
  const grouped = new Map();
  for (const match of loadMatches()) {
    if (!grouped.has(match.League)) grouped.set(match.League, new Set());
    grouped.get(match.League).add(match.HomeTeam);
    grouped.get(match.League).add(match.AwayTeam);
  }
  return Object.fromEntries([...grouped.entries()].map(([league, teams]) => [league, [...teams].sort()]));
}

module.exports = {
  fixturePredictionBoard,
  loadRemainingFixtures,
  predictMatch,
  teamsByLeague,
};
