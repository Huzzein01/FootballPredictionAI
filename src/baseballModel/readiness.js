"use strict";

const { assertPregameFeatureSnapshot } = require("./featureStore");

const REQUIRED_PREGAME_FEATURES = ["teamForm", "startingPitchers", "bullpen", "lineup", "park", "weather", "travelRest", "gameStatus"];

function assessPredictionReadiness(snapshot) {
  assertPregameFeatureSnapshot(snapshot);
  const unavailable = REQUIRED_PREGAME_FEATURES.filter((name) => {
    const feature = snapshot.features?.[name];
    return !feature || feature.quality !== "known";
  });
  return {
    ready: unavailable.length === 0,
    requiredFeatures: REQUIRED_PREGAME_FEATURES,
    unavailable,
    capturedAt: snapshot.capturedAt,
    firstPitchUtc: snapshot.firstPitchUtc,
  };
}

function assertPredictionReady(snapshot) {
  const assessment = assessPredictionReadiness(snapshot);
  if (!assessment.ready) throw new Error(`Pregame snapshot is not prediction-ready: ${assessment.unavailable.join(", ")}`);
  return assessment;
}

module.exports = { REQUIRED_PREGAME_FEATURES, assessPredictionReadiness, assertPredictionReady };
