"use strict";

const fs = require("fs");
const path = require("path");
const { repoDataPath } = require("../src/runtimePaths");
const { ensureHistory, historyDir } = require("../src/footballHistory/store");

function main() {
  const results = JSON.parse(fs.readFileSync(repoDataPath("teams", "results", "_index.json"), "utf8"));
  let created = 0;
  for (const team of results.teams || []) if (ensureHistory(team).created) created += 1;
  const records = fs.readdirSync(historyDir()).filter((file) => file.endsWith(".json") && file !== "_index.json");
  const index = { contract: "football-team-history-index-v1", generatedAt: new Date().toISOString(), teamCount: records.length, source: "data/teams/results/_index.json", files: records.sort() };
  fs.writeFileSync(path.join(historyDir(), "_index.json"), JSON.stringify(index, null, 2) + "\n");
  console.log(JSON.stringify({ output: historyDir(), created, existing: records.length - created, teamCount: records.length }, null, 2));
}
main();
