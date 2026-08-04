"use strict";

const { validateHistory } = require("./schema");

function snapshotFor(record, cutoff, { lookback = 20 } = {}) {
  const check = validateHistory(record, { asOf: cutoff });
  if (!check.valid) throw new Error(`Invalid history for ${record?.team?.slug}: ${check.errors.join("; ")}`);
  const prior = record.matches.filter((match) => match.date < cutoff).slice(-lookback);
  if (!prior.length) return null;
  const wins = prior.filter((match) => match.result === "W").length;
  const draws = prior.filter((match) => match.result === "D").length;
  const goalsFor = prior.reduce((total, match) => total + match.score.for, 0);
  const goalsAgainst = prior.reduce((total, match) => total + match.score.against, 0);
  return { contract: "football-team-pregame-snapshot-v1", team: record.team, cutoff, historyEnd: prior.at(-1).date, matchesUsed: prior.length, features: { winRate: wins / prior.length, drawRate: draws / prior.length, goalsForPerMatch: goalsFor / prior.length, goalsAgainstPerMatch: goalsAgainst / prior.length, recentCompetitionCount: new Set(prior.map((match) => match.competition.name)).size }, provenance: prior.map((match) => match.id) };
}
module.exports = { snapshotFor };
