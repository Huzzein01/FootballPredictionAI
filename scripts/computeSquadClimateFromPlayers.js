/**
 * scripts/computeSquadClimateFromPlayers.js
 *
 * Phase 1 of weather-model retraining:
 * Reads data/international/player_climate_profiles.json (real per-player
 * club-temperature data) and recomputes each squad's climate score as the
 * straight average of all 26 players' climateTier values.
 *
 * This replaces the league-distribution estimates that were hand-coded in
 * buildSquadClimateProfiles.js with values grounded in actual Wikipedia squad
 * data + CLUB_CITY_TEMP lookups.
 *
 * Output → data/international/squad_climate_profiles.json  (overwrites)
 *
 * Run:  node scripts/computeSquadClimateFromPlayers.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const PLAYER_PATH  = path.join(__dirname, "..", "data", "international", "player_climate_profiles.json");
const SQUAD_PATH   = path.join(__dirname, "..", "data", "international", "squad_climate_profiles.json");

// ── Altitude-adapted teams (≥30 % of squad play above 1 500 m) ─────────────
const ALTITUDE_ADAPTED = new Set(["Colombia", "Ecuador", "Mexico", "Bolivia", "Peru"]);

// ── City altitude lookup for known high-altitude club cities ────────────────
const HIGH_ALTITUDE_CITIES = {
  "Bogotá":        2600,
  "Quito":         2850,
  "Mexico City":   2240,
  "Guadalajara":   1560,
  "Toluca":        2680,
  "Pachuca":       2400,
  "Medellín":      1495,
  "Cali":           995,
  "Manizales":     2160,
  "La Paz":        3640,
  "Cochabamba":    2560,
  "Lima":           154,
  "Cuzco":         3400,
  "Quito Sangolquí": 2500,
};

function isHighAltitude(city) {
  return (HIGH_ALTITUDE_CITIES[city] ?? 0) >= 1500;
}

// ── Heat label from score ────────────────────────────────────────────────────
function heatLabel(score) {
  if (score >= 4.5) return "Hot/humid squad";
  if (score >= 3.5) return "Hot-climate squad";
  if (score >= 2.5) return "Warm-climate squad";
  if (score >= 1.5) return "Temperate squad";
  return "Cold-climate squad";
}

// ── Main ─────────────────────────────────────────────────────────────────────
function build() {
  if (!fs.existsSync(PLAYER_PATH)) {
    console.error("player_climate_profiles.json not found. Run buildPlayerClimateProfiles.js first.");
    process.exit(1);
  }

  const playerData = JSON.parse(fs.readFileSync(PLAYER_PATH, "utf8"));
  const teamPlayers = playerData.players; // { teamName: [ playerObj, ... ] }

  // Load existing squad profiles to preserve manual notes / distribution fields
  let existingProfiles = {};
  if (fs.existsSync(SQUAD_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(SQUAD_PATH, "utf8"));
      existingProfiles = existing.profiles || {};
    } catch (_) {}
  }

  const newProfiles = {};
  const rows = [];

  for (const [team, players] of Object.entries(teamPlayers)) {
    if (!players.length) continue;

    // ── Per-player climate tier average ──────────────────────────────────────
    const tierSum  = players.reduce((s, p) => s + (p.climateTier ?? 2), 0);
    const tempSum  = players.reduce((s, p) => s + (p.avgSeasonTemp_C ?? 13), 0);
    const avgTier  = tierSum  / players.length;
    const avgTemp  = tempSum  / players.length;
    const score    = Math.round(avgTier * 100) / 100;

    // ── Altitude adaptation check ─────────────────────────────────────────────
    const highAltitudePlayers = players.filter(p => isHighAltitude(p.clubCity)).length;
    const altitudeAdapted = ALTITUDE_ADAPTED.has(team)
      || (highAltitudePlayers / players.length) >= 0.3;

    // ── Build tier distribution (informational) ───────────────────────────────
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    players.forEach(p => { tierCounts[p.climateTier ?? 2]++; });
    const tierDistribution = {};
    for (const [t, c] of Object.entries(tierCounts)) {
      if (c > 0) tierDistribution[`tier${t}`] = Math.round(c / players.length * 100) + "%";
    }

    // Top 5 clubs (by player count)
    const clubCounts = {};
    players.forEach(p => { clubCounts[p.club] = (clubCounts[p.club] || 0) + 1; });
    const topClubs = Object.entries(clubCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c, n]) => `${c} (${n})`);

    newProfiles[team] = {
      squadClimateScore: score,
      avgSeasonTemp_C:   Math.round(avgTemp * 10) / 10,
      heatLabel:         heatLabel(score),
      altitudeAdapted,
      tierDistribution,
      topClubs,
      playerCount:       players.length,
      dataSource:        "player_climate_profiles.json",
    };

    rows.push({ team, score, avgTemp, altitudeAdapted });
  }

  // ── Sort and print summary ────────────────────────────────────────────────
  rows.sort((a, b) => b.score - a.score);
  console.log("\nSquad climate scores (player-data driven):");
  console.log("─".repeat(60));
  rows.forEach(r => {
    const alt = r.altitudeAdapted ? " ⛰" : "";
    console.log(
      `  ${r.team.padEnd(32)} ${r.score.toFixed(2)}  (avg ${r.avgTemp.toFixed(1)}°C)${alt}`
    );
  });

  const output = {
    _meta: {
      description: "WC 2026 squad climate profiles — now computed from real per-player club-temperature data (player_climate_profiles.json). Replaces hand-coded league-distribution estimates.",
      generatedAt: new Date().toISOString(),
      generatedBy: "scripts/computeSquadClimateFromPlayers.js",
      dataSource:  "data/international/player_climate_profiles.json",
      climateTierScale: {
        "1.0–1.9": "Cold (Scotland, Scandinavia, northern Canada)",
        "2.0–2.9": "Temperate (Premier League, Bundesliga, Eredivisie, MLS North)",
        "3.0–3.5": "Warm (Ligue 1, Serie A, Primeira Liga, J/K League)",
        "3.6–4.4": "Hot/Dry (La Liga, Süper Lig, Liga MX, African domestic)",
        "4.5–5.0": "Hot/Humid (Saudi Pro, Brazilian, Egyptian, West African, Iraqi, Qatari)",
      },
      altitudeAdaptedNote: "Teams marked altitudeAdapted:true receive reduced altitude penalty at Guadalajara and Mexico City venues.",
      teamCount: rows.length,
    },
    profiles: newProfiles,
  };

  fs.writeFileSync(SQUAD_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`\n✅  Written → ${SQUAD_PATH}  (${rows.length} teams)\n`);
}

build();
