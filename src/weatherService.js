/**
 * src/weatherService.js
 *
 * Weather and altitude adjustment engine for FIFA World Cup 2026 predictions.
 *
 * Consumes two static data files generated during Step 1 & 2:
 *   data/international/wc_venues_weather.json      — 16 venue heat/altitude profiles
 *   data/international/squad_climate_profiles.json — 48 team climate scores
 *
 * PRIMARY EXPORTS
 * ───────────────
 *   weatherContextForFixture(fixture)
 *     Returns a rich context object used by internationalData.js:
 *       .netDiffImpact       — net rating-point shift to add to match diff
 *       .home / .away        — per-team breakdown (heat adj + altitude adj + total)
 *       .summaryFactor       — one-line string for judgment.factors[]
 *       .venueTier           — effective heat index (1–5) after time-of-day reduction
 *       .dominantStressor    — "heat" | "humidity" | "altitude" | "heat+humidity" | "none"
 *
 * TUNING CONSTANTS
 * ────────────────
 *   HEAT_SCALE   0.50  — pts per tier-unit of heat delta (±0.5 per tier step)
 *   ADJ_MIN     -3.00  — floor: worst heat penalty (arctic squad in Miami)
 *   ADJ_MAX     +1.50  — ceiling: benefit capped (heat-acclimated squads in Seattle)
 *   EVENING_HOUR  18   — local kickoff hour at/after which evening reduction applies
 *
 * FORMULA (heat adjustment for one team)
 * ───────────────────────────────────────
 *   heatAdj = clamp( -(venueHeat - squadClimate) × HEAT_SCALE, ADJ_MIN, ADJ_MAX )
 *
 *   Positive result  → team's climate score > venue heat  → comfortable → slight lift
 *   Negative result  → venue hotter than team is used to  → heat stress → penalty
 *
 * ALTITUDE ADJUSTMENT
 * ───────────────────
 *   altAdj = -(venue.altitudePenaltyBase)  for non-adapted teams
 *   altAdj = 0                              for altitude-adapted teams
 *   Applied symmetrically; only matters in the diff when one team is adapted
 *   and the other is not (e.g. Mexico vs Scotland at Estadio Azteca).
 */

"use strict";

const path = require("path");
const { repoDataPath, readJsonWithFallback } = require("./runtimePaths");

// ── Load static data ────────────────────────────────────────────────────────

const venuesRaw   = readJsonWithFallback(
  repoDataPath("international", "wc_venues_weather.json"), null, null
);
const profilesRaw = readJsonWithFallback(
  repoDataPath("international", "squad_climate_profiles.json"), null, null
);

const VENUES   = venuesRaw?.venues   ?? {};
const PROFILES = profilesRaw?.profiles ?? {};

if (!Object.keys(VENUES).length) {
  console.warn("[weatherService] ⚠  wc_venues_weather.json not found or empty — weather adjustments will default to 0.");
}
if (!Object.keys(PROFILES).length) {
  console.warn("[weatherService] ⚠  squad_climate_profiles.json not found or empty — weather adjustments will default to 0.");
}

// ── Tuning constants ─────────────────────────────────────────────────────────

const HEAT_SCALE   = 0.50;   // rating points per unit of heat-tier difference
const ADJ_MIN      = -3.00;  // maximum heat penalty (floor)
const ADJ_MAX      = +1.50;  // maximum comfortable-conditions benefit (ceiling)
const EVENING_HOUR = 18;     // local hour at/after which evening kickoff reduction applies

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extract local hour (0–23) from a kickoffLocal ISO string.
 * kickoffLocal values in the fixture JSON use the literal local time in the
 * ISO format even though the string ends with 'Z' — e.g. "2026-06-11T20:00:00Z"
 * means 8 PM local, NOT 8 PM UTC.  We therefore parse the hour directly from
 * the string rather than using Date().getUTCHours().
 *
 * Returns null if the string is missing or unparseable.
 */
function localHour(kickoffLocalIso) {
  if (!kickoffLocalIso) return null;
  // Match the hour segment: "...T20:..." → 20
  const m = String(kickoffLocalIso).match(/T(\d{2}):/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Effective heat index for a venue after applying the optional evening kickoff
 * temperature reduction.  Returns a number in [1, 5].
 *
 * @param {string} city            — must match a key in wc_venues_weather.json
 * @param {string} kickoffLocalIso — ISO local time string from fixture JSON
 * @returns {number}
 */
function venueEffectiveHeat(city, kickoffLocalIso) {
  const v = VENUES[city];
  if (!v) return 3; // default: high if venue unknown
  let heat = v.effectiveHeatIndex ?? 3;
  const hour = localHour(kickoffLocalIso);
  if (hour !== null && hour >= EVENING_HOUR && v.eveningKickoffReduction) {
    heat = Math.max(1, heat - v.eveningKickoffReduction);
  }
  // Round to one decimal to avoid floating-point noise
  return Math.round(heat * 10) / 10;
}

/**
 * Return a team's squad climate score (1–5).
 * Defaults to 3.0 (warm/neutral) if team not found in profiles.
 *
 * @param {string} team
 * @returns {number}
 */
function teamClimateScore(team) {
  return PROFILES[team]?.squadClimateScore ?? 3.0;
}

/**
 * Is this team flagged as altitude-adapted?
 * Used to waive the altitude penalty at Guadalajara / Mexico City.
 *
 * @param {string} team
 * @returns {boolean}
 */
function isAltitudeAdapted(team) {
  return PROFILES[team]?.altitudeAdapted === true;
}

/**
 * Compute heat adjustment for one team at a venue.
 * Returns a rating-point delta in [ADJ_MIN, ADJ_MAX].
 *
 * @param {string} team
 * @param {string} city
 * @param {string} kickoffLocalIso
 * @returns {number}
 */
function heatAdjForTeam(team, city, kickoffLocalIso) {
  const venueHeat = venueEffectiveHeat(city, kickoffLocalIso);
  const climate   = teamClimateScore(team);
  const raw       = -(venueHeat - climate) * HEAT_SCALE;
  return Math.round(Math.min(ADJ_MAX, Math.max(ADJ_MIN, raw)) * 10) / 10;
}

/**
 * Compute altitude adjustment for one team at a venue.
 * Altitude-adapted teams pay no penalty.
 * Returns a non-positive rating-point delta (0 or negative).
 *
 * @param {string} team
 * @param {string} city
 * @returns {number}
 */
function altAdjForTeam(team, city) {
  const v = VENUES[city];
  if (!v || (v.altitudeTier ?? 0) === 0) return 0;
  if (isAltitudeAdapted(team)) return 0;
  return -(v.altitudePenaltyBase ?? 0);
}

/**
 * Build a concise human-readable factor string for the judgment panel.
 */
function buildSummaryFactor(fixture, venueTier, home, away) {
  const v = VENUES[fixture.city] ?? {};
  const stressor = v.dominantStressor ?? "none";
  const parts = [];

  // Venue descriptor
  const tierLabel = ["", "Mild", "Moderate", "High heat", "Severe heat", "Extreme heat"][Math.round(venueTier)] || "High heat";
  parts.push(`${fixture.city} venue: ${tierLabel} (tier ${venueTier}/5, ${stressor})`);

  // Heat adjustments
  const hSign  = (n) => (n >= 0 ? "+" : "") + n.toFixed(1);
  parts.push(
    `${fixture.homeTeam} climate ${home.climateScore.toFixed(1)} → heat ${hSign(home.heatAdj)} pts` +
    (home.altAdj !== 0 ? `, altitude ${hSign(home.altAdj)} pts` : "")
  );
  parts.push(
    `${fixture.awayTeam} climate ${away.climateScore.toFixed(1)} → heat ${hSign(away.heatAdj)} pts` +
    (away.altAdj !== 0 ? `, altitude ${hSign(away.altAdj)} pts` : "")
  );

  // Net impact
  const net = Math.round((home.total - away.total) * 10) / 10;
  if (Math.abs(net) >= 0.1) {
    const beneficiary = net > 0 ? fixture.homeTeam : fixture.awayTeam;
    parts.push(`Net weather edge: ${beneficiary} +${Math.abs(net).toFixed(1)} pts`);
  } else {
    parts.push("Net weather impact: negligible");
  }

  return parts.join(". ") + ".";
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the full weather context for a WC 2026 fixture.
 *
 * Returns an object with:
 *   .venueTier        {number}  effective heat index 1–5 (post time-of-day reduction)
 *   .heatRisk         {string}  human-readable risk label from venue data
 *   .dominantStressor {string}  "heat" | "heat+humidity" | "altitude" | "none"
 *   .altitudeM        {number}  metres above sea level
 *   .altitudeTier     {number}  0–3 altitude tier
 *   .home             {object}  { team, climateScore, heatAdj, altAdj, total }
 *   .away             {object}  { team, climateScore, heatAdj, altAdj, total }
 *   .netDiffImpact    {number}  home.total − away.total; add directly to match diff
 *   .summaryFactor    {string}  one-line string for judgment.factors[]
 *
 * @param {object} fixture — from world_cup_2026_fixtures.json
 * @returns {object}
 */
function weatherContextForFixture(fixture) {
  const city     = fixture.city ?? "";
  const kickoff  = fixture.kickoffLocal ?? null;
  const v        = VENUES[city] ?? {};

  const venueTier = venueEffectiveHeat(city, kickoff);

  const homeClimate = teamClimateScore(fixture.homeTeam);
  const awayClimate = teamClimateScore(fixture.awayTeam);

  const homeHeat = heatAdjForTeam(fixture.homeTeam, city, kickoff);
  const awayHeat = heatAdjForTeam(fixture.awayTeam, city, kickoff);
  const homeAlt  = altAdjForTeam(fixture.homeTeam, city);
  const awayAlt  = altAdjForTeam(fixture.awayTeam, city);

  const homeTotal = Math.round((homeHeat + homeAlt) * 10) / 10;
  const awayTotal = Math.round((awayHeat + awayAlt) * 10) / 10;
  const netDiff   = Math.round((homeTotal - awayTotal) * 10) / 10;

  const home = { team: fixture.homeTeam, climateScore: homeClimate, heatAdj: homeHeat, altAdj: homeAlt, total: homeTotal };
  const away = { team: fixture.awayTeam, climateScore: awayClimate, heatAdj: awayHeat, altAdj: awayAlt, total: awayTotal };

  return {
    city,
    venueTier,
    heatRisk:         v.heatRisk         ?? "Unknown",
    dominantStressor: v.dominantStressor ?? "none",
    altitudeM:        v.altitudeM        ?? 0,
    altitudeTier:     v.altitudeTier     ?? 0,
    hasAC:            v.hasAC            ?? false,
    home,
    away,
    netDiffImpact: netDiff,
    summaryFactor: buildSummaryFactor(fixture, venueTier, home, away),
  };
}

/**
 * Convenience: just the net diff impact for a fixture.
 * Equivalent to weatherContextForFixture(f).netDiffImpact.
 *
 * @param {object} fixture
 * @returns {number}
 */
function weatherDiffImpact(fixture) {
  return weatherContextForFixture(fixture).netDiffImpact;
}

module.exports = {
  weatherContextForFixture,
  weatherDiffImpact,
  // Exposed for unit testing / debugging:
  venueEffectiveHeat,
  teamClimateScore,
  isAltitudeAdapted,
  heatAdjForTeam,
  altAdjForTeam,
};
