"use strict";
/**
 * UEFA Nations League prediction engine.
 *
 * Reuses the World Cup module's rating engine (team-strength prior blended
 * with live FIFA ranking points, recent-form adjustment, and the tunable
 * logistic/draw model — see internationalData.js's exports) rather than
 * forking it, so both competitions share one continuously-tuned heuristic.
 * What's competition-specific here is: fixture sourcing (ESPN's
 * uefa.nations scoreboard, via uefaNationsLeagueSync.js), the detected
 * League A–D group structure, and live odds embedded directly in each
 * fixture at fetch time (Nations League has no separate odds feed to
 * cross-reference, unlike the World Cup's curated FIFA fixture file).
 *
 * No host-boost or tournament-prestige adjustment — Nations League has no
 * host nation, and "prestige" tied to World Cup titles doesn't map onto a
 * biennial continental competition, so applying it here would just be an
 * unjustified thumb on the scale.
 */

const {
  ratingFor,
  friendlyFormAdjustment,
  readFriendlyResults,
  clamp,
  logistic,
  projectedScore,
} = require("./internationalData");
const { teamMatchForm } = require("./teamMatchStats");
const { getTuning } = require("./modelTuning");
const { readNationsLeagueFixtures } = require("./uefaNationsLeagueSync");

function roundPct(value) {
  return Math.round(value * 1000) / 10;
}

function predictNationsLeagueFixture(fixture, friendlyResults = []) {
  const tuning = getTuning();
  const homeFormAdj = friendlyFormAdjustment(fixture.homeTeam, friendlyResults);
  const awayFormAdj = friendlyFormAdjustment(fixture.awayTeam, friendlyResults);
  const homeRating = ratingFor(fixture.homeTeam, false, tuning) + homeFormAdj;
  const awayRating = ratingFor(fixture.awayTeam, false, tuning) + awayFormAdj;
  // In-competition match-stats form (shots-on-target margin from completed
  // games) — the same signal the World Cup engine uses, drawn from the
  // SAME shared store, so it already carries recent WC/Nations League form
  // for any team that's played either.
  const matchStatsWeight = Number(tuning.matchStatsWeight ?? 1);
  const homeStatForm = teamMatchForm(fixture.homeTeam);
  const awayStatForm = teamMatchForm(fixture.awayTeam);
  const statFormDelta = matchStatsWeight * (homeStatForm.delta - awayStatForm.delta);
  const diff = homeRating - awayRating + statFormDelta;
  const draw = clamp(tuning.drawBase - Math.abs(diff) * tuning.drawSlope, tuning.drawMin, Math.max(tuning.drawMax, tuning.drawBase));
  const homeShare = logistic(diff / tuning.logisticSteepness);
  const home = (1 - draw) * homeShare;
  const away = (1 - draw) * (1 - homeShare);
  const entries = [["H", home], ["D", draw], ["A", away]].sort((a, b) => b[1] - a[1]);
  const prediction = entries[0][0];
  const confidence = roundPct(entries[0][1]);
  const fairPrice = (p) => (1 / (Math.min(0.95, Math.max(0.04, p)) * 1.04)).toFixed(2);
  const modelFairOdds = { homeOdds: fairPrice(home), drawOdds: fairPrice(draw), awayOdds: fairPrice(away) };
  return {
    competition: "UEFA Nations League",
    season: "2026-27 UEFA Nations League",
    phase: fixture.phase,
    date: fixture.date,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    homeLogoUrl: fixture.homeLogoUrl,
    awayLogoUrl: fixture.awayLogoUrl,
    venue: fixture.venue,
    kickoffUtc: fixture.kickoffUtc,
    espnEventId: fixture.espnEventId,
    completed: fixture.completed,
    homeGoals: fixture.completed ? fixture.homeGoals : null,
    awayGoals: fixture.completed ? fixture.awayGoals : null,
    odds: fixture.odds || modelFairOdds,
    oddsSource: fixture.odds ? `ESPN (${fixture.odds.provider})` : "Model fair odds (FIFA-ranking + form-trained probabilities)",
    oddsStatus: fixture.odds ? fixture.oddsStatus : "No public sportsbook line yet — model-derived fair price shown",
    hasOdds: true,
    oddsType: fixture.odds ? "sportsbook" : "model-fair",
    prediction,
    confidence,
    projectedScore: projectedScore(diff, prediction, tuning.scoreSlope),
    probabilities: { H: home, D: draw, A: away, homeWinPct: roundPct(home), drawPct: roundPct(draw), awayWinPct: roundPct(away) },
    judgment: {
      summary: `${prediction === "H" ? fixture.homeTeam : prediction === "A" ? fixture.awayTeam : "Draw"} is the model-only baseline pick.`,
      factors: [
        `Rating signal: ${fixture.homeTeam} ${homeRating.toFixed(1)}, ${fixture.awayTeam} ${awayRating.toFixed(1)}${homeFormAdj || awayFormAdj ? ` (recent-form adj: ${fixture.homeTeam} ${homeFormAdj >= 0 ? "+" : ""}${homeFormAdj}, ${fixture.awayTeam} ${awayFormAdj >= 0 ? "+" : ""}${awayFormAdj})` : ""}.`,
        homeStatForm.matches || awayStatForm.matches
          ? `In-competition match-stats form (shots-on-target margin, ESPN): ${fixture.homeTeam} ${homeStatForm.delta >= 0 ? "+" : ""}${homeStatForm.delta} (${homeStatForm.matches} game${homeStatForm.matches === 1 ? "" : "s"}), ${fixture.awayTeam} ${awayStatForm.delta >= 0 ? "+" : ""}${awayStatForm.delta} (${awayStatForm.matches} game${awayStatForm.matches === 1 ? "" : "s"}).`
          : "No in-competition match-stats form yet (no completed games).",
        fixture.odds ? `Live sportsbook line from ${fixture.odds.provider} via ESPN.` : "No sportsbook line posted yet for this fixture.",
      ],
    },
  };
}

let predictionsCache = null;
let predictionsCacheAt = 0;
const PREDICTIONS_TTL_MS = 12 * 1000;

function nationsLeagueFixturePredictions() {
  if (predictionsCache && Date.now() - predictionsCacheAt < PREDICTIONS_TTL_MS) return predictionsCache;
  const friendlyResults = readFriendlyResults();
  const { fixtures } = readNationsLeagueFixtures();
  predictionsCache = fixtures.map((f) => predictNationsLeagueFixture(f, friendlyResults));
  predictionsCacheAt = Date.now();
  return predictionsCache;
}

function emptyGroupRow(team) {
  return { team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

function applyResult(table, fixture) {
  const home = table.get(fixture.homeTeam);
  const away = table.get(fixture.awayTeam);
  const homeGoals = Number(fixture.homeGoals);
  const awayGoals = Number(fixture.awayGoals);
  if (!home || !away || !Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return;
  home.played += 1; away.played += 1;
  home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
  away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
  if (homeGoals > awayGoals) { home.wins += 1; away.losses += 1; home.points += 3; }
  else if (awayGoals > homeGoals) { away.wins += 1; home.losses += 1; away.points += 3; }
  else { home.draws += 1; away.draws += 1; home.points += 1; away.points += 1; }
  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
}

function nationsLeagueGroupTables() {
  const { fixtures, groups } = readNationsLeagueFixtures();
  const completed = fixtures.filter((f) => f.completed && f.phase === "group-stage");
  return Object.entries(groups || {}).map(([group, teams]) => {
    const groupFixtures = fixtures.filter((f) => f.phase === "group-stage" && teams.includes(f.homeTeam) && teams.includes(f.awayTeam));
    const table = new Map(teams.map((team) => [team, emptyGroupRow(team)]));
    let appliedResults = 0;
    for (const result of completed.filter((f) => teams.includes(f.homeTeam) && teams.includes(f.awayTeam))) {
      applyResult(table, result);
      appliedResults += 1;
    }
    const standings = [...table.values()]
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    return { group, fixtures: groupFixtures, standings, appliedResults };
  });
}

function nationsLeagueStatus() {
  const data = readNationsLeagueFixtures();
  return {
    competition: "UEFA Nations League",
    season: "2026-27 UEFA Nations League",
    fixtureCount: data.fixtureCount || data.fixtures?.length || 0,
    teamCount: data.teamCount || data.teams?.length || 0,
    groupCount: data.groupCount || Object.keys(data.groups || {}).length,
    updatedAt: data.updatedAt || null,
    source: data.source || null,
  };
}

module.exports = {
  predictNationsLeagueFixture,
  nationsLeagueFixturePredictions,
  nationsLeagueGroupTables,
  nationsLeagueStatus,
};
