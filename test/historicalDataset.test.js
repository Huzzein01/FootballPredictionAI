"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { reconstructTrainingRows } = require("../src/baseballModel/historicalDataset");

test("historical reconstruction only uses games before each first pitch", () => {
  const rows = reconstructTrainingRows([
    { gamePk: 1, gameType: "R", completed: true, firstPitchUtc: "2024-04-01T18:00:00Z", homeTeam: "A", awayTeam: "B", homeRuns: 6, awayRuns: 2 },
    { gamePk: 2, gameType: "R", completed: true, firstPitchUtc: "2024-04-02T18:00:00Z", homeTeam: "A", awayTeam: "C", homeRuns: 1, awayRuns: 3 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].snapshot.home.games, 0);
  assert.equal(rows[1].snapshot.home.games, 1);
  assert.equal(rows[1].snapshot.home.runsForPerGame, 6);
  assert.equal(rows[1].homeRuns, 1);
  assert.equal(rows[1].snapshot.homeRuns, undefined);
  assert.equal(rows[1].snapshot.provenance.cutoff, "strictly-before-first-pitch");
});
