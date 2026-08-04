"use strict";

const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { observedParticipation } = require("../src/footballHistory/participation");
const { MIN_TRAINING_DATE } = require("../src/footballHistory/scope");

const through = process.argv.find((arg) => arg.startsWith("--through="))?.slice(10) || new Date().toISOString().slice(0, 10);
const records = fs.readdirSync(historyDir()).filter((file) => file.endsWith(".json") && !file.startsWith("_"))
  .map((file) => readHistory(path.basename(file, ".json"))).filter((record) => record?.contract === "football-team-history-v1");
const participation = records.flatMap((record) => observedParticipation(record, { through }).map((entry) => ({ team: record.team, ...entry })));
const byType = Object.entries(participation.reduce((total, entry) => {
  const key = entry.competition.type;
  total[key] = (total[key] || 0) + 1;
  return total;
}, {})).sort((a, b) => b[1] - a[1]).map(([competitionType, participationRows]) => ({ competitionType, participationRows }));
const noObservedParticipation = records.filter((record) => !observedParticipation(record, { through }).length)
  .map((record) => ({ team: record.team.name, slug: record.team.slug }));
console.log(JSON.stringify({
  reportVersion: "football-team-history-major-scope-v1",
  from: MIN_TRAINING_DATE,
  through,
  policy: "Observed entries prove only that a dated source records participation. They do not prove a team had no additional major competition appearances.",
  teamFiles: records.length,
  observedParticipationRows: participation.length,
  teamsWithObservedParticipation: records.length - noObservedParticipation.length,
  teamsNeedingParticipationResearch: noObservedParticipation.length,
  participationByCompetitionType: byType,
  sampleTeamsNeedingParticipationResearch: noObservedParticipation.slice(0, 30),
}, null, 2));
