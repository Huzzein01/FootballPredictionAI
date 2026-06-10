#!/usr/bin/env node
"use strict";
/**
 * Second-batch training pass over pre-World Cup international friendlies.
 *
 * Reads data/international/friendly_results.json (ESPN scoreboard results,
 * Dec 2025 – Jun 2026) and produces a per-team training summary used by the
 * international prediction model:
 *
 *   - ESPN team names are normalized to FIFA names (United States → USA,
 *     South Korea → Korea Republic, Ivory Coast → Côte d'Ivoire, …) so that
 *     every World Cup squad's friendlies are actually matched.
 *   - Friendlies are deliberately DOWN-WEIGHTED (seriousness factor 0.6):
 *     teams showcase capability in warm-ups, but results are softer evidence
 *     than competitive matches.
 *   - Recency weighting (90-day half-life from the WC kickoff) so the
 *     June 2026 warm-up window dominates a result from December.
 *
 * Output: data/international/processed/friendly_training_summary.json
 *   { teams: { [fifaName]: { matches, weightedFormDelta, goalsForPerMatch,
 *     goalsAgainstPerMatch, cleanSheetRate, bttsRate, lastResults[] } } }
 *
 * Run:  node scripts/trainInternationalFriendlies.js
 * Also runs as part of the Vercel buildCommand.
 */

const fs = require("fs");
const path = require("path");

const FRIENDLY_PATH = path.join(__dirname, "..", "data", "international", "friendly_results.json");
const FIXTURES_PATH = path.join(__dirname, "..", "data", "international", "world_cup_2026_fixtures.json");
const OUT_DIR = path.join(__dirname, "..", "data", "international", "processed");
const OUT_PATH = path.join(OUT_DIR, "friendly_training_summary.json");

const WC_KICKOFF = new Date("2026-06-11T00:00:00Z").getTime();
const FRIENDLY_SERIOUSNESS = 0.6; // friendlies count 60% of a competitive match
const RECENCY_HALF_LIFE_DAYS = 90;

// ESPN / common names → FIFA fixture-feed names
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
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^﻿/, ""));
}

function recencyWeight(dateStr) {
  const t = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (!Number.isFinite(t)) return 0.5;
  const daysBefore = Math.max(0, (WC_KICKOFF - t) / 86400000);
  return Math.pow(0.5, daysBefore / RECENCY_HALF_LIFE_DAYS);
}

function main() {
  const snapshot = readJson(FRIENDLY_PATH, null);
  const results = Array.isArray(snapshot && snapshot.results) ? snapshot.results : [];
  const wcTeams = (readJson(FIXTURES_PATH, { teams: [] }).teams || []).map(normalizeIntlTeam);
  const wcSet = new Set(wcTeams);

  const teams = {};
  const ensure = (team) => {
    if (!teams[team]) {
      teams[team] = {
        matches: 0,
        weightSum: 0,
        weightedPoints: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        weightedGoalsFor: 0,
        weightedGoalsAgainst: 0,
        cleanSheets: 0,
        bttsCount: 0,
        lastResults: [],
      };
    }
    return teams[team];
  };

  for (const r of results) {
    const home = normalizeIntlTeam(r.homeTeam);
    const away = normalizeIntlTeam(r.awayTeam);
    const hg = Number(r.homeGoals);
    const ag = Number(r.awayGoals);
    if (!Number.isFinite(hg) || !Number.isFinite(ag)) continue;
    const weight = FRIENDLY_SERIOUSNESS * recencyWeight(r.date);
    for (const [team, scored, conceded, opponent] of [
      [home, hg, ag, away],
      [away, ag, hg, home],
    ]) {
      if (!wcSet.has(team)) continue;
      const entry = ensure(team);
      entry.matches += 1;
      entry.weightSum += weight;
      entry.weightedPoints += weight * (scored > conceded ? 3 : scored === conceded ? 1 : 0);
      entry.goalsFor += scored;
      entry.goalsAgainst += conceded;
      entry.weightedGoalsFor += weight * scored;
      entry.weightedGoalsAgainst += weight * conceded;
      if (conceded === 0) entry.cleanSheets += 1;
      if (scored > 0 && conceded > 0) entry.bttsCount += 1;
      entry.lastResults.push({
        date: r.date,
        opponent,
        scored,
        conceded,
        outcome: scored > conceded ? "W" : scored === conceded ? "D" : "L",
        weight: Math.round(weight * 1000) / 1000,
      });
    }
  }

  const output = { generatedAt: new Date().toISOString(), sourceResults: results.length, friendlySeriousness: FRIENDLY_SERIOUSNESS, recencyHalfLifeDays: RECENCY_HALF_LIFE_DAYS, teams: {} };
  for (const [team, e] of Object.entries(teams)) {
    e.lastResults.sort((a, b) => a.date.localeCompare(b.date));
    // Weighted points ratio in [0,1] → form delta in [-4, +4] rating points.
    const ratio = e.weightSum > 0 ? e.weightedPoints / (e.weightSum * 3) : 0.5;
    const formDelta = Math.round((ratio * 2 - 1) * 4 * 10) / 10;
    output.teams[team] = {
      matches: e.matches,
      weightedFormDelta: e.matches >= 2 ? formDelta : 0,
      goalsForPerMatch: e.matches ? Math.round((e.goalsFor / e.matches) * 100) / 100 : 0,
      goalsAgainstPerMatch: e.matches ? Math.round((e.goalsAgainst / e.matches) * 100) / 100 : 0,
      weightedGoalsForPerMatch: e.weightSum ? Math.round((e.weightedGoalsFor / e.weightSum) * 100) / 100 : 0,
      weightedGoalsAgainstPerMatch: e.weightSum ? Math.round((e.weightedGoalsAgainst / e.weightSum) * 100) / 100 : 0,
      cleanSheetRate: e.matches ? Math.round((e.cleanSheets / e.matches) * 100) / 100 : 0,
      bttsRate: e.matches ? Math.round((e.bttsCount / e.matches) * 100) / 100 : 0,
      lastResults: e.lastResults.slice(-8),
    };
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");

  const covered = wcTeams.filter((t) => output.teams[t] && output.teams[t].matches > 0);
  console.log(`Friendly training summary written: ${OUT_PATH}`);
  console.log(`WC teams covered: ${covered.length}/${wcTeams.length}`);
  const uncovered = wcTeams.filter((t) => !output.teams[t] || !output.teams[t].matches);
  if (uncovered.length) console.log(`No friendly data for: ${uncovered.join(", ")}`);
}

main();
