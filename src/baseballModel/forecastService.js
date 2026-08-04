"use strict";

const fs = require("fs");
const path = require("path");
const { predictBaseballGame } = require("./pipeline");

const FORECAST_MODEL_PATH = path.join(process.cwd(), "model", "baseball_forecast_model.json");
const NEUTRAL_OFFENSE = 100;
const NEUTRAL_PREVENTION = 100;
const NEUTRAL_LINEUP = 100;
const NEUTRAL_PARK = 1;
const NEUTRAL_TEMP = 70;

function average(values, fallback) {
  const nums = values.filter((value) => Number.isFinite(value));
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : fallback;
}

function linearModel(serialized) {
  const scales = serialized?.scales || [];
  const weights = serialized?.weights || [];
  return {
    ...serialized,
    predict(row) {
      return weights.reduce((sum, weight, index) => {
        if (index === 0) return sum + weight;
        const value = Number(row[index - 1]);
        const scale = scales[index - 1] || {};
        const center = Number.isFinite(Number(scale.center)) ? Number(scale.center) : 0;
        const spread = Number.isFinite(Number(scale.spread)) && Number(scale.spread) !== 0 ? Number(scale.spread) : 1;
        return sum + weight * (((Number.isFinite(value) ? value : center) - center) / spread);
      }, 0);
    },
  };
}

function loadForecastModel(modelPath = FORECAST_MODEL_PATH) {
  const raw = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  return {
    ...raw,
    featureVersion: raw.featureVersion || "baseball-pregame-features-v1",
    homeModel: linearModel(raw.homeModel),
    awayModel: linearModel(raw.awayModel),
  };
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function gameTime(game) {
  const parsed = Date.parse(game.kickoffUtc || game.firstPitchUtc || game.date || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function oddsKey(homeTeam, awayTeam, date) {
  return `${String(date || "").slice(0, 10)}|${normalizeName(homeTeam)}|${normalizeName(awayTeam)}`;
}

function indexOddsEvents(events = []) {
  const index = new Map();
  for (const event of events || []) {
    index.set(oddsKey(event.homeTeam, event.awayTeam, event.date || event.commenceTime), event);
  }
  return index;
}

function initialTeamStats(games) {
  const completed = games.filter((game) => game.completed && Number.isFinite(Number(game.homeScore)) && Number.isFinite(Number(game.awayScore)));
  const leagueRunsPerTeamGame = completed.length
    ? completed.reduce((sum, game) => sum + Number(game.homeScore) + Number(game.awayScore), 0) / (completed.length * 2)
    : 4.5;
  return { completed, leagueRunsPerTeamGame, teams: new Map() };
}

function teamRecord(state, team) {
  if (!state.teams.has(team)) state.teams.set(team, { games: 0, runsFor: 0, runsAgainst: 0, lastPlayedAt: null });
  return state.teams.get(team);
}

function updateTeamState(state, game) {
  if (!game.completed || !Number.isFinite(Number(game.homeScore)) || !Number.isFinite(Number(game.awayScore))) return;
  const home = teamRecord(state, game.homeTeam);
  const away = teamRecord(state, game.awayTeam);
  const playedAt = gameTime(game);
  home.games += 1; home.runsFor += Number(game.homeScore); home.runsAgainst += Number(game.awayScore); home.lastPlayedAt = playedAt || home.lastPlayedAt;
  away.games += 1; away.runsFor += Number(game.awayScore); away.runsAgainst += Number(game.homeScore); away.lastPlayedAt = playedAt || away.lastPlayedAt;
}

function offenseRating(record, leagueRunsPerTeamGame) {
  if (!record?.games) return NEUTRAL_OFFENSE;
  return Math.max(70, Math.min(130, NEUTRAL_OFFENSE + ((record.runsFor / record.games) - leagueRunsPerTeamGame) * 9));
}

function preventionRating(record, leagueRunsPerTeamGame) {
  if (!record?.games) return NEUTRAL_PREVENTION;
  return Math.max(70, Math.min(130, NEUTRAL_PREVENTION + (leagueRunsPerTeamGame - (record.runsAgainst / record.games)) * 9));
}

function restDays(record, firstPitch) {
  if (!record?.lastPlayedAt || !firstPitch) return 1;
  return Math.max(0, Math.min(7, Math.round((firstPitch - record.lastPlayedAt) / 86_400_000)));
}

function snapshotForGame(game, state, now = new Date()) {
  const firstPitch = gameTime(game);
  const capturedAt = Math.min(now.getTime(), firstPitch - 60 * 60 * 1000);
  const home = teamRecord(state, game.homeTeam);
  const away = teamRecord(state, game.awayTeam);
  return {
    gameId: game.id || game.gameId || `${game.awayTeam}@${game.homeTeam}:${game.date}`,
    firstPitchUtc: firstPitch ? new Date(firstPitch).toISOString() : `${game.date}T23:00:00Z`,
    capturedAt: new Date(capturedAt).toISOString(),
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    home: {
      offenseRating: offenseRating(home, state.leagueRunsPerTeamGame),
      startingPitcherRating: preventionRating(home, state.leagueRunsPerTeamGame),
      bullpenRating: preventionRating(home, state.leagueRunsPerTeamGame),
      lineupRating: NEUTRAL_LINEUP,
      restDays: restDays(home, firstPitch),
    },
    away: {
      offenseRating: offenseRating(away, state.leagueRunsPerTeamGame),
      startingPitcherRating: preventionRating(away, state.leagueRunsPerTeamGame),
      bullpenRating: preventionRating(away, state.leagueRunsPerTeamGame),
      lineupRating: NEUTRAL_LINEUP,
      restDays: restDays(away, firstPitch),
    },
    park: { runFactor: NEUTRAL_PARK },
    weather: { temperatureF: NEUTRAL_TEMP, windOutMph: 0 },
  };
}

function summarizePrediction(prediction, oddsEvent = null) {
  const modelHomeWin = prediction.probabilities.modelOnlyHomeWin;
  const homeWin = prediction.probabilities.blendedHomeWin;
  return {
    expectedRuns: {
      home: prediction.expectedRuns.home,
      away: prediction.expectedRuns.away,
      total: prediction.expectedRuns.home + prediction.expectedRuns.away,
    },
    probabilities: {
      homeWin,
      awayWin: 1 - homeWin,
      modelHomeWin,
      modelAwayWin: 1 - modelHomeWin,
      marketHomeWin: prediction.probabilities.marketHomeWin,
      marketAwayWin: prediction.probabilities.marketHomeWin == null ? null : 1 - prediction.probabilities.marketHomeWin,
      homeCoverMinus1_5: prediction.model.homeRunLineMinus1_5,
      awayCoverPlus1_5: 1 - prediction.model.homeRunLineMinus1_5,
    },
    odds: oddsEvent ? {
      provider: oddsEvent.provider || "The Odds API",
      homeOdds: oddsEvent.odds?.homeOdds || oddsEvent.odds?.homeDecimal || "",
      awayOdds: oddsEvent.odds?.awayOdds || oddsEvent.odds?.awayDecimal || "",
      bookmakerCount: oddsEvent.bookmakerCount || 0,
      eventId: oddsEvent.eventId || "",
    } : null,
  };
}

function buildLeaders(predictions, state) {
  const teamProjected = new Map();
  for (const item of predictions) {
    for (const side of ["home", "away"]) {
      const team = side === "home" ? item.homeTeam : item.awayTeam;
      const runs = item.prediction.expectedRuns[side];
      const current = teamProjected.get(team) || { team, games: 0, runs: 0 };
      current.games += 1; current.runs += runs;
      teamProjected.set(team, current);
    }
  }
  return {
    highestTotals: [...predictions].sort((a, b) => b.prediction.expectedRuns.total - a.prediction.expectedRuns.total).slice(0, 5),
    projectedOffenses: [...teamProjected.values()]
      .map((team) => ({ team: team.team, projectedRunsForPerGame: team.runs / team.games }))
      .sort((a, b) => b.projectedRunsForPerGame - a.projectedRunsForPerGame)
      .slice(0, 5),
    leagueRunsPerTeamGame: state.leagueRunsPerTeamGame,
  };
}

function forecastBoard(seasonData, { oddsEvents = [], limit = 30, marketWeight = 0.2, now = new Date() } = {}) {
  const model = loadForecastModel();
  const games = (seasonData?.games || []).slice().sort((a, b) => gameTime(a) - gameTime(b));
  const state = initialTeamStats(games);
  const oddsByGame = indexOddsEvents(oddsEvents);
  const allPredictions = [];
  for (const game of games) {
    const startsAt = gameTime(game);
    if (game.completed) {
      updateTeamState(state, game);
      continue;
    }
    if (!startsAt || startsAt <= now.getTime()) continue;
    const oddsEvent = oddsByGame.get(oddsKey(game.homeTeam, game.awayTeam, game.date));
    const odds = oddsEvent?.odds ? {
      homeDecimal: oddsEvent.odds.homeDecimal || oddsEvent.odds.homeOdds,
      awayDecimal: oddsEvent.odds.awayDecimal || oddsEvent.odds.awayOdds,
      source: oddsEvent.provider || "The Odds API",
    } : null;
    const rawPrediction = predictBaseballGame(model, snapshotForGame(game, state, now), odds ? {
      odds,
      marketCalibration: { validated: true, weight: marketWeight },
    } : {});
    const prediction = summarizePrediction(rawPrediction, oddsEvent);
    const homePick = prediction.probabilities.homeWin >= 0.5;
    allPredictions.push({
      gameId: game.id,
      date: game.date,
      firstPitchUtc: game.kickoffUtc,
      status: game.status,
      completed: false,
      venue: game.venue || "",
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      actual: null,
      prediction,
      pick: { team: homePick ? game.homeTeam : game.awayTeam, side: homePick ? "home" : "away", probability: homePick ? prediction.probabilities.homeWin : prediction.probabilities.awayWin },
      oddsAvailable: Boolean(oddsEvent),
    });
  }
  const returned = limit > 0 ? allPredictions.slice(0, limit) : allPredictions;
  const avg = (values) => average(values.filter(Number.isFinite), null);
  return {
    contract: "baseball-public-forecast-board-v1",
    generatedAt: new Date().toISOString(),
    model: {
      selectedVariant: "retrosheet-enriched",
      trainedAt: model.trainedAt,
      validationMae: model.selection || null,
      artifact: "model/baseball_forecast_model.json",
    },
    predictions: returned,
    leaders: buildLeaders(allPredictions, state),
    summary: {
      games: games.length,
      totalPredictions: allPredictions.length,
      predictions: returned.length,
      completedGames: state.completed.length,
      scheduledGames: allPredictions.length,
      gamesWithOdds: allPredictions.filter((game) => game.oddsAvailable).length,
      marketWeight,
      averageProjectedTotalRuns: avg(allPredictions.map((game) => game.prediction.expectedRuns.total)),
      averageHomeWinProbability: avg(allPredictions.map((game) => game.prediction.probabilities.homeWin)),
      leagueRunsPerTeamGame: state.leagueRunsPerTeamGame,
    },
  };
}

module.exports = { forecastBoard, loadForecastModel };
