"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { searchClubs, buildClubDossier, resolveClubName } = require("../src/clubDossier");

test("searchClubs finds real tracked teams by substring, ranking prefix matches first", () => {
  const results = searchClubs("arsen");
  assert.ok(results.length >= 1);
  assert.ok(results.some((r) => r.team === "Arsenal"));
  assert.ok(results[0].team.toLowerCase().startsWith("arsen"));
});

test("searchClubs auto-prefills the most-tracked clubs for an empty query, and returns nothing for an unmatched one", () => {
  const prefilled = searchClubs("");
  assert.ok(prefilled.length > 0, "an empty query should auto-prefill results, not come back empty");
  // Sorted by matchCount descending — each entry's matchCount should never
  // exceed the one before it.
  for (let i = 1; i < prefilled.length; i += 1) {
    assert.ok(prefilled[i - 1].matchCount >= prefilled[i].matchCount);
  }
  assert.deepEqual(searchClubs("zzzzzznotarealclub"), []);
});

test("resolveClubName finds the canonical team name for a partial query", () => {
  assert.equal(resolveClubName("arsenal"), "Arsenal");
});

test("buildClubDossier returns real form data, match history, and predictions — never fabricated heritage facts", () => {
  const dossier = buildClubDossier("Arsenal", { season: "2026-27" });
  assert.ok(dossier);
  assert.equal(dossier.team, "Arsenal");
  assert.equal(typeof dossier.summary, "string");
  assert.ok(dossier.summary.length > 0);
  // The summary must be built only from real, already-tracked form signals
  // — never claim things like a founding year or trophy count we have no
  // verified source for anywhere in this codebase.
  assert.doesNotMatch(dossier.summary.toLowerCase(), /founded|trophy|trophies|championship title/);
  assert.ok(Array.isArray(dossier.matchHistory.recent));
  assert.ok(Array.isArray(dossier.predictions.upcoming));
  dossier.predictions.upcoming.forEach((prediction) => {
    assert.ok(prediction.homeTeam === "Arsenal" || prediction.awayTeam === "Arsenal");
  });
});

test("buildClubDossier returns null for a team with no tracked data", () => {
  assert.equal(buildClubDossier("Totally Fictional FC Not In Any Dataset"), null);
});
