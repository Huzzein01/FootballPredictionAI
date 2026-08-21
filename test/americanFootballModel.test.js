"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assertPregameSnapshot } = require("../src/americanFootballModel/schema");
const { trainAmericanFootballModel, predictAmericanFootballGame } = require("../src/americanFootballModel/pipeline");
const { forecastBoard } = require("../src/americanFootballModel/forecastService");
const { reconstructTrainingRows } = require("../src/americanFootballModel/historicalDataset");

function snapshot(index) {
  return {
    gameId: `nfl:${index}`,
    kickoffUtc: `2025-0${(index % 8) + 1}-15T18:00:00Z`,
    capturedAt: `2025-0${(index % 8) + 1}-13T18:00:00Z`,
    homeTeam: "Home", awayTeam: "Away",
    home: { offenseRating: 100 + index, defenseRating: 95, restDays: 7 },
    away: { offenseRating: 95, defenseRating: 100, restDays: 6 },
  };
}

test("rejects post-kickoff information", () => {
  assert.throws(() => assertPregameSnapshot({ ...snapshot(1), capturedAt: "2025-02-16T20:00:00Z" }), /Post-kickoff/);
  assert.throws(() => assertPregameSnapshot({ ...snapshot(1), homeScore: 24 }), /Post-game field/);
});

test("trains and produces calibrated NFL probabilities", () => {
  const rows = Array.from({ length: 18 }, (_, index) => ({ snapshot: snapshot(index), homeScore: 21 + (index % 14), awayScore: 17 + (index % 10) }));
  const model = trainAmericanFootballModel(rows);
  const prediction = predictAmericanFootballGame(model, snapshot(22), { odds: { homeDecimal: 1.9, awayDecimal: 2.0 } });
  assert.equal(model.sport, "americanFootball");
  assert.equal(prediction.oddsUsed, true);
  assert.ok(prediction.calibrated.homeWinProbability > 0 && prediction.calibrated.homeWinProbability < 1);
  assert.ok(prediction.expectedPoints.home > 0);
  assert.equal(prediction.predictionSeed, predictAmericanFootballGame(model, snapshot(22)).predictionSeed);
  assert.equal(prediction.probabilities.marketBlendApplied, false);
});

test("reconstructs leakage-safe training rows only from strictly earlier games", () => {
  const games = [
    { id: "nfl:1", date: "2026-09-07", kickoffUtc: "2026-09-07T18:00:00Z", homeTeam: "A", awayTeam: "B", homeScore: 27, awayScore: 20, completed: true },
    { id: "nfl:2", date: "2026-09-14", kickoffUtc: "2026-09-14T18:00:00Z", homeTeam: "B", awayTeam: "A", homeScore: 17, awayScore: 24, completed: true },
  ];
  const rows = reconstructTrainingRows(games);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].snapshot.home.offenseRating, 100);
  assert.notEqual(rows[1].snapshot.away.offenseRating, 100);
});

test("builds public forecast board with standings and season-end projections", () => {
  const seasonData = {
    games: [
      { id: "nfl:1", date: "2026-09-07", kickoffUtc: "2026-09-07T18:00:00Z", homeTeam: "Buffalo Bills", awayTeam: "Miami Dolphins", homeScore: 27, awayScore: 20, completed: true, status: "Final" },
      { id: "nfl:2", date: "2026-09-14", kickoffUtc: "2026-09-14T18:00:00Z", homeTeam: "Buffalo Bills", awayTeam: "Miami Dolphins", completed: false, status: "Scheduled" },
      { id: "nfl:3", date: "2026-09-21", kickoffUtc: "2026-09-21T18:00:00Z", homeTeam: "Miami Dolphins", awayTeam: "Buffalo Bills", completed: false, status: "Scheduled" },
    ],
  };
  const board = forecastBoard(seasonData, {
    now: new Date("2026-09-08T12:00:00Z"),
    limit: 1,
    oddsEvents: [{ date: "2026-09-14", homeTeam: "Buffalo Bills", awayTeam: "Miami Dolphins", provider: "Test odds", odds: { homeDecimal: "1.80", awayDecimal: "2.10" } }],
  });
  assert.equal(board.predictions.length, 1);
  assert.equal(board.summary.totalPredictions, 2);
  assert.equal(board.summary.gamesWithOdds, 1);
  assert.ok(board.predictions[0].prediction.expectedPoints.total > 0);
  assert.equal(board.predictions[0].oddsAvailable, true);
  const billsStanding = board.standings.find((row) => row.team === "Buffalo Bills");
  assert.equal(billsStanding.wins, 1);
  assert.equal(billsStanding.losses, 0);
  const billsProjection = board.projections.find((row) => row.team === "Buffalo Bills");
  assert.equal(billsProjection.gamesRemaining, 2);
  assert.ok(billsProjection.projectedWins >= 1);
});
