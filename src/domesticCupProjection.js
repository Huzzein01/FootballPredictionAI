"use strict";
/**
 * Domestic cup bracket projection engine.
 *
 * For each national cup (FA Cup, Carabao Cup, Copa del Rey, DFB-Pokal,
 * Coppa Italia, Coupe de France) this module:
 *   1. Derives the participating teams from current league table data
 *   2. Seeds them into a knockout bracket (strength-ordered)
 *   3. Projects every round using squad-strength win probabilities
 *   4. Returns a bracket object compatible with renderBracketTree()
 */

const { xiFeature, getSquadRating } = require("./squadRatings");
const { normalizeTeamName } = require("./footballData");

// ── Cup definitions ────────────────────────────────────────────────────────
const CUP_CONFIG = {
  "fa-cup": {
    name: "FA Cup",
    country: "England",
    espnCode: "eng.fa",
    rounds: ["Third Round", "Fourth Round", "Fifth Round", "Quarter-Finals", "Semi-Finals", "Final"],
    bracketRounds: ["r32", "r16", "r5", "qf", "sf", "final"],
    renderRounds: ["r16", "qf", "sf", "final"],   // keys shown in bracket tree
    renderLabels: { r16: "Fifth Round", qf: "Quarter-Finals", sf: "Semi-Finals", final: "Final" },
    topLeagueTeams: 20,   // all EPL teams
    lowerTierTeams: 8,    // top Championship teams
    totalSlots: 32,       // 32 teams from 3rd round onwards (simplified)
  },
  "carabao-cup": {
    name: "Carabao Cup",
    country: "England",
    espnCode: "eng.league_cup",
    rounds: ["Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
    bracketRounds: ["r16", "qf", "sf", "final"],
    renderRounds: ["r16", "qf", "sf", "final"],
    renderLabels: { r16: "Round of 16", qf: "Quarter-Finals", sf: "Semi-Finals", final: "Final" },
    topLeagueTeams: 20,
    lowerTierTeams: 12,
    totalSlots: 16,
  },
  "copa-del-rey": {
    name: "Copa del Rey",
    country: "Spain",
    espnCode: "esp.copa_del_rey",
    rounds: ["Round of 32", "Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
    bracketRounds: ["r32", "r16", "qf", "sf", "final"],
    renderRounds: ["r16", "qf", "sf", "final"],
    renderLabels: { r16: "Round of 16", qf: "Quarter-Finals", sf: "Semi-Finals", final: "Final" },
    topLeagueTeams: 20,
    lowerTierTeams: 12,
    totalSlots: 32,
  },
  "dfb-pokal": {
    name: "DFB-Pokal",
    country: "Germany",
    espnCode: "ger.dfb_pokal",
    rounds: ["Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
    bracketRounds: ["r16", "qf", "sf", "final"],
    renderRounds: ["r16", "qf", "sf", "final"],
    renderLabels: { r16: "Round of 16", qf: "Quarter-Finals", sf: "Semi-Finals", final: "Final" },
    topLeagueTeams: 18,
    lowerTierTeams: 14,
    totalSlots: 16,
  },
  "coppa-italia": {
    name: "Coppa Italia",
    country: "Italy",
    espnCode: "ita.coppa_italia",
    rounds: ["Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
    bracketRounds: ["r16", "qf", "sf", "final"],
    renderRounds: ["r16", "qf", "sf", "final"],
    renderLabels: { r16: "Round of 16", qf: "Quarter-Finals", sf: "Semi-Finals", final: "Final" },
    topLeagueTeams: 20,
    lowerTierTeams: 12,
    totalSlots: 16,
  },
  "coupe-de-france": {
    name: "Coupe de France",
    country: "France",
    espnCode: "fra.coupe_de_france",
    rounds: ["Round of 32", "Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
    bracketRounds: ["r32", "r16", "qf", "sf", "final"],
    renderRounds: ["r16", "qf", "sf", "final"],
    renderLabels: { r16: "Round of 16", qf: "Quarter-Finals", sf: "Semi-Finals", final: "Final" },
    topLeagueTeams: 20,
    lowerTierTeams: 12,
    totalSlots: 32,
  },
};

// ── Team pools per league ──────────────────────────────────────────────────
// These are the realistic cup participants derived from each top flight.
// Lower-division "giant-killer" candidates are included for authenticity.

const LEAGUE_TEAM_POOL = {
  EPL: [
    "Arsenal", "Man City", "Liverpool", "Chelsea", "Man United",
    "Newcastle United", "Tottenham", "Aston Villa", "Brighton", "West Ham United",
    "Fulham", "Crystal Palace", "Wolves", "Brentford", "Everton",
    "Bournemouth", "Nott'm Forest", "Leicester City", "Southampton", "Ipswich Town",
    // Championship representatives
    "Leeds United", "Sunderland", "Sheffield United", "Burnley",
    "Coventry City", "Middlesbrough", "Stoke City", "Bristol City",
  ],
  "La Liga": [
    "Real Madrid", "Barcelona", "Ath Madrid", "Ath Bilbao", "Real Sociedad",
    "Villarreal", "Betis", "Sevilla", "Valencia", "Celta Vigo",
    "Osasuna", "Mallorca", "Girona", "Getafe", "Rayo Vallecano",
    "Las Palmas", "Alaves", "Levante", "Espanyol", "Racing Santander",
    // Second division
    "Almeria", "Valladolid", "Huesca", "Sporting Gijon",
  ],
  Bundesliga: [
    "Bayern Munich", "Bayer Leverkusen", "Borussia Dortmund", "RB Leipzig",
    "VfB Stuttgart", "Eintracht Frankfurt", "SC Freiburg", "TSG Hoffenheim",
    "Wolfsburg", "Borussia Mönchengladbach", "Union Berlin", "Augsburg",
    "Mainz", "Werder Bremen", "Heidenheim", "St. Pauli",
    "Hamburger SV", "SV Darmstadt", "Schalke 04", "FC Koln",
    "Hertha Berlin", "Fortuna Dusseldorf", "Hamburger SV",
  ],
  "Ligue 1": [
    "Paris SG", "Marseille", "Lyon", "Monaco", "Lille",
    "Lens", "Nice", "Stade Rennais", "Strasbourg", "Toulouse",
    "Nantes", "Brest", "Le Havre AC", "AJ Auxerre", "Angers",
    "Reims", "Lorient", "Montpellier", "Metz", "Troyes",
    // Ligue 2 representatives
    "Grenoble", "Caen", "Guingamp", "Bastia",
  ],
  "Serie A": [
    "Inter Milan", "AC Milan", "Juventus", "Napoli", "AS Roma",
    "Lazio", "Atalanta", "Fiorentina", "Torino", "Bologna",
    "Udinese", "Sassuolo", "Hellas Verona", "Cagliari", "Lecce",
    "Parma", "Como", "Genoa", "Venezia", "Empoli",
    // Serie B representatives
    "Cremonese", "Pisa", "Brescia", "Palermo",
  ],
};

// Default ratings for teams not in squad ratings (by division tier)
const TIER_DEFAULT_RATING = {
  1: 0.35, // top-flight mid table ~74 xi
  2: 0.20, // second division ~68 xi
  3: 0.10, // third division ~64 xi
};

function teamStrength(teamName) {
  const xi = xiFeature(normalizeTeamName(teamName));
  if (xi > 0.45) return xi; // known team from squad ratings
  // Unknown team — assign a default based on typical pool position
  return 0.20;
}

// ── Win probability calculation ────────────────────────────────────────────
// Cup matches: played on neutral or single ground (home slight advantage).
// We use a simple logistic model based on strength difference.
function winProb(homeStr, awayStr) {
  const diff = homeStr - awayStr;
  // Logistic with steepness tuned so a 0.3 difference → ~70% favourite
  const logit = diff * 8.0 + 0.10; // small home advantage
  const p = 1 / (1 + Math.exp(-logit));
  return Math.max(0.08, Math.min(0.92, p));
}

function simulateMatch(home, away) {
  const hStr = teamStrength(home);
  const aStr = teamStrength(away);
  const hWin = winProb(hStr, aStr);
  const aWin = winProb(aStr, hStr) * 0.9; // no away boost for cup
  const draw = Math.max(0.04, 1 - hWin - aWin);
  const norm = hWin + draw + aWin;
  return {
    home,
    away,
    homeProb: Math.round((hWin / norm) * 100),
    drawProb:  Math.round((draw / norm) * 100),
    awayProb:  Math.round((aWin / norm) * 100),
    // winner = higher probability team (deterministic projection)
    winner: hStr >= aStr ? { team: home } : { team: away },
    loser:  hStr >= aStr ? { team: away } : { team: home },
  };
}

// ── Derive participating teams ─────────────────────────────────────────────
function getLeagueForCup(cupId) {
  if (["fa-cup", "carabao-cup"].includes(cupId)) return "EPL";
  if (cupId === "copa-del-rey") return "La Liga";
  if (cupId === "dfb-pokal") return "Bundesliga";
  if (cupId === "coppa-italia") return "Serie A";
  if (cupId === "coupe-de-france") return "Ligue 1";
  return "EPL";
}

function buildParticipants(cupId, liveStandings) {
  const cfg = CUP_CONFIG[cupId];
  const league = getLeagueForCup(cupId);
  const pool = [...(LEAGUE_TEAM_POOL[league] || [])];

  // If live standings available, re-order pool to match current table
  if (liveStandings && liveStandings.length) {
    const standingOrder = liveStandings.map((e) => normalizeTeamName(e.team || e.name || ""));
    pool.sort((a, b) => {
      const ai = standingOrder.indexOf(normalizeTeamName(a));
      const bi = standingOrder.indexOf(normalizeTeamName(b));
      const aRank = ai >= 0 ? ai : 999;
      const bRank = bi >= 0 ? bi : 999;
      return aRank - bRank;
    });
  } else {
    // Sort by squad strength
    pool.sort((a, b) => teamStrength(b) - teamStrength(a));
  }

  // Trim to totalSlots
  const slots = cfg.totalSlots || 32;
  return [...new Set(pool)].slice(0, slots);
}

// ── Pair teams into matchups (strength-seeded bracket) ─────────────────────
// Strongest vs weakest (1 vs N, 2 vs N-1, etc.) like a traditional cup draw
function pairTeams(teams) {
  const sorted = [...teams].sort((a, b) => teamStrength(b) - teamStrength(a));
  const pairs = [];
  const n = sorted.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push([sorted[i], sorted[n - 1 - i]]);
  }
  return pairs;
}

// ── Simulate a full round ──────────────────────────────────────────────────
function simulateRound(teams, roundLabel) {
  const pairs = pairTeams(teams);
  return {
    label: roundLabel,
    matches: pairs.map(([home, away]) => simulateMatch(home, away)),
    advancers: pairs.map(([home, away]) => {
      const m = simulateMatch(home, away);
      return { team: m.winner.team };
    }),
  };
}

// ── Build full bracket ─────────────────────────────────────────────────────
function buildBracket(participants, cfg) {
  const renderRounds = cfg.renderRounds; // ["r16", "qf", "sf", "final"]
  const renderLabels = cfg.renderLabels;

  // Simulate from entry round down to the renderRounds
  let remaining = [...participants];

  // If we have more teams than needed for the first displayed round,
  // simulate preliminary rounds silently to get to the right team count.
  const firstRoundSize = renderRounds.length > 0 ? Math.pow(2, renderRounds.length) : 16;
  while (remaining.length > firstRoundSize && remaining.length > 2) {
    const rnd = simulateRound(remaining, "Preliminary");
    remaining = rnd.advancers.map((a) => a.team);
  }

  // Now simulate each displayed round
  const bracket = {};
  for (const roundKey of renderRounds) {
    if (remaining.length < 2) break;
    const label = renderLabels[roundKey] || roundKey.toUpperCase();
    const rnd = simulateRound(remaining, label);
    bracket[roundKey] = {
      label,
      subtitle: `${remaining.length} teams · model projection`,
      matches: rnd.matches,
      advancers: rnd.advancers,
    };
    remaining = rnd.advancers.map((a) => a.team);
  }

  const champion = remaining[0] ? { team: remaining[0] } : null;
  return { bracket, champion };
}

// ── Public API ────────────────────────────────────────────────────────────
/**
 * Projects a domestic cup bracket.
 * @param {string} cupId  e.g. "fa-cup", "copa-del-rey"
 * @param {Array} [liveStandings]  optional current league standings array
 * @returns {{ bracket, champion, cupName, country, disclaimer }}
 */
function projectDomesticCup(cupId, liveStandings) {
  const cfg = CUP_CONFIG[cupId];
  if (!cfg) throw new Error(`Unknown cup: ${cupId}`);

  const participants = buildParticipants(cupId, liveStandings);
  const { bracket, champion } = buildBracket(participants, cfg);

  return {
    cupId,
    cupName: cfg.name,
    country: cfg.country,
    generatedAt: new Date().toISOString(),
    participantCount: participants.length,
    participants,
    bracket,
    champion,
    disclaimer:
      `Model projection based on ${cfg.country} cup participant pool and squad strength ratings. ` +
      `Actual draws are random — this shows the statistically strongest projected path.`,
  };
}

module.exports = {
  CUP_CONFIG,
  projectDomesticCup,
  LEAGUE_TEAM_POOL,
};
