"use strict";

const fs = require("fs");
const path = require("path");
const { predictBasketballGame } = require("./pipeline");

const FORECAST_MODEL_PATH = path.join(process.cwd(), "model", "basketball_forecast_model.json");
const LEAGUE_FALLBACK_PPG = 112;

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
  return { ...raw, featureVersion: raw.featureVersion || "basketball-pregame-features-v1", homeModel: linearModel(raw.homeModel), awayModel: linearModel(raw.awayModel) };
}

function normalizeName(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function gameTime(game) {
  const parsed = Date.parse(game.kickoffUtc || game.date || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function oddsKey(homeTeam, awayTeam, date) {
  return `${String(date || "").slice(0, 10)}|${normalizeName(homeTeam)}|${normalizeName(awayTeam)}`;
}

function indexOddsEvents(events = []) {
  const index = new Map();
  for (const event of events || []) index.set(oddsKey(event.homeTeam, event.awayTeam, event.date || event.commenceTime), event);
  return index;
}

function initialTeamStats(games) {
  const completed = games.filter((game) => game.completed && Number.isFinite(Number(game.homeScore)) && Number.isFinite(Number(game.awayScore)));
  const leaguePpg = completed.length ? completed.reduce((sum, game) => sum + Number(game.homeScore) + Number(game.awayScore), 0) / (completed.length * 2) : LEAGUE_FALLBACK_PPG;
  return { completed, leaguePpg, teams: new Map() };
}

function teamRecord(state, team) {
  if (!state.teams.has(team)) state.teams.set(team, { games: 0, pointsFor: 0, pointsAgainst: 0, lastPlayedAt: null });
  return state.teams.get(team);
}

function updateTeamState(state, game) {
  if (!game.completed || !Number.isFinite(Number(game.homeScore)) || !Number.isFinite(Number(game.awayScore))) return;
  const home = teamRecord(state, game.homeTeam);
  const away = teamRecord(state, game.awayTeam);
  const playedAt = gameTime(game);
  home.games += 1; home.pointsFor += Number(game.homeScore); home.pointsAgainst += Number(game.awayScore); home.lastPlayedAt = playedAt || home.lastPlayedAt;
  away.games += 1; away.pointsFor += Number(game.awayScore); away.pointsAgainst += Number(game.homeScore); away.lastPlayedAt = playedAt || away.lastPlayedAt;
}

function offenseRating(record, leaguePpg) {
  if (!record?.games) return 100;
  return Math.max(70, Math.min(130, 100 * (record.pointsFor / record.games) / leaguePpg));
}

function defenseRating(record, leaguePpg) {
  if (!record?.games) return 100;
  return Math.max(70, Math.min(130, 100 * leaguePpg / Math.max(1, record.pointsAgainst / record.games)));
}

function restDays(record, kickoff) {
  if (!record?.lastPlayedAt || !kickoff) return 2;
  return Math.max(0, Math.min(10, Math.round((kickoff - record.lastPlayedAt) / 86_400_000)));
}

function snapshotForGame(game, state, now = new Date()) {
  const kickoff = gameTime(game);
  const capturedAt = Math.min(now.getTime(), kickoff - 30 * 60 * 1000);
  const home = teamRecord(state, game.homeTeam);
  const away = teamRecord(state, game.awayTeam);
  return {
    gameId: game.id || `${game.awayTeam}@${game.homeTeam}:${game.date}`,
    kickoffUtc: kickoff ? new Date(kickoff).toISOString() : `${game.date}T23:00:00Z`,
    capturedAt: new Date(capturedAt).toISOString(),
    homeTeam: game.homeTeam, awayTeam: game.awayTeam,
    home: { offenseRating: offenseRating(home, state.leaguePpg), defenseRating: defenseRating(home, state.leaguePpg), restDays: restDays(home, kickoff) },
    away: { offenseRating: offenseRating(away, state.leaguePpg), defenseRating: defenseRating(away, state.leaguePpg), restDays: restDays(away, kickoff) },
  };
}

function summarizePrediction(prediction, oddsEvent = null) {
  const modelHomeWin = prediction.probabilities.modelOnlyHomeWin;
  const homeWin = prediction.probabilities.blendedHomeWin;
  return {
    expectedPoints: { home: prediction.expectedPoints.home, away: prediction.expectedPoints.away, total: prediction.expectedPoints.home + prediction.expectedPoints.away },
    probabilities: { homeWin, awayWin: 1 - homeWin, modelHomeWin, modelAwayWin: 1 - modelHomeWin, marketHomeWin: prediction.probabilities.marketHomeWin, marketAwayWin: prediction.probabilities.marketHomeWin == null ? null : 1 - prediction.probabilities.marketHomeWin },
    odds: oddsEvent ? { provider: oddsEvent.provider || "ESPN", homeOdds: oddsEvent.odds?.homeOdds || oddsEvent.odds?.homeDecimal || "", awayOdds: oddsEvent.odds?.awayOdds || oddsEvent.odds?.awayDecimal || "", eventId: oddsEvent.eventId || "" } : null,
  };
}

function buildLeaders(predictions, state) {
  const teamProjected = new Map();
  for (const item of predictions) {
    for (const side of ["home", "away"]) {
      const team = side === "home" ? item.homeTeam : item.awayTeam;
      const points = item.prediction.expectedPoints[side];
      const current = teamProjected.get(team) || { team, games: 0, points: 0 };
      current.games += 1; current.points += points;
      teamProjected.set(team, current);
    }
  }
  return {
    highestTotals: [...predictions].sort((a, b) => b.prediction.expectedPoints.total - a.prediction.expectedPoints.total).slice(0, 5),
    projectedOffenses: [...teamProjected.values()].map((team) => ({ team: team.team, projectedPointsForPerGame: team.points / team.games })).sort((a, b) => b.projectedPointsForPerGame - a.projectedPointsForPerGame).slice(0, 5),
    leaguePointsPerTeamGame: state.leaguePpg,
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
    if (game.completed) { updateTeamState(state, game); continue; }
    if (!startsAt || startsAt <= now.getTime()) continue;
    const oddsEvent = oddsByGame.get(oddsKey(game.homeTeam, game.awayTeam, game.date));
    const odds = oddsEvent?.odds ? { homeDecimal: oddsEvent.odds.homeDecimal || oddsEvent.odds.homeOdds, awayDecimal: oddsEvent.odds.awayDecimal || oddsEvent.odds.awayOdds, source: oddsEvent.provider || "ESPN" } : null;
    const rawPrediction = predictBasketballGame(model, snapshotForGame(game, state, now), odds ? { odds, marketCalibration: { validated: true, weight: marketWeight } } : {});
    const prediction = summarizePrediction(rawPrediction, oddsEvent);
    const homePick = prediction.probabilities.homeWin >= 0.5;
    allPredictions.push({ gameId: game.id, date: game.date, kickoffUtc: game.kickoffUtc, status: game.status, completed: false, venue: game.venue || "", homeTeam: game.homeTeam, awayTeam: game.awayTeam, actual: null, prediction, pick: { team: homePick ? game.homeTeam : game.awayTeam, side: homePick ? "home" : "away", probability: homePick ? prediction.probabilities.homeWin : prediction.probabilities.awayWin }, oddsAvailable: Boolean(oddsEvent) });
  }
  const returned = limit > 0 ? allPredictions.slice(0, limit) : allPredictions;
  const avg = (values) => average(values.filter(Number.isFinite), null);
  return {
    contract: "basketball-public-forecast-board-v1", generatedAt: new Date().toISOString(),
    model: { selectedVariant: "results-only-ratings", trainedAt: model.trainedAt, validationMae: model.selection || null, artifact: "model/basketball_forecast_model.json" },
    predictions: returned, leaders: buildLeaders(allPredictions, state),
    summary: { games: games.length, totalPredictions: allPredictions.length, predictions: returned.length, completedGames: state.completed.length, scheduledGames: allPredictions.length, gamesWithOdds: allPredictions.filter((game) => game.oddsAvailable).length, marketWeight, averageProjectedTotalPoints: avg(allPredictions.map((game) => game.prediction.expectedPoints.total)), averageHomeWinProbability: avg(allPredictions.map((game) => game.prediction.probabilities.homeWin)), leaguePointsPerTeamGame: state.leaguePpg },
  };
}

module.exports = { forecastBoard, loadForecastModel };
