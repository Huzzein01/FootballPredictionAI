"use strict";

const { assertTrainingRow, assertPregameSnapshot } = require("./schema");
const { vector, FEATURE_NAMES } = require("./features");
const { fitRidge } = require("../baseballModel/regression");
const { simulateGame } = require("../baseballModel/simulation");
const { noVigMoneyline } = require("../baseballModel/odds");
const { applyCalibration } = require("../baseballModel/calibration");

function mean(values) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function variance(values, fallback) { if (values.length < 2) return fallback; const average = mean(values); return Math.max(fallback, values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length); }
function covariance(left, right) { const leftMean = mean(left), rightMean = mean(right); return left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0) / Math.max(1, left.length); }
function seedFor(model, snapshot) { let hash = 2166136261; const input = `${model.version}:${model.featureVersion}:${snapshot.gameId}:${snapshot.capturedAt}`; for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }

// Local chronological CV keyed on kickoffUtc — baseballModel/regression.js's
// chooseAlpha hardcodes firstPitchUtc, so basketball/football need their own
// thin copy rather than forcing a shared field name across sports.
function chronologicalFolds(rows, folds = 4) {
  const ordered = [...rows].sort((a, b) => Date.parse(a.snapshot.kickoffUtc) - Date.parse(b.snapshot.kickoffUtc));
  const start = Math.max(8, Math.floor(ordered.length / (folds + 1)));
  const result = [];
  const minTestRows = Math.max(8, Math.floor(start / 10));
  for (let split = start; split < ordered.length;) {
    while (split < ordered.length && ordered[split - 1].snapshot.kickoffUtc === ordered[split].snapshot.kickoffUtc) split += 1;
    let end = Math.min(split + start, ordered.length);
    while (end < ordered.length && ordered[end - 1].snapshot.kickoffUtc === ordered[end].snapshot.kickoffUtc) end += 1;
    const test = ordered.slice(split, end);
    if (test.length < minTestRows) break;
    result.push({ train: ordered.slice(0, split), test });
    split = end;
  }
  return result;
}

function chooseAlpha(rows, target, candidates = [0, 0.1, 1, 5, 20]) {
  const folds = chronologicalFolds(rows);
  if (!folds.length) return { alpha: 1, validationMae: null };
  const scored = candidates.map((alpha) => {
    const errors = [];
    folds.forEach(({ train, test }) => {
      const model = fitRidge(train.map((row) => vector(row.snapshot)), train.map((row) => Number(row[target])), alpha);
      test.forEach((row) => errors.push(Math.abs(model.predict(vector(row.snapshot)) - Number(row[target]))));
    });
    return { alpha, validationMae: mean(errors) };
  });
  return scored.sort((a, b) => a.validationMae - b.validationMae)[0];
}

function trainBasketballModel(rows) {
  rows.forEach(assertTrainingRow);
  const homeSelection = chooseAlpha(rows, "homeScore");
  const awaySelection = chooseAlpha(rows, "awayScore");
  const homeModel = fitRidge(rows.map((row) => vector(row.snapshot)), rows.map((row) => Number(row.homeScore)), homeSelection.alpha);
  const awayModel = fitRidge(rows.map((row) => vector(row.snapshot)), rows.map((row) => Number(row.awayScore)), awaySelection.alpha);
  const homeResiduals = rows.map((row) => Number(row.homeScore) - homeModel.predict(vector(row.snapshot)));
  const awayResiduals = rows.map((row) => Number(row.awayScore) - awayModel.predict(vector(row.snapshot)));
  return { version: 1, featureVersion: "basketball-pregame-features-v1", sport: "basketball", featureNames: FEATURE_NAMES, trainedAt: new Date().toISOString(), selection: { home: homeSelection, away: awaySelection }, homeModel, awayModel, residualVariance: { home: variance(homeResiduals, 100), away: variance(awayResiduals, 100) }, residualCovariance: covariance(homeResiduals, awayResiduals) };
}

function predictBasketballGame(model, snapshot, { odds, marketCalibration } = {}) {
  assertPregameSnapshot(snapshot);
  const features = vector(snapshot);
  const homePoints = Math.max(60, model.homeModel.predict(features));
  const awayPoints = Math.max(60, model.awayModel.predict(features));
  const sharedVariance = Math.max(0, Math.min(0.75, Number(model.residualCovariance || 0) / Math.max(1, homePoints * awayPoints)));
  const seed = seedFor(model, snapshot);
  const simulation = simulateGame({ homeRuns: homePoints, awayRuns: awayPoints, homeVariance: model.residualVariance.home, awayVariance: model.residualVariance.away, sharedVariance, seed });
  const modelOnlyProbability = applyCalibration(simulation.homeWinProbability, marketCalibration);
  const market = noVigMoneyline(odds);
  const canBlend = Boolean(market && marketCalibration?.validated && Number.isFinite(marketCalibration.weight));
  const blendedProbability = canBlend ? modelOnlyProbability * (1 - marketCalibration.weight) + market.homeProbability * marketCalibration.weight : modelOnlyProbability;
  return { predictionVersion: "basketball-score-distribution-v1", modelVersion: model.version, featureVersion: model.featureVersion, predictionSeed: seed, homeTeam: snapshot.homeTeam, awayTeam: snapshot.awayTeam, expectedPoints: { home: homePoints, away: awayPoints }, model: simulation, probabilities: { modelOnlyHomeWin: modelOnlyProbability, marketHomeWin: market?.homeProbability ?? null, blendedHomeWin: blendedProbability, marketBlendApplied: canBlend }, calibrated: { ...simulation, homeWinProbability: blendedProbability }, market: market ? { ...market, source: odds?.source || "unattributed" } : null, oddsUsed: Boolean(market) };
}

module.exports = { trainBasketballModel, predictBasketballGame };
