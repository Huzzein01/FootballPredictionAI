"use strict";
/**
 * Team match-stats harvester + rolling-form signal.
 *
 * The most efficient post-match data source we have is the ESPN match summary
 * we ALREADY fetch for player stats — its `boxscore.teams[].statistics` block
 * carries per-team-per-match shots, shots-on-target, possession, corners,
 * cards, tackles, etc. for free, with no rate limit and no paid plan (unlike
 * API-Football, which returns BLOCKED_BY_PLAN on the free tier).
 *
 * This module:
 *   1. Extracts those team stats per completed match into team_match_stats.json
 *      (syncTeamMatchStats / recordTeamStatsFromSummary).
 *   2. Derives a shrinkage-weighted rolling-form nudge per team
 *      (teamMatchForm) from the underlying performance margin — chiefly
 *      shots-on-target FOR vs AGAINST, an xG-style signal that predicts future
 *      results better than past goals. The nudge is small with 1 match and
 *      only trusted near a full set of group games, so the tiny tournament
 *      sample can't overfit.
 */

const fs = require("fs");
const { mutableDataPath, readJsonWithFallback, writeJson } = require("./runtimePaths");
const { normalizeIntlTeam } = require("./internationalTraining");

const WC_SLUG = "fifa.world";
const USER_AGENT = "Mozilla/5.0 FootballPredictionAI team-match-stats";
const TEAM_STATS_PATH = mutableDataPath("international", "processed", "team_match_stats.json");

// Rolling-form tuning. Conservative by design — tournament samples are tiny.
const ROLLING_WINDOW = 5;       // last N matches
const RECENCY_HALF_LIFE = 3;    // matches; older games decay
const SHRINK_K = 2.5;           // n/(n+K): 1 game→0.29, 3→0.55, 5→0.67
const FORM_SCALE = 0.8;         // performance-margin → rating points
const FORM_CAP = 2.5;           // ±cap on the nudge (rating points)

let storeCache = null;
let storeCacheMtime = 0;
// mtime-cached so a full board build (72 fixtures × 2 teams) doesn't re-parse
// the file 144 times; refreshes automatically after each sync writes it.
function readTeamMatchStats() {
  try {
    if (fs.existsSync(TEAM_STATS_PATH)) {
      const mtime = fs.statSync(TEAM_STATS_PATH).mtimeMs;
      if (storeCache && mtime === storeCacheMtime) return storeCache;
      storeCache = readJsonWithFallback(TEAM_STATS_PATH, null, { matches: [], syncedEvents: [], updatedAt: "" });
      storeCacheMtime = mtime;
      return storeCache;
    }
  } catch (_) { /* fall through */ }
  return readJsonWithFallback(TEAM_STATS_PATH, null, { matches: [], syncedEvents: [], updatedAt: "" });
}

function statValue(statistics, name) {
  const row = (statistics || []).find((s) => s.name === name);
  if (!row) return null;
  const raw = row.value ?? row.displayValue;
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Pull the two per-team stat rows out of one ESPN summary + its result.
function extractMatchRows(summary, result) {
  const teams = summary?.boxscore?.teams || [];
  if (teams.length !== 2) return [];
  const side = (i) => {
    const t = teams[i];
    const stats = t?.statistics || [];
    return {
      name: t?.team?.displayName || "",
      homeAway: t?.homeAway || "",
      shots: statValue(stats, "totalShots"),
      sot: statValue(stats, "shotsOnTarget"),
      poss: statValue(stats, "possessionPct"),
      corners: statValue(stats, "wonCorners"),
      fouls: statValue(stats, "foulsCommitted"),
      yellow: statValue(stats, "yellowCards"),
      red: statValue(stats, "redCards"),
    };
  };
  const a = side(0);
  const b = side(1);
  // Goals come from the settled result (boxscore omits the scoreline cleanly).
  const goalsFor = (teamName) => {
    if (normalizeIntlTeam(teamName) === normalizeIntlTeam(result.homeTeam)) return Number(result.homeGoals);
    if (normalizeIntlTeam(teamName) === normalizeIntlTeam(result.awayTeam)) return Number(result.awayGoals);
    return null;
  };
  const mkRow = (self, opp) => ({
    eventId: String(result.espnEventId || ""),
    date: result.date || "",
    team: normalizeIntlTeam(self.name),
    opponent: normalizeIntlTeam(opp.name),
    isHome: self.homeAway === "home",
    gf: goalsFor(self.name),
    ga: goalsFor(opp.name),
    shots: self.shots,
    sot: self.sot,
    shotsAg: opp.shots,
    sotAg: opp.sot,
    poss: self.poss,
    corners: self.corners,
    fouls: self.fouls,
    yellow: self.yellow,
    red: self.red,
  });
  return [mkRow(a, b), mkRow(b, a)];
}

// Merge rows for one event into the store (idempotent per eventId).
function recordTeamStatsFromSummary(store, summary, result) {
  const id = String(result.espnEventId || "");
  if (!id || (store.syncedEvents || []).includes(id)) return false;
  const rows = extractMatchRows(summary, result);
  if (!rows.length) return false;
  store.matches = store.matches || [];
  store.matches.push(...rows);
  store.syncedEvents = [...(store.syncedEvents || []), id];
  return true;
}

async function fetchSummary(eventId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${WC_SLUG}/summary?event=${eventId}`;
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`ESPN summary ${eventId} failed: ${res.status}`);
  return res.json();
}

/**
 * Fetch + record team stats for completed matches not yet in the store.
 * Doubles as backfill (raise maxEventsPerRun) and the live per-cycle sync.
 */
async function syncTeamMatchStats({ maxEventsPerRun = 12 } = {}) {
  let readWorldCupResults;
  try { ({ readWorldCupResults } = require("./worldCupSync")); }
  catch (_) { return { newEvents: 0, error: "worldCupSync unavailable" }; }

  const completed = (readWorldCupResults().results || []).filter((r) => r.completed && r.espnEventId);
  const store = readTeamMatchStats();
  const synced = new Set(store.syncedEvents || []);
  const queue = completed.filter((r) => !synced.has(String(r.espnEventId))).slice(0, maxEventsPerRun);
  if (!queue.length) return { ...store, newEvents: 0 };

  let recorded = 0;
  for (const result of queue) {
    try {
      const summary = await fetchSummary(result.espnEventId);
      if (recordTeamStatsFromSummary(store, summary, result)) recorded += 1;
    } catch (error) {
      store.lastError = `${result.espnEventId}: ${error.message}`;
    }
  }
  store.updatedAt = new Date().toISOString();
  store.source = "ESPN public event summary API — boxscore.teams";
  writeJson(TEAM_STATS_PATH, store);
  return { ...store, newEvents: recorded };
}

function recencyWeights(n) {
  // Most recent match weight 1, decaying by half every RECENCY_HALF_LIFE.
  const w = [];
  for (let i = 0; i < n; i += 1) w.push(Math.pow(0.5, i / RECENCY_HALF_LIFE));
  return w; // index 0 = most recent
}

/**
 * Rolling-form nudge (rating points) for a team, from underlying performance
 * — primarily shots-on-target FOR minus AGAINST, plus shot volume and
 * possession. Shrunk toward 0 by sample size. Returns { delta, matches, ... }.
 */
function teamMatchForm(team) {
  const fifaName = normalizeIntlTeam(team);
  const rows = (readTeamMatchStats().matches || [])
    .filter((r) => r.team === fifaName)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, ROLLING_WINDOW);
  if (!rows.length) return { delta: 0, matches: 0 };

  const weights = recencyWeights(rows.length);
  let wsum = 0;
  let marginSum = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const sot = Number(r.sot), sotAg = Number(r.sotAg);
    const shots = Number(r.shots), shotsAg = Number(r.shotsAg);
    const poss = Number(r.poss);
    // Performance margin: did they create/concede more than the opponent?
    // SOT margin dominates (best xG proxy); shot volume + possession refine it.
    let margin = 0;
    if (Number.isFinite(sot) && Number.isFinite(sotAg)) margin += 0.6 * (sot - sotAg);
    if (Number.isFinite(shots) && Number.isFinite(shotsAg)) margin += 0.15 * (shots - shotsAg);
    if (Number.isFinite(poss)) margin += 0.04 * (poss - 50);
    const w = weights[i];
    marginSum += margin * w;
    wsum += w;
  }
  const avgMargin = wsum > 0 ? marginSum / wsum : 0;
  const shrink = rows.length / (rows.length + SHRINK_K);
  const raw = avgMargin * FORM_SCALE * shrink;
  const delta = Math.max(-FORM_CAP, Math.min(FORM_CAP, raw));
  return { delta: Math.round(delta * 100) / 100, matches: rows.length, avgMargin: Math.round(avgMargin * 100) / 100 };
}

function saveTeamMatchStats(store) {
  store.updatedAt = new Date().toISOString();
  store.source = "ESPN public event summary API — boxscore.teams";
  writeJson(TEAM_STATS_PATH, store);
}

module.exports = {
  readTeamMatchStats,
  recordTeamStatsFromSummary,
  saveTeamMatchStats,
  syncTeamMatchStats,
  teamMatchForm,
  TEAM_STATS_PATH,
};
