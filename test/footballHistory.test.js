"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { emptyHistory, validateHistory, seasonFromDate } = require("../src/footballHistory/schema");
const { sourcePlan } = require("../src/footballHistory/sources");
const { tableForMatches } = require("../src/footballHistory/standings");
const { snapshotFor } = require("../src/footballHistory/training");
const { stageRank } = require("../src/footballHistory/competitionProgress");

test("team history contract requires attributed, settled historic matches", () => {
  const record = emptyHistory({ team: "Example FC", slug: "example-fc" });
  record.sourcePlan = sourcePlan(record.team);
  record.matches.push({ id: "example-1985-01", date: "1985-08-17", season: "1985-86", competition: { name: "Example League" }, opponent: { name: "Opponent", slug: "opponent" }, venue: "home", score: { for: 2, against: 1 }, sources: [{ url: "https://example.test/match", retrievedAt: "2026-08-04T00:00:00.000Z" }] });
  assert.equal(validateHistory(record).valid, true);
  assert.equal(record.coverage.competitionScopeVerified, false);
  assert.equal(seasonFromDate("1985-08-17"), "1985-86");
});

test("knockout stages preserve progression order without pretending to be tables", () => {
  assert.ok(stageRank("Final") > stageRank("Quarter-Final"));
  assert.equal(stageRank("league"), 0);
});

test("league tables are derived deterministically from recorded home fixtures", () => {
  const rows = tableForMatches([{ teamName: "Alpha", opponent: { name: "Beta" }, venue: "home", score: { for: 2, against: 0 } }, { teamName: "Gamma", opponent: { name: "Alpha" }, venue: "home", score: { for: 1, against: 1 } }]);
  assert.equal(rows[0].team, "Alpha");
  assert.equal(rows[0].points, 4);
});

test("training snapshots only use matches strictly before cutoff", () => {
  const record = emptyHistory({ team: "Example FC", slug: "example-fc" }); record.sourcePlan = sourcePlan(record.team);
  record.matches = ["1985-08-17", "1985-08-24"].map((date, index) => ({ id: `m${index}`, date, season: "1985-86", competition: { name: "Example League" }, opponent: { name: "Opponent", slug: "opponent" }, venue: "home", score: { for: 1, against: 0 }, result: "W", sources: [{ url: "https://example.test/match", retrievedAt: "2026-08-04T00:00:00.000Z" }] }));
  const snapshot = snapshotFor(record, "1985-08-24");
  assert.equal(snapshot.matchesUsed, 1);
  assert.equal(snapshot.historyEnd, "1985-08-17");
});
