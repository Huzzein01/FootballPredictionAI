"use strict";

const fs = require("fs");
const { historyDir, readHistory, writeHistory } = require("./store");

function tableForMatches(matches) {
  const table = new Map();
  const row = (team) => { if (!table.has(team)) table.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }); return table.get(team); };
  for (const match of matches.filter((match) => match.venue === "home")) {
    const home = row(match.teamName); const away = row(match.opponent.name);
    home.played += 1; away.played += 1; home.goalsFor += match.score.for; home.goalsAgainst += match.score.against; away.goalsFor += match.score.against; away.goalsAgainst += match.score.for;
    if (match.score.for > match.score.against) { home.won += 1; away.lost += 1; home.points += 3; }
    else if (match.score.for < match.score.against) { away.won += 1; home.lost += 1; away.points += 3; }
    else { home.drawn += 1; away.drawn += 1; home.points += 1; away.points += 1; }
  }
  return [...table.values()].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team)).map((row, index) => ({ position: index + 1, ...row }));
}
function rebuildLeagueStandings() {
  const files = fs.readdirSync(historyDir()).filter((file) => file.endsWith(".json") && file !== "_index.json");
  const records = files.map((file) => readHistory(file.slice(0, -5))).filter((record) => record?.contract === "football-team-history-v1");
  const groups = new Map();
  for (const record of records) for (const match of record.matches || []) {
    if (match.competition?.type !== "league" || match.venue !== "home") continue;
    const key = `${match.season}|${match.competition.name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...match, teamName: record.team.name });
  }
  const tables = new Map([...groups].map(([key, matches]) => [key, tableForMatches(matches)]));
  for (const record of records) {
    const standings = [];
    for (const match of record.matches || []) {
      if (match.competition?.type !== "league") continue;
      const key = `${match.season}|${match.competition.name}`;
      const table = tables.get(key) || [];
      const entry = table.find((row) => row.team === record.team.name);
      if (entry && !standings.some((standing) => standing.season === match.season && standing.competition.name === match.competition.name)) standings.push({ season: match.season, competition: match.competition, ...entry, basis: "derived from recorded completed home fixtures" });
    }
    record.seasonStandings = standings.sort((a, b) => `${a.season}${a.competition.name}`.localeCompare(`${b.season}${b.competition.name}`));
    record.updatedAt = new Date().toISOString(); writeHistory(record);
  }
  return { competitions: tables.size, teams: records.length };
}
module.exports = { tableForMatches, rebuildLeagueStandings };
