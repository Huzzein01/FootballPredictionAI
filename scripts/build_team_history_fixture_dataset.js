"use strict";

const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { fixtureRows } = require("../src/footballHistory/fixtures");
const { MIN_TRAINING_DATE } = require("../src/footballHistory/scope");

const through = process.argv.find((arg) => arg.startsWith("--through="))?.slice(10) || new Date().toISOString().slice(0, 10);
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice(9)
  || path.join("data", "teams", "history", "normalized", "training", `verified-major-fixtures-${through}.json`);
const progress = process.argv.includes("--progress");
const records = fs.readdirSync(historyDir()).filter((file) => file.endsWith(".json") && !file.startsWith("_"))
  .map((file) => readHistory(path.basename(file, ".json"))).filter((record) => record?.contract === "football-team-history-v1");
const { fixtures, conflicts } = fixtureRows(records, { through, onRecord: progress ? ({ recordIndex, team, fixtureCount, conflictCount }) => {
  if (recordIndex % 100 === 0 || recordIndex === records.length) console.error(JSON.stringify({ phase: "deduplicate", recordIndex, totalRecords: records.length, team, fixtureCount, conflictCount }));
} : undefined });
if (conflicts.length) throw new Error(`Refusing to train on ${conflicts.length} conflicting duplicate fixture(s). Review the first conflict: ${JSON.stringify(conflicts[0])}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({
  contract: "football-verified-major-fixture-training-v1",
  generatedAt: new Date().toISOString(),
  policy: "One deduplicated home/away fixture per verified, individually dated major-competition match from 1985 onward. Conflicting source scores abort the build.",
  from: MIN_TRAINING_DATE,
  through,
  fixtureCount: fixtures.length,
  fixtures,
}, null, 2) + "\n");
console.log(JSON.stringify({ output, fixtureCount: fixtures.length, conflicts: conflicts.length }, null, 2));
