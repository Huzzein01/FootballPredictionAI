"use strict";

const { assertTrainingRow } = require("./schema");

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function isFiniteScore(value) {
  return value !== null && value !== "" && value !== undefined && Number.isFinite(Number(value));
}

function summarizeDataset(dataset) {
  const rows = Array.isArray(dataset) ? dataset : dataset?.rows;
  if (!Array.isArray(rows)) throw new Error("Dataset must be an array of training rows or an object with rows");

  const seenGameIds = new Set();
  const duplicateGameIds = new Set();
  const violations = [];
  const seasons = new Set();
  let missingScores = 0;
  let missingTimestamps = 0;
  let nonStrictSnapshots = 0;

  rows.forEach((row, index) => {
    const snapshot = row?.snapshot || {};
    const firstPitch = timestamp(snapshot.firstPitchUtc);
    const capturedAt = timestamp(snapshot.capturedAt);
    const gameId = snapshot.gameId || "";

    if (gameId && seenGameIds.has(gameId)) duplicateGameIds.add(gameId);
    if (gameId) seenGameIds.add(gameId);
    if (firstPitch) seasons.add(new Date(firstPitch).getUTCFullYear());
    if (!isFiniteScore(row?.homeRuns) || !isFiniteScore(row?.awayRuns)) missingScores += 1;
    if (firstPitch === null || capturedAt === null) missingTimestamps += 1;
    if (firstPitch !== null && capturedAt !== null && capturedAt >= firstPitch) nonStrictSnapshots += 1;

    try {
      assertTrainingRow(row);
    } catch (error) {
      violations.push({ index, gameId, error: error.message });
    }
  });

  const declaredSeasons = Array.isArray(dataset?.seasons) ? dataset.seasons.map(Number).sort((a, b) => a - b) : [];
  const observedSeasons = [...seasons].sort((a, b) => a - b);
  const rowCountMatches = !Number.isFinite(Number(dataset?.rowCount)) || Number(dataset.rowCount) === rows.length;
  const errors = [
    ...(rowCountMatches ? [] : [`Declared rowCount ${dataset.rowCount} does not match ${rows.length} rows`]),
    ...(duplicateGameIds.size ? [`${duplicateGameIds.size} duplicate game ID(s)`] : []),
    ...(missingScores ? [`${missingScores} row(s) with missing final scores`] : []),
    ...(missingTimestamps ? [`${missingTimestamps} row(s) with invalid timestamps`] : []),
    ...(nonStrictSnapshots ? [`${nonStrictSnapshots} snapshot(s) not captured strictly before first pitch`] : []),
    ...violations.map((violation) => `Row ${violation.index} (${violation.gameId || "unknown game"}): ${violation.error}`),
  ];

  return {
    reportVersion: "baseball-dataset-qa-v1",
    valid: errors.length === 0,
    contract: dataset?.datasetContract || null,
    rowCount: rows.length,
    declaredRowCount: dataset?.rowCount ?? null,
    declaredSeasons,
    observedSeasons,
    duplicateGameIds: [...duplicateGameIds].sort(),
    missingScores,
    missingTimestamps,
    nonStrictSnapshots,
    schemaViolationCount: violations.length,
    errors,
  };
}

module.exports = { summarizeDataset };
