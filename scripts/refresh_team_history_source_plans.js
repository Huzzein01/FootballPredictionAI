"use strict";
const fs = require("fs"); const path = require("path"); const { historyDir, readHistory, writeHistory } = require("../src/footballHistory/store"); const { sourcePlan } = require("../src/footballHistory/sources");
let updated = 0;
for (const file of fs.readdirSync(historyDir()).filter((name) => name.endsWith(".json") && name !== "_index.json")) { const record = readHistory(path.basename(file, ".json")); if (record?.contract !== "football-team-history-v1") continue; record.sourcePlan = sourcePlan(record.team); record.updatedAt = new Date().toISOString(); writeHistory(record); updated += 1; }
console.log(JSON.stringify({ updated }, null, 2));
