"use strict";
/**
 * Self-tuning parameters for the international (World Cup) model.
 *
 * The international model is a rating-based heuristic. "Training" it means
 * searching its free parameters for the set that maximizes 3-way result
 * accuracy over the settled-result corpus (pre-WC friendlies + live World Cup
 * matches). runAutoTune() runs a coordinate-descent search after every newly
 * settled match and persists the winning parameters here, so the live model
 * sharpens continuously toward the 75%-by-matchday-3 target.
 *
 * The model reads these via getTuning() (mtime-cached), so a re-tune takes
 * effect immediately without a restart.
 */

const fs = require("fs");
const path = require("path");
const { mutableDataPath, readJsonWithFallback, writeJson } = require("./runtimePaths");

const TUNING_PATH = mutableDataPath("international", "model_tuning.json");
const SEEDED_TUNING_PATH = path.join(process.cwd(), "data", "international", "model_tuning.json");

// Defaults reproduce the original hand-tuned constants exactly, so an
// untuned deployment behaves identically to before this layer existed.
const DEFAULT_TUNING = {
  fifaBlend: 0.45,        // weight on FIFA-points rating vs hand-tuned prior
  fifaMovementCap: 1.5,   // ±cap on the latest-release points-movement nudge
  friendlySeriousness: 0.6,
  logisticSteepness: 12,  // diff / steepness inside the win-share logistic
  drawBase: 0.25,
  drawSlope: 0.004,
  drawMin: 0.16,
  drawMax: 0.28,
  hostBoost: 3,
  scoreSlope: 26,         // diff / slope in the projected-score model
  motivationWeight: 1.0,  // group-stage "motives" nudge (must-win vs rotation)
  // Trust placed in the in-tournament match-stats form nudge (shots-on-target
  // margin from completed games). Fixed default, not in the search grid: the
  // backtest core (predictResultForTuning) excludes it to avoid leakage, since
  // form is derived from the same matches being scored. The signal is already
  // shrinkage-bounded, so a weight of 1.0 is safe untuned.
  matchStatsWeight: 1.0,
  updatedAt: "",
  tunedBy: "default",
  backtestAccuracy: null,
  sampleSize: 0,
};

let cache = null;
let cacheMtime = 0;

function getTuning() {
  const activePath = fs.existsSync(TUNING_PATH) ? TUNING_PATH : SEEDED_TUNING_PATH;
  if (!fs.existsSync(activePath)) return { ...DEFAULT_TUNING };
  const mtime = fs.statSync(activePath).mtimeMs;
  if (cache && mtime === cacheMtime) return cache;
  try {
    const loaded = JSON.parse(fs.readFileSync(activePath, "utf8").replace(/^﻿/, ""));
    cache = { ...DEFAULT_TUNING, ...loaded };
    cacheMtime = mtime;
  } catch (_) {
    cache = { ...DEFAULT_TUNING };
  }
  return cache;
}

function saveTuning(tuning) {
  const payload = { ...DEFAULT_TUNING, ...tuning, updatedAt: new Date().toISOString() };
  writeJson(TUNING_PATH, payload);
  cache = payload;
  try {
    cacheMtime = fs.statSync(TUNING_PATH).mtimeMs;
  } catch (_) { /* ignore */ }
  return payload;
}

// Candidate values explored per parameter (coordinate descent sweeps each).
const SEARCH_GRID = {
  fifaBlend: [0.3, 0.4, 0.45, 0.5, 0.6, 0.7],
  logisticSteepness: [8, 10, 12, 14, 16, 20],
  // Draw curve reaches high enough that evenly-matched fixtures are actually
  // called draws (~24% of international results are draws; the old 0.28 cap
  // meant the model never picked one).
  friendlySeriousness: [0.4, 0.5, 0.6, 0.7, 0.8],
  drawBase: [0.25, 0.3, 0.34, 0.36, 0.38, 0.4, 0.42, 0.46],
  drawSlope: [0.004, 0.006, 0.008, 0.01, 0.012, 0.016],
  drawMax: [0.28, 0.34, 0.4, 0.44, 0.48],
  hostBoost: [2, 3, 4],
  fifaMovementCap: [1.0, 1.5, 2.0],
  motivationWeight: [0, 0.5, 1.0, 1.5, 2.0],
};

/**
 * Coordinate-descent search. scoreFn(params) -> { accuracy, sample } is
 * supplied by the caller (internationalTraining) so this module stays free of
 * circular deps. Returns the best params plus its backtest accuracy.
 */
function searchBestParams(scoreFn, startParams) {
  let best = { ...DEFAULT_TUNING, ...startParams };
  let bestEval = scoreFn(best);
  let improved = true;
  let passes = 0;
  while (improved && passes < 4) {
    improved = false;
    passes += 1;
    for (const [param, candidates] of Object.entries(SEARCH_GRID)) {
      for (const value of candidates) {
        if (best[param] === value) continue;
        const trial = { ...best, [param]: value };
        const trialEval = scoreFn(trial);
        // Prefer higher accuracy; tie-break toward the larger sample coverage.
        if (
          trialEval.accuracy > bestEval.accuracy + 1e-9 ||
          (Math.abs(trialEval.accuracy - bestEval.accuracy) < 1e-9 && trialEval.sample > bestEval.sample)
        ) {
          best = trial;
          bestEval = trialEval;
          improved = true;
        }
      }
    }
  }
  return { params: best, evaluation: bestEval, passes };
}

module.exports = {
  getTuning,
  saveTuning,
  searchBestParams,
  DEFAULT_TUNING,
  SEARCH_GRID,
  TUNING_PATH,
};
