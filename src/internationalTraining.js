"use strict";
/**
 * Continuous training for the international model.
 *
 * Builds data/international/processed/friendly_training_summary.json from two
 * evidence streams:
 *   1. Pre-WC friendlies  — DOWN-WEIGHTED (seriousness 0.6): warm-ups signal
 *      capability, not competitive-grade evidence.
 *   2. World Cup results  — FULL weight (seriousness 1.0): live tournament
 *      matches auto-fetched from ESPN as they finish.
 *
 * Both streams are recency-weighted (90-day half-life around the WC window)
 * and feed the ±4 rating-point form delta consumed by ratingFor()/
 * friendlyFormAdjustment() in internationalData.js. Rebuilt automatically by
 * the World Cup sync after every newly settled match, so the model keeps
 * learning as the tournament progresses.
 */

const fs = require("fs");
const path = require("path");
const { mutableDataPath, readJsonWithFallback } = require("./runtimePaths");

const FRIENDLY_PATH = path.join(process.cwd(), "data", "international", "friendly_results.json");
const WC_RESULTS_PATH = mutableDataPath("international", "world_cup_results.json");
const FIXTURES_PATH = path.join(process.cwd(), "data", "international", "world_cup_2026_fixtures.json");
const OUT_DIR_REPO = path.join(process.cwd(), "data", "international", "processed");
const OUT_PATH = mutableDataPath("international", "processed", "friendly_training_summary.json");

const WC_KICKOFF = new Date("2026-06-11T00:00:00Z").getTime();
const FRIENDLY_SERIOUSNESS = 0.6;
const TOURNAMENT_SERIOUSNESS = 1.0;
const RECENCY_HALF_LIFE_DAYS = 90;

const TEAM_ALIASES = {
  "United States": "USA",
  "South Korea": "Korea Republic",
  "Korea": "Korea Republic",
  "Iran": "IR Iran",
  "Ivory Coast": "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire",
  "Cape Verde": "Cabo Verde",
  "Cape Verde Islands": "Cabo Verde",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "Bosnia": "Bosnia and Herzegovina",
  "Turkey": "Türkiye",
  "Turkiye": "Türkiye",
  "Czech Republic": "Czechia",
  "DR Congo": "Congo DR",
  "Curacao": "Curaçao",
};

function normalizeIntlTeam(name) {
  const trimmed = String(name || "").trim();
  return TEAM_ALIASES[trimmed] || trimmed;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^﻿/, ""));
  } catch (_) {
    return fallback;
  }
}

function recencyWeight(dateStr) {
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (!Number.isFinite(t)) return 0.5;
  const daysAway = Math.abs(WC_KICKOFF - t) / 86400000;
  return Math.pow(0.5, daysAway / RECENCY_HALF_LIFE_DAYS);
}

function rebuildInternationalTrainingSummary() {
  const friendlySnapshot = readJson(FRIENDLY_PATH, null);
  const friendlies = Array.isArray(friendlySnapshot?.results) ? friendlySnapshot.results : [];
  const wcSnapshot = readJsonWithFallback(WC_RESULTS_PATH, null, null);
  const wcResults = Array.isArray(wcSnapshot?.results) ? wcSnapshot.results.filter((r) => r.completed) : [];
  const wcTeams = (readJson(FIXTURES_PATH, { teams: [] }).teams || []).map(normalizeIntlTeam);
  const wcSet = new Set(wcTeams);

  const teams = {};
  const ensure = (team) => {
    if (!teams[team]) {
      teams[team] = {
        matches: 0, tournamentMatches: 0, weightSum: 0, weightedPoints: 0,
        goalsFor: 0, goalsAgainst: 0, weightedGoalsFor: 0, weightedGoalsAgainst: 0,
        cleanSheets: 0, bttsCount: 0, lastResults: [],
      };
    }
    return teams[team];
  };

  const ingest = (rows, seriousness, label) => {
    for (const r of rows) {
      const home = normalizeIntlTeam(r.homeTeam);
      const away = normalizeIntlTeam(r.awayTeam);
      const hg = Number(r.homeGoals);
      const ag = Number(r.awayGoals);
      if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
      const weight = seriousness * recencyWeight(r.date);
      for (const [team, scored, conceded, opponent] of [[home, hg, ag, away], [away, ag, hg, home]]) {
        if (!wcSet.has(team)) continue;
        const entry = ensure(team);
        entry.matches += 1;
        if (label === "world-cup") entry.tournamentMatches += 1;
        entry.weightSum += weight;
        entry.weightedPoints += weight * (scored > conceded ? 3 : scored === conceded ? 1 : 0);
        entry.goalsFor += scored;
        entry.goalsAgainst += conceded;
        entry.weightedGoalsFor += weight * scored;
        entry.weightedGoalsAgainst += weight * conceded;
        if (conceded === 0) entry.cleanSheets += 1;
        if (scored > 0 && conceded > 0) entry.bttsCount += 1;
        entry.lastResults.push({
          date: r.date, opponent, scored, conceded,
          outcome: scored > conceded ? "W" : scored === conceded ? "D" : "L",
          competition: label,
          weight: Math.round(weight * 1000) / 1000,
        });
      }
    }
  };

  ingest(friendlies, FRIENDLY_SERIOUSNESS, "friendly");
  ingest(wcResults, TOURNAMENT_SERIOUSNESS, "world-cup");

  const output = {
    generatedAt: new Date().toISOString(),
    sourceResults: friendlies.length,
    tournamentResults: wcResults.length,
    friendlySeriousness: FRIENDLY_SERIOUSNESS,
    tournamentSeriousness: TOURNAMENT_SERIOUSNESS,
    recencyHalfLifeDays: RECENCY_HALF_LIFE_DAYS,
    teams: {},
  };
  for (const [team, e] of Object.entries(teams)) {
    e.lastResults.sort((a, b) => a.date.localeCompare(b.date));
    const ratio = e.weightSum > 0 ? e.weightedPoints / (e.weightSum * 3) : 0.5;
    const formDelta = Math.round((ratio * 2 - 1) * 4 * 10) / 10;
    output.teams[team] = {
      matches: e.matches,
      tournamentMatches: e.tournamentMatches,
      weightedFormDelta: e.matches >= 2 ? formDelta : 0,
      goalsForPerMatch: e.matches ? Math.round((e.goalsFor / e.matches) * 100) / 100 : 0,
      goalsAgainstPerMatch: e.matches ? Math.round((e.goalsAgainst / e.matches) * 100) / 100 : 0,
      weightedGoalsForPerMatch: e.weightSum ? Math.round((e.weightedGoalsFor / e.weightSum) * 100) / 100 : 0,
      weightedGoalsAgainstPerMatch: e.weightSum ? Math.round((e.weightedGoalsAgainst / e.weightSum) * 100) / 100 : 0,
      cleanSheetRate: e.matches ? Math.round((e.cleanSheets / e.matches) * 100) / 100 : 0,
      bttsRate: e.matches ? Math.round((e.bttsCount / e.matches) * 100) / 100 : 0,
      lastResults: e.lastResults.slice(-10),
    };
  }

  try {
    fs.mkdirSync(OUT_DIR_REPO, { recursive: true });
  } catch (_) { /* read-only runtime — mutableDataPath redirects below */ }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
  return output;
}

module.exports = {
  rebuildInternationalTrainingSummary,
  normalizeIntlTeam,
  TRAINING_SUMMARY_PATH: OUT_PATH,
};
