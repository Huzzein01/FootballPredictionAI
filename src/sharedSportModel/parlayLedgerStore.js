"use strict";

// Persistent parlay tracker for baseball/basketball/American football,
// mirroring src/parlayBacktestStore.js's ticket/leg/status shape (kept as a
// separate store rather than reusing that module directly, so tracking
// parlays for these sports can never affect football's own ledger). One
// shared file, legs carry a `sport` field, and every read helper accepts an
// optional sport filter so each sport's page only sees its own tickets.
const path = require("path");
const { mutableDataPath, readJsonWithFallback, writeJson } = require("../runtimePaths");

const STORE_PATH = mutableDataPath("multi_sport_parlay_backtests.json");
// Every exported function takes an optional trailing `root` directory,
// matching the test-isolation convention baseballModel/productionService.js
// etc. already use (fs.mkdtempSync + a root param) — without this, tests
// would have no way to avoid writing into the real data/ directory.
function storePathFor(root) {
  return root ? path.join(root, "multi_sport_parlay_backtests.json") : STORE_PATH;
}
// This store is reachable from an unauthenticated POST route (gated behind
// isHostedPrivateApiPath in hosted-public-mode, but open to anyone in local/
// self-hosted mode), so cap request and total-store size defensively rather
// than trust the frontend's own shape.
const MAX_PARLAYS_PER_REQUEST = 10;
const MAX_LEGS_PER_PARLAY = 8;
const MAX_STRING_LENGTH = 200;
const MAX_STORED_PARLAYS = 500;

function clampString(value, max = MAX_STRING_LENGTH) {
  return String(value ?? "").slice(0, max);
}

function sanitizeLeg(leg) {
  return {
    sport: clampString(leg?.sport, 40),
    date: clampString(leg?.date, 20),
    matchup: clampString(leg?.matchup, 120),
    pick: clampString(leg?.pick, 80),
    probability: Number.isFinite(Number(leg?.probability)) ? Math.max(0, Math.min(1, Number(leg.probability))) : null,
    decimalOdds: Number.isFinite(Number(leg?.decimalOdds)) && Number(leg.decimalOdds) > 1 ? Number(leg.decimalOdds) : null,
    oddsSource: clampString(leg?.oddsSource, 20),
  };
}

function sanitizeParlay(parlay) {
  const legs = (Array.isArray(parlay?.legs) ? parlay.legs : []).slice(0, MAX_LEGS_PER_PARLAY).map(sanitizeLeg);
  return {
    sport: clampString(parlay?.sport, 40),
    riskMode: clampString(parlay?.riskMode, 20),
    combinedOdds: Number.isFinite(Number(parlay?.combinedOdds)) ? Number(parlay.combinedOdds) : null,
    combinedProbability: Number.isFinite(Number(parlay?.combinedProbability)) ? Math.max(0, Math.min(1, Number(parlay.combinedProbability))) : null,
    legs,
  };
}

function readStore(root) {
  return readJsonWithFallback(storePathFor(root), null, { parlays: [] });
}

function writeStore(store, root) {
  writeJson(storePathFor(root), store);
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function legKey(leg) {
  return [leg.sport, leg.date, leg.matchup, leg.pick].join("|").toLowerCase();
}

function signature(parlay) {
  return (parlay.legs || []).map(legKey).sort().join("||");
}

function ticketStatus(legs) {
  if (legs.some((leg) => leg.status === "MISS")) return "MISS";
  const active = legs.filter((leg) => leg.status !== "VOID");
  if (legs.length && !active.length) return "VOID";
  if (active.some((leg) => leg.status === "PENDING")) return "PENDING";
  if (active.length && active.every((leg) => leg.status === "HIT")) return "HIT";
  return "PENDING";
}

function decorateParlay(parlay) {
  const legs = (parlay.legs || []).map((leg, index) => ({
    id: makeId(`leg${index + 1}`),
    status: "PENDING",
    settledAt: "",
    ...leg,
  }));
  return {
    id: makeId("parlay"),
    createdAt: new Date().toISOString(),
    sport: parlay.sport,
    riskMode: parlay.riskMode || "",
    legCount: legs.length,
    combinedOdds: Number.isFinite(Number(parlay.combinedOdds)) ? Number(parlay.combinedOdds) : null,
    combinedProbability: Number.isFinite(Number(parlay.combinedProbability)) ? Number(parlay.combinedProbability) : null,
    status: ticketStatus(legs),
    settledAt: "",
    legs,
  };
}

function saveParlaysIfMissing(parlays, root) {
  const store = readStore(root);
  const existing = new Set(store.parlays.map(signature));
  const saved = [];
  const incoming = (Array.isArray(parlays) ? parlays : []).slice(0, MAX_PARLAYS_PER_REQUEST);
  for (const raw of incoming) {
    const parlay = sanitizeParlay(raw);
    if (!parlay.legs.length) continue;
    const sig = signature(parlay);
    if (!sig || existing.has(sig)) continue;
    const entry = decorateParlay(parlay);
    store.parlays.unshift(entry);
    existing.add(sig);
    saved.push(entry);
  }
  store.parlays = store.parlays.slice(0, MAX_STORED_PARLAYS);
  writeStore(store, root);
  return saved;
}

function listParlays(sport, root) {
  const all = readStore(root).parlays;
  return sport ? all.filter((parlay) => parlay.sport === sport) : all;
}

function updateLeg(parlayId, legId, status, root) {
  const store = readStore(root);
  const parlay = store.parlays.find((item) => item.id === parlayId);
  if (!parlay) return null;
  const leg = parlay.legs.find((item) => item.id === legId);
  if (!leg) return null;
  const normalized = ["HIT", "MISS", "VOID"].includes(status) ? status : "PENDING";
  leg.status = normalized;
  leg.settledAt = normalized === "PENDING" ? "" : new Date().toISOString();
  parlay.status = ticketStatus(parlay.legs);
  parlay.settledAt = parlay.status === "PENDING" ? "" : new Date().toISOString();
  writeStore(store, root);
  return { parlay };
}

function summary(sport, root) {
  const parlays = listParlays(sport, root);
  const settled = parlays.filter((parlay) => parlay.status !== "PENDING");
  const wins = parlays.filter((parlay) => parlay.status === "HIT").length;
  const losses = parlays.filter((parlay) => parlay.status === "MISS").length;
  const voids = parlays.filter((parlay) => parlay.status === "VOID").length;
  const legs = parlays.flatMap((parlay) => parlay.legs);
  const settledLegs = legs.filter((leg) => ["HIT", "MISS"].includes(leg.status));
  const hitLegs = legs.filter((leg) => leg.status === "HIT").length;
  const decidedTickets = wins + losses;
  return {
    total: parlays.length,
    pending: parlays.length - settled.length,
    settled: settled.length,
    wins,
    losses,
    voids,
    legTotal: legs.length,
    legPending: legs.filter((leg) => leg.status === "PENDING").length,
    legHitRate: settledLegs.length ? hitLegs / settledLegs.length : 0,
    ticketHitRate: decidedTickets ? wins / decidedTickets : 0,
  };
}

// Settles any PENDING legs whose game has since finished, using the same
// sport's season games array (date, homeTeam, awayTeam, homeScore,
// awayScore, completed — the shape multiSportDataService already returns).
// Matched by sport+date+matchup+pick, the same key legs are saved under.
function autoSettleFromResults(sport, games, root) {
  const store = readStore(root);
  const winnerByKey = new Map();
  for (const game of games || []) {
    if (!game.completed || !Number.isFinite(Number(game.homeScore)) || !Number.isFinite(Number(game.awayScore))) continue;
    const matchup = `${game.awayTeam} @ ${game.homeTeam}`;
    const winner = Number(game.homeScore) > Number(game.awayScore) ? game.homeTeam : game.awayTeam;
    winnerByKey.set([sport, game.date, matchup].join("|").toLowerCase(), winner);
  }
  let settledCount = 0;
  for (const parlay of store.parlays) {
    if (parlay.sport !== sport) continue;
    let changed = false;
    for (const leg of parlay.legs) {
      if (leg.status !== "PENDING") continue;
      const winner = winnerByKey.get([sport, leg.date, leg.matchup].join("|").toLowerCase());
      if (!winner) continue;
      leg.status = winner === leg.pick ? "HIT" : "MISS";
      leg.settledAt = new Date().toISOString();
      settledCount += 1;
      changed = true;
    }
    if (changed) {
      parlay.status = ticketStatus(parlay.legs);
      parlay.settledAt = parlay.status === "PENDING" ? "" : new Date().toISOString();
    }
  }
  if (settledCount) writeStore(store, root);
  return settledCount;
}

module.exports = { saveParlaysIfMissing, listParlays, updateLeg, summary, autoSettleFromResults, STORE_PATH };
