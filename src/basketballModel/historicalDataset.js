"use strict";

const NEUTRAL = 100;
const LEAGUE_FALLBACK_PPG = 112;

function isoBefore(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time - 60_000).toISOString() : "";
}

function gameTime(game) {
  const parsed = Date.parse(game.kickoffUtc || game.date || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function statLine(state, leaguePpg, now) {
  const games = state?.games || 0;
  const pointsFor = games ? state.pointsFor / games : leaguePpg;
  const pointsAgainst = games ? state.pointsAgainst / games : leaguePpg;
  const restDays = state?.lastPlayedAt && now ? Math.max(0, Math.min(10, Math.round((now - state.lastPlayedAt) / 86_400_000))) : 2;
  return {
    games, pointsForPerGame: pointsFor, pointsAgainstPerGame: pointsAgainst,
    offenseRating: leaguePpg ? NEUTRAL * pointsFor / leaguePpg : NEUTRAL,
    defenseRating: leaguePpg ? NEUTRAL * leaguePpg / Math.max(0.1, pointsAgainst) : NEUTRAL,
    restDays,
  };
}

function updateState(state, team, scored, allowed, playedAt) {
  const line = state.get(team) || { games: 0, pointsFor: 0, pointsAgainst: 0, lastPlayedAt: null };
  line.games += 1; line.pointsFor += scored; line.pointsAgainst += allowed; line.lastPlayedAt = playedAt || line.lastPlayedAt;
  state.set(team, line);
}

// Chronologically replays completed games and, for every game, builds a
// pregame snapshot from ONLY strictly-earlier results — the same
// leakage-safe pattern baseballModel/historicalDataset.js uses for MLB.
function reconstructTrainingRows(games) {
  const completed = (games || [])
    .filter((game) => game.completed && game.homeTeam && game.awayTeam && Number.isFinite(Number(game.homeScore)) && Number.isFinite(Number(game.awayScore)))
    .sort((left, right) => gameTime(left) - gameTime(right));
  const teamState = new Map();
  let leaguePoints = 0, leagueTeamGames = 0;
  const rows = [];
  for (const game of completed) {
    const leaguePpg = leagueTeamGames ? leaguePoints / leagueTeamGames : LEAGUE_FALLBACK_PPG;
    const playedAt = gameTime(game);
    const snapshot = {
      gameId: game.id || `${game.awayTeam}@${game.homeTeam}:${game.date}`,
      kickoffUtc: game.kickoffUtc || `${game.date}T23:00:00Z`,
      capturedAt: isoBefore(game.kickoffUtc || `${game.date}T23:00:00Z`),
      homeTeam: game.homeTeam, awayTeam: game.awayTeam,
      home: statLine(teamState.get(game.homeTeam), leaguePpg, playedAt),
      away: statLine(teamState.get(game.awayTeam), leaguePpg, playedAt),
      provenance: {
        type: "historical_reconstruction", cutoff: "strictly-before-tipoff", sourceGameId: game.id,
        limitations: ["No lineup, injury, pace, or travel fields are included — ratings are results-only."],
      },
    };
    rows.push({ snapshot, homeScore: Number(game.homeScore), awayScore: Number(game.awayScore) });
    updateState(teamState, game.homeTeam, Number(game.homeScore), Number(game.awayScore), playedAt);
    updateState(teamState, game.awayTeam, Number(game.awayScore), Number(game.homeScore), playedAt);
    leaguePoints += Number(game.homeScore) + Number(game.awayScore); leagueTeamGames += 2;
  }
  return rows;
}

module.exports = { reconstructTrainingRows };
