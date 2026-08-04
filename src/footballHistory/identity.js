"use strict";
const { normalizeTeamName } = require("../footballData");

// Only confirmed historical display-name variants belong here. Unknown similarities
// are deliberately left alone for manual review rather than merged heuristically.
const HISTORICAL_ALIASES = {
  "blackburn rovers": "Blackburn",
  "bradford city": "Bradford",
  "brighton and hove albion": "Brighton",
  "coventry city": "Coventry",
  "derby county": "Derby",
  "huddersfield town": "Huddersfield",
  "leeds united": "Leeds",
  "leicester city": "Leicester",
  "oldham athletic": "Oldham",
  "queens park rangers": "QPR",
  "sheffield wednesday": "Sheffield Weds",
  "stoke city": "Stoke",
  "swansea city": "Swansea",
  "swindon town": "Swindon",
  "watford": "Watford",
};
function canonicalHistoricalName(name) {
  const plain = String(name || "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  return HISTORICAL_ALIASES[plain] || normalizeTeamName(name);
}
module.exports = { HISTORICAL_ALIASES, canonicalHistoricalName };
