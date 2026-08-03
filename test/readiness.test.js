"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assessPredictionReadiness, assertPredictionReady } = require("../src/baseballModel/readiness");

function snapshot(quality = "known") {
  const stamp = { value: {}, source: "test", observedAt: "2026-04-01T16:00:00Z", availableAt: "2026-04-01T16:00:00Z", quality };
  return { contract: "mlb-pregame-feature-store-v1", gameId: "mlb:1", homeTeam: "Home", awayTeam: "Away", capturedAt: "2026-04-01T17:00:00Z", firstPitchUtc: "2026-04-01T18:00:00Z", features: { teamForm: stamp, startingPitchers: stamp, bullpen: stamp, lineup: stamp, park: stamp, weather: stamp, travelRest: stamp, gameStatus: stamp } };
}

test("prediction readiness blocks unknown and partial feature groups", () => {
  const incomplete = snapshot();
  incomplete.features.bullpen = { ...incomplete.features.bullpen, quality: "unknown" };
  incomplete.features.park = { ...incomplete.features.park, quality: "partial" };
  assert.deepEqual(assessPredictionReadiness(incomplete).unavailable, ["bullpen", "park"]);
  assert.throws(() => assertPredictionReady(incomplete), /not prediction-ready/);
});

test("prediction readiness accepts a complete pregame snapshot", () => {
  assert.equal(assertPredictionReady(snapshot()).ready, true);
});
