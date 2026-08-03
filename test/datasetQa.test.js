"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeDataset } = require("../src/baseballModel/datasetQa");

function row(gameId, capturedAt = "2025-04-01T17:59:00Z") {
  return {
    snapshot: {
      gameId,
      firstPitchUtc: "2025-04-01T18:00:00Z",
      capturedAt,
      homeTeam: "Home",
      awayTeam: "Away",
      home: {}, away: {}, park: {}, weather: {},
    },
    homeRuns: 4,
    awayRuns: 3,
  };
}

test("dataset QA accepts a strict pregame dataset", () => {
  const report = summarizeDataset({ datasetContract: "historical-pregame-v1", seasons: [2025], rowCount: 1, rows: [row("mlb:1")] });
  assert.equal(report.valid, true);
  assert.deepEqual(report.observedSeasons, [2025]);
});

test("dataset QA rejects duplicate, leaked, and incomplete rows", () => {
  const leaked = row("mlb:1", "2025-04-01T18:00:00Z");
  leaked.snapshot.homeRuns = 4;
  const incomplete = { ...row("mlb:1"), awayRuns: null };
  const report = summarizeDataset({ rowCount: 3, rows: [row("mlb:1"), leaked, incomplete] });
  assert.equal(report.valid, false);
  assert.equal(report.duplicateGameIds.length, 1);
  assert.equal(report.nonStrictSnapshots, 1);
  assert.equal(report.missingScores, 1);
  assert.ok(report.schemaViolationCount > 0);
});
