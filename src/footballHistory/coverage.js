"use strict";
const fs = require("fs");
const { historyDir, readHistory } = require("./store");
const { MIN_YEAR } = require("./schema");
const { isDatedVerifiedMatch, isInScopeMatch } = require("./scope");

function coverageReport() {
  const files = fs.readdirSync(historyDir()).filter((file) => file.endsWith(".json") && file !== "_index.json");
  const records = files.map((file) => readHistory(file.slice(0, -5))).filter((record) => record?.contract === "football-team-history-v1");
  const withHistoricCoverage = records.filter((record) => {
    const earliest = record.coverage?.earliestMatch || "";
    const year = Number(earliest.slice(0, 4));
    return /^\d{4}-\d{2}-\d{2}$/.test(earliest) && Number.isFinite(year) && year <= MIN_YEAR;
  });
  const matchCount = records.reduce((total, record) => total + (record.matches || []).length, 0);
  const eligibleRecords = records.filter((record) => (record.matches || []).some((match) => isInScopeMatch(match)));
  const verifiedDatedRows = records.reduce((total, record) => total + (record.matches || []).filter((match) => isDatedVerifiedMatch(match)).length, 0);
  const inScopeRows = records.reduce((total, record) => total + (record.matches || []).filter((match) => isInScopeMatch(match)).length, 0);
  const sourceCoverage = records.filter((record) => (record.sourcePlan || []).length >= 5).length;
  const verifiedCompetitionScope = records.filter((record) => record.coverage?.competitionScopeVerified).length;
  const completeSeasonCoverage = records.filter((record) => /^\d{4}-\d{2}-\d{2}$/.test(record.coverage?.earliestMatch || "") && (record.coverage?.missingSeasons || []).length === 0).length;
  return {
    reportVersion: "football-team-history-coverage-v1",
    requestedFromYear: MIN_YEAR,
    generatedAt: new Date().toISOString(),
    teamFiles: records.length,
    totalTeamMatchRows: matchCount,
    verifiedDatedRowsFrom1985: verifiedDatedRows,
    majorScopeRowsEligibleForTraining: inScopeRows,
    teamsWithFiveSourcePlans: sourceCoverage,
    teamsWithCoverageFrom1985: withHistoricCoverage.length,
    teamsWithEverySeasonCovered: completeSeasonCoverage,
    teamsWithVerifiedCompetitionScope: verifiedCompetitionScope,
    teamsWithVerifiedRecordsEligibleForPartialTraining: eligibleRecords.length,
    // Partial training is intentionally independent from an aspirational
    // all-competitions/all-seasons completion gate.
    readyForPartialHistoricalTraining: inScopeRows > 0,
    readyForFullHistoricalTraining: completeSeasonCoverage === records.length && verifiedCompetitionScope === records.length && records.length > 0,
    nextAction: "Train only the verified dated rows from 1985 onward; continue source collection and participation verification before claiming complete historical coverage.",
    sampleGaps: records.filter((record) => record.coverage?.missingSeasons?.length).slice(0, 10).map((record) => ({ team: record.team.name, earliestMatch: record.coverage.earliestMatch, missingSeasonCount: record.coverage.missingSeasons.length })),
  };
}
module.exports = { coverageReport };
