"use strict";
const fs = require("fs"); const path = require("path");
const { runChronologicalBacktest } = require("../src/baseballModel/backtest");
const input = process.argv[2]; const output = process.argv[3] || path.join("data", "baseball", "chronological_backtest.json");
if (!input) throw new Error("Usage: node scripts/backtest_baseball_models.js <dataset.json> [output.json]");
const data = JSON.parse(fs.readFileSync(input, "utf8")); const report = runChronologicalBacktest(Array.isArray(data) ? data : data.rows); fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify({ output, folds: report.folds, metrics: report.metrics }, null, 2));
