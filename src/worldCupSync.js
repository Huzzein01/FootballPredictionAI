"use strict";
/**
 * World Cup 2026 live sync.
 *
 * Everything here runs automatically (background interval + on-request TTL):
 *   1. refreshWorldCupResults() — pulls the ESPN FIFA World Cup scoreboard
 *      (free public API, slug fifa.world), stores completed results,
 *      AUTO-CREATES tracked predictions for any fixture the model hasn't
 *      tracked yet, settles them against the final score, rebuilds the
 *      international training summary (WC results at full weight), and
 *      schedules a model retrain.
 *   2. syncWorldCupPlayerStats() — for each completed match, pulls the ESPN
 *      event summary and accumulates per-player goals/assists so player
 *      props keep training on live tournament output.
 */

const fs = require("fs");
const path = require("path");
const { mutableDataPath, readJsonWithFallback, writeJson } = require("./runtimePaths");
const { normalizeEspnResult, dateRange } = require("./espnFixtureService");
const { listPredictions, addPredictionsIfMissing, updateResult } = require("./backtestStore");
const { rebuildInternationalTrainingSummary, normalizeIntlTeam } = require("./internationalTraining");
const { scheduleRetrain } = require("./continuousTraining");

const WC_SLUG = "fifa.world";
const WC_LEAGUE_LABEL = "FIFA World Cup";
const USER_AGENT = "Mozilla/5.0 FootballPredictionAI world-cup-sync";
const WC_RESULTS_PATH = mutableDataPath("international", "world_cup_results.json");
const WC_PLAYER_STATS_PATH = mutableDataPath("international", "processed", "wc2026_live_player_stats.json");
const RESULTS_TTL_MS = 2 * 60 * 1000;

function readWorldCupResults() {
  return readJsonWithFallback(WC_RESULTS_PATH, null, { results: [] });
}

function readWcLivePlayerStats() {
  return readJsonWithFallback(WC_PLAYER_STATS_PATH, null, { players: {}, syncedEvents: [] });
}

function snapshotIsFresh(snapshot, ttlMs) {
  if (!snapshot?.updatedAt) return false;
  const age = Date.now() - Date.parse(snapshot.updatedAt);
  return Number.isFinite(age) && age >= 0 && age < ttlMs;
}

function daysBetween(a, b) {
  const at = Date.parse(a || "");
  const bt = Date.parse(b || "");
  if (!Number.isFinite(at) || !Number.isFinite(bt)) return 99;
  return Math.abs(at - bt) / 86400000;
}

// Match an ESPN result to a fixture from the FIFA fixture feed using
// normalized country names and a ±1.5-day window (UTC date drift).
function resultMatchesFixture(result, fixture) {
  const rh = normalizeIntlTeam(result.homeTeam);
  const ra = normalizeIntlTeam(result.awayTeam);
  const fh = normalizeIntlTeam(fixture.homeTeam);
  const fa = normalizeIntlTeam(fixture.awayTeam);
  const sameTeams = (rh === fh && ra === fa) || (rh === fa && ra === fh);
  if (!sameTeams) return false;
  return daysBetween(result.kickoffUtc || result.date, fixture.kickoffUtc || fixture.date) <= 1.5;
}

/**
 * Fetch latest World Cup results from ESPN, auto-track + auto-settle
 * predictions, refresh the training summary, schedule retraining.
 */
async function refreshWorldCupResults({ force = false, daysBack = 6, daysForward = 1 } = {}) {
  const cached = readWorldCupResults();
  if (!force && snapshotIsFresh(cached, RESULTS_TTL_MS)) return { ...cached, cached: true };

  const window = dateRange(daysBack, daysForward);
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${WC_SLUG}/scoreboard?dates=${window}&limit=200`;
  let events = [];
  let fetchError = null;
  try {
    const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
    if (!response.ok) throw new Error(`ESPN World Cup scoreboard failed: ${response.status}`);
    events = (await response.json()).events || [];
  } catch (error) {
    fetchError = error.message;
  }

  const fetched = events.map((event) => normalizeEspnResult(event, WC_LEAGUE_LABEL, sourceUrl));
  // Merge with previously stored results so early-tournament matches survive
  // the rolling date window.
  const byKey = new Map((cached.results || []).map((r) => [r.espnEventId || `${r.date}|${r.homeTeam}|${r.awayTeam}`, r]));
  for (const result of fetched) {
    byKey.set(result.espnEventId || `${result.date}|${result.homeTeam}|${result.awayTeam}`, result);
  }
  const results = [...byKey.values()].sort((a, b) => String(a.kickoffUtc).localeCompare(String(b.kickoffUtc)));
  const completed = results.filter((r) => r.completed && Number.isFinite(Number(r.homeGoals)) && Number.isFinite(Number(r.awayGoals)));

  // ── Auto-fill tracked predictions ────────────────────────────────────────
  // Lazily required to avoid a circular dependency (internationalData is in
  // predictInternationalFixture's import chain).
  const { internationalFixturePredictions } = require("./internationalData");
  const board = internationalFixturePredictions();
  const settled = [];
  if (completed.length) {
    // 1. Create tracked predictions for completed fixtures not yet tracked.
    const tracked = listPredictions().filter((p) => p.source === "international-fixture-board");
    const trackedKeys = new Set(tracked.map((p) => `${p.date}||${p.homeTeam}||${p.awayTeam}`.toLowerCase()));
    const toTrack = [];
    for (const result of completed) {
      const fixture = board.find((f) => resultMatchesFixture(result, f));
      if (!fixture) continue;
      const key = `${fixture.date}||${fixture.homeTeam}||${fixture.awayTeam}`.toLowerCase();
      if (trackedKeys.has(key)) continue;
      toTrack.push({
        date: fixture.date,
        league: fixture.group || fixture.league,
        season: "2026 World Cup",
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        prediction: fixture.prediction,
        confidence: fixture.confidence,
        projectedScore: fixture.projectedScore,
        odds: fixture.odds,
        oddsSource: fixture.oddsSource,
        espnEventId: result.espnEventId,
        kickoffUtc: fixture.kickoffUtc,
        homeFlagUrl: fixture.homeFlagUrl,
        awayFlagUrl: fixture.awayFlagUrl,
      });
      trackedKeys.add(key);
    }
    if (toTrack.length) addPredictionsIfMissing(toTrack, "international-fixture-board");

    // 2. Settle every pending international prediction with a final score.
    const pending = listPredictions().filter((p) => p.source === "international-fixture-board" && p.status !== "SETTLED");
    for (const prediction of pending) {
      const result = completed.find((r) =>
        (prediction.espnEventId && r.espnEventId && String(prediction.espnEventId) === String(r.espnEventId)) ||
        resultMatchesFixture(r, prediction)
      );
      if (!result) continue;
      const updated = updateResult(prediction.id, {
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
        settledBy: "espn-worldcup-auto",
        sourceName: result.sourceName,
        sourceUrl: result.sourceUrl,
        sourceEventId: result.espnEventId,
      });
      if (updated) {
        settled.push({
          id: updated.id, date: updated.date, league: updated.league,
          homeTeam: updated.homeTeam, awayTeam: updated.awayTeam,
          homeGoals: updated.homeGoals, awayGoals: updated.awayGoals,
          prediction: updated.prediction, correct: updated.correct,
        });
      }
    }
  }

  const snapshot = {
    updatedAt: new Date().toISOString(),
    source: "ESPN public event scoreboard API (FIFA World Cup)",
    sourceUrl,
    dateWindow: window,
    fetched: fetched.length,
    completedCount: completed.length,
    settled: settled.length,
    settledPredictions: settled,
    error: fetchError,
    results,
  };
  writeJson(WC_RESULTS_PATH, snapshot);

  // ── Continuous training ──────────────────────────────────────────────────
  if (settled.length) {
    try {
      rebuildInternationalTrainingSummary();
    } catch (error) {
      snapshot.trainingError = error.message;
    }
    // Re-tune model parameters against the freshly settled corpus, grade the
    // capital-ledger slips that just resolved, and roll the next day's slip.
    try {
      snapshot.tuning = require("./autoTune").runAutoTune({ reason: "world-cup-results-settled" });
    } catch (error) {
      snapshot.tuningError = error.message;
    }
    try {
      const { gradeDailySlips, generateDailySlip } = require("./dailyParlay");
      snapshot.slipGrading = gradeDailySlips();
      generateDailySlip();
    } catch (error) {
      snapshot.slipError = error.message;
    }
    scheduleRetrain("world-cup-results-settled");
  }
  return snapshot;
}

// ── Live player stats from ESPN match summaries ───────────────────────────
function recordPlayerEvent(players, name, team, field) {
  const key = String(name || "").trim();
  if (!key) return;
  if (!players[key]) players[key] = { player: key, team: normalizeIntlTeam(team), goals: 0, assists: 0, matches: 0 };
  if (field) players[key][field] += 1;
}

async function fetchEventSummary(eventId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${WC_SLUG}/summary?event=${eventId}`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`ESPN summary ${eventId} failed: ${response.status}`);
  return response.json();
}

/**
 * Accumulates per-player goals/assists from completed WC matches so the
 * parlay engine keeps training on real tournament output. Each ESPN event is
 * fetched once (tracked in syncedEvents).
 */
async function syncWorldCupPlayerStats({ maxEventsPerRun = 8 } = {}) {
  const resultsSnapshot = readWorldCupResults();
  const completed = (resultsSnapshot.results || []).filter((r) => r.completed && r.espnEventId);
  const store = readWcLivePlayerStats();
  const synced = new Set(store.syncedEvents || []);
  const queue = completed.filter((r) => !synced.has(String(r.espnEventId))).slice(0, maxEventsPerRun);
  if (!queue.length) return { ...store, newEvents: 0 };

  // Harvest team match-stats from the SAME summary fetch (zero extra calls).
  let teamStats = null;
  let teamStatsStore = null;
  try {
    teamStats = require("./teamMatchStats");
    teamStatsStore = teamStats.readTeamMatchStats();
  } catch (_) { /* team-stats module optional */ }

  for (const result of queue) {
    try {
      const summary = await fetchEventSummary(result.espnEventId);
      if (teamStats && teamStatsStore) {
        try { teamStats.recordTeamStatsFromSummary(teamStatsStore, summary, result); } catch (_) { /* skip */ }
      }
      const competitors = summary?.boxscore?.players || [];
      // Scorers/assists come from the key events feed; rosters give appearances.
      const appearedThisEvent = new Set();
      const creditAppearance = (name, team) => {
        const key = String(name || "").trim();
        if (!key || appearedThisEvent.has(key)) return;
        recordPlayerEvent(store.players, key, team, null);
        store.players[key].matches += 1;
        appearedThisEvent.add(key);
      };
      for (const side of competitors) {
        const teamName = side?.team?.displayName || "";
        for (const group of side?.statistics || []) {
          for (const athlete of group?.athletes || []) {
            const name = athlete?.athlete?.displayName;
            if (name) creditAppearance(name, teamName);
          }
        }
      }
      const keyEvents = summary?.keyEvents || [];
      for (const ev of keyEvents) {
        const type = String(ev?.type?.text || "").toLowerCase();
        if (!type.includes("goal")) continue;
        const isOwnGoal = type.includes("own");
        const scorer = ev?.participants?.find?.((p) => String(p?.type || "scorer").toLowerCase().includes("scorer")) || ev?.participants?.[0];
        const assister = ev?.participants?.find?.((p) => String(p?.type || "").toLowerCase().includes("assist"));
        const teamName = ev?.team?.displayName || "";
        if (scorer?.athlete?.displayName && !isOwnGoal) {
          // A scorer has played even when the boxscore feed omits rosters.
          creditAppearance(scorer.athlete.displayName, teamName);
          recordPlayerEvent(store.players, scorer.athlete.displayName, teamName, "goals");
        }
        if (assister?.athlete?.displayName) {
          creditAppearance(assister.athlete.displayName, teamName);
          recordPlayerEvent(store.players, assister.athlete.displayName, teamName, "assists");
        }
      }
      synced.add(String(result.espnEventId));
    } catch (error) {
      // Leave unsynced; retried on the next pass.
      store.lastError = `${result.espnEventId}: ${error.message}`;
    }
  }

  store.syncedEvents = [...synced];
  store.updatedAt = new Date().toISOString();
  store.source = "ESPN public event summary API (FIFA World Cup)";
  writeJson(WC_PLAYER_STATS_PATH, store);
  if (teamStats && teamStatsStore) {
    try { teamStats.saveTeamMatchStats(teamStatsStore); } catch (_) { /* skip */ }
  }
  return { ...store, newEvents: queue.length };
}

module.exports = {
  refreshWorldCupResults,
  syncWorldCupPlayerStats,
  readWorldCupResults,
  readWcLivePlayerStats,
  WC_LEAGUE_LABEL,
};
