"use strict";

/**
 * ESPN Fixture Bridge
 *
 * Continuously monitors ESPN's public scoreboard APIs to pick up fixtures the
 * moment they're published, for both International (World Cup) and Club football.
 *
 * International path — polling fifa.world:
 *   • Merges newly-published knockout fixtures into world_cup_2026_fixtures.json
 *     so the bracket populates automatically as ESPN confirms match-ups.
 *   • Back-fills ESPN event IDs on existing group-stage entries (needed for
 *     live score enrichment and per-player stat sync).
 *
 * Club path — thin near-term wrapper around refreshEspnFixtures():
 *   • Polls the next-14-day window every 15 min independently of the full
 *     75-day refresh so fixtures published within the week show up quickly.
 *
 * TTL logic: repeated calls within the TTL window return a cached marker.
 * Pass { force: true } to bypass.
 */

const fs = require("fs");
const path = require("path");
const { writeJson, readJsonWithFallback, mutableDataPath } = require("./runtimePaths");
const { refreshEspnFixtures } = require("./espnFixtureService");
const { normalizeIntlTeam } = require("./internationalData");

const WC_SLUG = "fifa.world";
const WC_FIXTURES_PATH = path.join(process.cwd(), "data", "international", "world_cup_2026_fixtures.json");
const BRIDGE_STATE_PATH = mutableDataPath("espn_fixture_bridge_state.json");

const INTL_TTL_MS = 15 * 60 * 1000;   // 15 min — international
const CLUB_TTL_MS = 15 * 60 * 1000;   // 15 min — club near-term

let lastIntlSyncAt = 0;
let lastClubSyncAt = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

function yyyymmddWindow(daysBack, daysForward) {
  const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + daysForward);
  return `${fmt(start)}-${fmt(end)}`;
}

function teamOf(competitors, homeAway) {
  return competitors.find((c) => c.homeAway === homeAway)?.team?.displayName || "";
}

function logoOf(competitors, homeAway) {
  const t = competitors.find((c) => c.homeAway === homeAway)?.team || {};
  return t.logos?.[0]?.href || t.logo || "";
}

function stageFromEvent(event) {
  const label = (event.name || "") + " " + (event.season?.type?.name || "");
  const lower = label.toLowerCase();
  if (lower.includes("round of 32")) return "Round of 32";
  if (lower.includes("round of 16")) return "Round of 16";
  if (lower.includes("quarter")) return "Quarterfinals";
  if (lower.includes("semi")) return "Semifinals";
  if (lower.includes("third")) return "Third Place";
  if (lower.includes("final")) return "Final";
  if (lower.includes("group") || lower.includes("first stage")) return "First Stage";
  return "Knockout Stage";
}

function isKnockoutStage(stage) {
  return !["First Stage", "Group Stage"].includes(stage);
}

// ── International (WC) fixture sync ──────────────────────────────────────────

async function fetchEspnWcUpcoming(daysBack = 3, daysForward = 65) {
  const window = yyyymmddWindow(daysBack, daysForward);
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${WC_SLUG}/scoreboard?dates=${window}&limit=300`;
  const res = await fetch(url, { headers: { "user-agent": "FootballPredictionAI/espn-fixture-bridge" } });
  if (!res.ok) throw new Error(`ESPN WC fetch failed: ${res.status}`);
  const payload = await res.json();
  return { url, events: payload.events || [] };
}

function normalizeEspnWcEvent(event, sourceUrl) {
  const comp = event.competitions?.[0] || {};
  const competitors = comp.competitors || [];
  const status = event.status?.type || {};
  const kickoff = event.date || comp.date || "";
  const stage = stageFromEvent(event);
  const homeRaw = teamOf(competitors, "home");
  const awayRaw = teamOf(competitors, "away");
  const venue = comp.venue?.fullName || comp.venue?.name || "";
  const addr = comp.venue?.address || {};
  const city = addr.city || addr.state || "";
  return {
    date: kickoff.slice(0, 10),
    kickoffUtc: kickoff,
    timeDefined: true,
    stage,
    group: null,
    groupLetter: null,
    league: "World Cup 2026",
    season: "2026 World Cup",
    homeTeam: normalizeIntlTeam(homeRaw) || homeRaw,
    awayTeam: normalizeIntlTeam(awayRaw) || awayRaw,
    homeCode: null,
    awayCode: null,
    homeFlagUrl: logoOf(competitors, "home"),
    awayFlagUrl: logoOf(competitors, "away"),
    venue,
    city,
    isKnockout: isKnockoutStage(stage),
    espnEventId: String(event.id || comp.id || ""),
    espnSource: sourceUrl,
    completed: Boolean(status.completed),
    statusState: status.state || "pre",
  };
}

function mergeWcFixtures(espnUpcoming) {
  if (!fs.existsSync(WC_FIXTURES_PATH)) {
    return { inserted: 0, updated: 0, total: 0, error: "wc fixture file missing" };
  }
  let fileData;
  try {
    fileData = JSON.parse(fs.readFileSync(WC_FIXTURES_PATH, "utf8").replace(/^﻿/, ""));
  } catch (err) {
    return { inserted: 0, updated: 0, total: 0, error: err.message };
  }

  const existing = Array.isArray(fileData.fixtures) ? fileData.fixtures : [];

  const byEspnId = new Map(existing.filter((f) => f.espnEventId).map((f) => [String(f.espnEventId), f]));
  const byKey = new Map(
    existing.map((f) => [
      `${(f.date || "").slice(0, 10)}|${normalizeIntlTeam(f.homeTeam)}|${normalizeIntlTeam(f.awayTeam)}`.toLowerCase(),
      f,
    ])
  );

  let inserted = 0;
  let updated = 0;

  for (const ef of espnUpcoming) {
    if (!ef.homeTeam || !ef.awayTeam || !ef.date) continue;
    const teamKey = `${ef.date}|${normalizeIntlTeam(ef.homeTeam)}|${normalizeIntlTeam(ef.awayTeam)}`.toLowerCase();
    const existing_ = (ef.espnEventId && byEspnId.get(ef.espnEventId)) || byKey.get(teamKey);

    if (existing_) {
      let changed = false;
      if (!existing_.espnEventId && ef.espnEventId) { existing_.espnEventId = ef.espnEventId; changed = true; }
      if (!existing_.homeFlagUrl && ef.homeFlagUrl) { existing_.homeFlagUrl = ef.homeFlagUrl; changed = true; }
      if (!existing_.awayFlagUrl && ef.awayFlagUrl) { existing_.awayFlagUrl = ef.awayFlagUrl; changed = true; }
      if (!existing_.kickoffUtc && ef.kickoffUtc) { existing_.kickoffUtc = ef.kickoffUtc; changed = true; }
      if (changed) {
        updated++;
        if (ef.espnEventId) byEspnId.set(ef.espnEventId, existing_);
      }
    } else {
      // New fixture (knockout round just confirmed by ESPN)
      const entry = { matchNumber: null, idMatch: ef.espnEventId || null, ...ef };
      existing.push(entry);
      if (ef.espnEventId) byEspnId.set(ef.espnEventId, entry);
      byKey.set(teamKey, entry);
      inserted++;
    }
  }

  if (inserted || updated) {
    existing.sort((a, b) => {
      const d = String(a.date || "").localeCompare(String(b.date || ""));
      return d || String(a.kickoffUtc || "").localeCompare(String(b.kickoffUtc || ""));
    });
    fileData.fixtures = existing;
    fileData.fixtureCount = existing.length;
    fileData.espnBridgeUpdatedAt = new Date().toISOString();
    fs.writeFileSync(WC_FIXTURES_PATH, JSON.stringify(fileData, null, 2), "utf8");
  }

  return { inserted, updated, total: existing.length };
}

async function syncInternationalFixtures({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastIntlSyncAt < INTL_TTL_MS) {
    return { cached: true, lastSyncAt: new Date(lastIntlSyncAt).toISOString() };
  }

  let result = { inserted: 0, updated: 0, total: 0 };
  let error = null;

  try {
    const { url, events } = await fetchEspnWcUpcoming(3, 65);
    const upcoming = events
      .filter((e) => {
        const s = e.status?.type || {};
        return !s.completed && s.state !== "post";
      })
      .map((e) => normalizeEspnWcEvent(e, url))
      .filter((e) => e.homeTeam && e.awayTeam && e.date);

    result = mergeWcFixtures(upcoming);
    result.fetchedFromEspn = upcoming.length;

    if (result.inserted > 0) {
      console.log(`[espnFixtureBridge] International: +${result.inserted} new fixture(s) (${result.total} total)`);
    }
  } catch (err) {
    error = err.message;
    console.warn("[espnFixtureBridge] International sync failed:", err.message);
  }

  lastIntlSyncAt = now;

  try {
    const state = readJsonWithFallback(BRIDGE_STATE_PATH, null, {});
    writeJson(BRIDGE_STATE_PATH, {
      ...state,
      internationalLastSyncAt: new Date(now).toISOString(),
      international: { ...result, error },
    });
  } catch (_) { /* state persistence is best-effort */ }

  return { ...result, error, syncedAt: new Date(now).toISOString() };
}

// ── Club near-term fixture sync ───────────────────────────────────────────────

async function syncClubNearTermFixtures({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastClubSyncAt < CLUB_TTL_MS) {
    return { cached: true, lastSyncAt: new Date(lastClubSyncAt).toISOString() };
  }

  let result = {};
  let error = null;

  try {
    result = await refreshEspnFixtures({ daysBack: 3, daysForward: 14 });
    lastClubSyncAt = now;
  } catch (err) {
    error = err.message;
    console.warn("[espnFixtureBridge] Club near-term sync failed:", err.message);
  }

  try {
    const state = readJsonWithFallback(BRIDGE_STATE_PATH, null, {});
    writeJson(BRIDGE_STATE_PATH, {
      ...state,
      clubLastSyncAt: new Date(now).toISOString(),
      club: { ...result, error },
    });
  } catch (_) { /* best-effort */ }

  return { ...result, window: "near-term-14d", error, syncedAt: new Date(now).toISOString() };
}

// ── Combined entry point ──────────────────────────────────────────────────────

async function runFixtureBridge({ force = false } = {}) {
  const [intl, club] = await Promise.allSettled([
    syncInternationalFixtures({ force }),
    syncClubNearTermFixtures({ force }),
  ]);
  return {
    international: intl.status === "fulfilled" ? intl.value : { error: intl.reason?.message },
    club: club.status === "fulfilled" ? club.value : { error: club.reason?.message },
    ranAt: new Date().toISOString(),
  };
}

function bridgeState() {
  return readJsonWithFallback(BRIDGE_STATE_PATH, null, {});
}

module.exports = {
  runFixtureBridge,
  syncInternationalFixtures,
  syncClubNearTermFixtures,
  bridgeState,
};
