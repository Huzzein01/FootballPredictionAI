"use strict";
/**
 * 24/7 auto-tuner + accuracy tracker for the international model.
 *
 * Goal: drive 3-way result accuracy toward 75% by the end of World Cup
 * group-stage matchday 3. Every time a match settles, runAutoTune():
 *   1. Builds the backtest corpus — pre-WC friendlies + live WC results,
 *      weighting WC matches 3× (they are the real target) and applying a
 *      90-day recency decay around the tournament window.
 *   2. Coordinate-descent searches the model's free parameters for the set
 *      that maximizes weighted hit-rate, with a small regularization pull
 *      toward the defaults so a tiny live sample can't overfit.
 *   3. Persists the winning parameters (modelTuning) and appends an accuracy
 *      snapshot to data/international/accuracy_history.json, including the
 *      live World Cup hit-rate and progress toward the 75% target.
 */

const { writeJson, readJsonWithFallback, mutableDataPath } = require("./runtimePaths");
const { getTuning, saveTuning, searchBestParams, DEFAULT_TUNING } = require("./modelTuning");
const { predictResultForTuning, normalizeIntlTeam } = require("./internationalData");
const { listPredictions } = require("./backtestStore");

const ACCURACY_HISTORY_PATH = mutableDataPath("international", "accuracy_history.json");
const FRIENDLY_PATH = mutableDataPath("international", "friendly_results.json");
const TARGET_ACCURACY = 0.75;
const WC_KICKOFF = new Date("2026-06-11T00:00:00Z").getTime();
const WC_WEIGHT = 3;        // live World Cup matches count 3× a friendly
const RECENCY_HALF_LIFE_DAYS = 90;
const REGULARIZATION = 0.004; // accuracy penalty per unit of normalized drift

function resultCode(hg, ag) {
  const h = Number(hg);
  const a = Number(ag);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h > a) return "H";
  if (h < a) return "A";
  return "D";
}

function recencyWeight(dateStr) {
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (!Number.isFinite(t)) return 0.5;
  const daysAway = Math.abs(WC_KICKOFF - t) / 86400000;
  return Math.pow(0.5, daysAway / RECENCY_HALF_LIFE_DAYS);
}

// Combined settled-result corpus: friendlies + live World Cup matches.
function buildCorpus() {
  const friendlySnap = readJsonWithFallback(FRIENDLY_PATH, null, null);
  const friendlies = Array.isArray(friendlySnap?.results) ? friendlySnap.results : [];
  let wc = [];
  try {
    wc = (require("./worldCupSync").readWorldCupResults().results || []).filter((r) => r.completed);
  } catch (_) { /* sync module optional */ }

  const corpus = [];
  for (const r of friendlies) {
    const actual = resultCode(r.homeGoals, r.awayGoals);
    if (!actual) continue;
    corpus.push({
      home: normalizeIntlTeam(r.homeTeam),
      away: normalizeIntlTeam(r.awayTeam),
      actual,
      weight: recencyWeight(r.date),
      competition: "friendly",
    });
  }
  for (const r of wc) {
    const actual = resultCode(r.homeGoals, r.awayGoals);
    if (!actual) continue;
    corpus.push({
      home: normalizeIntlTeam(r.homeTeam),
      away: normalizeIntlTeam(r.awayTeam),
      actual,
      weight: recencyWeight(r.date) * WC_WEIGHT,
      competition: "world-cup",
    });
  }
  return corpus;
}

// Normalized drift of a candidate from the defaults (for regularization).
function paramDrift(params) {
  const keys = ["fifaBlend", "logisticSteepness", "friendlySeriousness", "drawBase", "drawSlope", "hostBoost", "fifaMovementCap"];
  let drift = 0;
  for (const k of keys) {
    const def = DEFAULT_TUNING[k] || 1;
    drift += Math.abs((Number(params[k]) - def) / (Math.abs(def) || 1));
  }
  return drift / keys.length;
}

function makeScorer(corpus) {
  return (params) => {
    let correctW = 0;
    let totalW = 0;
    let rawCorrect = 0;
    for (const m of corpus) {
      const pick = predictResultForTuning(m.home, m.away, params);
      totalW += m.weight;
      if (pick === m.actual) {
        correctW += m.weight;
        rawCorrect += 1;
      }
    }
    const accuracy = totalW > 0 ? correctW / totalW : 0;
    return {
      accuracy: accuracy - REGULARIZATION * paramDrift(params),
      rawAccuracy: corpus.length ? rawCorrect / corpus.length : 0,
      weightedAccuracy: accuracy,
      sample: corpus.length,
    };
  };
}

// Live World Cup model accuracy from settled tracked predictions.
function liveWorldCupAccuracy() {
  const settled = listPredictions().filter(
    (p) => p.source === "international-fixture-board" && p.status === "SETTLED" && (p.correct === true || p.correct === false)
  );
  const correct = settled.filter((p) => p.correct === true).length;
  return {
    matchdayResults: settled.length,
    correct,
    accuracy: settled.length ? correct / settled.length : null,
  };
}

function appendAccuracyHistory(snapshot) {
  const store = readJsonWithFallback(ACCURACY_HISTORY_PATH, null, { history: [] });
  store.history = Array.isArray(store.history) ? store.history : [];
  store.history.push(snapshot);
  if (store.history.length > 500) store.history = store.history.slice(-500);
  store.latest = snapshot;
  writeJson(ACCURACY_HISTORY_PATH, store);
  return store;
}

/**
 * Run one tuning pass. Returns the chosen params + accuracy snapshot.
 */
function runAutoTune({ reason = "scheduled" } = {}) {
  const corpus = buildCorpus();
  if (corpus.length < 10) {
    return { skipped: true, reason: "insufficient corpus", sample: corpus.length };
  }
  const scorer = makeScorer(corpus);
  const baseline = scorer(getTuning());
  const { params, evaluation, passes } = searchBestParams(scorer, getTuning());

  const live = liveWorldCupAccuracy();
  // Only persist params that did not regress weighted backtest accuracy.
  let saved = null;
  if (evaluation.weightedAccuracy >= baseline.weightedAccuracy - 1e-9) {
    saved = saveTuning({
      ...params,
      tunedBy: `auto-tune:${reason}`,
      backtestAccuracy: Math.round(evaluation.weightedAccuracy * 1000) / 1000,
      sampleSize: evaluation.sample,
    });
  }

  const snapshot = {
    at: new Date().toISOString(),
    reason,
    passes,
    corpusSize: corpus.length,
    wcMatches: corpus.filter((m) => m.competition === "world-cup").length,
    baselineWeightedAccuracy: Math.round(baseline.weightedAccuracy * 1000) / 1000,
    tunedWeightedAccuracy: Math.round(evaluation.weightedAccuracy * 1000) / 1000,
    tunedRawAccuracy: Math.round(evaluation.rawAccuracy * 1000) / 1000,
    liveWorldCup: live,
    targetAccuracy: TARGET_ACCURACY,
    targetMet: live.accuracy != null ? live.accuracy >= TARGET_ACCURACY : false,
    params: saved ? {
      fifaBlend: saved.fifaBlend,
      logisticSteepness: saved.logisticSteepness,
      friendlySeriousness: saved.friendlySeriousness,
      drawBase: saved.drawBase,
      drawSlope: saved.drawSlope,
      hostBoost: saved.hostBoost,
      fifaMovementCap: saved.fifaMovementCap,
    } : null,
  };
  appendAccuracyHistory(snapshot);
  return snapshot;
}

function readAccuracyHistory() {
  return readJsonWithFallback(ACCURACY_HISTORY_PATH, null, { history: [], latest: null });
}

module.exports = {
  runAutoTune,
  readAccuracyHistory,
  liveWorldCupAccuracy,
  buildCorpus,
  TARGET_ACCURACY,
  ACCURACY_HISTORY_PATH,
};
