"use strict";

const { assertTrainingRow, assertPregameSnapshot } = require("./schema");
const { vector, FEATURE_NAMES } = require("./features");
const { fitRidge, chooseAlpha } = require("./regression");
const { simulateGame } = require("./simulation");
const { noVigMoneyline } = require("./odds");
const { applyCalibration } = require("./calibration");

function variance(values, fallback) { if (values.length < 2) return fallback; const average = values.reduce((sum, value) => sum + value, 0) / values.length; return Math.max(fallback, values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length); }
function covariance(left, right) { const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length; const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length; return left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0) / Math.max(1, left.length); }
function seedFor(model, snapshot) { let hash = 2166136261; const input = `${model.version}:${model.featureVersion}:${snapshot.gameId}:${snapshot.capturedAt}`; for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }

function trainBaseballModel(rows) {
  rows.forEach(assertTrainingRow);
  const homeSelection = chooseAlpha(rows, "homeRuns", vector);
  const awaySelection = chooseAlpha(rows, "awayRuns", vector);
  const homeModel = fitRidge(rows.map((row) => vector(row.snapshot)), rows.map((row) => Number(row.homeRuns)), homeSelection.alpha);
  const awayModel = fitRidge(rows.map((row) => vector(row.snapshot)), rows.map((row) => Number(row.awayRuns)), awaySelection.alpha);
  const homeResiduals = rows.map((row) => Number(row.homeRuns) - homeModel.predict(vector(row.snapshot)));
  const awayResiduals = rows.map((row) => Number(row.awayRuns) - awayModel.predict(vector(row.snapshot)));
  return { version: 2, featureVersion: "baseball-pregame-features-v1", sport: "baseball", featureNames: FEATURE_NAMES, trainedAt: new Date().toISOString(), selection: { home: homeSelection, away: awaySelection }, homeModel, awayModel, residualVariance: { home: variance(homeResiduals, 4), away: variance(awayResiduals, 4) }, residualCovariance: covariance(homeResiduals, awayResiduals) };
}

function predictBaseballGame(model, snapshot, { odds, marketCalibration, simulations = 20000, trackDistribution = true } = {}) {
  assertPregameSnapshot(snapshot);
  const features = vector(snapshot);
  const homeRuns = Math.max(0.1, model.homeModel.predict(features));
  const awayRuns = Math.max(0.1, model.awayModel.predict(features));
  const sharedVariance = Math.max(0, Math.min(0.75, Number(model.residualCovariance || 0) / Math.max(0.1, homeRuns * awayRuns)));
  const seed = seedFor(model, snapshot);
  const simulation = simulateGame({ homeRuns, awayRuns, homeVariance: model.residualVariance.home, awayVariance: model.residualVariance.away, sharedVariance, seed, simulations, trackDistribution });
  const modelOnlyProbability = applyCalibration(simulation.homeWinProbability, marketCalibration);
  const market = noVigMoneyline(odds);
  const canBlend = Boolean(market && marketCalibration?.validated && Number.isFinite(marketCalibration.weight));
  const blendedProbability = canBlend ? modelOnlyProbability * (1 - marketCalibration.weight) + market.homeProbability * marketCalibration.weight : modelOnlyProbability;
  return { predictionVersion: "baseball-score-distribution-v1", modelVersion: model.version, featureVersion: model.featureVersion, predictionSeed: seed, homeTeam: snapshot.homeTeam, awayTeam: snapshot.awayTeam, expectedRuns: { home: homeRuns, away: awayRuns }, model: simulation, probabilities: { modelOnlyHomeWin: modelOnlyProbability, marketHomeWin: market?.homeProbability ?? null, blendedHomeWin: blendedProbability, marketBlendApplied: canBlend }, calibrated: { ...simulation, homeWinProbability: blendedProbability }, market: market ? { ...market, source: odds?.source || "unattributed" } : null, oddsUsed: Boolean(market) };
}

module.exports = { trainBaseballModel, predictBaseballGame };
