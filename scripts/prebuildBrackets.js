#!/usr/bin/env node
"use strict";
/**
 * Pre-generates bracket JSON files at build time so Vercel can serve them
 * instantly without timeout risk.
 *
 * Run:  node scripts/prebuildBrackets.js
 * Vercel build command runs this automatically before deploying.
 *
 * Output: data/cached/brackets/
 *   champions-league.json
 *   europa-league.json
 *   conference-league.json
 *   international.json
 */

const fs   = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "data", "cached", "brackets");
fs.mkdirSync(OUT_DIR, { recursive: true });

let errors = 0;

// ── Club brackets ─────────────────────────────────────────────────────────────
try {
  const { projectClubBracket } = require("../src/clubBracketProjection");
  for (const comp of ["champions-league", "europa-league", "conference-league"]) {
    try {
      console.log(`Generating ${comp} bracket…`);
      const bracket = projectClubBracket(comp);
      const outPath = path.join(OUT_DIR, `${comp}.json`);
      fs.writeFileSync(outPath, JSON.stringify(bracket), "utf8");
      console.log(`  ✓ Saved ${outPath}`);
    } catch (err) {
      console.error(`  ✗ ${comp}: ${err.message}`);
      errors++;
    }
  }
} catch (err) {
  console.error(`Could not load clubBracketProjection: ${err.message}`);
  errors++;
}

// ── International (World Cup) bracket ────────────────────────────────────────
try {
  const { projectTournament } = require("../src/tournamentProjection");
  try {
    console.log("Generating international (WC 2026) bracket…");
    const bracket = projectTournament();
    const outPath = path.join(OUT_DIR, "international.json");
    fs.writeFileSync(outPath, JSON.stringify(bracket), "utf8");
    console.log(`  ✓ Saved ${outPath}`);
  } catch (err) {
    console.error(`  ✗ international: ${err.message}`);
    errors++;
  }
} catch (err) {
  console.error(`Could not load tournamentProjection: ${err.message}`);
  errors++;
}

if (errors === 0) {
  console.log("\nAll brackets pre-generated successfully.");
} else {
  console.warn(`\n${errors} bracket(s) failed — check data/uefa/ and data/international/ files.`);
  // Don't exit(1) so the Vercel build doesn't fail completely
}
