"use strict";

const { assertPregameSnapshot } = require("./schema");

// Inputs deliberately cover the information that makes an MLB prediction
// usable pregame: starters, current lineups, bullpens, park, travel, weather
// and a team's current form. Missing values are imputed to league neutral.
const FEATURE_NAMES = [
  "homeOffense", "awayOffense", "homeStarter", "awayStarter",
  "homeBullpen", "awayBullpen", "homeLineup", "awayLineup",
  "parkRunFactor", "temperatureF", "windOutMph",
  "homeTravelMiles", "awayTravelMiles", "homeRestDays", "awayRestDays",
];

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildFeatures(snapshot) {
  assertPregameSnapshot(snapshot);
  const home = snapshot.home || {};
  const away = snapshot.away || {};
  const park = snapshot.park || {};
  const weather = snapshot.weather || {};
  return {
    homeOffense: number(home.offenseRating), awayOffense: number(away.offenseRating),
    homeStarter: number(home.startingPitcherRating), awayStarter: number(away.startingPitcherRating),
    homeBullpen: number(home.bullpenRating), awayBullpen: number(away.bullpenRating),
    homeLineup: number(home.lineupRating), awayLineup: number(away.lineupRating),
    parkRunFactor: number(park.runFactor, 1), temperatureF: number(weather.temperatureF, 70),
    windOutMph: number(weather.windOutMph), homeTravelMiles: number(home.travelMiles),
    awayTravelMiles: number(away.travelMiles), homeRestDays: number(home.restDays), awayRestDays: number(away.restDays),
  };
}

function vector(snapshot) {
  const features = buildFeatures(snapshot);
  return FEATURE_NAMES.map((name) => features[name]);
}

module.exports = { FEATURE_NAMES, buildFeatures, vector };
