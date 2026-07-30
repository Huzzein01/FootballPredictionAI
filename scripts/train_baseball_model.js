"use strict";

// Usage: node scripts/train_baseball_model.js path/to/pregame-training-rows.json
// This intentionally reads a prepared snapshot dataset; it does not scrape,
// call an API, or write to a database as a side effect of loading modules.
const fs = require("fs");
const path = require("path");
const { trainBaseballModel } = require("../src/baseballModel/pipeline");

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/train_baseball_model.js <training-rows.json> [output.json]");
const output = process.argv[3] || path.join(process.cwd(), "data", "baseball_model.json");
const rows = JSON.parse(fs.readFileSync(input, "utf8"));
const model = trainBaseballModel(rows);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(model, null, 2) + "\n");
console.log(JSON.stringify({ output, selection: model.selection, trainedAt: model.trainedAt }, null, 2));
