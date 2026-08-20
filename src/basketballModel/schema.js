"use strict";

// Leakage-guard contract for the NBA model — mirrors src/baseballModel/schema.js
// and src/americanFootballModel/schema.js so all three sports share the same
// pregame-snapshot discipline.
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
  if (!snapshot || typeof snapshot !== "object") throw new Error("A basketball pregame snapshot is required");
  for (const key of REQUIRED) if (!snapshot[key]) throw new Error(`Snapshot is missing ${key}`);
  const capturedAt = toTime(snapshot.capturedAt);
  const kickoff = toTime(snapshot.kickoffUtc);
  if (!Number.isFinite(capturedAt) || !Number.isFinite(kickoff)) throw new Error("Snapshot timestamps must be ISO dates");
  if (capturedAt > kickoff) throw new Error("Post-tipoff data cannot be used for a pregame prediction");
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
