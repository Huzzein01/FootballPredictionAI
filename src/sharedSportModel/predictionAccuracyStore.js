"use strict";

// Live prediction-accuracy tracker for baseball/basketball/American
// football. baseballModel/productionService.js already has an elaborate
// create/settle/monitoring system, but it depends on a separate manual
// snapshot-capture pipeline (collectPregameFeatures) that the live
// Predictions tab never actually calls — forecastBoard() is the real
// pathway, so that system stays permanently empty in production. This
// module instead records straight off forecastBoard()'s own output on
// every request, so it reflects what users actually see.
const path = require("path");
const { mutableDataPath, readJsonWithFallback, writeJson } = require("../runtimePaths");

// Every exported function takes an optional trailing `root` directory,
// matching the test-isolation convention baseballModel/productionService.js
// etc. already use (fs.mkdtempSync + a root param).
function storePath(sport, root) {
  const fileName = `${sport.replace(/-/g, "_")}_prediction_accuracy.json`;
  return root ? path.join(root, fileName) : mutableDataPath(fileName);
}

function readStore(sport, root) {
  return readJsonWithFallback(storePath(sport, root), null, { predictions: [] });
}

function writeStore(sport, store, root) {
  writeJson(storePath(sport, root), store);
}

// Upserts every prediction forecastBoard() just returned, keyed by gameId.
// A game's prediction is captured once and never overwritten by a later
// request for the same game — re-predicting a game as its scheduled date
// approaches would let the tracker quietly grade a different, easier
// prediction than the one a user actually saw first.
function recordPredictions(sport, predictions, root) {
  const store = readStore(sport, root);
  const byId = new Map(store.predictions.map((entry) => [entry.gameId, entry]));
  let added = 0;
  for (const game of predictions || []) {
    if (!game?.gameId || byId.has(game.gameId)) continue;
    byId.set(game.gameId, {
      gameId: game.gameId,
      date: game.date,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      predictedAt: new Date().toISOString(),
      pick: game.pick?.team || null,
      pickProbability: Number.isFinite(Number(game.pick?.probability)) ? Number(game.pick.probability) : null,
      homeWinProbability: Number.isFinite(Number(game.prediction?.probabilities?.homeWin)) ? Number(game.prediction.probabilities.homeWin) : null,
      oddsAvailable: Boolean(game.oddsAvailable),
      settled: false,
      correct: null,
      actualWinner: null,
      settledAt: null,
    });
    added += 1;
  }
  if (added) {
    store.predictions = [...byId.values()];
    writeStore(sport, store, root);
  }
  return added;
}

// Same matching pattern as parlayLedgerStore's autoSettleFromResults —
// settles any recorded prediction whose game has since completed.
function settleFromResults(sport, games, root) {
  const store = readStore(sport, root);
  const winnerByGameId = new Map();
  for (const game of games || []) {
    if (!game.completed || !Number.isFinite(Number(game.homeScore)) || !Number.isFinite(Number(game.awayScore))) continue;
    winnerByGameId.set(game.id, Number(game.homeScore) > Number(game.awayScore) ? game.homeTeam : game.awayTeam);
  }
  let settledCount = 0;
  for (const prediction of store.predictions) {
    if (prediction.settled) continue;
    const winner = winnerByGameId.get(prediction.gameId);
    if (!winner) continue;
    prediction.settled = true;
    prediction.actualWinner = winner;
    prediction.correct = winner === prediction.pick;
    prediction.settledAt = new Date().toISOString();
    settledCount += 1;
  }
  if (settledCount) writeStore(sport, store, root);
  return settledCount;
}

function summary(sport, root) {
  const predictions = readStore(sport, root).predictions;
  const settled = predictions.filter((entry) => entry.settled);
  const correct = settled.filter((entry) => entry.correct).length;
  const scoreable = settled.filter((entry) => Number.isFinite(entry.homeWinProbability));
  const clampedProb = (value) => Math.max(0.01, Math.min(0.99, value));
  const logLoss = scoreable.length
    ? scoreable.reduce((sum, entry) => {
      const actualHomeWin = entry.actualWinner === entry.homeTeam ? 1 : 0;
      const probability = clampedProb(entry.homeWinProbability);
      return sum - Math.log(actualHomeWin ? probability : 1 - probability);
    }, 0) / scoreable.length
    : null;
  const brier = scoreable.length
    ? scoreable.reduce((sum, entry) => {
      const actualHomeWin = entry.actualWinner === entry.homeTeam ? 1 : 0;
      return sum + (actualHomeWin - entry.homeWinProbability) ** 2;
    }, 0) / scoreable.length
    : null;
  return {
    totalRecorded: predictions.length,
    settled: settled.length,
    pending: predictions.length - settled.length,
    correct,
    accuracy: settled.length ? correct / settled.length : null,
    logLoss,
    brier,
  };
}

module.exports = { recordPredictions, settleFromResults, summary, readStore };
