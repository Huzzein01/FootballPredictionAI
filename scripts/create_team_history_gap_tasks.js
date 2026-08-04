"use strict";
// Generates a deterministic, reviewable collection queue. It does not invent facts
// or mark a team covered merely because a source is listed.
const fs = require("fs"); const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { MIN_YEAR } = require("../src/footballHistory/schema");
const through = Number(process.argv.find((arg) => arg.startsWith("--through="))?.slice(10) || new Date().getUTCFullYear());
const tasks = [];
for (const file of fs.readdirSync(historyDir()).filter((name) => name.endsWith(".json") && name !== "_index.json")) { const record = readHistory(path.basename(file, ".json")); if (record?.contract !== "football-team-history-v1") continue; const covered = new Set(record.coverage?.seasonsWithMatches || []); for (let year = MIN_YEAR; year <= through; year += 1) { const season = `${year}-${String(year + 1).slice(-2)}`; if (!covered.has(season)) tasks.push({ team: record.team, season, required: ["all domestic league matches", "domestic cups", "continental competitions", "final league/competition standings"], sourcePlanRef: `${record.team.slug}#sourcePlan` }); } }
const output = path.join("data", "teams", "history", "backfill-tasks.json"); fs.writeFileSync(output, JSON.stringify({ contract: "football-team-history-backfill-tasks-v1", generatedAt: new Date().toISOString(), fromYear: MIN_YEAR, throughYear: through, taskCount: tasks.length, tasks }, null, 2) + "\n"); console.log(JSON.stringify({ output, taskCount: tasks.length }, null, 2));
