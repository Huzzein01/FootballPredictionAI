"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { emptyHistory, validateHistory, seasonFromDate } = require("../src/footballHistory/schema");
const { sourcePlan } = require("../src/footballHistory/sources");

test("team history contract requires attributed, settled historic matches", () => {
  const record = emptyHistory({ team: "Example FC", slug: "example-fc" });
  record.sourcePlan = sourcePlan(record.team);
  record.matches.push({ id: "example-1985-01", date: "1985-08-17", season: "1985-86", competition: { name: "Example League" }, opponent: { name: "Opponent", slug: "opponent" }, venue: "home", score: { for: 2, against: 1 }, sources: [{ url: "https://example.test/match", retrievedAt: "2026-08-04T00:00:00.000Z" }] });
  assert.equal(validateHistory(record).valid, true);
  assert.equal(seasonFromDate("1985-08-17"), "1985-86");
});
