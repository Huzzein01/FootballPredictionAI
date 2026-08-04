"use strict";

const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { validateHistory } = require("../src/footballHistory/schema");

const files = fs.existsSync(historyDir()) ? fs.readdirSync(historyDir()).filter((file) => file.endsWith(".json") && file !== "_index.json") : [];
const reports = files.map((file) => ({ file, ...validateHistory(readHistory(path.basename(file, ".json"))) }));
const invalid = reports.filter((report) => !report.valid);
console.log(JSON.stringify({ reportVersion: "football-team-history-qa-v1", valid: invalid.length === 0, teamFiles: files.length, invalidFiles: invalid.slice(0, 20) }, null, 2));
process.exitCode = invalid.length ? 1 : 0;
