"use strict";

// Usage: node scripts/auto_train_baseball_model.js [output.json]
// Self-contained retrain entry point for the background sync loop — unlike
// scripts/train_baseball_model.js (which expects a hand-prepared training
// rows file), this builds its own dataset straight from the MLB Stats API
// via historicalDataset.js's buildHistoricalDataset, covering the last two
// seasons, then only promotes the result if it doesn't regress meaningfully
// against whatever model is currently live.
const fs = require("fs");
const path = require("path");
const { buildHistoricalDataset } = require("../src/baseballModel/historicalDataset");
const { trainBaseballModel } = require("../src/baseballModel/pipeline");
const { validateCandidate } = require("../src/sharedSportModel/modelValidator");

const output = process.argv[2] || path.join(process.cwd(), "model", "baseball_forecast_model.json");
const endSeason = new Date().getUTCFullYear();
const startSeason = endSeason - 1;

buildHistoricalDataset({ startSeason, endSeason })
  .then((dataset) => {
    if (dataset.rowCount < 200) throw new Error(`Only ${dataset.rowCount} completed MLB games available across ${startSeason}-${endSeason} — need more history to train`);
    const model = trainBaseballModel(dataset.rows);
    const verdict = validateCandidate(model, output);
    if (!verdict.promote) {
      console.log(JSON.stringify({ promoted: false, output, rows: dataset.rowCount, seasons: dataset.seasons, ...verdict }, null, 2));
      return;
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(model, null, 2) + "\n");
    console.log(JSON.stringify({ promoted: true, output, rows: dataset.rowCount, seasons: dataset.seasons, selection: model.selection, trainedAt: model.trainedAt, ...verdict }, null, 2));
  })
  .catch((error) => {
    console.error(JSON.stringify({ promoted: false, error: error.message }));
    process.exitCode = 1;
  });
