"use strict";

// Ranked by authority first, then breadth and historic archive usefulness.
// `query` is intentionally retained: sources are collected per club, never silently shared.
function sourcePlan(team) {
  const name = team.name || team.team || "";
  const league = String(team.primaryLeague || team.league || "");
  const domestic = { EPL: "https://www.premierleague.com/", "La Liga": "https://www.laliga.com/", Bundesliga: "https://www.bundesliga.com/", "Ligue 1": "https://ligue1.com/" }[league] || "";
  return [
    { rank: 1, provider: "Official club archive", url: "", scope: "club history, competition participation and match reports", lookupKey: name, review: "Verify the club-owned archive URL before collection." },
    { rank: 2, provider: "Official domestic competition / association", url: domestic, scope: "official league fixtures, final tables and cup records", lookupKey: league || name },
    { rank: 3, provider: "UEFA", url: "https://www.uefa.com/", scope: "official European competition appearances, fixtures and standings", lookupKey: name },
    { rank: 4, provider: "RSSSF", url: "https://www.rsssf.org/", scope: "historic competitions, tables and cross-checking", lookupKey: name },
    { rank: 5, provider: "worldfootball.net", url: "https://www.worldfootball.net/", scope: "club match archive and competition participation cross-check", lookupKey: name },
  ];
}

module.exports = { sourcePlan };
