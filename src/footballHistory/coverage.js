"use strict";
const fs = require("fs");
const { historyDir, readHistory } = require("./store");
const { MIN_YEAR } = require("./schema");

function coverageReport() {
  const files = fs.readdirSync(historyDir()).filter((file) => file.endsWith(".json") && file !== "_index.json");
  const records = files.map((file) => readHistory(file.slice(0, -5))).filter((record) => record?.contract === "football-team-history-v1");
  const withHistoricCoverage = records.filter((record) => {
    const earliest = record.coverage?.earliestMatch || "";
    const year = Number(earliest.slice(0, 4));
    return /^\d{4}-\d{2}-\d{2}$/.test(earliest) && Number.isFinite(year) && year <= MIN_YEAR;
  });
  const matchCount = records.reduce((total, record) => total + (record.matches || []).length, 0);
  const sourceCoverage = records.filter((record) => (record.sourcePlan || []).length >= 5).length;
  const verifiedCompetitionScope = records.filter((record) => record.coverage?.competitionScopeVerified).length;
  const completeSeasonCoverage = records.filter((record) => (record.coverage?.missingSeasons || []).length === 0).length;
  return {
    reportVersion: "football-team-history-coverage-v1",
    requestedFromYear: MIN_YEAR,
    generatedAt: new Date().toISOString(),
    teamFiles: records.length,
    totalTeamMatchRows: matchCount,
    teamsWithFiveSourcePlans: sourceCoverage,
    teamsWithCoverageFrom1985: withHistoricCoverage.length,
    teamsWithEverySeasonCovered: completeSeasonCoverage,
    teamsWithVerifiedCompetitionScope: verifiedCompetitionScope,
    readyForFullHistoricalTraining: completeSeasonCoverage === records.length && verifiedCompetitionScope === records.length && records.length > 0,
    nextAction: "Run a timestamped external source collector, import its normalized artifacts, then rerun this report before training.",
    sampleGaps: records.filter((record) => record.coverage?.missingSeasons?.length).slice(0, 10).map((record) => ({ team: record.team.name, earliestMatch: record.coverage.earliestMatch, missingSeasonCount: record.coverage.missingSeasons.length })),
  };
}
module.exports = { coverageReport };
