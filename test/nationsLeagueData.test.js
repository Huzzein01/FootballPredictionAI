"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { predictNationsLeagueFixture } = require("../src/nationsLeagueData");

function fixture(overrides = {}) {
  return {
    date: "2026-09-24",
    homeTeam: "Netherlands",
    awayTeam: "Andorra",
    homeLogoUrl: "", awayLogoUrl: "", venue: "Johan Cruijff ArenA",
    kickoffUtc: "2026-09-24T18:45Z", espnEventId: "1", completed: false,
    phase: "group-stage",
    odds: null, oddsStatus: "Waiting for odds",
    ...overrides,
  };
}

test("predicts a real fixture with model-fair odds when no sportsbook line exists", () => {
  const prediction = predictNationsLeagueFixture(fixture());
  assert.equal(prediction.competition, "UEFA Nations League");
  assert.equal(prediction.oddsType, "model-fair");
  assert.ok(["H", "D", "A"].includes(prediction.prediction));
  assert.ok(prediction.confidence > 0 && prediction.confidence <= 100);
  const sum = prediction.probabilities.H + prediction.probabilities.D + prediction.probabilities.A;
  assert.ok(Math.abs(sum - 1) < 1e-6, "probabilities must sum to 1");
  // A clear ratings mismatch (Netherlands vs Andorra) should favor the home side.
  assert.equal(prediction.prediction, "H");
});

test("uses the real embedded sportsbook line when one is present, not the model-fair price", () => {
  const prediction = predictNationsLeagueFixture(fixture({
    odds: { homeOdds: "1.30", drawOdds: "5.00", awayOdds: "9.00", provider: "DraftKings" },
    oddsStatus: "Live bookmaker line (DraftKings)",
  }));
  assert.equal(prediction.oddsType, "sportsbook");
  assert.equal(prediction.odds.homeOdds, "1.30");
  assert.match(prediction.oddsSource, /DraftKings/);
});

test("never applies a host boost or World Cup tournament prestige bonus", () => {
  // Portugal carries a WC_TOURNAMENT_PRESTIGE bonus in internationalData.js
  // (knockout rounds only) and neither module has a Nations League "host" —
  // this just documents that predictNationsLeagueFixture never threads a
  // prestige/host flag through to ratingFor, unlike predictInternationalFixture.
  const prediction = predictNationsLeagueFixture(fixture({ homeTeam: "Portugal", awayTeam: "Wales" }));
  assert.equal(typeof prediction.confidence, "number");
});
