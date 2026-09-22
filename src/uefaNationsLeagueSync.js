"use strict";
/**
 * UEFA Nations League live sync — the second international competition
 * alongside the World Cup, built to the same pattern as worldCupSync.js
 * but self-contained (its own fixture/result files, never touches WC
 * state) so this can't regress anything World-Cup-related.
 *
 * ESPN's public scoreboard covers this competition under the slug
 * "uefa.nations" (confirmed live: id 2395, "2026-27 UEFA Nations League").
 * Unlike the date-range queries used elsewhere in this codebase, this
 * competition's scoreboard endpoint only accepts a single `dates` value —
 * a bare four-digit year returns that year's full schedule in one call
 * (confirmed: dates=2026 returns 160 events across 20 matchdays, including
 * both this cycle's Sep–Nov 2026 group stage and some leftover March 2026
 * fixtures from the prior cycle's promotion/relegation playoffs).
 *
 * ESPN doesn't label League A/B/C/D group membership anywhere in this
 * payload, so groups are inferred structurally: two teams that face each
 * other twice (home and away) within the group-stage window are grouped
 * together via union-find, which is exactly how UEFA Nations League groups
 * are actually built (a round-robin of 3-4 teams, played home and away).
 */

const { mutableDataPath, readJsonWithFallback, writeJson } = require("./runtimePaths");
const { normalizeEspnResult } = require("./espnFixtureService");
const { normalizeIntlTeam } = require("./internationalData");

const SLUG = "uefa.nations";
const LEAGUE_LABEL = "UEFA Nations League";
const USER_AGENT = "Mozilla/5.0 FootballPredictionAI uefa-nations-league-sync";
const FIXTURES_PATH = mutableDataPath("international", "uefa_nations_league_fixtures.json");
const FIXTURES_TTL_MS = 5 * 60 * 1000;
// The 2026-27 cycle's group stage runs Sep–Nov 2026; the Finals (knockout,
// League A top 4) are played the following March — fetched from "2027" once
// that year's schedule exists (harmless 0-event response until then).
const SEASON_YEARS = ["2026", "2027"];

function decimalFromAmerican(value) {
  const text = String(value ?? "").replace(/[^\d+-]/g, "");
  const n = Number(text);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

// Same null-entry guard as espnOddsService.js's soccer odds parser — ESPN's
// `odds` array can contain a literal `null` placeholder when no sportsbook
// has priced a match yet.
function oddsFromCompetition(competition) {
  for (const entry of competition?.odds || []) {
    if (!entry?.moneyline) continue;
    const homeOdds = decimalFromAmerican(entry.moneyline.home?.close?.odds ?? entry.moneyline.home?.open?.odds);
    const awayOdds = decimalFromAmerican(entry.moneyline.away?.close?.odds ?? entry.moneyline.away?.open?.odds);
    const drawOdds = decimalFromAmerican(entry.moneyline.draw?.close?.odds ?? entry.moneyline.draw?.open?.odds);
    if (!homeOdds || !awayOdds || !drawOdds) continue;
    return {
      homeOdds: homeOdds.toFixed(2),
      drawOdds: drawOdds.toFixed(2),
      awayOdds: awayOdds.toFixed(2),
      provider: entry.provider?.displayName || entry.provider?.name || "ESPN sportsbook partner",
    };
  }
  return null;
}

async function fetchYear(year) {
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${SLUG}/scoreboard?dates=${year}&limit=300`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`ESPN UEFA Nations League scoreboard (${year}) failed: ${response.status}`);
  const payload = await response.json();
  return { events: payload.events || [], sourceUrl };
}

// Union-find over "which teams have played each other" within the current
// group-stage window — the structural signal that actually defines a
// Nations League group, since ESPN doesn't label it directly.
function detectGroups(fixtures) {
  const parent = new Map();
  const find = (team) => {
    if (!parent.has(team)) parent.set(team, team);
    let root = team;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = team;
    while (parent.get(cur) !== cur) { const next = parent.get(cur); parent.set(cur, root); cur = next; }
    return root;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const fixture of fixtures) {
    if (fixture.phase !== "group-stage") continue;
    union(fixture.homeTeam, fixture.awayTeam);
  }
  const clusters = new Map();
  for (const team of parent.keys()) {
    const root = find(team);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(team);
  }
  const groups = {};
  [...clusters.values()]
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
    .forEach((teams, index) => {
      groups[`Group ${index + 1}`] = teams.sort();
    });
  return groups;
}

// event.season.slug is the real per-fixture phase signal (confirmed live:
// "group-stage" for the Sep–Nov round-robin, "relegation-playoffs" for a
// handful of leftover March fixtures that are actually a two-legged
// promotion/relegation tie from the PRIOR cycle — season.year on those is
// 2024, not 2026 — and would otherwise wrongly cross-link this cycle's
// group detection below, since a team can play a relegation-playoff
// opponent who isn't in its actual round-robin group).
function phaseFor(event) {
  const slug = String(event?.season?.slug || "").toLowerCase();
  if (slug.includes("group")) return "group-stage";
  if (slug.includes("final")) return "finals";
  if (slug.includes("playoff") || slug.includes("promotion") || slug.includes("relegation")) return "playoff";
  return slug || "group-stage";
}

async function refreshNationsLeagueFixtures({ force = false } = {}) {
  const cached = readJsonWithFallback(FIXTURES_PATH, null, null);
  if (!force && cached?.updatedAt && Date.now() - Date.parse(cached.updatedAt) < FIXTURES_TTL_MS) {
    return { ...cached, cached: true };
  }

  const allEvents = [];
  const errors = [];
  for (const year of SEASON_YEARS) {
    try {
      const { events } = await fetchYear(year);
      allEvents.push(...events);
    } catch (error) {
      errors.push({ year, message: error.message });
    }
  }

  const byId = new Map();
  for (const event of allEvents) {
    const competition = event.competitions?.[0] || {};
    const result = normalizeEspnResult(event, LEAGUE_LABEL, `https://site.api.espn.com/apis/site/v2/sports/soccer/${SLUG}/scoreboard`);
    const odds = oddsFromCompetition(competition);
    const competitors = competition.competitors || [];
    const homeCompetitor = competitors.find((c) => c.homeAway === "home");
    const awayCompetitor = competitors.find((c) => c.homeAway === "away");
    byId.set(result.espnEventId || event.id, {
      ...result,
      homeTeam: normalizeIntlTeam(result.homeTeam),
      awayTeam: normalizeIntlTeam(result.awayTeam),
      homeLogoUrl: homeCompetitor?.team?.logo || "",
      awayLogoUrl: awayCompetitor?.team?.logo || "",
      venue: competition.venue?.fullName || "",
      phase: phaseFor(event),
      odds: odds || null,
      oddsStatus: odds ? `Live bookmaker line (${odds.provider})` : "Waiting for odds",
    });
  }
  const fixtures = [...byId.values()]
    .filter((f) => f.homeTeam && f.awayTeam)
    .sort((a, b) => String(a.kickoffUtc).localeCompare(String(b.kickoffUtc)));
  const teams = [...new Set(fixtures.flatMap((f) => [f.homeTeam, f.awayTeam]))].sort();
  const groups = detectGroups(fixtures);

  const snapshot = {
    updatedAt: new Date().toISOString(),
    source: { name: "ESPN public scoreboard API", url: `https://site.api.espn.com/apis/site/v2/sports/soccer/${SLUG}/scoreboard`, slug: SLUG },
    competition: LEAGUE_LABEL,
    seasonYears: SEASON_YEARS,
    fetched: allEvents.length,
    fixtureCount: fixtures.length,
    teamCount: teams.length,
    groupCount: Object.keys(groups).length,
    errors,
    fixtures,
    teams,
    groups,
  };
  writeJson(FIXTURES_PATH, snapshot);
  return snapshot;
}

function readNationsLeagueFixtures() {
  return readJsonWithFallback(FIXTURES_PATH, null, { fixtures: [], teams: [], groups: {}, fixtureCount: 0 });
}

// Pulls each completed fixture's ESPN summary into the SAME shared
// team-match-stats store the World Cup sync already writes to
// (teamMatchStats.js) — teamMatchForm() is competition-agnostic, so this is
// the only step needed for Nations League matches to start contributing to
// the "recent form" signal used in predictions, exactly like WC games do.
async function syncNationsLeagueTeamStats({ maxEventsPerRun = 8 } = {}) {
  const { fixtures } = readNationsLeagueFixtures();
  const completed = fixtures.filter((f) => f.completed && f.espnEventId);
  const { readTeamMatchStats, recordTeamStatsFromSummary, saveTeamMatchStats } = require("./teamMatchStats");
  const store = readTeamMatchStats();
  const synced = new Set(store.syncedEvents || []);
  const queue = completed.filter((f) => !synced.has(String(f.espnEventId))).slice(0, maxEventsPerRun);
  if (!queue.length) return { newEvents: 0 };

  let recorded = 0;
  for (const fixture of queue) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${SLUG}/summary?event=${fixture.espnEventId}`;
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (!response.ok) throw new Error(`ESPN summary ${fixture.espnEventId} failed: ${response.status}`);
      const summary = await response.json();
      if (recordTeamStatsFromSummary(store, summary, fixture)) recorded += 1;
    } catch (error) {
      store.lastError = `${fixture.espnEventId}: ${error.message}`;
    }
  }
  saveTeamMatchStats(store);
  return { newEvents: queue.length, recorded };
}

module.exports = {
  refreshNationsLeagueFixtures,
  readNationsLeagueFixtures,
  syncNationsLeagueTeamStats,
  LEAGUE_LABEL,
  FIXTURES_PATH,
  // Exported for tests only — pure functions, no I/O.
  detectGroups,
  phaseFor,
};
