"use strict";

const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { isInScopeMatch, MIN_TRAINING_DATE } = require("../src/footballHistory/scope");

const through = process.argv.find((arg) => arg.startsWith("--through="))?.slice(10) || new Date().toISOString().slice(0, 10);
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9)
  || path.join("data", "teams", "history", "normalized", "training", `verified-major-history-${through}.json`);
const rows = fs.readdirSync(historyDir())
  .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
  .flatMap((file) => {
    const record = readHistory(path.basename(file, ".json"));
    if (record?.contract !== "football-team-history-v1") return [];
    return (record.matches || []).filter((match) => isInScopeMatch(match, { through })).map((match) => ({
      id: match.id,
      date: match.date,
      season: match.season,
      team: record.team,
      opponent: match.opponent,
      venue: match.venue,
      competition: match.competition,
      stage: match.stage || "",
      score: match.score,
      result: match.result,
      sources: match.sources,
      sourceRef: match.sourceRef,
    }));
  })
  .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
// Rows are streamed in batches rather than passed through a single JSON.stringify
// call: the combined dataset is now large enough to exceed V8's max string length.
fs.mkdirSync(path.dirname(output), { recursive: true });
const fd = fs.openSync(output, "w");
const header = JSON.stringify({
  contract: "football-verified-major-history-training-v1",
  generatedAt: new Date().toISOString(),
  policy: "Individually dated, attributable major-competition records from 1985 onward; include preseason friendlies only when the record explicitly identifies a Europe/South America cross-confederation opponent.",
  from: MIN_TRAINING_DATE,
  through,
  rowCount: rows.length,
}, null, 2);
fs.writeSync(fd, `${header.slice(0, -2)},\n  "rows": [\n`);
const batchSize = 5000;
for (let start = 0; start < rows.length; start += batchSize) {
  const batch = rows.slice(start, start + batchSize);
  const body = batch.map((row) => `    ${JSON.stringify(row)}`).join(",\n");
  fs.writeSync(fd, start === 0 ? body : `,\n${body}`);
}
fs.writeSync(fd, "\n  ]\n}\n");
fs.closeSync(fd);
console.log(JSON.stringify({ output, rowCount: rows.length, from: MIN_TRAINING_DATE, through }, null, 2));
