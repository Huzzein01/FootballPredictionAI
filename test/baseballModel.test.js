"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertPregameSnapshot } = require("../src/baseballModel/schema");
const { trainBaseballModel, predictBaseballGame } = require("../src/baseballModel/pipeline");

function snapshot(index) {
  return { gameId: `mlb:${index}`, firstPitchUtc: `2025-0${(index % 8) + 1}-15T23:00:00Z`, capturedAt: `2025-0${(index % 8) + 1}-15T18:00:00Z`, homeTeam: "Home", awayTeam: "Away", home: { offenseRating: 100 + index, startingPitcherRating: 90, bullpenRating: 95, lineupRating: 100, restDays: 1 }, away: { offenseRating: 90, startingPitcherRating: 100, bullpenRating: 100, lineupRating: 95, restDays: 1 }, park: { runFactor: 1 }, weather: { temperatureF: 70, windOutMph: 4 } };
}

test("rejects post-first-pitch information", () => {
  assert.throws(() => assertPregameSnapshot({ ...snapshot(1), capturedAt: "2025-02-16T01:00:00Z" }), /Post-first-pitch/);
  assert.throws(() => assertPregameSnapshot({ ...snapshot(1), homeRuns: 5 }), /Post-game field/);
});

test("trains and produces calibrated baseball probabilities", () => {
  const rows = Array.from({ length: 18 }, (_, index) => ({ snapshot: snapshot(index), homeRuns: 3 + (index % 4), awayRuns: 2 + (index % 3) }));
  const model = trainBaseballModel(rows);
  const prediction = predictBaseballGame(model, snapshot(22), { odds: { homeDecimal: 1.9, awayDecimal: 2.0 } });
  assert.equal(model.sport, "baseball");
  assert.equal(prediction.oddsUsed, true);
  assert.ok(prediction.calibrated.homeWinProbability > 0 && prediction.calibrated.homeWinProbability < 1);
  assert.ok(prediction.expectedRuns.home > 0);
});
