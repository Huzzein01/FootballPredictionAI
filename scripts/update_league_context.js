const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("../src/footballData");
const { LIVE_CONTEXT_PATH, standingFeaturesFromStandings } = require("../src/leagueContext");

const SOURCES = {
  EPL: {
    name: "English Premier League",
    url: "https://site.web.api.espn.com/apis/v2/sports/soccer/eng.1/standings?region=us&lang=en&contentorigin=espn&season=2025",
  },
  "La Liga": {
    name: "La Liga",
    url: "https://site.web.api.espn.com/apis/v2/sports/soccer/esp.1/standings?region=us&lang=en&contentorigin=espn&season=2025",
  },
  Bundesliga: {
    name: "Bundesliga",
    url: "https://site.web.api.espn.com/apis/v2/sports/soccer/ger.1/standings?region=us&lang=en&contentorigin=espn&season=2025",
  },
  "Ligue 1": {
    name: "Ligue 1",
    url: "https://site.web.api.espn.com/apis/v2/sports/soccer/fra.1/standings?region=us&lang=en&contentorigin=espn&season=2025",
  },
};

function statValue(entry, name, fallback = 0) {
  const found = (entry.stats || []).find((stat) => stat.name === name);
  const value = Number(found?.value ?? found?.displayValue);
  return Number.isFinite(value) ? value : fallback;
}

function standingsEntries(payload) {
  return payload.children?.[0]?.standings?.entries || payload.standings?.entries || [];
}

async function fetchStandings(league, source) {
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`${league} standings request failed: ${response.status}`);
  const payload = await response.json();
  return standingsEntries(payload).map((entry, index) => ({
    rank: statValue(entry, "rank", index + 1),
    team: normalizeTeamName(entry.team?.displayName || entry.team?.name || ""),
    sourceTeam: entry.team?.displayName || entry.team?.name || "",
    played: statValue(entry, "gamesPlayed"),
    wins: statValue(entry, "wins"),
    draws: statValue(entry, "ties"),
    losses: statValue(entry, "losses"),
    points: statValue(entry, "points"),
    goalsFor: statValue(entry, "pointsFor"),
    goalsAgainst: statValue(entry, "pointsAgainst"),
    goalDifference: statValue(entry, "pointDifferential"),
  }));
}

function leagueNarrative(league, standings) {
  const leader = standings[0];
  const second = standings[1];
  const notes = [];
  if (!leader) return notes;
  const leaderContext = standingFeaturesFromStandings(league, standings, leader.team, second?.team || leader.team).home;
  if (leaderContext.securedTitle) {
    notes.push(`${leader.team} have secured the title; treat remaining league fixtures as rotation-risk games.`);
  } else if (leaderContext.titleRaceScore > 0 && second) {
    notes.push(`${leader.team} lead ${second.team} by ${leader.points - second.points} points; title pressure remains live.`);
  }
  const europeTeams = standings.filter((entry) => {
    const context = standingFeaturesFromStandings(league, standings, entry.team, leader.team).home;
    return context.europeRaceScore > 0;
  });
  const relegationTeams = standings.filter((entry) => {
    const context = standingFeaturesFromStandings(league, standings, entry.team, leader.team).home;
    return context.relegationBattleScore > 0;
  });
  if (europeTeams.length) notes.push(`European-place pressure: ${europeTeams.map((entry) => entry.team).join(", ")}.`);
  if (relegationTeams.length) notes.push(`Relegation pressure: ${relegationTeams.map((entry) => entry.team).join(", ")}.`);
  return notes;
}

async function main() {
  const leagues = {};
  for (const [league, source] of Object.entries(SOURCES)) {
    const standings = await fetchStandings(league, source);
    leagues[league] = {
      name: source.name,
      source: "ESPN public standings API",
      sourceUrl: source.url,
      standings,
      notes: leagueNarrative(league, standings),
    };
  }

  const output = {
    updatedAt: new Date().toISOString(),
    season: "2025-26",
    policy: "Live standings are used to model title-race, European-place, relegation, title-secured, and dead-rubber motivation for upcoming fixture predictions.",
    leagues,
  };

  fs.mkdirSync(path.dirname(LIVE_CONTEXT_PATH), { recursive: true });
  fs.writeFileSync(LIVE_CONTEXT_PATH, JSON.stringify(output, null, 2));
  console.log(`League context saved: ${LIVE_CONTEXT_PATH}`);
  for (const [league, context] of Object.entries(leagues)) {
    console.log(`${league}: ${context.notes.join(" ")}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
