"use strict";

// A snapshot is the only permitted input to the baseball model. It is frozen
// before first pitch, which makes leakage checks enforceable rather than a
// convention hidden in an ingestion script.
const REQUIRED = ["gameId", "firstPitchUtc", "capturedAt", "homeTeam", "awayTeam"];
const POSTGAME_KEYS = new Set(["homeRuns", "awayRuns", "finalScore", "winner", "innings", "result"]);

function toTime(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : NaN;
}

function isFiniteScore(value) {
  return value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value));
}

function assertPregameSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("A baseball pregame snapshot is required");
  for (const key of REQUIRED) if (!snapshot[key]) throw new Error(`Snapshot is missing ${key}`);
  const capturedAt = toTime(snapshot.capturedAt);
  const firstPitch = toTime(snapshot.firstPitchUtc);
  if (!Number.isFinite(capturedAt) || !Number.isFinite(firstPitch)) throw new Error("Snapshot timestamps must be ISO dates");
  if (capturedAt > firstPitch) throw new Error("Post-first-pitch data cannot be used for a pregame prediction");
  for (const key of POSTGAME_KEYS) if (snapshot[key] != null) throw new Error(`Post-game field is not allowed in a pregame snapshot: ${key}`);
  return true;
}

function assertTrainingRow(row) {
  assertPregameSnapshot(row.snapshot);
  if (!isFiniteScore(row.homeRuns) || !isFiniteScore(row.awayRuns)) {
    throw new Error("Training rows require settled homeRuns and awayRuns outside the snapshot");
  }
  return true;
}

module.exports = { assertPregameSnapshot, assertTrainingRow };
