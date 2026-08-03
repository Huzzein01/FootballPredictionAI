"use strict";
const fs = require("fs");
const { collectPregameFeatures } = require("../src/baseballModel/pregameCollectors");
function option(name) { const value = process.argv.find((argument) => argument.startsWith(`--${name}=`)); return value ? value.slice(name.length + 3) : ""; }
async function main() { const input = option("input"); if (!input) throw new Error("Usage: node scripts/collect_mlb_pregame_features.js --input=path/to/normalized-schedule.json [--captured-at=ISO]"); const result = await collectPregameFeatures({ normalizedSchedule: JSON.parse(fs.readFileSync(input, "utf8")), capturedAt: option("captured-at") || new Date().toISOString() }); console.log(JSON.stringify(result, null, 2)); }
if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
