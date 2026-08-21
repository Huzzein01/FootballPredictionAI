"use strict";

// Usage: node scripts/train_basketball_model.js [output.json]
// Builds training rows directly from the cached NBA season files in
// data/multi_sport/ (no network calls) via a leakage-safe chronological
// reconstruction, then trains and writes a model, mirroring
// scripts/train_baseball_model.js.
const fs = require("fs");
const path = require("path");
const { reconstructTrainingRows } = require("../src/basketballModel/historicalDataset");
const { trainBasketballModel } = require("../src/basketballModel/pipeline");
const { validateCandidate } = require("../src/sharedSportModel/modelValidator");

const output = process.argv[2] || path.join(process.cwd(), "model", "basketball_forecast_model.json");
const cacheDir = path.join(process.cwd(), "data", "multi_sport");
const seasonFiles = fs.readdirSync(cacheDir).filter((name) => name.startsWith("basketball_") && name.endsWith(".json"));
if (!seasonFiles.length) throw new Error("No cached basketball season files found in data/multi_sport");

const games = seasonFiles.flatMap((name) => JSON.parse(fs.readFileSync(path.join(cacheDir, name), "utf8")).games || []);
const rows = reconstructTrainingRows(games);
if (rows.length < 50) throw new Error(`Only ${rows.length} completed NBA games available — need more history to train`);

const model = trainBasketballModel(rows);
const verdict = validateCandidate(model, output);
if (!verdict.promote) {
  console.log(JSON.stringify({ promoted: false, output, rows: rows.length, ...verdict }, null, 2));
  process.exit(0);
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(model, null, 2) + "\n");
console.log(JSON.stringify({ promoted: true, output, rows: rows.length, selection: model.selection, trainedAt: model.trainedAt, ...verdict }, null, 2));
