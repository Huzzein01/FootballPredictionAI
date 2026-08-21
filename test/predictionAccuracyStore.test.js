"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const store = require("../src/sharedSportModel/predictionAccuracyStore");

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "prediction-accuracy-test-"));
}

function forecastGame(overrides = {}) {
  return {
    gameId: "nba:1", date: "2026-08-20", homeTeam: "A", awayTeam: "B",
    pick: { team: "A", side: "home", probability: 0.6 },
    prediction: { probabilities: { homeWin: 0.6 } },
    oddsAvailable: false,
    ...overrides,
  };
}

test("records a prediction once and never overwrites it on a later request", () => {
  const root = tempRoot();
  const added = store.recordPredictions("basketball", [forecastGame()], root);
  assert.equal(added, 1);

  // A later request for the same game with a wildly different pick (as if
  // the model changed its mind closer to game time) must NOT replace the
  // originally recorded prediction — that would let the tracker grade a
  // different, possibly easier, prediction than what a user actually saw.
  const secondAdd = store.recordPredictions("basketball", [forecastGame({ pick: { team: "B", side: "away", probability: 0.95 } })], root);
  assert.equal(secondAdd, 0);
  const [stored] = store.readStore("basketball", root).predictions;
  assert.equal(stored.pick, "A");
  assert.equal(stored.pickProbability, 0.6);
});

test("settles a recorded prediction once its game completes and grades it correctly", () => {
  const root = tempRoot();
  store.recordPredictions("basketball", [forecastGame()], root);
  const settledCount = store.settleFromResults("basketball", [
    { id: "nba:1", homeTeam: "A", awayTeam: "B", homeScore: 100, awayScore: 90, completed: true },
  ], root);
  assert.equal(settledCount, 1);
  const summary = store.summary("basketball", root);
  assert.equal(summary.totalRecorded, 1);
  assert.equal(summary.settled, 1);
  assert.equal(summary.correct, 1);
  assert.equal(summary.accuracy, 1);
  assert.ok(Number.isFinite(summary.logLoss));
  assert.ok(Number.isFinite(summary.brier));
});

test("grades an incorrect pick as a miss without touching pending predictions", () => {
  const root = tempRoot();
  store.recordPredictions("basketball", [
    forecastGame({ gameId: "nba:1", pick: { team: "A", side: "home", probability: 0.6 } }),
    forecastGame({ gameId: "nba:2", homeTeam: "C", awayTeam: "D", pick: { team: "C", side: "home", probability: 0.55 } }),
  ], root);
  store.settleFromResults("basketball", [
    // A was predicted to win but B actually won — a miss.
    { id: "nba:1", homeTeam: "A", awayTeam: "B", homeScore: 90, awayScore: 100, completed: true },
  ], root);
  const summary = store.summary("basketball", root);
  assert.equal(summary.settled, 1, "nba:2 has no result yet and must stay pending");
  assert.equal(summary.pending, 1);
  assert.equal(summary.correct, 0);
  assert.equal(summary.accuracy, 0);
});
