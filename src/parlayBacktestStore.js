const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "parlay_backtests.json");

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify({ parlays: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function signature(parlay) {
  return (parlay.legs || [])
    .map(legSignature)
    .sort()
    .join("||");
}

function legSignature(leg) {
  return [leg.type, leg.date, leg.fixture, leg.market, leg.pick].join("|").toLowerCase();
}

function fixtureSignature(date, fixture) {
  return [date || "", fixture || ""].join("|").toLowerCase();
}

function fixtureSignatureFromFixture(fixture) {
  return fixtureSignature(fixture.date, `${fixture.homeTeam} vs ${fixture.awayTeam}`);
}

function ticketStatus(legs) {
  if (legs.some((leg) => leg.status === "MISS")) return "MISS";
  const activeLegs = legs.filter((leg) => leg.status !== "VOID");
  if (legs.length && !activeLegs.length) return "VOID";
  if (activeLegs.some((leg) => leg.status === "PENDING")) return "PENDING";
  if (activeLegs.length && activeLegs.every((leg) => leg.status === "HIT")) return "HIT";
  return "PENDING";
}

function decorateParlay(parlay, source = "generated-parlay") {
  const legs = (parlay.legs || []).map((leg, index) => ({
    id: makeId(`leg${index + 1}`),
    status: "PENDING",
    settledAt: "",
    ...leg,
  }));
  return {
    id: makeId("parlay"),
    createdAt: new Date().toISOString(),
    source,
    name: parlay.name || "Generated Parlay",
    riskMode: parlay.riskMode || "safe",
    averageConfidence: parlay.averageConfidence || 0,
    requestedLegs: legs.length,
    status: ticketStatus(legs),
    settledAt: "",
    legs,
  };
}

function saveParlaysIfMissing(parlays, source = "generated-parlay") {
  const store = readStore();
  const existing = new Set(store.parlays.map(signature));
  const saved = [];

  for (const parlay of parlays || []) {
    const sig = signature(parlay);
    if (!sig || existing.has(sig)) continue;
    const entry = decorateParlay(parlay, source);
    store.parlays.unshift(entry);
    existing.add(sig);
    saved.push(entry);
  }

  writeStore(store);
  return saved;
}

function listParlays() {
  return readStore().parlays;
}

function updateLeg(parlayId, legId, status) {
  const store = readStore();
  const parlay = store.parlays.find((item) => item.id === parlayId);
  if (!parlay) return null;
  const leg = parlay.legs.find((item) => item.id === legId);
  if (!leg) return null;

  const normalized = ["HIT", "MISS", "VOID"].includes(status) ? status : "PENDING";
  const targetSignature = legSignature(leg);
  const settledAt = normalized === "PENDING" ? "" : new Date().toISOString();
  const affectedParlayIds = new Set();
  const previousStatuses = new Map();
  let affectedLegs = 0;

  for (const ticket of store.parlays) {
    for (const ticketLeg of ticket.legs || []) {
      if (legSignature(ticketLeg) !== targetSignature) continue;
      previousStatuses.set(ticket.id, ticket.status);
      ticketLeg.status = normalized;
      ticketLeg.settledAt = settledAt;
      affectedLegs += 1;
      affectedParlayIds.add(ticket.id);
    }
  }

  const newlyMissedParlays = [];
  for (const ticket of store.parlays) {
    if (!affectedParlayIds.has(ticket.id)) continue;
    ticket.status = ticketStatus(ticket.legs || []);
    ticket.settledAt = ticket.status === "PENDING" ? "" : new Date().toISOString();
    if (previousStatuses.get(ticket.id) !== "MISS" && ticket.status === "MISS") {
      newlyMissedParlays.push(ticket.id);
    }
  }

  writeStore(store);
  return {
    parlay: store.parlays.find((item) => item.id === parlayId),
    affectedLegs,
    affectedParlays: affectedParlayIds.size,
    newlyMissedParlays: newlyMissedParlays.length,
    playedFixture: { date: leg.date || "", fixture: leg.fixture || "" },
    syncedPick: leg.pick,
  };
}

function playedFixtureKeys() {
  const keys = new Set();
  for (const parlay of listParlays()) {
    for (const leg of parlay.legs || []) {
      if (!["HIT", "MISS", "VOID"].includes(leg.status)) continue;
      keys.add(fixtureSignature(leg.date, leg.fixture));
    }
  }
  return keys;
}

function playedFixtureSummaries() {
  const grouped = new Map();

  for (const parlay of listParlays()) {
    for (const leg of parlay.legs || []) {
      if (!["HIT", "MISS", "VOID"].includes(leg.status)) continue;
      const key = fixtureSignature(leg.date, leg.fixture);
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          date: leg.date || "",
          fixture: leg.fixture || "",
          league: leg.league || "",
          hits: 0,
          misses: 0,
          voids: 0,
          settledLegs: 0,
          modelCorrect: null,
          picks: [],
          markets: new Set(),
        });
      }
      const summary = grouped.get(key);
      if (leg.league && !summary.league) summary.league = leg.league;
      if (leg.status === "HIT") summary.hits += 1;
      if (leg.status === "MISS") summary.misses += 1;
      if (leg.status === "VOID") summary.voids += 1;
      summary.settledLegs += 1;
      summary.modelCorrect = summary.misses > 0 ? false : summary.hits > 0 ? true : null;
      if (leg.market) summary.markets.add(leg.market);
      summary.picks.push({
        type: leg.type || "",
        market: leg.market || "",
        pick: leg.pick || "",
        status: leg.status,
      });
    }
  }

  return [...grouped.values()]
    .map((summary) => ({
      ...summary,
      markets: [...summary.markets],
      statusLabel: summary.misses > 0 ? "Model missed" : summary.hits > 0 ? "Model correct" : "Voided",
    }))
    .sort((a, b) => `${a.date} ${a.fixture}`.localeCompare(`${b.date} ${b.fixture}`));
}

function summary() {
  const parlays = listParlays();
  const settled = parlays.filter((parlay) => parlay.status !== "PENDING");
  const wins = parlays.filter((parlay) => parlay.status === "HIT").length;
  const losses = parlays.filter((parlay) => parlay.status === "MISS").length;
  const voids = parlays.filter((parlay) => parlay.status === "VOID").length;
  const legs = parlays.flatMap((parlay) => parlay.legs);
  const settledLegs = legs.filter((leg) => ["HIT", "MISS"].includes(leg.status));
  const hitLegs = legs.filter((leg) => leg.status === "HIT").length;
  const voidLegs = legs.filter((leg) => leg.status === "VOID").length;
  const playerLegs = legs.filter((leg) => leg.type === "player");
  const settledPlayerLegs = playerLegs.filter((leg) => ["HIT", "MISS"].includes(leg.status));
  const hitPlayerLegs = playerLegs.filter((leg) => leg.status === "HIT").length;
  const missPlayerLegs = playerLegs.filter((leg) => leg.status === "MISS").length;
  const voidPlayerLegs = playerLegs.filter((leg) => leg.status === "VOID").length;
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
    legVoids: voidLegs,
    legHitRate: settledLegs.length ? hitLegs / settledLegs.length : 0,
    playerLegTotal: playerLegs.length,
    playerLegSettled: settledPlayerLegs.length,
    playerLegHits: hitPlayerLegs,
    playerLegMisses: missPlayerLegs,
    playerLegPending: playerLegs.filter((leg) => leg.status === "PENDING").length,
    playerLegVoids: voidPlayerLegs,
    playerLegHitRate: settledPlayerLegs.length ? hitPlayerLegs / settledPlayerLegs.length : 0,
    ticketHitRate: decidedTickets ? wins / decidedTickets : 0,
  };
}

module.exports = {
  STORE_PATH,
  fixtureSignatureFromFixture,
  listParlays,
  playedFixtureKeys,
  playedFixtureSummaries,
  saveParlaysIfMissing,
  summary,
  updateLeg,
};
