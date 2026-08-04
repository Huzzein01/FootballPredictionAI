"use strict";
const { coverageReport } = require("../src/footballHistory/coverage");
console.log(JSON.stringify(coverageReport(), null, 2));
