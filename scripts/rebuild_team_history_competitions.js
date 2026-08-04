"use strict";
const { rebuildCompetitionProgress } = require("../src/footballHistory/competitionProgress");
console.log(JSON.stringify(rebuildCompetitionProgress(), null, 2));
