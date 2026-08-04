"use strict";

const { loadMatches, normalizeTeamName } = require("../footballData");
const { slugifyTeam, resultCode } = require("../teamResultsStore");
const { ensureHistory, writeHistory, rebuildCoverage } = require("./store");

function upsertMatch(record, match) {
  const index = record.matches.findIndex((candidate) => candidate.id === match.id);
  if (index >= 0) record.matches[index] = { ...record.matches[index], ...match };
  else record.matches.push(match);
}
function perspective(row, team, opponent, venue, goalsFor, goalsAgainst) {
  const canonicalTeam = normalizeTeamName(team);
  const canonicalOpponent = normalizeTeamName(opponent);
  return {
    team: canonicalTeam,
    id: `football-data:${row.Season}:${row.League}:${row.DateISO}:${slugifyTeam(canonicalTeam)}:${slugifyTeam(canonicalOpponent)}:${venue}`,
    date: row.DateISO,
    season: row.Season,
    competition: { name: row.League, type: "league", country: "" },
    stage: "league",
    opponent: { name: canonicalOpponent, slug: slugifyTeam(canonicalOpponent) },
    venue,
    score: { for: Number(goalsFor), against: Number(goalsAgainst) },
    result: resultCode(goalsFor, goalsAgainst),
    sources: [{ provider: "football-data.co.uk", url: "https://www.football-data.co.uk/", retrievedAt: new Date().toISOString(), sourceFile: row.SourceFile }],
  };
}
function importBundledLeagueHistory() {
  const touched = new Map();
  for (const row of loadMatches()) {
    const homeGoals = Number(row.FTHG); const awayGoals = Number(row.FTAG);
    if (!row.HomeTeam || !row.AwayTeam || !Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) continue;
    for (const match of [perspective(row, row.HomeTeam, row.AwayTeam, "home", homeGoals, awayGoals), perspective(row, row.AwayTeam, row.HomeTeam, "away", awayGoals, homeGoals)]) {
      const found = ensureHistory({ team: match.team, league: row.League });
      const record = found.record;
      delete match.team;
      upsertMatch(record, match);
      touched.set(record.team.slug, record);
    }
  }
  for (const record of touched.values()) { record.matches.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)); rebuildCoverage(record); record.updatedAt = new Date().toISOString(); writeHistory(record); }
  return { teamsTouched: touched.size, matchPerspectives: [...touched.values()].reduce((count, record) => count + record.matches.length, 0) };
}
module.exports = { importBundledLeagueHistory, upsertMatch };
