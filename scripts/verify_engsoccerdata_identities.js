"use strict";
// Builds evidence for human-reviewed club-name merges. It does not modify any
// club record: same-looking names can identify different clubs.
const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");

function csvRows(text) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"') { if (quoted && next === '"') { value += char; index += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
const manifestPath = path.join("data", "teams", "history", "raw", "engsoccerdata-manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error("Run collect_engsoccerdata_history.js first; no source manifest found.");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const source = manifest.rows.find((row) => row.name === "teamnames.csv" && row.captured);
if (!source || !fs.existsSync(source.file)) throw new Error("teamnames.csv was not captured; rerun the collector before identity verification.");
const [headers, ...rows] = csvRows(fs.readFileSync(source.file, "utf8"));
const entries = rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
const existing = fs.readdirSync(historyDir()).filter((file) => file.endsWith(".json") && !file.startsWith("_"))
  .map((file) => readHistory(path.basename(file, ".json"))).filter((record) => record?.contract === "football-team-history-v1");
const exact = new Map(existing.map((record) => [record.team.name.toLocaleLowerCase("en"), record.team]));
const evidence = entries.map((entry) => ({ canonical: entry.name, alias: entry.name_other, country: entry.country, canonicalRecord: exact.get(String(entry.name).toLocaleLowerCase("en")) || null, aliasRecord: exact.get(String(entry.name_other).toLocaleLowerCase("en")) || null }))
  .filter((entry) => entry.canonicalRecord && entry.aliasRecord && entry.canonicalRecord.slug !== entry.aliasRecord.slug)
  .map((entry) => ({ ...entry, source: { provider: "jalapic/engsoccerdata", url: source.url, retrievedAt: source.retrievedAt, sha256: source.sha256 }, action: "review-before-merge" }));
const output = path.join("data", "teams", "history", "identity-evidence-engsoccerdata.json");
fs.writeFileSync(output, JSON.stringify({ contract: "football-team-history-identity-evidence-v1", generatedAt: new Date().toISOString(), policy: "Evidence only. A mapping is not applied until a reviewer confirms club continuity and that it is not a predecessor/successor collision.", source: { url: source.url, retrievedAt: source.retrievedAt, sha256: source.sha256 }, candidateCount: evidence.length, candidates: evidence }, null, 2) + "\n");
console.log(JSON.stringify({ output, candidateCount: evidence.length }, null, 2));
