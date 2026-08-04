"use strict";

const { slugifyTeam } = require("../teamResultsStore");
const { isInScopeMatch } = require("./scope");

function competitionKey(name) {
  const value = String(name || "").toLowerCase();
  if (value.includes("champion") || value.includes("european cup")) return "uefa-champions-league";
  if (value.includes("cup winners")) return "uefa-cup-winners-cup";
  if (value.includes("europa") || value.includes("uefa cup")) return "uefa-cup";
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function fixtureKey(row) {
  return [row.date, competitionKey(row.competition?.name), slugifyTeam(row.homeTeam), slugifyTeam(row.awayTeam)].join("|");
}

function fixtureRows(records, { through } = {}) {
  const fixtures = new Map();
  const conflicts = [];
  for (const record of records) for (const match of record.matches || []) {
    if (match.venue !== "home" || !isInScopeMatch(match, { through })) continue;
    const row = {
      date: match.date,
      season: match.season,
      competition: match.competition,
      stage: match.stage || "",
      homeTeam: record.team.name,
      awayTeam: match.opponent.name,
      homeScore: Number(match.score.for),
      awayScore: Number(match.score.against),
      sources: match.sources || [],
      sourceRef: match.sourceRef,
      matchIds: [match.id],
    };
    const key = fixtureKey(row);
    const existing = fixtures.get(key);
    if (!existing) { fixtures.set(key, row); continue; }
    if (existing.homeScore !== row.homeScore || existing.awayScore !== row.awayScore) {
      conflicts.push({ key, existing: { homeScore: existing.homeScore, awayScore: existing.awayScore, matchIds: existing.matchIds }, incoming: { homeScore: row.homeScore, awayScore: row.awayScore, matchIds: row.matchIds } });
      continue;
    }
    existing.sources = [...existing.sources, ...row.sources].filter((source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index);
    existing.matchIds.push(...row.matchIds);
  }
  return { fixtures: [...fixtures.values()].map((fixture) => ({ ...fixture, matchIds: [...new Set(fixture.matchIds)].sort() })).sort((a, b) => a.date.localeCompare(b.date) || fixtureKey(a).localeCompare(fixtureKey(b))), conflicts };
}

module.exports = { competitionKey, fixtureKey, fixtureRows };
