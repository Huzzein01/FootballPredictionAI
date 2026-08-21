"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const store = require("../src/sharedSportModel/parlayLedgerStore");

// Every store call in this file passes an explicit temp `root`, the same
// isolation convention baseballModel/productionService.js's tests already
// use — never touches the real data/multi_sport_parlay_backtests.json.
function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "parlay-ledger-test-"));
}

function sampleParlay(overrides = {}) {
  return {
    sport: "baseball", riskMode: "balanced", combinedOdds: 4.6, combinedProbability: 0.174,
    legs: [
      { sport: "baseball", date: "2026-08-20", matchup: "New York Yankees @ Baltimore Orioles", pick: "Baltimore Orioles", probability: 0.515, decimalOdds: 1.98, oddsSource: "market" },
      { sport: "baseball", date: "2026-08-21", matchup: "A @ B", pick: "B", probability: 0.55, decimalOdds: 1.8, oddsSource: "model" },
    ],
    ...overrides,
  };
}

test("saves a parlay, dedupes an identical re-save, and rejects legless entries", () => {
  const root = tempRoot();
  const saved = store.saveParlaysIfMissing([sampleParlay()], root);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].status, "PENDING");
  assert.equal(saved[0].legs.length, 2);

  const dup = store.saveParlaysIfMissing([sampleParlay()], root);
  assert.equal(dup.length, 0, "an identical parlay must not be saved twice");

  const empty = store.saveParlaysIfMissing([{ sport: "baseball", legs: [] }], root);
  assert.equal(empty.length, 0, "a parlay with no legs must be rejected");
});

test("caps request size, legs per parlay, and string lengths defensively", () => {
  const root = tempRoot();
  const huge = {
    sport: "baseball",
    legs: Array.from({ length: 50 }, () => ({ sport: "baseball", date: "x".repeat(5000), matchup: "y".repeat(5000), pick: "z".repeat(5000), probability: 999, decimalOdds: -5 })),
  };
  const saved = store.saveParlaysIfMissing([huge], root);
  assert.equal(saved.length, 1);
  assert.ok(saved[0].legs.length <= 8, "legs per parlay must be capped");
  assert.ok(saved[0].legs[0].date.length <= 20, "leg string fields must be truncated");
  assert.ok(saved[0].legs[0].probability <= 1, "probability must be clamped to [0,1]");
  assert.equal(saved[0].legs[0].decimalOdds, null, "negative odds must be rejected, not stored");
});

test("auto-settles a pending leg once its game completes, and recomputes ticket status", () => {
  const root = tempRoot();
  const [saved] = store.saveParlaysIfMissing([sampleParlay({ legs: [
    { sport: "baseball", date: "2026-09-01", matchup: "Home @ Away", pick: "Away", probability: 0.6, decimalOdds: 1.7, oddsSource: "market" },
  ] })], root);
  const settledCount = store.autoSettleFromResults("baseball", [
    { date: "2026-09-01", homeTeam: "Away", awayTeam: "Home", homeScore: 3, awayScore: 5, completed: true },
  ], root);
  assert.equal(settledCount, 1);
  const [ticket] = store.listParlays("baseball", root).filter((item) => item.id === saved.id);
  assert.equal(ticket.legs[0].status, "MISS", "pick was 'Away' but the away team (Home) actually won");
  assert.equal(ticket.status, "MISS");
});

test("summary computes hit rates and only counts the requested sport", () => {
  const root = tempRoot();
  store.saveParlaysIfMissing([sampleParlay()], root);
  store.saveParlaysIfMissing([sampleParlay({ sport: "basketball", legs: [
    { sport: "basketball", date: "2026-09-05", matchup: "X @ Y", pick: "Y", probability: 0.7, decimalOdds: 1.4 },
  ] })], root);
  const baseballSummary = store.summary("baseball", root);
  const basketballSummary = store.summary("basketball", root);
  assert.equal(baseballSummary.total, 1);
  assert.equal(basketballSummary.total, 1);
  assert.equal(baseballSummary.legTotal, 2);
  assert.equal(basketballSummary.legTotal, 1);
});
