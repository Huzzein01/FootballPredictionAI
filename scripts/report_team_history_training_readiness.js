"use strict";

const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { MIN_TRAINING_DATE, isInScopeMatch } = require("../src/footballHistory/scope");

const through = process.argv.find((arg) => arg.startsWith("--through="))?.slice(10) || new Date().toISOString().slice(0, 10);
const records = fs.readdirSync(historyDir())
  .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
  .map((file) => readHistory(path.basename(file, ".json")))
  .filter((record) => record?.contract === "football-team-history-v1");
const matches = records.flatMap((record) => (record.matches || []).map((match) => ({ ...match, team: record.team.name })))
  .filter((match) => isInScopeMatch(match, { through }));
const byType = Object.entries(matches.reduce((groups, match) => {
  const type = match.competition?.type || "unknown";
  groups[type] = (groups[type] || 0) + 1;
  return groups;
}, {})).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => ({ type, count }));
const byCountry = Object.entries(matches.reduce((groups, match) => {
  const country = match.competition?.country || "Unspecified";
  groups[country] = (groups[country] || 0) + 1;
  return groups;
}, {})).sort((a, b) => b[1] - a[1]).map(([country, count]) => ({ country, count }));
const dates = matches.map((match) => match.date).sort();
console.log(JSON.stringify({
  reportVersion: "football-team-history-training-readiness-v1",
  policy: "Use only verified, individually dated match records from 1985-01-01 through the requested cutoff. Missing seasons and undated archive entries are excluded, never inferred.",
  from: MIN_TRAINING_DATE,
  through,
  eligibleMatchPerspectives: matches.length,
  eligibleTeams: new Set(matches.map((match) => match.team)).size,
  earliestEligibleMatch: dates[0] || null,
  latestEligibleMatch: dates.at(-1) || null,
  readyForPartialHistoricalTraining: matches.length > 0,
  completeMajorCompetitionParticipationVerified: records.length > 0 && records.every((record) => record.coverage?.competitionScopeVerified),
  rowsByCompetitionType: byType,
  rowsByCountry: byCountry,
}, null, 2));
