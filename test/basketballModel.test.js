"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertPregameSnapshot } = require("../src/basketballModel/schema");
const { trainBasketballModel, predictBasketballGame } = require("../src/basketballModel/pipeline");
const { forecastBoard } = require("../src/basketballModel/forecastService");
const { reconstructTrainingRows } = require("../src/basketballModel/historicalDataset");

function snapshot(index) {
  return {
    gameId: `nba:${index}`,
    kickoffUtc: `2025-0${(index % 8) + 1}-15T23:00:00Z`,
    capturedAt: `2025-0${(index % 8) + 1}-15T18:00:00Z`,
    homeTeam: "Home", awayTeam: "Away",
    home: { offenseRating: 100 + index, defenseRating: 95, restDays: 2 },
    away: { offenseRating: 95, defenseRating: 100, restDays: 1 },
  };
}

test("rejects post-tipoff information", () => {
  assert.throws(() => assertPregameSnapshot({ ...snapshot(1), capturedAt: "2025-02-16T01:00:00Z" }), /Post-tipoff/);
  assert.throws(() => assertPregameSnapshot({ ...snapshot(1), homeScore: 110 }), /Post-game field/);
});

test("trains and produces calibrated basketball probabilities", () => {
  const rows = Array.from({ length: 18 }, (_, index) => ({ snapshot: snapshot(index), homeScore: 105 + (index % 15), awayScore: 100 + (index % 12) }));
  const model = trainBasketballModel(rows);
  const prediction = predictBasketballGame(model, snapshot(22), { odds: { homeDecimal: 1.9, awayDecimal: 2.0 } });
  assert.equal(model.sport, "basketball");
  assert.equal(prediction.oddsUsed, true);
  assert.ok(prediction.calibrated.homeWinProbability > 0 && prediction.calibrated.homeWinProbability < 1);
  assert.ok(prediction.expectedPoints.home > 0);
  assert.equal(prediction.predictionSeed, predictBasketballGame(model, snapshot(22)).predictionSeed);
  assert.equal(prediction.probabilities.marketBlendApplied, false);
  assert.equal(prediction.probabilities.blendedHomeWin, prediction.probabilities.modelOnlyHomeWin);
});

test("reconstructs leakage-safe training rows only from strictly earlier games", () => {
  const games = [
    { id: "nba:1", date: "2026-01-01", kickoffUtc: "2026-01-01T23:00:00Z", homeTeam: "A", awayTeam: "B", homeScore: 110, awayScore: 100, completed: true },
    { id: "nba:2", date: "2026-01-03", kickoffUtc: "2026-01-03T23:00:00Z", homeTeam: "B", awayTeam: "A", homeScore: 95, awayScore: 105, completed: true },
  ];
  const rows = reconstructTrainingRows(games);
  assert.equal(rows.length, 2);
  // The second row's snapshot must reflect team A's rating from ONLY the
  // first game (a 110-100 win) — team A's home offense rating from row 1
  // should be neutral (no prior games), while row 2's away-team (A) rating
  // must already be influenced by that first result.
  assert.equal(rows[0].snapshot.home.offenseRating, 100);
  assert.notEqual(rows[1].snapshot.away.offenseRating, 100);
});

test("builds public forecast board with standings and season-end projections", () => {
  const seasonData = {
    games: [
      { id: "nba:1", date: "2026-01-01", kickoffUtc: "2026-01-01T23:00:00Z", homeTeam: "Boston Celtics", awayTeam: "Miami Heat", homeScore: 110, awayScore: 100, completed: true, status: "Final" },
      { id: "nba:2", date: "2026-08-04", kickoffUtc: "2026-08-04T23:00:00Z", homeTeam: "Boston Celtics", awayTeam: "Miami Heat", completed: false, status: "Scheduled" },
      { id: "nba:3", date: "2026-08-05", kickoffUtc: "2026-08-05T23:00:00Z", homeTeam: "Miami Heat", awayTeam: "Boston Celtics", completed: false, status: "Scheduled" },
    ],
  };
  const board = forecastBoard(seasonData, {
    now: new Date("2026-08-04T12:00:00Z"),
    limit: 1,
    oddsEvents: [{ date: "2026-08-04", homeTeam: "Boston Celtics", awayTeam: "Miami Heat", provider: "Test odds", odds: { homeDecimal: "1.80", awayDecimal: "2.10" } }],
  });
  assert.equal(board.predictions.length, 1);
  assert.equal(board.summary.totalPredictions, 2);
  assert.equal(board.summary.gamesWithOdds, 1);
  assert.ok(board.predictions[0].prediction.expectedPoints.total > 0);
  assert.equal(board.predictions[0].oddsAvailable, true);
  const celticsStanding = board.standings.find((row) => row.team === "Boston Celtics");
  assert.equal(celticsStanding.wins, 1);
  assert.equal(celticsStanding.losses, 0);
  const celticsProjection = board.projections.find((row) => row.team === "Boston Celtics");
  assert.equal(celticsProjection.gamesRemaining, 2);
  assert.ok(celticsProjection.projectedWins >= 1);
});
