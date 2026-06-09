/**
 * scripts/buildTeamTraining.js
 *
 * Builds (or refreshes) the per-team ESPN results files and the per-team
 * continuous training corpus.
 *
 *   node scripts/buildTeamTraining.js            # use cached ESPN results snapshot
 *   node scripts/buildTeamTraining.js --fetch    # fetch fresh results from ESPN first
 *
 * Run locally and commit the generated data/teams/** files so the hosted
 * deploy ships with an up-to-date seed.
 */

"use strict";

const { readResultsSnapshot, refreshEspnResults } = require("../src/espnFixtureService");
const { updateTeamResultsFromEspn, listTeamResults } = require("../src/teamResultsStore");
const { updateTeamTrainingProfiles } = require("../src/teamTrainingStore");

async function main() {
  const fetchFresh = process.argv.includes("--fetch");

  if (fetchFresh) {
    console.log("Fetching fresh results from ESPN (daysBack=120)...");
    // refreshEspnResults already updates per-team results + training internally.
    const snap = await refreshEspnResults({ daysBack: 120, daysForward: 1, force: true });
    console.log(`ESPN fetched ${snap.fetched} results; settled ${snap.settled} predictions.`);
  } else {
    const snap = readResultsSnapshot();
    const results = Array.isArray(snap?.results) ? snap.results : [];
    console.log(`Using cached ESPN snapshot: ${results.length} results.`);
    if (!results.length) {
      console.log("No cached results found. Re-run with --fetch to pull from ESPN.");
    }
    updateTeamResultsFromEspn(results);
    updateTeamTrainingProfiles({ reason: "cli-build" });
  }

  const resultsIndex = listTeamResults();
  const trainingIndex = require("../src/teamTrainingStore").listTeamTraining();
  console.log(`\nPer-team results files: ${resultsIndex.teamCount ?? (resultsIndex.teams || []).length} teams`);
  console.log(`Per-team training profiles: ${trainingIndex.teamCount ?? (trainingIndex.teams || []).length} teams`);

  const top = (trainingIndex.teams || []).slice(0, 12);
  if (top.length) {
    console.log("\nTop strength indices:");
    for (const t of top) {
      console.log(`  ${String(t.strengthIndex).padStart(5)}  ${t.team} (${t.league || "?"})  form:${t.last5 || "—"}  results:${t.espnResults}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
