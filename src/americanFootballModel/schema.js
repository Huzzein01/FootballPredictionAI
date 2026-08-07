"use strict";

// Skeleton contract for the American Football (NFL) model — mirrors the
// leakage-guard pattern used by src/baseballModel/schema.js. No model is
// trained yet; this defines the shape future training/prediction code must
// respect once historical game data and features are imported.

const REQUIRED = ["gameId", "kickoffUtc", "capturedAt", "homeTeam", "awayTeam"];
const POSTGAME_KEYS = new Set(["homeScore", "awayScore", "winner", "quarterScores", "result"]);

function toTime(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : NaN;
}

function isFiniteScore(value) {
  return value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value));
}

function assertPregameSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("An American Football pregame snapshot is required");
  for (const key of REQUIRED) if (!snapshot[key]) throw new Error(`Snapshot is missing ${key}`);
  const capturedAt = toTime(snapshot.capturedAt);
  const kickoff = toTime(snapshot.kickoffUtc);
  if (!Number.isFinite(capturedAt) || !Number.isFinite(kickoff)) throw new Error("Snapshot timestamps must be ISO dates");
  if (capturedAt > kickoff) throw new Error("Post-kickoff data cannot be used for a pregame prediction");
  for (const key of POSTGAME_KEYS) if (snapshot[key] != null) throw new Error(`Post-game field is not allowed in a pregame snapshot: ${key}`);
  return true;
}

function assertTrainingRow(row) {
  assertPregameSnapshot(row.snapshot);
  if (!isFiniteScore(row.homeScore) || !isFiniteScore(row.awayScore)) {
    throw new Error("Training rows require settled homeScore and awayScore outside the snapshot");
  }
  return true;
}

module.exports = { assertPregameSnapshot, assertTrainingRow, REQUIRED, POSTGAME_KEYS };
