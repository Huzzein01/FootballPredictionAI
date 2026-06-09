/**
 * src/teamResultsStore.js
 *
 * Stores match results fetched from the ESPN API as one file per team.
 *
 *   data/teams/results/<slug>.json   →  a single team's match history
 *   data/teams/results/_index.json   →  list of all tracked teams + counts
 *
 * Each team file accumulates every completed match the team has played
 * (home or away), from that team's point of view:
 *
 *   { team, slug, league, updatedAt, matchCount, matches: [
 *       { date, league, opponent, homeAway, goalsFor, goalsAgainst,
 *         result: "W"|"D"|"L", points, espnEventId, kickoffUtc, source }
 *   ] }
 *
 * Writes use the runtime-mutable path (repo dir locally, os.tmpdir on the
 * read-only hosted runtime) with the committed repo files as the read
 * fallback, matching the rest of the codebase's persistence pattern.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");
const { mutableDataPath, readJsonWithFallback, repoDataPath, writeJson } = require("./runtimePaths");

const RESULTS_SUBPATH = ["teams", "results"];

function mutableResultsDir() {
  return mutableDataPath(...RESULTS_SUBPATH);
}
function seededResultsDir() {
  return repoDataPath(...RESULTS_SUBPATH);
}

/** Convert a team name into a filesystem-safe slug. */
function slugifyTeam(team) {
  return String(team || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip combining accent marks
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown-team";
}

function resultCode(goalsFor, goalsAgainst) {
  const gf = Number(goalsFor);
  const ga = Number(goalsAgainst);
  if (!Number.isFinite(gf) || !Number.isFinite(ga)) return "";
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

function pointsFor(code) {
  if (code === "W") return 3;
  if (code === "D") return 1;
  return 0;
}

function matchKey(match) {
  if (match.espnEventId) return `id:${match.espnEventId}`;
  return `dk:${String(match.date || "").slice(0, 10)}|${slugifyTeam(match.opponent)}|${match.homeAway}`;
}

/** Read a single team's stored results (mutable first, repo seed fallback). */
function readTeamResults(slug) {
  const primary = path.join(mutableResultsDir(), `${slug}.json`);
  const fallback = path.join(seededResultsDir(), `${slug}.json`);
  return readJsonWithFallback(primary, fallback, null);
}

function readResultsIndex() {
  const primary = path.join(mutableResultsDir(), "_index.json");
  const fallback = path.join(seededResultsDir(), "_index.json");
  return readJsonWithFallback(primary, fallback, { updatedAt: "", teams: [] });
}

function writeTeamResults(slug, record) {
  writeJson(path.join(mutableResultsDir(), `${slug}.json`), record);
}

function writeResultsIndex(index) {
  writeJson(path.join(mutableResultsDir(), "_index.json"), index);
}

/**
 * Turn one ESPN result (which already has homeTeam/awayTeam/homeGoals/awayGoals)
 * into the two team-perspective match rows.
 */
function perspectivesFromResult(result) {
  const home = normalizeTeamName(result.homeTeam);
  const away = normalizeTeamName(result.awayTeam);
  if (!home || !away) return [];
  const hg = Number(result.homeGoals);
  const ag = Number(result.awayGoals);
  if (!Number.isFinite(hg) || !Number.isFinite(ag)) return [];

  const base = {
    date: String(result.date || result.kickoffUtc || "").slice(0, 10),
    league: result.league || "",
    espnEventId: result.espnEventId || "",
    kickoffUtc: result.kickoffUtc || "",
    source: result.sourceName || "ESPN public event scoreboard API",
    sourceUrl: result.sourceUrl || "",
  };

  const homeCode = resultCode(hg, ag);
  const awayCode = resultCode(ag, hg);

  return [
    {
      team: home,
      match: { ...base, opponent: away, homeAway: "home", goalsFor: hg, goalsAgainst: ag, result: homeCode, points: pointsFor(homeCode) },
    },
    {
      team: away,
      match: { ...base, opponent: home, homeAway: "away", goalsFor: ag, goalsAgainst: hg, result: awayCode, points: pointsFor(awayCode) },
    },
  ];
}

function mergeTeamMatch(record, match) {
  const key = matchKey(match);
  const existingIdx = record.matches.findIndex((m) => matchKey(m) === key);
  if (existingIdx >= 0) {
    record.matches[existingIdx] = { ...record.matches[existingIdx], ...match };
    return false; // updated, not new
  }
  record.matches.push(match);
  return true; // newly inserted
}

function emptyRecord(team, slug, league) {
  return { team, slug, league: league || "", updatedAt: "", matchCount: 0, matches: [] };
}

/**
 * Merge a batch of ESPN results into per-team files.
 * @param {Array} results  ESPN-normalized result rows (homeTeam/awayTeam/homeGoals/awayGoals/...)
 * @returns {object} summary { teamsTouched, inserted, updated, teams: [...] }
 */
function updateTeamResultsFromEspn(results = []) {
  if (!Array.isArray(results) || results.length === 0) {
    return { teamsTouched: 0, inserted: 0, updated: 0, teams: [] };
  }

  // Group every match perspective by team slug.
  const byTeam = new Map(); // slug -> { team, league, matches: [] }
  for (const result of results) {
    if (!result || !result.completed) continue;
    for (const { team, match } of perspectivesFromResult(result)) {
      const slug = slugifyTeam(team);
      if (!byTeam.has(slug)) byTeam.set(slug, { team, league: match.league, matches: [] });
      byTeam.get(slug).matches.push(match);
    }
  }

  let inserted = 0;
  let updated = 0;
  const touchedTeams = [];

  for (const [slug, group] of byTeam) {
    const record = readTeamResults(slug) || emptyRecord(group.team, slug, group.league);
    record.team = group.team;
    record.slug = slug;
    if (!record.league && group.league) record.league = group.league;
    if (!Array.isArray(record.matches)) record.matches = [];

    for (const match of group.matches) {
      if (mergeTeamMatch(record, match)) inserted += 1;
      else updated += 1;
    }

    record.matches.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    record.matchCount = record.matches.length;
    record.updatedAt = new Date().toISOString();
    writeTeamResults(slug, record);

    touchedTeams.push({ slug, team: record.team, league: record.league, matchCount: record.matchCount });
  }

  // Refresh the index by merging touched teams with any previously known ones.
  const prior = readResultsIndex();
  const indexBySlug = new Map((prior.teams || []).map((t) => [t.slug, t]));
  for (const t of touchedTeams) indexBySlug.set(t.slug, t);
  const index = {
    updatedAt: new Date().toISOString(),
    source: "ESPN public event scoreboard API",
    teamCount: indexBySlug.size,
    teams: [...indexBySlug.values()].sort((a, b) => a.team.localeCompare(b.team)),
  };
  writeResultsIndex(index);

  return { teamsTouched: touchedTeams.length, inserted, updated, teams: touchedTeams };
}

/** List all known teams (from the index). */
function listTeamResults() {
  return readResultsIndex();
}

/** Full results for one team by slug or by team name. */
function getTeamResults(slugOrTeam) {
  const direct = readTeamResults(slugOrTeam);
  if (direct) return direct;
  return readTeamResults(slugifyTeam(slugOrTeam));
}

module.exports = {
  slugifyTeam,
  resultCode,
  updateTeamResultsFromEspn,
  listTeamResults,
  getTeamResults,
  readTeamResults,
  readResultsIndex,
  mutableResultsDir,
  seededResultsDir,
};
