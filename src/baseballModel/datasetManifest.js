"use strict";

const crypto = require("crypto");
const { summarizeDataset } = require("./datasetQa");

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function createDatasetManifest(dataset, { sourceVersions = {}, generatedAt = new Date().toISOString() } = {}) {
  const report = summarizeDataset(dataset);
  const rows = Array.isArray(dataset) ? dataset : dataset.rows || [];
  const firstPitches = rows.map((row) => row.snapshot?.firstPitchUtc).filter(Boolean).sort();
  const sources = [...new Set(rows.map((row) => row.snapshot?.provenance?.sourceUrl).filter(Boolean))].sort();
  return {
    contract: "baseball-dataset-manifest-v1",
    sport: "baseball",
    datasetContract: dataset.datasetContract || null,
    featureVersion: dataset.datasetContract || "unknown",
    generatedAt,
    datasetSha256: hash(dataset),
    timeRange: { firstPitchUtc: firstPitches[0] || null, lastPitchUtc: firstPitches.at(-1) || null },
    rowCount: rows.length,
    seasons: report.observedSeasons,
    sourceVersions: { ...sourceVersions, sourceUrls: sources },
    qa: { valid: report.valid, duplicateGameIds: report.duplicateGameIds.length, missingScores: report.missingScores, missingTimestamps: report.missingTimestamps, nonStrictSnapshots: report.nonStrictSnapshots, schemaViolationCount: report.schemaViolationCount },
  };
}

module.exports = { createDatasetManifest };
