"use strict";

const { assertTrainingRow, assertPregameSnapshot } = require("./schema");
const { vector, FEATURE_NAMES } = require("./features");
const { fitRidge, chooseAlpha } = require("./regression");
const { simulateGame, blendMarketProbability } = require("./simulation");

function variance(values, fallback) { if (values.length < 2) return fallback; const average = values.reduce((sum, value) => sum + value, 0) / values.length; return Math.max(fallback, values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length); }

function trainBaseballModel(rows) {
  rows.forEach(assertTrainingRow);
  const homeSelection = chooseAlpha(rows, "homeRuns", vector);
  const awaySelection = chooseAlpha(rows, "awayRuns", vector);
  const homeModel = fitRidge(rows.map((row) => vector(row.snapshot)), rows.map((row) => Number(row.homeRuns)), homeSelection.alpha);
  const awayModel = fitRidge(rows.map((row) => vector(row.snapshot)), rows.map((row) => Number(row.awayRuns)), awaySelection.alpha);
  const homeResiduals = rows.map((row) => Number(row.homeRuns) - homeModel.predict(vector(row.snapshot)));
  const awayResiduals = rows.map((row) => Number(row.awayRuns) - awayModel.predict(vector(row.snapshot)));
  return { version: 1, sport: "baseball", featureNames: FEATURE_NAMES, trainedAt: new Date().toISOString(), selection: { home: homeSelection, away: awaySelection }, homeModel, awayModel, residualVariance: { home: variance(homeResiduals, 4), away: variance(awayResiduals, 4) } };
}

function predictBaseballGame(model, snapshot, { odds, marketWeight = 0.2 } = {}) {
  assertPregameSnapshot(snapshot);
  const features = vector(snapshot);
  const homeRuns = Math.max(0.1, model.homeModel.predict(features));
  const awayRuns = Math.max(0.1, model.awayModel.predict(features));
  const simulation = simulateGame({ homeRuns, awayRuns, homeVariance: model.residualVariance.home, awayVariance: model.residualVariance.away });
  return { homeTeam: snapshot.homeTeam, awayTeam: snapshot.awayTeam, expectedRuns: { home: homeRuns, away: awayRuns }, model: simulation, calibrated: { ...simulation, homeWinProbability: blendMarketProbability(simulation.homeWinProbability, odds, marketWeight) }, oddsUsed: Boolean(odds?.homeDecimal && odds?.awayDecimal) };
}

module.exports = { trainBaseballModel, predictBaseballGame };
