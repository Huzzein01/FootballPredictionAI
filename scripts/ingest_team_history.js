"use strict";
// Ingests a reviewed, normalized artifact. Network collectors must write an artifact
// first; this keeps retrieval, cleaning, and model training reproducible.
const fs = require("fs");
const { slugifyTeam, resultCode } = require("../src/teamResultsStore");
const { canonicalHistoricalName } = require("../src/footballHistory/identity");
const { ensureHistory, writeHistory, rebuildCoverage } = require("../src/footballHistory/store");
const { seasonFromDate } = require("../src/footballHistory/schema");
const input = process.argv.find((arg) => arg.startsWith("--input="))?.slice(8);
if (!input) throw new Error("Usage: node scripts/ingest_team_history.js --input=normalized-history.json");
const artifact = JSON.parse(fs.readFileSync(input, "utf8"));
if (!Array.isArray(artifact.matches)) throw new Error("Artifact must include matches[]");
let inserted = 0;
const byTeam = new Map();
for (const item of artifact.matches) {
  if (!item.team || !item.opponent || !item.date || !item.competition || !item.score || !item.source?.url) throw new Error(`Invalid normalized match: ${JSON.stringify(item).slice(0, 200)}`);
  const team = canonicalHistoricalName(item.team); const opponent = canonicalHistoricalName(item.opponent);
  const normalized = { ...item, team, opponent };
  const slug = slugifyTeam(team);
  if (!byTeam.has(slug)) byTeam.set(slug, { team, league: item.competition.name, items: [] });
  byTeam.get(slug).items.push(normalized);
}
for (const group of byTeam.values()) {
  const { record } = ensureHistory({ team: group.team, league: group.league });
  for (const item of group.items) {
  const match = { id: item.id || `external:${item.date}:${slugifyTeam(item.team)}:${slugifyTeam(item.opponent)}:${item.competition.name}`, date: item.date, season: item.season || seasonFromDate(item.date), competition: { name: item.competition.name, type: item.competition.type || "unknown", country: item.competition.country || "" }, stage: item.stage || "", opponent: { name: item.opponent, slug: slugifyTeam(item.opponent) }, venue: item.venue || "neutral", score: { for: Number(item.score.for), against: Number(item.score.against) }, result: resultCode(item.score.for, item.score.against), sources: [{ provider: item.source.provider || "external", url: item.source.url, retrievedAt: item.source.retrievedAt || new Date().toISOString(), rawArtifact: input }] };
    const index = record.matches.findIndex((candidate) => candidate.id === match.id);
    if (index < 0) { record.matches.push(match); inserted += 1; } else record.matches[index] = match;
  }
  record.matches.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  rebuildCoverage(record); record.updatedAt = new Date().toISOString(); writeHistory(record);
}
console.log(JSON.stringify({ input, attempted: artifact.matches.length, inserted }, null, 2));
