"use strict";
/**
 * Daily highest-confidence World Cup parlay slip + compounding capital ledger.
 *
 * Each day the model produces ONE flagship multi-leg slip from its most
 * confident, not-yet-played World Cup picks. A capital ledger compounds the
 * bankroll as slips settle — modelling how winnings "fund" the continuous
 * training. Slips are graded automatically from the auto-settled results.
 *
 *   generateDailySlip()  — build/refresh today's slip (idempotent per date)
 *   gradeDailySlips()    — settle pending slips against final results, compound
 *   readCapitalLedger()  — current bankroll + slip history
 */

const { writeJson, readJsonWithFallback, mutableDataPath } = require("./runtimePaths");
const { internationalFixturePredictions, normalizeIntlTeam } = require("./internationalData");
const { listPredictions } = require("./backtestStore");

const LEDGER_PATH = mutableDataPath("international", "capital_ledger.json");
const STARTING_BANKROLL = 100;
const STAKE_FRACTION = 0.25;   // fraction of bankroll staked per daily slip
const DEFAULT_LEGS = 4;
const MIN_LEG_CONFIDENCE = 55; // only stake on genuinely confident picks

function pickLabel(p) {
  if (p.prediction === "H") return `${p.homeTeam} to win`;
  if (p.prediction === "A") return `${p.awayTeam} to win`;
  return "Draw";
}

function pickDecimalOdds(p) {
  const odds = p.odds || {};
  const raw = p.prediction === "H" ? odds.homeOdds : p.prediction === "A" ? odds.awayOdds : odds.drawOdds;
  const val = Number(raw);
  return Number.isFinite(val) && val > 1 ? val : null;
}

function settledIntlKeySet() {
  return new Set(
    listPredictions()
      .filter((p) => p.source === "international-fixture-board" && p.status === "SETTLED")
      .map((p) => `${normalizeIntlTeam(p.homeTeam)}|${normalizeIntlTeam(p.awayTeam)}|${p.date}`.toLowerCase())
  );
}

function fixtureKey(p) {
  return `${normalizeIntlTeam(p.homeTeam)}|${normalizeIntlTeam(p.awayTeam)}|${p.date}`.toLowerCase();
}

function readCapitalLedger() {
  return readJsonWithFallback(LEDGER_PATH, null, {
    bankroll: STARTING_BANKROLL,
    startingBankroll: STARTING_BANKROLL,
    currency: "units",
    stakeFraction: STAKE_FRACTION,
    slips: [],
    updatedAt: "",
  });
}

/**
 * Build (or refresh, if still pending) the highest-confidence slip for the
 * next World Cup matchday with unplayed fixtures.
 */
function generateDailySlip({ legs = DEFAULT_LEGS, date = "" } = {}) {
  const ledger = readCapitalLedger();
  const settled = settledIntlKeySet();
  const board = internationalFixturePredictions()
    .filter((p) => !settled.has(fixtureKey(p)))
    .filter((p) => pickDecimalOdds(p) != null && Number(p.confidence) >= MIN_LEG_CONFIDENCE);

  if (!board.length) {
    return { ...ledger, today: null, note: "No upcoming World Cup fixtures meet the confidence threshold yet." };
  }

  // Target the earliest upcoming matchday (or an explicit date), then take the
  // highest-confidence picks from it.
  const targetDate = date || board.map((p) => p.date).sort()[0];
  const dayPicks = board
    .filter((p) => p.date === targetDate)
    .sort((a, b) => Number(b.confidence) - Number(a.confidence));
  // If a single day is thin, top up with the next strongest upcoming picks.
  const pool = dayPicks.length >= legs ? dayPicks : board.sort((a, b) => Number(b.confidence) - Number(a.confidence));
  const chosen = pool.slice(0, Math.max(2, legs));

  const slipLegs = chosen.map((p) => ({
    fixture: `${p.homeTeam} vs ${p.awayTeam}`,
    date: p.date,
    group: p.group || p.league,
    pick: pickLabel(p),
    prediction: p.prediction,
    confidence: Number(p.confidence),
    decimalOdds: pickDecimalOdds(p),
    oddsType: p.oddsType || (p.oddsSource && /odds api|sportsbook/i.test(p.oddsSource) ? "sportsbook" : "model-fair"),
    key: fixtureKey(p),
    status: "PENDING",
  }));

  const combinedOdds = slipLegs.reduce((acc, leg) => acc * leg.decimalOdds, 1);
  const avgConfidence = slipLegs.reduce((acc, leg) => acc + leg.confidence, 0) / slipLegs.length;
  // Joint hit probability (independence approximation) for an honest edge read.
  const jointProbability = slipLegs.reduce((acc, leg) => acc * (leg.confidence / 100), 1);
  const stake = Math.round(ledger.bankroll * STAKE_FRACTION * 100) / 100;
  const potentialReturn = Math.round(stake * combinedOdds * 100) / 100;

  const slipId = `slip_${targetDate}`;
  const slip = {
    id: slipId,
    date: targetDate,
    createdAt: new Date().toISOString(),
    legs: slipLegs,
    legCount: slipLegs.length,
    combinedOdds: Math.round(combinedOdds * 100) / 100,
    averageConfidence: Math.round(avgConfidence * 10) / 10,
    jointProbability: Math.round(jointProbability * 1000) / 1000,
    stake,
    bankrollBefore: ledger.bankroll,
    potentialReturn,
    status: "PENDING",
  };

  // Replace any existing pending slip for the same date (refresh in place).
  ledger.slips = (ledger.slips || []).filter((s) => !(s.id === slipId && s.status === "PENDING"));
  ledger.slips.unshift(slip);
  ledger.updatedAt = new Date().toISOString();
  writeJson(LEDGER_PATH, ledger);
  return { ...ledger, today: slip };
}

/**
 * Grade any pending slips whose legs have all settled, then compound the
 * bankroll. A parlay pays out only if every leg won.
 */
function gradeDailySlips() {
  const ledger = readCapitalLedger();
  const settledPreds = listPredictions().filter(
    (p) => p.source === "international-fixture-board" && p.status === "SETTLED"
  );
  const resultByKey = new Map(settledPreds.map((p) => [fixtureKey(p), p]));
  let graded = 0;

  for (const slip of ledger.slips || []) {
    if (slip.status !== "PENDING") continue;
    const settledLegs = slip.legs.map((leg) => {
      const res = resultByKey.get(leg.key);
      if (!res) return { ...leg };
      const won = res.actualResult === leg.prediction;
      return { ...leg, status: won ? "WON" : "LOST", actualResult: res.actualResult, finalScore: `${res.homeGoals}-${res.awayGoals}` };
    });
    const allSettled = settledLegs.every((leg) => leg.status === "WON" || leg.status === "LOST");
    if (!allSettled) {
      slip.legs = settledLegs; // reflect partial progress
      continue;
    }
    const won = settledLegs.every((leg) => leg.status === "WON");
    slip.legs = settledLegs;
    slip.status = won ? "WON" : "LOST";
    slip.settledAt = new Date().toISOString();
    const before = ledger.bankroll;
    if (won) {
      ledger.bankroll = Math.round((before - slip.stake + slip.stake * slip.combinedOdds) * 100) / 100;
      slip.profit = Math.round((slip.stake * slip.combinedOdds - slip.stake) * 100) / 100;
    } else {
      ledger.bankroll = Math.round((before - slip.stake) * 100) / 100;
      slip.profit = -slip.stake;
    }
    slip.bankrollAfter = ledger.bankroll;
    graded += 1;
  }

  if (graded > 0) {
    ledger.updatedAt = new Date().toISOString();
    writeJson(LEDGER_PATH, ledger);
  }
  return { graded, bankroll: ledger.bankroll };
}

module.exports = {
  generateDailySlip,
  gradeDailySlips,
  readCapitalLedger,
  STARTING_BANKROLL,
};
