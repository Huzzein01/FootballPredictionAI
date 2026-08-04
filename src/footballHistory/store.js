"use strict";

const fs = require("fs");
const path = require("path");
const { repoDataPath, ensureParent } = require("../runtimePaths");
const { slugifyTeam } = require("../teamResultsStore");
const { emptyHistory, seasonFromDate } = require("./schema");
const { sourcePlan } = require("./sources");

function historyDir() { return repoDataPath("teams", "history"); }
function historyPath(slug) { return path.join(historyDir(), `${slug}.json`); }
function readHistory(slug) { try { return JSON.parse(fs.readFileSync(historyPath(slug), "utf8")); } catch { return null; } }
function writeHistory(record) { ensureParent(historyPath(record.team.slug)); fs.writeFileSync(historyPath(record.team.slug), JSON.stringify(record, null, 2) + "\n"); }
function ensureHistory(team) {
  const slug = team.slug || slugifyTeam(team.team);
  const found = readHistory(slug);
  if (found) return { record: found, created: false };
  const record = emptyHistory({ ...team, slug });
  record.sourcePlan = sourcePlan(record.team);
  record.updatedAt = new Date().toISOString();
  writeHistory(record);
  return { record, created: true };
}
function rebuildCoverage(record) {
  const matches = record.matches || [];
  const dates = matches.map((match) => match.date).filter(Boolean).sort();
  const seasons = [...new Set(matches.map((match) => match.season || seasonFromDate(match.date)).filter(Boolean))].sort();
  const currentYear = new Date().getUTCFullYear();
  const expected = [];
  for (let year = 1985; year <= currentYear; year += 1) expected.push(`${year}-${String(year + 1).slice(-2)}`);
  record.coverage = { earliestMatch: dates[0] || "", latestMatch: dates.at(-1) || "", seasonsWithMatches: seasons, missingSeasons: expected.filter((season) => !seasons.includes(season)), competitionScopeVerified: Boolean(record.coverage?.competitionScopeVerified), status: dates[0] && Number(dates[0].slice(0, 4)) <= 1985 && record.coverage?.competitionScopeVerified ? "backfilled" : "partial" };
  return record;
}
module.exports = { historyDir, historyPath, readHistory, writeHistory, ensureHistory, rebuildCoverage };
