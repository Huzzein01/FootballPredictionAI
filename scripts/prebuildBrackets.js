#!/usr/bin/env node
"use strict";
/**
 * Pre-generates all bracket and futures JSON files at build time so Vercel
 * can serve them instantly without timeout risk.
 *
 * Run:  node scripts/prebuildBrackets.js
 * Vercel buildCommand runs this before deploying.
 *
 * Output: data/cached/brackets/   — competition bracket JSONs
 *         data/cached/futures/    — futures prediction JSONs
 *         data/cached/cups/       — domestic cup bracket JSONs
 */

const fs   = require("fs");
const path = require("path");

const BRACKETS_DIR = path.join(__dirname, "..", "data", "cached", "brackets");
const FUTURES_DIR  = path.join(__dirname, "..", "data", "cached", "futures");
const CUPS_DIR     = path.join(__dirname, "..", "data", "cached", "cups");
fs.mkdirSync(BRACKETS_DIR, { recursive: true });
fs.mkdirSync(FUTURES_DIR,  { recursive: true });
fs.mkdirSync(CUPS_DIR,     { recursive: true });

let errors = 0;

function save(outPath, data) {
  fs.writeFileSync(outPath, JSON.stringify(data), "utf8");
  console.log(`  ✓ ${outPath}`);
}

function fail(label, err) {
  console.error(`  ✗ ${label}: ${err.message}`);
  errors++;
}

// ── UEFA club brackets ─────────────────────────────────────────────────────
try {
  const { projectClubBracket } = require("../src/clubBracketProjection");
  for (const comp of ["champions-league", "europa-league", "conference-league"]) {
    try {
      console.log(`Generating ${comp} bracket…`);
      save(path.join(BRACKETS_DIR, `${comp}.json`), projectClubBracket(comp));
    } catch (err) { fail(comp, err); }
  }
} catch (err) { fail("clubBracketProjection load", err); }

// ── International (World Cup) bracket ─────────────────────────────────────
try {
  const { projectTournament } = require("../src/tournamentProjection");
  try {
    console.log("Generating international (WC 2026) bracket…");
    save(path.join(BRACKETS_DIR, "international.json"), projectTournament());
  } catch (err) { fail("international bracket", err); }
} catch (err) { fail("tournamentProjection load", err); }

// ── Domestic cup brackets ──────────────────────────────────────────────────
try {
  const { projectDomesticCup, CUP_CONFIG } = require("../src/domesticCupProjection");
  for (const cupId of Object.keys(CUP_CONFIG)) {
    try {
      console.log(`Generating ${cupId} bracket…`);
      save(path.join(CUPS_DIR, `${cupId}.json`), projectDomesticCup(cupId));
    } catch (err) { fail(cupId, err); }
  }
} catch (err) { fail("domesticCupProjection load", err); }

// ── Futures predictions ────────────────────────────────────────────────────
// We pre-generate futures for the most common request combinations.
// These are served by the server cache-first, recomputed on local dev.
async function buildFutures() {
  let futuresPredictions;
  try {
    ({ futuresPredictions } = require("../src/futuresService"));
  } catch (err) {
    fail("futuresService load", err);
    return;
  }

  const SEASONS = ["2025-26", "2026-27"];
  const LEAGUES = ["All", "EPL", "La Liga", "Bundesliga", "Ligue 1", "Serie A",
                   "Champions League", "Europa League", "Conference League"];

  // International futures
  try {
    console.log("Generating international futures…");
    const data = await futuresPredictions({ context: "international", season: "2026 World Cup" });
    save(path.join(FUTURES_DIR, "international__2026-World-Cup.json"), data);
  } catch (err) { fail("international futures", err); }

  // Club futures
  for (const season of SEASONS) {
    for (const league of LEAGUES) {
      const key = `club__${season}__${league.replace(/[^a-zA-Z0-9]/g, "-")}`;
      try {
        console.log(`Generating futures ${key}…`);
        const data = await futuresPredictions({ context: "club", season, league });
        save(path.join(FUTURES_DIR, `${key}.json`), data);
      } catch (err) { fail(key, err); }
    }
  }
}

buildFutures().then(() => {
  if (errors === 0) {
    console.log("\nAll cache files pre-generated successfully.");
  } else {
    console.warn(`\n${errors} item(s) failed — check data/ and src/ for details.`);
  }
});
