"use strict";

const MLB_STATS_API = "https://statsapi.mlb.com/api/v1";

function number(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isoBefore(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time - 60_000).toISOString() : "";
}

function statLine(state, leagueRunsPerGame) {
  const games = state.games || 0;
  const runsFor = games ? state.runsFor / games : leagueRunsPerGame;
  const runsAgainst = games ? state.runsAgainst / games : leagueRunsPerGame;
  return {
    games, wins: state.wins || 0, losses: state.losses || 0,
    runsForPerGame: runsFor, runsAgainstPerGame: runsAgainst,
    // Neutral is 100. This is based only on games completed before the target.
    offenseRating: leagueRunsPerGame ? 100 * runsFor / leagueRunsPerGame : 100,
    bullpenRating: leagueRunsPerGame ? 100 * leagueRunsPerGame / Math.max(0.1, runsAgainst) : 100,
    lineupRating: 0, startingPitcherRating: 0, travelMiles: 0, restDays: 0,
  };
}

function updateState(state, team, scored, allowed, won) {
  const line = state.get(team) || { games: 0, wins: 0, losses: 0, runsFor: 0, runsAgainst: 0 };
  line.games += 1; line.wins += won ? 1 : 0; line.losses += won ? 0 : 1;
  line.runsFor += scored; line.runsAgainst += allowed;
  state.set(team, line);
}

// The MLB schedule endpoint can repeat a finalized gamePk after a postponement
// or continuation. A gamePk is the immutable game identity, so retain its
// earliest scheduled first pitch and reject conflicting repeats rather than
// quietly training on the same final score twice.
function uniqueCompletedGames(games) {
  const byGamePk = new Map();
  for (const game of games) {
    const existing = byGamePk.get(game.gamePk);
    if (!existing) {
      byGamePk.set(game.gamePk, game);
      continue;
    }
    const sameOutcome = existing.homeTeam === game.homeTeam
      && existing.awayTeam === game.awayTeam
      && existing.homeRuns === game.homeRuns
      && existing.awayRuns === game.awayRuns;
    if (!sameOutcome) throw new Error(`Conflicting finalized records for MLB gamePk ${game.gamePk}`);
    if (Date.parse(game.firstPitchUtc) < Date.parse(existing.firstPitchUtc)) byGamePk.set(game.gamePk, game);
  }
  return [...byGamePk.values()];
}

// Reconstructs a pregame-only row from a chronologically ordered result feed.
// Game results are used only after a row is emitted, so a target game's score
// is never available in its own snapshot.
function reconstructTrainingRows(games) {
  const completed = uniqueCompletedGames((games || [])
    .filter((game) => game.completed && game.gameType === "R" && game.homeTeam && game.awayTeam && Number.isFinite(game.homeRuns) && Number.isFinite(game.awayRuns) && game.firstPitchUtc)
  ).sort((left, right) => Date.parse(left.firstPitchUtc) - Date.parse(right.firstPitchUtc));
  const teamState = new Map();
  let leagueRuns = 0, leagueTeamGames = 0;
  const rows = [];
  for (const game of completed) {
    const leagueRunsPerGame = leagueTeamGames ? leagueRuns / leagueTeamGames : 4.4;
    const snapshot = {
      gameId: `mlb:${game.gamePk}`, firstPitchUtc: game.firstPitchUtc,
      capturedAt: isoBefore(game.firstPitchUtc), homeTeam: game.homeTeam, awayTeam: game.awayTeam,
      home: statLine(teamState.get(game.homeTeam) || {}, leagueRunsPerGame),
      away: statLine(teamState.get(game.awayTeam) || {}, leagueRunsPerGame),
      park: { name: game.venue || "", runFactor: 1 }, weather: {},
      provenance: {
        type: "historical_reconstruction", cutoff: "strictly-before-first-pitch",
        sourceGamePk: game.gamePk, sourceUrl: game.sourceUrl || "",
        limitations: ["No retrospective lineup, starter, injury, weather, travel, or odds fields are included."],
      },
    };
    rows.push({ snapshot, homeRuns: game.homeRuns, awayRuns: game.awayRuns });
    updateState(teamState, game.homeTeam, game.homeRuns, game.awayRuns, game.homeRuns > game.awayRuns);
    updateState(teamState, game.awayTeam, game.awayRuns, game.homeRuns, game.awayRuns > game.homeRuns);
    leagueRuns += game.homeRuns + game.awayRuns; leagueTeamGames += 2;
  }
  return rows;
}

async function fetchMlbSeasonGames(season, fetchImpl = fetch) {
  const year = String(season).slice(0, 4);
  const sourceUrl = `${MLB_STATS_API}/schedule?sportId=1&season=${encodeURIComponent(year)}&hydrate=linescore,venue`;
  const response = await fetchImpl(sourceUrl, { headers: { "user-agent": "SportsbooksAnalyst/1.0 historical-pregame-builder" } });
  if (!response.ok) throw new Error(`MLB schedule request for ${year} failed: ${response.status}`);
  const payload = await response.json();
  return (payload.dates || []).flatMap((day) => (day.games || []).map((game) => ({
    gamePk: game.gamePk, gameType: game.gameType, firstPitchUtc: game.gameDate,
    homeTeam: game.teams?.home?.team?.name || "", awayTeam: game.teams?.away?.team?.name || "",
    homeRuns: number(game.teams?.home?.score), awayRuns: number(game.teams?.away?.score),
    completed: game.status?.abstractGameState === "Final" || game.status?.codedGameState === "F",
    venue: game.venue?.name || "", sourceUrl,
  })));
}

async function buildHistoricalDataset({ startSeason, endSeason, fetchImpl = fetch }) {
  const years = [];
  for (let year = Number(startSeason); year <= Number(endSeason); year += 1) years.push(year);
  const games = (await Promise.all(years.map((year) => fetchMlbSeasonGames(year, fetchImpl)))).flat();
  const rows = reconstructTrainingRows(games);
  return {
    sport: "baseball", league: "MLB", seasons: years, generatedAt: new Date().toISOString(),
    datasetContract: "historical-pregame-v1", rowCount: rows.length,
    limitations: "Rows reconstruct team form only from results before first pitch. High-value event data must be added only from timestamped pregame sources.",
    rows,
  };
}

module.exports = { fetchMlbSeasonGames, reconstructTrainingRows, buildHistoricalDataset, uniqueCompletedGames };
