"use strict";

/**
 * src/clubDossier.js
 *
 * Backs the club search feature: search a club by name, then see its
 * upcoming/recent predictions, its real match-history compilation (from
 * teamResultsStore), and a data-driven form summary (from
 * teamTrainingStore's signals).
 *
 * Deliberately does NOT fabricate club "heritage" facts — founding year,
 * honours, stadium name, historic rivalries. No verified data source for
 * that exists anywhere in this codebase, and inventing it for hundreds of
 * clubs across dozens of leagues would just be misinformation dressed up
 * as fact. The "summary" here is instead an honest, real-data narrative of
 * the club's actual recent form and season trajectory — labeled as such,
 * not presented as history.
 */

const { listTeamResults, getTeamResults, slugifyTeam } = require("./teamResultsStore");
const { getTeamTraining } = require("./teamTrainingStore");
const { fixturePredictionBoard } = require("./predictionService");

function normalizeForSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Substring match against every tracked team name, ranked by whether the
// query matches at the start of the name (more relevant) before falling
// back to alphabetical order.
function searchClubs(query, limit = 12) {
  const needle = normalizeForSearch(query).trim();
  if (!needle) return [];
  const { teams } = listTeamResults();
  return teams
    .filter((entry) => normalizeForSearch(entry.team).includes(needle))
    .sort((a, b) => {
      const aStarts = normalizeForSearch(a.team).startsWith(needle) ? 0 : 1;
      const bStarts = normalizeForSearch(b.team).startsWith(needle) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.team.localeCompare(b.team);
    })
    .slice(0, limit)
    .map((entry) => ({ team: entry.team, slug: entry.slug, league: entry.league, matchCount: entry.matchCount }));
}

function matchesClub(prediction, team) {
  return prediction.homeTeam === team || prediction.awayTeam === team;
}

// A short, honest narrative built only from real, already-computed signals
// (teamTrainingStore's rolling form stats) — never invented facts.
function buildFormSummary(team, training) {
  const form = training?.signals?.form;
  if (!form || !form.played) {
    return `${team} does not have enough completed matches on file yet to summarize current form.`;
  }
  const pct = (value) => `${Math.round(value * 100)}%`;
  const sign = (value) => (value > 0 ? "+" : "");
  const parts = [
    `${team} have won ${form.wins} of their last ${form.played} matches (${pct(form.winRate)} win rate), `
      + `averaging ${form.pointsPerGame.toFixed(2)} points per game.`,
    `They've scored ${form.goalsForPerGame.toFixed(2)} and conceded ${form.goalsAgainstPerGame.toFixed(2)} goals per game `
      + `(${sign(form.goalDiffPerGame)}${form.goalDiffPerGame.toFixed(2)} goal difference), with a clean sheet in `
      + `${pct(form.cleanSheetRate)} of matches.`,
  ];
  if (form.last5) parts.push(`Their last five results read ${form.last5.split("").join("-")}.`);
  if (Number.isFinite(training?.strengthIndex)) {
    parts.push(`Our model currently rates them at a strength index of ${training.strengthIndex.toFixed(1)}.`);
  }
  return parts.join(" ");
}

// Resolves a club by exact or best-fuzzy name match against the tracked
// team index, since a user's search-box selection may not exactly match
// the canonical team name used across our data stores.
function resolveClubName(query) {
  const { teams } = listTeamResults();
  const needle = normalizeForSearch(query).trim();
  const exact = teams.find((entry) => normalizeForSearch(entry.team) === needle || entry.slug === needle);
  if (exact) return exact.team;
  const partial = teams.find((entry) => normalizeForSearch(entry.team).includes(needle));
  return partial ? partial.team : query;
}

function buildClubDossier(query, { season = "2025-26" } = {}) {
  const team = resolveClubName(query);
  const results = getTeamResults(team);
  const training = getTeamTraining(team);
  if (!results && !training) return null;

  const board = fixturePredictionBoard({ season });
  const upcoming = board.filter((prediction) => matchesClub(prediction, team)).slice(0, 10);

  const recentMatches = (results?.matches || []).slice(0, 15);

  return {
    team,
    slug: slugifyTeam(team),
    league: results?.league || training?.league || "",
    summary: buildFormSummary(team, training),
    form: training?.signals?.form || null,
    strengthIndex: training?.strengthIndex ?? null,
    matchHistory: {
      totalTracked: results?.matchCount || 0,
      recent: recentMatches,
    },
    predictions: {
      upcoming,
      season,
    },
    updatedAt: results?.updatedAt || training?.updatedAt || null,
  };
}

module.exports = { searchClubs, buildClubDossier, resolveClubName };
