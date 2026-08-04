"use strict";

const CONTRACT = "football-team-history-v1";
const MIN_YEAR = 1985;

function seasonFromDate(date) {
  const value = new Date(date);
  if (Number.isNaN(value.valueOf())) return "";
  const year = value.getUTCFullYear();
  return value.getUTCMonth() >= 6 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

function validateMatch(match) {
  const errors = [];
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(match.date || "")) errors.push("match.date must be YYYY-MM-DD");
  if (!match?.season) errors.push("match.season is required");
  if (!match?.competition?.name) errors.push("match.competition.name is required");
  if (!match?.opponent?.name) errors.push("match.opponent.name is required");
  if (!Number.isFinite(Number(match?.score?.for)) || !Number.isFinite(Number(match?.score?.against))) errors.push("match.score requires numeric for/against values");
  if ((!Array.isArray(match?.sources) || !match.sources.some((source) => source?.url && source?.retrievedAt)) && !match?.sourceRef) errors.push("match requires an attributable source URL/retrieval time or sourceRef");
  return errors;
}

function validateHistory(record, { asOf = new Date().toISOString() } = {}) {
  const errors = [];
  if (!record || record.contract !== CONTRACT) errors.push(`contract must be ${CONTRACT}`);
  if (!record?.team?.name || !record?.team?.slug) errors.push("team name and slug are required");
  if (!Array.isArray(record?.sourcePlan) || record.sourcePlan.length < 5) errors.push("sourcePlan requires five ranked resources");
  if (!Array.isArray(record?.matches)) errors.push("matches must be an array");
  const seen = new Set();
  for (const match of record?.matches || []) {
    for (const error of validateMatch(match)) errors.push(`${match?.id || "match"}: ${error}`);
    if (match?.date && match.date > String(asOf).slice(0, 10)) errors.push(`${match.id || "match"}: future result is not allowed`);
    const key = match?.id || [match?.date, match?.competition?.name, match?.opponent?.slug, match?.venue].join("|");
    if (seen.has(key)) errors.push(`duplicate match ${key}`);
    seen.add(key);
  }
  return { valid: errors.length === 0, errors };
}

function emptyHistory(team) {
  return {
    contract: CONTRACT,
    team: { name: team.team, slug: team.slug, primaryLeague: team.league || "", aliases: [] },
    requestedCoverage: { fromYear: MIN_YEAR, to: "present", includes: ["all competitions", "opponents", "scorelines", "league standings", "competition standings"] },
    sourcePlan: [],
    coverage: { earliestMatch: "", latestMatch: "", seasonsWithMatches: [], missingSeasons: [], competitionScopeVerified: false, status: "not-collected" },
    matches: [],
    seasonStandings: [],
    competitionStandings: [],
    updatedAt: "",
  };
}

module.exports = { CONTRACT, MIN_YEAR, seasonFromDate, validateMatch, validateHistory, emptyHistory };
