const { archivedLeagueTables } = require("./leagueTableService");
const { readFixtureData, internationalGroupTables } = require("./internationalData");
const { listPlayerProfiles } = require("./playerProfileStore");
const { listTeamProfiles } = require("./teamProfileStore");

const CLUB_LEAGUES = ["EPL", "La Liga", "Bundesliga", "Ligue 1", "Serie A"];

const INTERNATIONAL_RATINGS = {
  Argentina: 92,
  France: 91,
  Brazil: 90,
  Spain: 89,
  England: 88,
  Portugal: 87,
  Netherlands: 86,
  Belgium: 84,
  Germany: 84,
  Croatia: 83,
  Uruguay: 82,
  Colombia: 82,
  Morocco: 81,
  Switzerland: 80,
  USA: 79,
  Mexico: 79,
  Japan: 79,
  Senegal: 78,
  Ecuador: 78,
  Austria: 76,
  Denmark: 76,
  Serbia: 75,
  Sweden: 75,
  Australia: 74,
  Tunisia: 73,
  Ghana: 72,
  Canada: 72,
  Qatar: 71,
  "Saudi Arabia": 71,
};

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value, decimals = 1) {
  const scale = 10 ** decimals;
  return Math.round(numeric(value) * scale) / scale;
}

function confidenceFromRank(index, total, floor = 54, ceiling = 76) {
  if (!total || total === 1) return ceiling;
  return round(ceiling - (index / Math.max(1, total - 1)) * (ceiling - floor), 1);
}

function pickSource(league) {
  return {
    name: "ESPN public standings API",
    url: league?.sourceUrl || "https://www.espn.com/soccer/standings",
  };
}

function tablePickFromLeague(leagueName, league, season) {
  const standings = league?.standings || [];
  const leader = standings[0];
  if (!leader) return null;
  const complete = standings.every((entry) => numeric(entry.played) >= numeric(league.totalGames || 38));
  const second = standings[1];
  const pointsGap = second ? numeric(leader.points) - numeric(second.points) : 0;
  return {
    rank: 1,
    label: leader.team,
    detail: `${leagueName} ${season}: ${leader.points} pts, +${leader.goalDifference} GD${complete ? "; final-table baseline" : `; ${pointsGap} point lead`}.`,
    confidence: complete ? 72 : Math.min(74, 58 + Math.max(0, pointsGap) * 2),
    note: complete
      ? "Use this as a next-season futures baseline until fresh fixtures, transfers, odds, and summer form are imported."
      : "Current table leader with ledger results layered into the standings feed.",
    source: pickSource(league),
  };
}

function scorerPicksForLeague(leagueName, profiles) {
  return profiles
    .filter((profile) => profile.league === leagueName)
    .map((profile) => {
      const totals = profile.totals || {};
      return {
        player: profile.player,
        team: profile.team,
        goals: numeric(totals.goals),
        goalsPer90: numeric(totals.goalsPer90),
        assists: numeric(totals.assists),
      };
    })
    .filter((candidate) => candidate.goals > 0 || candidate.goalsPer90 > 0)
    .sort((a, b) => b.goals - a.goals || b.goalsPer90 - a.goalsPer90)
    .slice(0, 5)
    .map((candidate, index, list) => ({
      rank: index + 1,
      label: candidate.player,
      detail: `${candidate.team}: ${candidate.goals} goals, ${round(candidate.goalsPer90, 2)} goals/90, ${candidate.assists} assists in the tracked profile baseline.`,
      confidence: confidenceFromRank(index, list.length, 50, 68),
      note: "Player-profile baseline plus manual training entries. Improve this market with match-by-match minutes, shots, and SOT updates.",
      source: { name: "Player profile baselines and manual training", url: "" },
    }));
}

async function clubFutures({ season = "2025-26", league = "All" } = {}) {
  const tableData = await archivedLeagueTables(season);
  const playerProfiles = listPlayerProfiles().profiles || [];
  const teamProfiles = listTeamProfiles(season, tableData).profiles || [];
  if (tableData.unavailable) {
    return {
      context: "club",
      season,
      league,
      generatedAt: new Date().toISOString(),
      unavailable: true,
      message: tableData.message,
      sections: [],
    };
  }

  const leagueNames = league && league !== "All" ? [league] : CLUB_LEAGUES;
  const sections = [];
  for (const leagueName of leagueNames) {
    const tableLeague = tableData.leagues?.[leagueName];
    if (!tableLeague) continue;
    const leagueWinner = tablePickFromLeague(leagueName, tableLeague, season);
    const scorerPicks = scorerPicksForLeague(leagueName, playerProfiles);
    const trainedTeams = teamProfiles.filter((profile) => profile.league === leagueName && numeric(profile.totals?.matches) > 0).length;
    sections.push({
      id: `${leagueName}-futures`,
      title: `${tableLeague.name || leagueName} Futures`,
      subtitle: `${trainedTeams} manually trained team profile${trainedTeams === 1 ? "" : "s"} layered into club context.`,
      picks: [
        ...(leagueWinner ? [{ ...leagueWinner, market: "League winner / next-season baseline" }] : []),
        ...scorerPicks.map((pick) => ({ ...pick, market: "Top scorer watchlist" })),
      ],
    });
  }

  return {
    context: "club",
    season,
    league,
    generatedAt: new Date().toISOString(),
    unavailable: false,
    sourcePolicy: "Futures use public league tables, tracked player profiles, and manually trained team-profile form. Treat completed seasons as baseline priors for the next campaign.",
    sections,
  };
}

function internationalWinnerPicks() {
  const fixtureData = readFixtureData();
  const teams = fixtureData.teams?.length ? fixtureData.teams : Object.values(fixtureData.groups || {}).flat();
  return [...new Set(teams)]
    .map((team) => ({
      team,
      rating: INTERNATIONAL_RATINGS[team] || 68,
      group: Object.entries(fixtureData.groups || {}).find(([, groupTeams]) => groupTeams.includes(team))?.[0] || "",
    }))
    .sort((a, b) => b.rating - a.rating || a.team.localeCompare(b.team))
    .slice(0, 8)
    .map((candidate, index, list) => ({
      rank: index + 1,
      market: "World Cup winner watchlist",
      label: candidate.team,
      detail: `${candidate.group ? `Group ${candidate.group}; ` : ""}international baseline rating ${candidate.rating}.`,
      confidence: confidenceFromRank(index, list.length, 52, 70),
      note: "Early futures lean before final squads, injuries, odds, and group-stage results are layered in.",
      source: { name: "World Cup 2026 fixture feed and model ratings", url: fixtureData.source?.url || "" },
    }));
}

function internationalScorerPicks() {
  const profiles = listPlayerProfiles().profiles || [];
  const fixtureTeams = new Set(readFixtureData().teams || []);
  return profiles
    .map((profile) => {
      const international = profile.internationalProfile || {};
      const totals = international.totals || {};
      return {
        player: profile.player,
        team: international.team,
        goals: numeric(totals.goals),
        goalsPer90: numeric(totals.goalsPer90),
        shotsPer90: numeric(totals.shotsPer90),
      };
    })
    .filter((candidate) => candidate.team && (!fixtureTeams.size || fixtureTeams.has(candidate.team)) && (candidate.goals > 0 || candidate.goalsPer90 > 0))
    .sort((a, b) => b.goals - a.goals || b.goalsPer90 - a.goalsPer90)
    .slice(0, 8)
    .map((candidate, index, list) => ({
      rank: index + 1,
      market: "World Cup top scorer watchlist",
      label: candidate.player,
      detail: `${candidate.team}: ${candidate.goals} international/World Cup baseline goals, ${round(candidate.goalsPer90, 2)} goals/90, ${round(candidate.shotsPer90, 2)} shots/90.`,
      confidence: confidenceFromRank(index, list.length, 50, 69),
      note: "Uses the international player-profile baseline plus prior World Cup data where available.",
      source: { name: "International player profiles and imported World Cup screenshots", url: "" },
    }));
}

async function internationalFutures({ season = "2026 World Cup" } = {}) {
  const groups = internationalGroupTables();
  return {
    context: "international",
    season,
    league: "International",
    generatedAt: new Date().toISOString(),
    unavailable: season !== "2026 World Cup",
    message: season !== "2026 World Cup" ? `${season} futures are archive-only until fixtures and squads are imported.` : "",
    sourcePolicy: "International futures use World Cup fixtures, group-table state, model ratings, and player-profile international baselines.",
    sections:
      season === "2026 World Cup"
        ? [
            {
              id: "world-cup-winner",
              title: "World Cup Winner Futures",
              subtitle: `${groups.length} group table${groups.length === 1 ? "" : "s"} active. Results will update these leans after each settled international fixture.`,
              picks: internationalWinnerPicks(),
            },
            {
              id: "world-cup-top-scorer",
              title: "World Cup Top Scorer Futures",
              subtitle: "Based on tracked international player profiles and prior World Cup training rows.",
              picks: internationalScorerPicks(),
            },
          ]
        : [],
  };
}

async function futuresPredictions({ context = "club", season, league } = {}) {
  if (context === "international") return internationalFutures({ season: season || "2026 World Cup" });
  return clubFutures({ season: season || "2025-26", league: league || "All" });
}

module.exports = {
  futuresPredictions,
};
