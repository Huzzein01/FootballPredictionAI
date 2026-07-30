"use strict";

const fs = require("fs");
const path = require("path");
const { buildHistoricalDataset } = require("../src/baseballModel/historicalDataset");

function option(name, fallback) {
  const value = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  return value ? value.slice(name.length + 3) : fallback;
}

async function main() {
  const startSeason = option("start", "2021");
  const endSeason = option("end", String(new Date().getUTCFullYear() - 1));
  const output = option("output", path.join("data", "baseball", `mlb_pregame_${startSeason}_${endSeason}.json`));
  const dataset = await buildHistoricalDataset({ startSeason, endSeason });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(dataset, null, 2) + "\n");
  console.log(JSON.stringify({ output, rowCount: dataset.rowCount, seasons: dataset.seasons, contract: dataset.datasetContract }, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
