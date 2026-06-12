#!/usr/bin/env node
"use strict";
/**
 * Rebuilds the international training summary from pre-WC friendlies
 * (down-weighted, seriousness 0.6) and live World Cup results (full weight).
 *
 * The computation lives in src/internationalTraining.js and is also invoked
 * automatically by the World Cup sync whenever a match is settled, so this
 * script is mainly for the Vercel build step and manual refreshes.
 *
 * Run:  node scripts/trainInternationalFriendlies.js
 */

const { rebuildInternationalTrainingSummary, TRAINING_SUMMARY_PATH } = require("../src/internationalTraining");

const output = rebuildInternationalTrainingSummary();
const covered = Object.values(output.teams).filter((t) => t.matches > 0).length;
console.log(`International training summary written: ${TRAINING_SUMMARY_PATH}`);
console.log(`Teams covered: ${covered} | friendlies: ${output.sourceResults} | WC results: ${output.tournamentResults}`);
