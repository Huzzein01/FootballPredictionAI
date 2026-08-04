"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertPregameSnapshot } = require("../src/baseballModel/schema");
const { trainBaseballModel, predictBaseballGame } = require("../src/baseballModel/pipeline");
const { forecastBoard } = require("../src/baseballModel/forecastService");

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
  assert.ok(Math.abs(prediction.model.scoreDistribution.reduce((sum, score) => sum + score.probability, 0) - 1) < 1e-10);
  assert.equal(prediction.predictionSeed, predictBaseballGame(model, snapshot(22)).predictionSeed);
  assert.equal(prediction.model.scoreDistribution[0].probability, predictBaseballGame(model, snapshot(22)).model.scoreDistribution[0].probability);
  assert.equal(prediction.probabilities.marketBlendApplied, false);
  assert.equal(prediction.probabilities.blendedHomeWin, prediction.probabilities.modelOnlyHomeWin);
});

test("builds public forecast board for upcoming MLB fixtures", () => {
  const seasonData = {
    games: [
      { id: "mlb:1", date: "2026-04-01", kickoffUtc: "2026-04-01T23:00:00Z", homeTeam: "Baltimore Orioles", awayTeam: "Los Angeles Angels", homeScore: 6, awayScore: 4, completed: true, status: "Final", venue: "Park" },
      { id: "mlb:2", date: "2026-08-04", kickoffUtc: "2026-08-04T23:00:00Z", homeTeam: "Baltimore Orioles", awayTeam: "Los Angeles Angels", completed: false, status: "Pre-Game", venue: "Park" },
      { id: "mlb:3", date: "2026-08-05", kickoffUtc: "2026-08-05T23:00:00Z", homeTeam: "Cincinnati Reds", awayTeam: "Athletics", completed: false, status: "Scheduled", venue: "Park" },
    ],
  };
  const board = forecastBoard(seasonData, {
    now: new Date("2026-08-04T12:00:00Z"),
    limit: 2,
    oddsEvents: [{ date: "2026-08-04", homeTeam: "Baltimore Orioles", awayTeam: "Los Angeles Angels", provider: "Test odds", odds: { homeDecimal: "1.80", awayDecimal: "2.10", homeOdds: "1.80", awayOdds: "2.10" } }],
  });
  assert.equal(board.predictions.length, 2);
  assert.equal(board.summary.totalPredictions, 2);
  assert.equal(board.summary.gamesWithOdds, 1);
  assert.equal(board.model.selectedVariant, "retrosheet-enriched");
  assert.ok(board.predictions[0].prediction.expectedRuns.total > 0);
  assert.equal(board.predictions[0].oddsAvailable, true);
  assert.ok(board.predictions[0].prediction.probabilities.homeWin > 0);
});
