"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatasetManifest } = require("../src/baseballModel/datasetManifest");

test("dataset manifest records coverage, source, and QA", () => {
  const dataset = { datasetContract: "historical-pregame-v1", rows: [{ snapshot: { gameId: "mlb:1", firstPitchUtc: "2025-04-01T18:00:00Z", capturedAt: "2025-04-01T17:00:00Z", homeTeam: "Home", awayTeam: "Away", provenance: { sourceUrl: "https://example.test/mlb" } }, homeRuns: 2, awayRuns: 1 }] };
  const manifest = createDatasetManifest(dataset, { generatedAt: "2026-01-01T00:00:00Z" });
  assert.equal(manifest.qa.valid, true);
  assert.equal(manifest.rowCount, 1);
  assert.deepEqual(manifest.sourceVersions.sourceUrls, ["https://example.test/mlb"]);
});
