"use strict";

const { assertPregameSnapshot } = require("./schema");

// Neutral is 100, same convention as the baseball feature set. Ratings are
// built purely from points-for/against in games played strictly before the
// target game (see historicalDataset.js / forecastService.js), since no
// lineup/injury feed is available for the NBA yet.
const FEATURE_NAMES = [
  "homeOffense", "awayOffense", "homeDefense", "awayDefense",
  "homeRestDays", "awayRestDays",
];

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildFeatures(snapshot) {
  assertPregameSnapshot(snapshot);
  const home = snapshot.home || {};
  const away = snapshot.away || {};
  return {
    homeOffense: number(home.offenseRating, 100), awayOffense: number(away.offenseRating, 100),
    homeDefense: number(home.defenseRating, 100), awayDefense: number(away.defenseRating, 100),
    homeRestDays: number(home.restDays, 1), awayRestDays: number(away.restDays, 1),
  };
}

function vector(snapshot) {
  const features = buildFeatures(snapshot);
  return FEATURE_NAMES.map((name) => features[name]);
}

module.exports = { FEATURE_NAMES, buildFeatures, vector };
