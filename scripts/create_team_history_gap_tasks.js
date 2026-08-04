"use strict";
// Generates a reviewable collection queue. A missing season is only a task
// inside a team's observed participation window; clubs are not assumed to have
// played every season since 1985.
const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { MIN_YEAR } = require("../src/footballHistory/schema");

const through = Number(process.argv.find((arg) => arg.startsWith("--through="))?.slice(10) || new Date().getUTCFullYear());
const tasks = [];
for (const file of fs.readdirSync(historyDir()).filter((name) => name.endsWith(".json") && name !== "_index.json")) {
  const record = readHistory(path.basename(file, ".json"));
  if (record?.contract !== "football-team-history-v1") continue;
  const covered = new Set(record.coverage?.seasonsWithMatches || []);
  const observedYears = [...covered].map((season) => Number(String(season).slice(0, 4))).filter(Number.isFinite);
  if (!observedYears.length) {
    tasks.push({ team: record.team, type: "participation-index", required: ["verify first and last major-competition participation", "do not infer missing historical seasons"], sourcePlanRef: `${record.team.slug}#sourcePlan` });
    continue;
  }
  const start = Math.max(MIN_YEAR, Math.min(...observedYears));
  const end = Math.min(through, Math.max(...observedYears));
  for (let year = start; year <= end; year += 1) {
    const season = `${year}-${String(year + 1).slice(-2)}`;
    if (!covered.has(season)) tasks.push({ team: record.team, type: "observed-window-gap", season, required: ["verify whether the club participated in a major competition", "collect dated league/cup/continental results only if participation is confirmed", "collect final standings where applicable"], sourcePlanRef: `${record.team.slug}#sourcePlan` });
  }
}
const output = path.join("data", "teams", "history", "backfill-tasks.json");
fs.writeFileSync(output, JSON.stringify({ contract: "football-team-history-backfill-tasks-v2", generatedAt: new Date().toISOString(), fromYear: MIN_YEAR, throughYear: through, policy: "Tasks cover only observed participation windows. Missing records are never treated as evidence of a missed season.", taskCount: tasks.length, tasks }, null, 2) + "\n");
console.log(JSON.stringify({ output, taskCount: tasks.length }, null, 2));
