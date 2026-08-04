"use strict";
const { importBundledLeagueHistory } = require("../src/footballHistory/importers");
console.log(JSON.stringify({ source: "bundled football-data league CSVs", ...importBundledLeagueHistory() }, null, 2));
