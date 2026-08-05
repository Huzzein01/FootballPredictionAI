"use strict";
/**
 * Live club player-stat sync.
 *
 * Mirrors syncWorldCupPlayerStats() in worldCupSync.js, but for club-context
 * PLAYER_PROFILES: for each newly-completed club fixture (from
 * espnFixtureService's live results snapshot) involving a tracked player's
 * team, pulls the ESPN event summary and appends a real per-match stat entry
 * (goals/assists/shots/shotsOnTarget/minutes/started) via addPlayerStatEntry.
 * Each ESPN event is fetched at most once (tracked in syncedEvents).
 */

const { mutableDataPath, readJsonWithFallback, writeJson } = require("./runtimePaths");
const { ESPN_LEAGUES, readResultsSnapshot } = require("./espnFixtureService");
const { normalizeTeamName } = require("./footballData");
const { PLAYER_PROFILES, addPlayerStatEntry } = require("./playerProfileStore");
const { seasonFromDate } = require("./footballHistory/schema");

const USER_AGENT = "Mozilla/5.0 FootballPredictionAI club-player-stats-sync";
const SYNC_STATE_PATH = mutableDataPath("club_player_stats_sync_state.json");

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();

function trackedProfilesByTeam() {
  const byTeam = new Map();
  for (const profile of PLAYER_PROFILES) {
    const key = normalizeTeamName(profile.team);
    if (!byTeam.has(key)) byTeam.set(key, []);
    byTeam.get(key).push(profile);
  }
  return byTeam;
}

function readSyncState() {
  return readJsonWithFallback(SYNC_STATE_PATH, null, { syncedEvents: [] });
}

async function fetchEventSummary(slug, eventId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${eventId}`;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`ESPN summary ${eventId} failed: ${response.status}`);
  return response.json();
}

function statValue(stats, name) {
  const entry = (stats || []).find((s) => s.name === name);
  return entry ? Number(entry.value) || 0 : 0;
}

function subMinute(entry) {
  const clock = String(entry?.clock?.displayValue || "").match(/(\d+)/);
  return clock ? Number(clock[1]) : null;
}

function estimateMinutes(player) {
  const subOutPlay = (player.plays || []).find((p) => p.substitution && player.subbedOut);
  const subInPlay = (player.plays || []).find((p) => p.substitution && player.subbedIn);
  if (player.starter && player.subbedOut) return subMinute(subOutPlay) ?? 90;
  if (player.starter) return 90;
  if (player.subbedIn) return 90 - (subMinute(subInPlay) ?? 90);
  return 0;
}

/**
 * @param {{ maxEventsPerRun?: number }} options
 */
async function syncClubPlayerStats({ maxEventsPerRun = 8 } = {}) {
  const byTeam = trackedProfilesByTeam();
  if (!byTeam.size) return { newEvents: 0 };

  const snapshot = readResultsSnapshot();
  const completed = (snapshot?.results || []).filter((r) => r.completed && r.espnEventId);
  const state = readSyncState();
  const synced = new Set(state.syncedEvents || []);

  const relevant = completed.filter((r) => {
    if (synced.has(String(r.espnEventId))) return false;
    return byTeam.has(normalizeTeamName(r.homeTeam)) || byTeam.has(normalizeTeamName(r.awayTeam));
  });
  const queue = relevant.slice(0, maxEventsPerRun);
  if (!queue.length) return { newEvents: 0 };

  let added = 0;
  for (const result of queue) {
    const slug = ESPN_LEAGUES[result.league];
    if (!slug) { synced.add(String(result.espnEventId)); continue; }
    try {
      const summary = await fetchEventSummary(slug, result.espnEventId);
      for (const side of summary?.rosters || []) {
        const teamKey = normalizeTeamName(side?.team?.displayName || "");
        const profiles = byTeam.get(teamKey);
        if (!profiles) continue;
        const opponent = side.homeAway === "home" ? result.awayTeam : result.homeTeam;
        for (const player of side.roster || []) {
          if (!player.active) continue;
          const displayName = player.athlete?.displayName || "";
          const profile = profiles.find((p) => normalizeName(p.player) === normalizeName(displayName));
          if (!profile) continue;
          addPlayerStatEntry(profile.id, {
            context: "club",
            season: result.season || seasonFromDate(result.date),
            date: result.date,
            opponent,
            venue: side.homeAway === "home" ? "Home" : "Away",
            started: Boolean(player.starter),
            minutes: estimateMinutes(player),
            shots: statValue(player.stats, "totalShots"),
            shotsOnTarget: statValue(player.stats, "shotsOnTarget"),
            goals: statValue(player.stats, "totalGoals"),
            assists: statValue(player.stats, "goalAssists"),
            saves: statValue(player.stats, "saves"),
            notes: "Auto-synced from ESPN match summary",
          });
          added += 1;
        }
      }
      synced.add(String(result.espnEventId));
    } catch (error) {
      state.lastError = `${result.espnEventId}: ${error.message}`;
    }
  }

  state.syncedEvents = [...synced];
  state.updatedAt = new Date().toISOString();
  writeJson(SYNC_STATE_PATH, state);
  return { newEvents: queue.length, statEntriesAdded: added };
}

module.exports = { syncClubPlayerStats };
