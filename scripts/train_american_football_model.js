"use strict";

// Usage: node scripts/train_american_football_model.js [output.json]
// Mirrors scripts/train_basketball_model.js: builds rows from the cached
// NFL season files in data/multi_sport/, no network calls.
const fs = require("fs");
const path = require("path");
const { reconstructTrainingRows } = require("../src/americanFootballModel/historicalDataset");
const { trainAmericanFootballModel } = require("../src/americanFootballModel/pipeline");

const output = process.argv[2] || path.join(process.cwd(), "model", "american_football_forecast_model.json");
const cacheDir = path.join(process.cwd(), "data", "multi_sport");
const seasonFiles = fs.readdirSync(cacheDir).filter((name) => name.startsWith("american-football_") && name.endsWith(".json"));
if (!seasonFiles.length) throw new Error("No cached american-football season files found in data/multi_sport");

const games = seasonFiles.flatMap((name) => JSON.parse(fs.readFileSync(path.join(cacheDir, name), "utf8")).games || []);
const rows = reconstructTrainingRows(games);
if (rows.length < 50) throw new Error(`Only ${rows.length} completed NFL games available — need more history to train`);

const model = trainAmericanFootballModel(rows);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(model, null, 2) + "\n");
console.log(JSON.stringify({ output, rows: rows.length, selection: model.selection, trainedAt: model.trainedAt }, null, 2));
