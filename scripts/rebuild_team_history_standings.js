"use strict";
const { rebuildLeagueStandings } = require("../src/footballHistory/standings");
console.log(JSON.stringify(rebuildLeagueStandings(), null, 2));
