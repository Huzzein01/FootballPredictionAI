const fs = require("fs");
const path = require("path");
const { FEATURE_NAMES, buildCurrentFeatureVector } = require("./features");
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

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function featureMap(features) {
  return Object.fromEntries(FEATURE_NAMES.map((name, index) => [name, Number(features[index] || 0)]));
}

function labelForResult(code, homeTeam, awayTeam) {
  if (code === "H") return `${homeTeam} win`;
  if (code === "A") return `${awayTeam} win`;
  return "Draw";
}

function pctMap(probabilities) {
  return {
    H: pct(probabilities.H || 0),
    D: pct(probabilities.D || 0),
    A: pct(probabilities.A || 0),
  };
}

function rankText(motivation = {}) {
  const rank = Number(motivation.rank || 0);
  if (!rank) return "unranked";
  const suffix = [11, 12, 13].includes(rank % 100) ? "th" : rank % 10 === 1 ? "st" : rank % 10 === 2 ? "nd" : rank % 10 === 3 ? "rd" : "th";
  return `${rank}${suffix}`;
}

function marketProbabilitiesFromFeatures(features) {
  const f = featureMap(features);
  if (!f.marketHomeProb && !f.marketDrawProb && !f.marketAwayProb) return null;
  return normalizeProbabilities({
    H: f.marketHomeProb,
    D: f.marketDrawProb,
    A: f.marketAwayProb,
  });
}

function contextualProbabilities(features, standingContext) {
  const f = featureMap(features);
  const motivationDiff = Number(standingContext?.home?.motivationScore || 0) - Number(standingContext?.away?.motivationScore || 0);
  const homeRotationRisk = Number(standingContext?.home?.securedTitle || 0) + Number(standingContext?.home?.deadRubber || 0) * 0.5;
  const awayRotationRisk = Number(standingContext?.away?.securedTitle || 0) + Number(standingContext?.away?.deadRubber || 0) * 0.5;
  const homeLean =
    0.1 +
    clamp(Number(f.ppgDiff || 0) / 1.3, -0.22, 0.22) +
    clamp(Number(f.goalDiffPerGameDiff || 0) / 1.35, -0.18, 0.18) +
    clamp(Number(f.homeLast5PPG || 0) - Number(f.awayLast5PPG || 0), -1.6, 1.6) * 0.045 +
    clamp(Number(f.homeLast5GD || 0) - Number(f.awayLast5GD || 0), -2.5, 2.5) * 0.035 +
    clamp(Number(f.eloDiff || 0) / 475, -0.16, 0.16) +
    clamp(Number(f.shotsPerGameDiff || 0) / 8, -0.08, 0.08) +
    clamp(Number(f.playerGoalsTotalDiff || 0) / 36, -0.07, 0.07) +
    clamp(Number(f.playerShotsOnTargetTotalDiff || 0) / 90, -0.05, 0.05) +
    clamp(motivationDiff / 1.5, -0.16, 0.16) -
    homeRotationRisk * 0.05 +
    awayRotationRisk * 0.04;
  const closeness = 1 - clamp(Math.abs(homeLean) / 0.75);
  const bothHaveStakes = Math.min(pressureScore(standingContext?.home || {}), pressureScore(standingContext?.away || {}));
  const drawRaw = 0.72 + closeness * 0.28 + bothHaveStakes * 0.07 + Math.max(homeRotationRisk, awayRotationRisk) * 0.05;

  return normalizeProbabilities({
    H: Math.exp(homeLean),
    D: drawRaw,
    A: Math.exp(-homeLean),
  });
}

function applyContextualJudgment(probabilities, contextProbabilities, standingContext, hasOdds) {
  const hasTableContext = standingContext?.source === "public-standings" || standingContext?.source === "local-season-table";
  const contextWeight = hasOdds ? (hasTableContext ? 0.26 : 0.18) : hasTableContext ? 0.38 : 0.3;
  return normalizeProbabilities({
    H: probabilities.H * (1 - contextWeight) + contextProbabilities.H * contextWeight,
    D: probabilities.D * (1 - contextWeight) + contextProbabilities.D * contextWeight,
    A: probabilities.A * (1 - contextWeight) + contextProbabilities.A * contextWeight,
  });
}

function pressureScore(motivation = {}) {
  return (
    Number(motivation.titleRaceScore || 0) +
    Number(motivation.europeRaceScore || 0) * 0.7 +
    Number(motivation.relegationBattleScore || 0) * 0.85 +
    Math.max(0, Number(motivation.recordMotiveScore || 0)) * 0.35
  );
}

function applyMotivationAdjustment(probabilities, standingContext) {
  const home = standingContext?.home || {};
  const away = standingContext?.away || {};
  const motivationDiff = Number(home.motivationScore || 0) - Number(away.motivationScore || 0);
  const homeRotationRisk = Number(home.securedTitle || 0) + Number(home.deadRubber || 0) * 0.5;
  const awayRotationRisk = Number(away.securedTitle || 0) + Number(away.deadRubber || 0) * 0.5;
  const homePressure = pressureScore(home);
  const awayPressure = pressureScore(away);
  const homeShift = motivationDiff * 0.045 - homeRotationRisk * 0.055 + awayRotationRisk * 0.035 + (homePressure - awayPressure) * 0.025;
  const awayShift = -motivationDiff * 0.045 - awayRotationRisk * 0.055 + homeRotationRisk * 0.035 + (awayPressure - homePressure) * 0.025;
  const drawShift = Math.max(homeRotationRisk, awayRotationRisk) * 0.025;

  return normalizeProbabilities({
    H: Math.max(0.03, probabilities.H + homeShift),
    D: Math.max(0.03, probabilities.D + drawShift),
    A: Math.max(0.03, probabilities.A + awayShift),
  });
}

function applyDrawCalibration(probabilities, standingContext, features, hasOdds) {
  const f = featureMap(features);
  const home = standingContext?.home || {};
  const away = standingContext?.away || {};
  const marketHome = Number(f.marketHomeProb || 0);
  const marketDraw = Number(f.marketDrawProb || 0);
  const marketAway = Number(f.marketAwayProb || 0);
  const marketClose = hasOdds ? 1 - clamp(Math.abs(marketHome - marketAway) / 0.22) : 0.35;
  const ppgClose = 1 - clamp(Math.abs(Number(f.ppgDiff || 0)) / 0.55);
  const formClose = 1 - clamp((Math.abs(Number(f.homeLast5PPG || 0) - Number(f.awayLast5PPG || 0)) + Math.abs(Number(f.homeLast5GD || 0) - Number(f.awayLast5GD || 0)) * 0.55) / 1.5);
  const eloClose = 1 - clamp(Math.abs(Number(f.eloDiff || 0)) / 210);
  const h2hGames = Number(f.h2hMatches || 0);
  const h2hDrawRate = h2hGames > 0 ? clamp(3 - (Number(f.homeH2HPPG || 0) + Number(f.awayH2HPPG || 0))) : 0;
  const h2hClose = h2hGames > 0 ? 1 - clamp(Math.abs(Number(f.h2hGoalDiffPerGame || 0)) / 1.2) : 0.35;
  const motivationParity = 1 - clamp(Math.abs(Number(home.motivationScore || 0) - Number(away.motivationScore || 0)) / 1.15);
  const bothPressure = Math.min(pressureScore(home), pressureScore(away));
  const rotationDrawRisk = Math.max(Number(home.securedTitle || 0), Number(away.securedTitle || 0)) * 0.025;
  const closeGameScore =
    marketClose * 0.28 +
    ppgClose * 0.18 +
    formClose * 0.18 +
    eloClose * 0.14 +
    h2hClose * 0.1 +
    motivationParity * 0.12;
  const h2hBoost = h2hDrawRate * 0.07;
  const pressureBoost = bothPressure > 0.35 ? 0.025 : 0;
  const marketAnchor = hasOdds ? marketDraw : probabilities.D;
  const targetDraw = clamp(
    Math.max(probabilities.D, marketAnchor * 0.72 + closeGameScore * 0.16 + h2hBoost + pressureBoost + rotationDrawRisk),
    0.08,
    0.39
  );
  const currentDraw = probabilities.D;
  if (targetDraw <= currentDraw + 0.004) {
    return { probabilities, diagnostics: { closeGameScore, h2hDrawRate, marketDraw, drawAdjustment: 0 } };
  }
  const nonDrawTotal = probabilities.H + probabilities.A || 1;
  const remaining = 1 - targetDraw;
  const calibrated = normalizeProbabilities({
    H: Math.max(0.03, (probabilities.H / nonDrawTotal) * remaining),
    D: targetDraw,
    A: Math.max(0.03, (probabilities.A / nonDrawTotal) * remaining),
  });
  return {
    probabilities: calibrated,
    diagnostics: {
      closeGameScore,
      h2hDrawRate,
      marketDraw,
      marketClose,
      ppgClose,
      formClose,
      eloClose,
      motivationParity,
      drawAdjustment: calibrated.D - currentDraw,
    },
  };
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

function buildJudgment({ prediction, probabilities, modelProbabilities, marketProbabilities, contextProbabilities, standingContext, features, homeTeam, awayTeam, hasOdds, drawCalibration }) {
  const f = featureMap(features);
  const predictedTeam = labelForResult(prediction, homeTeam, awayTeam);
  const home = standingContext?.home || {};
  const away = standingContext?.away || {};
  const tableSource = standingContext?.source === "public-standings" ? standingContext.sourceName || "Public standings" : "local season table";
  const tableLine = `${homeTeam}: ${rankText(home)}, ${Number(home.points || 0)} pts, ${home.note || "No motive note"}; ${awayTeam}: ${rankText(away)}, ${Number(away.points || 0)} pts, ${away.note || "No motive note"}.`;
  const marketLine = marketProbabilities
    ? `Market signal: H ${pct(marketProbabilities.H)}%, D ${pct(marketProbabilities.D)}%, A ${pct(marketProbabilities.A)}% from the provided odds.`
    : "Market signal: no complete 1X2 odds were provided, so the model leaned more heavily on form, table context, and team features.";
  const contextLine = `Context signal: H ${pct(contextProbabilities.H)}%, D ${pct(contextProbabilities.D)}%, A ${pct(contextProbabilities.A)}% after table position, current form, Elo, player features, and motivation are considered.`;
  const modelLine = `Model signal before final judgment: H ${pct(modelProbabilities.H)}%, D ${pct(modelProbabilities.D)}%, A ${pct(modelProbabilities.A)}%.`;
  const driverLine = `Drivers: PPG diff ${Number(f.ppgDiff || 0).toFixed(2)}, Elo diff ${Number(f.eloDiff || 0).toFixed(0)}, last-5 PPG ${Number(f.homeLast5PPG || 0).toFixed(2)}-${Number(f.awayLast5PPG || 0).toFixed(2)}, motivation diff ${Number((home.motivationScore || 0) - (away.motivationScore || 0)).toFixed(2)}.`;
  const drawLine = Number(drawCalibration?.drawAdjustment || 0) > 0.004
    ? `Draw risk was raised by ${(Number(drawCalibration.drawAdjustment) * 100).toFixed(1)} pts because the matchup profile looked close.`
    : "Draw risk was kept near the model baseline because the matchup did not trigger a strong draw-risk flag.";
  const manualNotes = [home.manualNote && `${homeTeam}: ${home.manualNote}`, away.manualNote && `${awayTeam}: ${away.manualNote}`].filter(Boolean);
  const topProbability = pct(probabilities[prediction] || 0);
  const summary = hasOdds
    ? `${predictedTeam} is the pick at ${topProbability}% after the odds were moderated by table stakes, motivation, form, Elo, head-to-head/player features, and draw-risk calibration.`
    : `${predictedTeam} is the pick at ${topProbability}% from the model and table context because no full market odds were supplied.`;

  return {
    summary,
    tableSource,
    sourceUrl: standingContext?.sourceUrl || "",
    updatedAt: standingContext?.updatedAt || "",
    marketProbabilities: marketProbabilities ? pctMap(marketProbabilities) : null,
    contextProbabilities: pctMap(contextProbabilities),
    finalProbabilities: pctMap(probabilities),
    factors: [marketLine, `${tableSource}: ${tableLine}`, contextLine, modelLine, driverLine, drawLine, ...manualNotes],
  };
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
  const motivationProbabilities = applyMotivationAdjustment(modelProbabilities, vector.standingContext);
  const drawCalibration = applyDrawCalibration(motivationProbabilities, vector.standingContext, vector.features, hasOdds);
  const marketProbabilities = hasOdds ? marketProbabilitiesFromFeatures(vector.features) : null;
  const contextProbabilities = contextualProbabilities(vector.features, vector.standingContext);
  const probabilities = applyContextualJudgment(drawCalibration.probabilities, contextProbabilities, vector.standingContext, hasOdds);
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
    calibration: drawCalibration.diagnostics,
    judgment: buildJudgment({
      prediction,
      probabilities,
      modelProbabilities,
      marketProbabilities,
      contextProbabilities,
      standingContext: vector.standingContext,
      features: vector.features,
      homeTeam: vector.homeTeam,
      awayTeam: vector.awayTeam,
      hasOdds,
      drawCalibration: drawCalibration.diagnostics,
    }),
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
