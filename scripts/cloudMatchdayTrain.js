#!/usr/bin/env node
"use strict";
/**
 * Cloud matchday training pass (GitHub Actions cron entrypoint).
 *
 * Runs the mechanical half of the "matchday coach" with no LLM / API key:
 *   1. Force-sync the ESPN World Cup scoreboard (results + live player stats),
 *      auto-creating and settling tracked predictions.
 *   2. If new matches settled since the last recorded pass, rebuild the
 *      training summary, run the auto-tuner, and regrade/roll the daily slip.
 *   3. Print a JSON summary and set CHANGES=yes|no for the workflow so it only
 *      commits when something actually changed.
 *
 * Idempotent: if no new matches have completed, it exits cleanly without
 * touching tuning/accuracy history, so cron runs on quiet days are no-ops.
 *
 * Run:  node scripts/cloudMatchdayTrain.js
 */

const fs = require("fs");

function setOutput(key, value) {
  // Expose a value to later GitHub Actions steps when running in CI.
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    try { fs.appendFileSync(out, `${key}=${value}\n`); } catch (_) { /* ignore */ }
  }
}

async function main() {
  const { refreshWorldCupResults, syncWorldCupPlayerStats, readWorldCupResults } = require("../src/worldCupSync");
  const { rebuildInternationalTrainingSummary } = require("../src/internationalTraining");
  const { runAutoTune, readAccuracyHistory } = require("../src/autoTune");
  const { gradeDailySlips, generateDailySlip, readCapitalLedger } = require("../src/dailyParlay");

  const lastSnapshot = readAccuracyHistory().latest || null;
  const lastWcMatches = Number(lastSnapshot?.wcMatches || 0);

  // 1. Force-sync results + player stats.
  const sync = await refreshWorldCupResults({ force: true });
  await syncWorldCupPlayerStats();

  const completedNow = readWorldCupResults().results.filter((r) => r.completed).length;
  const newlySettled = Number(sync.settled || 0);
  const hasNewResults = completedNow > lastWcMatches || newlySettled > 0;

  const summary = {
    at: new Date().toISOString(),
    completedMatches: completedNow,
    previousWcMatches: lastWcMatches,
    newlySettledThisRun: newlySettled,
    hasNewResults,
  };

  if (!hasNewResults) {
    summary.action = "no-op: no new World Cup matches completed since last pass";
    setOutput("CHANGES", "no");
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // 2. New results — full training pass.
  rebuildInternationalTrainingSummary();
  const tune = runAutoTune({ reason: "cloud-cron-matchday" });
  gradeDailySlips();
  const ledger = generateDailySlip();

  summary.action = "trained";
  summary.rawAccuracy = tune.tunedRawAccuracy;
  summary.highConfidenceAccuracy = tune.highConfidenceAccuracy;
  summary.highConfidencePicks = tune.highConfidencePicks;
  summary.currentMatchday = tune.currentMatchday;
  summary.targetMatchday = tune.targetMatchday;
  summary.targetMet = tune.targetMet;
  summary.bankroll = readCapitalLedger().bankroll;
  setOutput("CHANGES", "yes");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("cloud matchday train failed:", err.stack || err.message);
  process.exit(1);
});
