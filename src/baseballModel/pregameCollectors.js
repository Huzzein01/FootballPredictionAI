"use strict";

const path = require("path");
const { buildCollectedSnapshot, contentKey, writeImmutableJson } = require("./featureStore");
const { mutableDataPath } = require("../runtimePaths");

const MLB_API = "https://statsapi.mlb.com/api/v1";

function timed(value, source, capturedAt, quality = "known") {
  return { value, source, observedAt: capturedAt, availableAt: capturedAt, quality };
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { "user-agent": "SportsbooksAnalyst/1.0 mlb-pregame-collector" } });
  if (!response.ok) throw new Error(`MLB request failed (${response.status}): ${url}`);
  return response.json();
}

function completedGames(payload, capturedAt) {
  return (payload?.dates || []).flatMap((date) => date.games || []).filter((game) => {
    const final = game.status?.abstractGameState === "Final" || game.status?.codedGameState === "F";
    return final && Date.parse(game.gameDate || "") < Date.parse(capturedAt);
  });
}

function teamForm(games, team, capturedAt) {
  const prior = games.filter((game) => game.teams?.home?.team?.name === team || game.teams?.away?.team?.name === team);
  const split = (limit) => {
    const rows = prior.slice(-limit);
    const summary = rows.reduce((total, game) => {
      const home = game.teams.home.team.name === team;
      const scored = Number(home ? game.teams.home.score : game.teams.away.score);
      const allowed = Number(home ? game.teams.away.score : game.teams.home.score);
      total.games += 1; total.runsFor += scored; total.runsAllowed += allowed; total.wins += scored > allowed ? 1 : 0;
      return total;
    }, { games: 0, wins: 0, runsFor: 0, runsAllowed: 0 });
    return { ...summary, runsForPerGame: summary.games ? summary.runsFor / summary.games : null, runsAllowedPerGame: summary.games ? summary.runsAllowed / summary.games : null };
  };
  return { season: split(prior.length), last7: split(7), last14: split(14), last30: split(30), lastGameUtc: prior.at(-1)?.gameDate || null, capturedAt };
}

function gameFeedFeatures(game, feed, formGames, capturedAt, source) {
  const gameData = feed?.gameData || {};
  const boxscore = feed?.liveData?.boxscore?.teams || {};
  const probable = gameData.probablePitchers || {};
  const homeOrder = boxscore.home?.battingOrder || [];
  const awayOrder = boxscore.away?.battingOrder || [];
  const weather = gameData.weather || null;
  return {
    teamForm: timed({ home: teamForm(formGames, game.homeTeam, capturedAt), away: teamForm(formGames, game.awayTeam, capturedAt) }, source, capturedAt),
    startingPitchers: timed({ home: probable.home || null, away: probable.away || null }, source, capturedAt, probable.home || probable.away ? "partial" : "unknown"),
    bullpen: timed(null, source, capturedAt, "unknown"),
    lineup: timed({ homeBattingOrder: homeOrder, awayBattingOrder: awayOrder }, source, capturedAt, homeOrder.length || awayOrder.length ? "partial" : "unknown"),
    park: timed({ venue: game.venue || gameData.venue?.name || null }, source, capturedAt, game.venue || gameData.venue?.name ? "partial" : "unknown"),
    weather: timed(weather, source, capturedAt, weather ? "partial" : "unknown"),
    travelRest: timed({ homeLastGameUtc: teamForm(formGames, game.homeTeam, capturedAt).lastGameUtc, awayLastGameUtc: teamForm(formGames, game.awayTeam, capturedAt).lastGameUtc }, source, capturedAt, "partial"),
    gameStatus: timed(gameData.status?.detailedState || game.status, source, capturedAt),
  };
}

function storeRaw(root, kind, sourceUrl, capturedAt, payload) {
  const record = { contract: "mlb-raw-response-v1", sport: "baseball", league: "MLB", sourceUrl, fetchedAt: capturedAt, payload };
  const key = contentKey(record);
  return { sourceUrl, ...writeImmutableJson(path.join(root, "raw", kind, `${key}.json`), record) };
}

async function collectPregameFeatures({ normalizedSchedule, capturedAt = new Date().toISOString(), root = mutableDataPath("baseball", "feature_store"), fetchImpl = fetch } = {}) {
  const games = (normalizedSchedule?.games || []).filter((game) => Date.parse(game.firstPitchUtc) > Date.parse(capturedAt));
  const season = new Date(capturedAt).getUTCFullYear();
  const historyUrl = `${MLB_API}/schedule?sportId=1&startDate=${season}-03-01&endDate=${capturedAt.slice(0, 10)}&hydrate=linescore`;
  const historyPayload = await fetchJson(historyUrl, fetchImpl);
  const historyRaw = storeRaw(root, "mlb-schedule-history", historyUrl, capturedAt, historyPayload);
  const formGames = completedGames(historyPayload, capturedAt);
  const snapshots = [];
  for (const game of games) {
    const gamePk = game.gameId.replace(/^mlb:/, "");
    const feedUrl = `${MLB_API}/game/${encodeURIComponent(gamePk)}/feed/live`;
    let feed = {}, source = feedUrl;
    try {
      feed = await fetchJson(feedUrl, fetchImpl);
      storeRaw(root, "mlb-game-feed", feedUrl, capturedAt, feed);
    } catch (error) {
      source = `${feedUrl}#unavailable`;
    }
    const snapshot = buildCollectedSnapshot(game, capturedAt, gameFeedFeatures(game, feed, formGames, capturedAt, source));
    const result = writeImmutableJson(path.join(root, "snapshots", game.gameId, `${contentKey(snapshot)}.json`), snapshot);
    snapshots.push({ gameId: game.gameId, ...result });
  }
  return { capturedAt, historyRawPath: historyRaw.filePath, eligibleGames: games.length, captured: snapshots.length, snapshots };
}

module.exports = { collectPregameFeatures, completedGames, teamForm, gameFeedFeatures };
