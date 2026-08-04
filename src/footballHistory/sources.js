"use strict";

// Ranked by authority first, then breadth and historic archive usefulness.
// `query` is intentionally retained: sources are collected per club, never silently shared.
function sourcePlan(team) {
  const name = team.name || team.team || "";
  const query = encodeURIComponent(name);
  return [
    { rank: 1, provider: "Official club archive", scope: "club history, competition participation and match reports", lookup: `https://www.google.com/search?q=site%3A${encodeURIComponent(name.toLowerCase().replace(/\s+/g, ""))}.com+${query}+archive` },
    { rank: 2, provider: "Domestic league / national association", scope: "official league fixtures, tables and cup records", lookup: `https://www.google.com/search?q=${query}+official+league+archive+tables` },
    { rank: 3, provider: "UEFA", scope: "official European competition appearances, fixtures and standings", lookup: `https://www.uefa.com/search/?q=${query}` },
    { rank: 4, provider: "RSSSF", scope: "historic competitions, tables and cross-checking", lookup: `https://www.rsssf.org/search.html?query=${query}` },
    { rank: 5, provider: "worldfootball.net", scope: "club match archive and competition participation cross-check", lookup: `https://www.worldfootball.net/search/?q=${query}` },
  ];
}

module.exports = { sourcePlan };
