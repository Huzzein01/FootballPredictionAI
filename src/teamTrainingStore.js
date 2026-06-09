/**
 * src/teamTrainingStore.js
 *
 * Maintains a continuously-updated training corpus — one file per team —
 * that blends every available training signal into a single per-team profile:
 *
 *   - ESPN match results            (from teamResultsStore)
 *   - Bookmaker odds                (from remaining_fixtures_2025_26_with_odds.csv)
 *   - Screenshot / player & team stats (from team_profile_updates.json)
 *   - Motivations                   (fill-later slot, seeded from manual notes)
 *   - Internet research / news      (fill-later slot)
 *
 * Output:
 *   data/teams/training/<slug>.json  →  a single team's training corpus
 *   data/teams/training/_index.json  →  list of teams + strength indices
 *
 * The per-team corpus feeds ONE global match model: each refresh recomputes a
 * `strengthIndex` and form/odds signals that the prediction layer can consume,
 * while the raw ESPN results are already folded into the model's training rows.
 *
 * This is "continuous training": every time ESPN results refresh, each team's
 * profile is rebuilt from the latest data. Fill-later slots (motivations,
 * internetResearch) are preserved across rebuilds.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");
const { mutableDataPath, readJsonWithFallback, repoDataPath, writeJson } = require("./runtimePaths");
const { slugifyTeam, getTeamResults, readResultsIndex } = require("./teamResultsStore");

const TRAINING_SUBPATH = ["teams", "training"];
const FIXTURES_CSV = repoDataPath("remaining_fixtures_2025_26_with_odds.csv");
const TEAM_PROFILE_UPDATES = mutableDataPath("team_profile_updates.json");
const SEEDED_TEAM_PROFILE_UPDATES = repoDataPath("team_profile_updates.json");

function mutableTrainingDir() {
  return mutableDataPath(...TRAINING_SUBPATH);
}
function seededTrainingDir() {
  return repoDataPath(...TRAINING_SUBPATH);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function round(value, dp = 2) {
  const f = 10 ** dp;
  return Math.round((Number(value) || 0) * f) / f;
}

// ── Minimal CSV reader for the odds fixtures file ─────────────────────────────
function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i += 1; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

let _oddsCache = null;
function readOddsFixtures() {
  if (_oddsCache) return _oddsCache;
  if (!fs.existsSync(FIXTURES_CSV)) { _oddsCache = []; return _oddsCache; }
  const lines = fs.readFileSync(FIXTURES_CSV, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || "");
  _oddsCache = lines.map((line) => Object.fromEntries(parseCsvLine(line).map((v, i) => [headers[i], v])));
  return _oddsCache;
}

/** Implied (overround-normalized) win probability for a team from one fixture row. */
function impliedWinProb(row, isHome) {
  const h = Number(row.homeOdds);
  const d = Number(row.drawOdds);
  const a = Number(row.awayOdds);
  if (![h, d, a].every((n) => Number.isFinite(n) && n > 1)) return null;
  const ih = 1 / h, id = 1 / d, ia = 1 / a;
  const sum = ih + id + ia;
  if (sum <= 0) return null;
  return (isHome ? ih : ia) / sum;
}

/** Average odds-implied win probability across this team's priced fixtures. */
function oddsSignalForTeam(team) {
  const target = normalizeTeamName(team);
  const probs = [];
  for (const row of readOddsFixtures()) {
    const home = normalizeTeamName(row.homeTeam);
    const away = normalizeTeamName(row.awayTeam);
    let isHome = null;
    if (home === target) isHome = true;
    else if (away === target) isHome = false;
    else continue;
    const p = impliedWinProb(row, isHome);
    if (p != null) probs.push(p);
  }
  if (!probs.length) return { pricedFixtures: 0, avgImpliedWinPct: null };
  const avg = probs.reduce((s, p) => s + p, 0) / probs.length;
  return { pricedFixtures: probs.length, avgImpliedWinPct: round(avg * 100, 1) };
}

// ── Screenshot / manual team-stat signal ──────────────────────────────────────
function readTeamProfileUpdates() {
  const data = readJsonWithFallback(TEAM_PROFILE_UPDATES, SEEDED_TEAM_PROFILE_UPDATES, null);
  return Array.isArray(data?.entries) ? data.entries : [];
}

function manualStatsForTeam(team) {
  const target = normalizeTeamName(team);
  const entries = readTeamProfileUpdates().filter((e) => normalizeTeamName(e.team) === target);
  const motivations = entries
    .map((e) => String(e.motivation || "").trim())
    .filter(Boolean)
    .map((text) => ({ text, source: "team-profile-entry", date: "" }));
  return {
    manualEntryCount: entries.length,
    seededMotivations: motivations,
    latestNotes: entries.map((e) => String(e.notes || "").trim()).filter(Boolean).slice(0, 3),
  };
}

// ── Form signals from stored ESPN results ─────────────────────────────────────
function formSignals(matches) {
  const played = matches.filter((m) => ["W", "D", "L"].includes(m.result));
  const n = played.length;
  if (!n) {
    return {
      played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0,
      pointsPerGame: 0, goalsForPerGame: 0, goalsAgainstPerGame: 0,
      goalDiffPerGame: 0, winRate: 0, cleanSheetRate: 0,
      last5: "", last5PointsPerGame: 0,
    };
  }
  let w = 0, d = 0, l = 0, gf = 0, ga = 0, cs = 0, pts = 0;
  for (const m of played) {
    if (m.result === "W") w += 1;
    else if (m.result === "D") d += 1;
    else l += 1;
    gf += Number(m.goalsFor) || 0;
    ga += Number(m.goalsAgainst) || 0;
    if ((Number(m.goalsAgainst) || 0) === 0) cs += 1;
    pts += Number(m.points) || 0;
  }
  // matches are stored newest-first
  const last5 = played.slice(0, 5);
  const last5Pts = last5.reduce((s, m) => s + (Number(m.points) || 0), 0);
  return {
    played: n, wins: w, draws: d, losses: l, goalsFor: gf, goalsAgainst: ga,
    pointsPerGame: round(pts / n, 3),
    goalsForPerGame: round(gf / n, 3),
    goalsAgainstPerGame: round(ga / n, 3),
    goalDiffPerGame: round((gf - ga) / n, 3),
    winRate: round(w / n, 3),
    cleanSheetRate: round(cs / n, 3),
    last5: last5.map((m) => m.result).join(""),
    last5PointsPerGame: round(last5Pts / last5.length, 3),
  };
}

/**
 * Composite 0–100 strength index blending recent form, goal difference, and
 * bookmaker odds (when priced). This is the per-team "trained" output signal.
 */
function computeStrengthIndex(form, oddsSignal) {
  const formScore = clamp(form.pointsPerGame / 3, 0, 1);             // 0..1
  const gdScore = clamp((form.goalDiffPerGame + 3) / 6, 0, 1);       // -3..+3 → 0..1
  const hasOdds = oddsSignal.avgImpliedWinPct != null;
  const oddsScore = hasOdds ? clamp(oddsSignal.avgImpliedWinPct / 100, 0, 1) : null;

  let index;
  if (hasOdds) index = 0.45 * formScore + 0.25 * gdScore + 0.30 * oddsScore;
  else index = 0.6 * formScore + 0.4 * gdScore;
  return round(index * 100, 1);
}

// ── Persistence ───────────────────────────────────────────────────────────────
function readTrainingProfile(slug) {
  const primary = path.join(mutableTrainingDir(), `${slug}.json`);
  const fallback = path.join(seededTrainingDir(), `${slug}.json`);
  return readJsonWithFallback(primary, fallback, null);
}
function readTrainingIndex() {
  const primary = path.join(mutableTrainingDir(), "_index.json");
  const fallback = path.join(seededTrainingDir(), "_index.json");
  return readJsonWithFallback(primary, fallback, { updatedAt: "", teams: [] });
}
function writeTrainingProfile(slug, record) {
  writeJson(path.join(mutableTrainingDir(), `${slug}.json`), record);
}
function writeTrainingIndex(index) {
  writeJson(path.join(mutableTrainingDir(), "_index.json"), index);
}

/**
 * Rebuild one team's training corpus from current signals, preserving the
 * fill-later slots (motivations, internetResearch) from any prior profile.
 */
function buildTrainingProfile(team, slug, league, reason) {
  const results = getTeamResults(slug) || { matches: [], league };
  const matches = Array.isArray(results.matches) ? results.matches : [];
  const form = formSignals(matches);
  const oddsSignal = oddsSignalForTeam(team);
  const manual = manualStatsForTeam(team);
  const strengthIndex = computeStrengthIndex(form, oddsSignal);

  const prior = readTrainingProfile(slug) || {};
  // Preserve fill-later content across rebuilds; seed motivations from manual notes once.
  const priorMotivations = Array.isArray(prior.motivations) ? prior.motivations : [];
  const motivations = priorMotivations.length ? priorMotivations : manual.seededMotivations;
  const internetResearch = Array.isArray(prior.internetResearch) ? prior.internetResearch : [];

  return {
    team,
    slug,
    league: results.league || league || prior.league || "",
    updatedAt: new Date().toISOString(),
    lastReason: reason || "",
    strengthIndex,
    signals: {
      form,
      odds: oddsSignal,
      screenshotStats: {
        manualEntryCount: manual.manualEntryCount,
        latestNotes: manual.latestNotes,
      },
    },
    // Fill-later training material (populated by you or a later automated job).
    motivations,
    internetResearch,
    // Manifest of how much training material currently backs this team.
    trainingMaterials: {
      espnResults: matches.length,
      pricedFixtures: oddsSignal.pricedFixtures,
      screenshotEntries: manual.manualEntryCount,
      motivations: motivations.length,
      internetResearch: internetResearch.length,
    },
  };
}

/** Union of teams to train: everything with ESPN results, plus tracked profiles. */
function teamsToTrain() {
  const map = new Map(); // slug -> { team, league }
  for (const t of readResultsIndex().teams || []) {
    map.set(t.slug, { team: t.team, league: t.league || "" });
  }
  return [...map.entries()].map(([slug, v]) => ({ slug, team: v.team, league: v.league }));
}

/**
 * Rebuild every team's training corpus. Called on each ESPN results refresh.
 * @returns {object} summary { profilesUpdated, teams: [...] }
 */
function updateTeamTrainingProfiles({ reason = "manual" } = {}) {
  _oddsCache = null; // force fresh odds read each rebuild
  const teams = teamsToTrain();
  const indexRows = [];
  for (const { slug, team, league } of teams) {
    const profile = buildTrainingProfile(team, slug, league, reason);
    writeTrainingProfile(slug, profile);
    indexRows.push({
      slug,
      team: profile.team,
      league: profile.league,
      strengthIndex: profile.strengthIndex,
      espnResults: profile.trainingMaterials.espnResults,
      last5: profile.signals.form.last5,
    });
  }
  const index = {
    updatedAt: new Date().toISOString(),
    reason,
    teamCount: indexRows.length,
    teams: indexRows.sort((a, b) => b.strengthIndex - a.strengthIndex),
  };
  writeTrainingIndex(index);
  return { profilesUpdated: indexRows.length, reason, teams: indexRows };
}

function listTeamTraining() {
  return readTrainingIndex();
}

function getTeamTraining(slugOrTeam) {
  const direct = readTrainingProfile(slugOrTeam);
  if (direct) return direct;
  return readTrainingProfile(slugifyTeam(slugOrTeam));
}

/**
 * Append a fill-later training note (motivation or internet research) to a team
 * and persist it. This is the mechanism for populating the slots over time.
 * @param {string} slugOrTeam
 * @param {object} note { type: "motivation"|"research", text, source?, date? }
 */
function appendTeamNote(slugOrTeam, note = {}) {
  const slug = readTrainingProfile(slugOrTeam) ? slugOrTeam : slugifyTeam(slugOrTeam);
  const profile = readTrainingProfile(slug);
  if (!profile) return null;
  const text = String(note.text || "").trim();
  if (!text) return null;
  const entry = {
    text,
    source: String(note.source || "manual").trim(),
    date: note.date || new Date().toISOString().slice(0, 10),
    addedAt: new Date().toISOString(),
  };
  const type = String(note.type || "research").toLowerCase();
  if (type === "motivation") {
    profile.motivations = [entry, ...(Array.isArray(profile.motivations) ? profile.motivations : [])];
  } else {
    profile.internetResearch = [entry, ...(Array.isArray(profile.internetResearch) ? profile.internetResearch : [])];
  }
  profile.trainingMaterials.motivations = (profile.motivations || []).length;
  profile.trainingMaterials.internetResearch = (profile.internetResearch || []).length;
  profile.updatedAt = new Date().toISOString();
  writeTrainingProfile(slug, profile);
  return profile;
}

module.exports = {
  updateTeamTrainingProfiles,
  listTeamTraining,
  getTeamTraining,
  appendTeamNote,
  buildTrainingProfile,
  computeStrengthIndex,
  mutableTrainingDir,
  seededTrainingDir,
};
