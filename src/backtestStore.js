const fs = require("fs");
const path = require("path");
const { mutableDataPath, readJsonWithFallback, repoDataPath, writeJson } = require("./runtimePaths");

const STORE_PATH = mutableDataPath("backtests.json");
const SEEDED_STORE_PATH = repoDataPath("backtests.json");

function ensureStore() {
  if (!fs.existsSync(STORE_PATH)) {
    writeJson(STORE_PATH, readJsonWithFallback(SEEDED_STORE_PATH, null, { predictions: [] }));
  }
}

function readStore() {
  return readJsonWithFallback(STORE_PATH, SEEDED_STORE_PATH, { predictions: [] });
}

function writeStore(store) {
  writeJson(STORE_PATH, store);
}

function makeId() {
  return `pred_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function resultFromScore(homeGoals, awayGoals) {
  const home = Number(homeGoals);
  const away = Number(awayGoals);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return "";
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

function scoreFromText(score) {
  const match = String(score || "").trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  return { homeGoals: Number(match[1]), awayGoals: Number(match[2]) };
}

function isExactScoreCorrect(entry) {
  const projected = scoreFromText(entry.projectedScore);
  if (!projected) return false;
  const homeGoals = Number(entry.homeGoals);
  const awayGoals = Number(entry.awayGoals);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return false;
  return projected.homeGoals === homeGoals && projected.awayGoals === awayGoals;
}

function addPrediction(prediction, source = "manual") {
  const store = readStore();
  const entry = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    source,
    status: "PENDING",
    actualResult: "",
    homeGoals: "",
    awayGoals: "",
    settledAt: "",
    correct: null,
    scoreCorrect: null,
    ...prediction,
  };
  store.predictions.unshift(entry);
  writeStore(store);
  return entry;
}

function fixtureKey(prediction, source) {
  return [
    source,
    prediction.date || "",
    prediction.league || "",
    prediction.homeTeam || "",
    prediction.awayTeam || "",
  ].join("||").toLowerCase();
}

function addPredictionsIfMissing(predictions, source = "fixture-board") {
  const store = readStore();
  const existing = new Set(store.predictions.map((prediction) => fixtureKey(prediction, prediction.source)));
  const saved = [];

  for (const prediction of predictions) {
    const key = fixtureKey(prediction, source);
    if (existing.has(key)) continue;
    const entry = {
      id: makeId(),
      createdAt: new Date().toISOString(),
      source,
      status: "PENDING",
      actualResult: "",
      homeGoals: "",
      awayGoals: "",
      settledAt: "",
      correct: null,
      scoreCorrect: null,
      ...prediction,
    };
    store.predictions.unshift(entry);
    existing.add(key);
    saved.push(entry);
  }

  writeStore(store);
  return saved;
}

function listPredictions() {
  return readStore().predictions;
}

function updateResult(id, update) {
  const store = readStore();
  const entry = store.predictions.find((item) => item.id === id);
  if (!entry) return null;

  const actualResult = update.actualResult || resultFromScore(update.homeGoals, update.awayGoals);
  entry.homeGoals = update.homeGoals ?? entry.homeGoals;
  entry.awayGoals = update.awayGoals ?? entry.awayGoals;
  entry.actualResult = actualResult || entry.actualResult;
  if (entry.actualResult) {
    entry.status = "SETTLED";
    entry.settledAt = new Date().toISOString();
    entry.settledBy = update.settledBy || entry.settledBy || "manual";
    entry.resultSourceName = update.sourceName || entry.resultSourceName || "";
    entry.resultSourceUrl = update.sourceUrl || entry.resultSourceUrl || "";
    entry.resultSourceEventId = update.sourceEventId || entry.resultSourceEventId || "";
    entry.correct = entry.prediction === entry.actualResult;
    entry.scoreCorrect = isExactScoreCorrect(entry);
  }
  writeStore(store);
  return entry;
}

function deletePrediction(id) {
  const store = readStore();
  const before = store.predictions.length;
  store.predictions = store.predictions.filter((item) => item.id !== id);
  writeStore(store);
  return store.predictions.length !== before;
}

function summary() {
  const predictions = listPredictions();
  const settled = predictions.filter((item) => item.status === "SETTLED");
  const correct = settled.filter((item) => item.prediction === item.actualResult).length;
  const scoreEligible = settled.filter((item) => scoreFromText(item.projectedScore)).length;
  const scoreCorrect = settled.filter((item) => isExactScoreCorrect(item)).length;
  return {
    total: predictions.length,
    pending: predictions.length - settled.length,
    settled: settled.length,
    correct,
    scoreEligible,
    scoreCorrect,
    accuracy: settled.length ? correct / settled.length : 0,
    pickAccuracy: settled.length ? correct / settled.length : 0,
    scoreAccuracy: scoreEligible ? scoreCorrect / scoreEligible : 0,
  };
}

module.exports = {
  STORE_PATH,
  addPrediction,
  addPredictionsIfMissing,
  deletePrediction,
  isExactScoreCorrect,
  listPredictions,
  resultFromScore,
  summary,
  updateResult,
};
