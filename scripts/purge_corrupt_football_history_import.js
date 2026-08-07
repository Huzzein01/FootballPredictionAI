"use strict";
const fs = require("fs"); const path = require("path"); const { historyDir, readHistory, writeHistory, rebuildCoverage } = require("../src/footballHistory/store");
let removed = 0; let teams = 0;
for (const file of fs.readdirSync(historyDir()).filter((name) => name.endsWith(".json") && name !== "_index.json")) { const record = readHistory(path.basename(file, ".json")); if (!record || record.contract !== "football-team-history-v1" || !Array.isArray(record.matches)) continue; const before = record.matches.length; record.matches = record.matches.filter((match) => !/^football-data:[a-f0-9]{64}:.+:(home|away)$/.test(match.id || "")); if (record.matches.length !== before) { removed += before - record.matches.length; teams += 1; rebuildCoverage(record); record.updatedAt = new Date().toISOString(); writeHistory(record); } }
console.log(JSON.stringify({ removed, teams }, null, 2));
