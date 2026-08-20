"use strict";

const { assertPregameSnapshot } = require("./schema");

// Same results-only rating pattern as basketballModel/features.js — no
// starter/injury feed is available for the NFL yet, so offense/defense
// ratings are derived purely from points scored/allowed before kickoff.
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
    homeRestDays: number(home.restDays, 7), awayRestDays: number(away.restDays, 7),
  };
}

function vector(snapshot) {
  const features = buildFeatures(snapshot);
  return FEATURE_NAMES.map((name) => features[name]);
}

module.exports = { FEATURE_NAMES, buildFeatures, vector };
