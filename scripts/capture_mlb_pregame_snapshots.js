"use strict";
const fs = require("fs");
const { capturePregameSnapshots } = require("../src/baseballModel/featureStore");
function option(name) { const value = process.argv.find((argument) => argument.startsWith(`--${name}=`)); return value ? value.slice(name.length + 3) : ""; }
function main() { const input = option("input"); if (!input) throw new Error("Usage: node scripts/capture_mlb_pregame_snapshots.js --input=path/to/normalized-schedule.json [--captured-at=ISO]"); console.log(JSON.stringify(capturePregameSnapshots({ normalizedSchedule: JSON.parse(fs.readFileSync(input, "utf8")), capturedAt: option("captured-at") || new Date().toISOString() }), null, 2)); }
if (require.main === module) { try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; } }
