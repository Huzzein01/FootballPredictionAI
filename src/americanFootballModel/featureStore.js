"use strict";

// Skeleton for turning imported NFL schedule games into frozen pregame
// feature snapshots — the shape training rows must satisfy (see schema.js)
// before pipeline.js can train a model. Schedule import itself is real and
// working (delegated to multiSportDataService, same as the basketball path);
// feature collection is the part left for later training work.

const { refreshSportSeason, readOrRefreshSportSeason } = require("../multiSportDataService");

async function readSeason(season, { refresh = false } = {}) {
  return readOrRefreshSportSeason("american-football", season, { refresh });
}

async function refreshSeason(season) {
  return refreshSportSeason("american-football", season);
}

// TODO(training): once box-score, injury, and weather feeds are chosen, turn
// each scheduled game into a pregame snapshot matching schema.js's REQUIRED
// shape (gameId, kickoffUtc, capturedAt, homeTeam, awayTeam) plus feature
// fields such as team form, QB/starter status, rest days, and travel context.
function collectPregameFeatures(/* game */) {
  throw new Error("American Football pregame feature collection is not implemented yet — only schedule import (readSeason) is available.");
}

module.exports = { readSeason, refreshSeason, collectPregameFeatures };
