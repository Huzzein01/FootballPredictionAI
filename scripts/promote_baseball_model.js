"use strict";
const fs = require("fs"); const path = require("path"); const { promoteModel } = require("../src/baseballModel/modelRegistry");
const [modelFile, backtestFile] = process.argv.slice(2); if (!modelFile || !backtestFile) throw new Error("Usage: node scripts/promote_baseball_model.js <model.json> <backtest.json>");
console.log(JSON.stringify(promoteModel({ model: JSON.parse(fs.readFileSync(modelFile, "utf8")), backtest: JSON.parse(fs.readFileSync(backtestFile, "utf8")), registryDir: path.join("data", "baseball", "model_registry") }), null, 2));
