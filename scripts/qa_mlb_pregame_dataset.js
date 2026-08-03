"use strict";

const fs = require("fs");
const { summarizeDataset } = require("../src/baseballModel/datasetQa");

function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: node scripts/qa_mlb_pregame_dataset.js <dataset.json>");
  const dataset = JSON.parse(fs.readFileSync(input, "utf8"));
  const report = summarizeDataset(dataset);
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { main };
