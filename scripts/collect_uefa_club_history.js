"use strict";
// Collects immutable official UEFA raw artifacts. It intentionally keeps
// retrieval separate from normalization and does not claim that UEFA covers
// domestic cups or preseason friendlies.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { writeFileRetrying } = require("../src/runtimePaths");

const competitions = {
  1: "UEFA Champions League / European Cup",
  2: "UEFA Cup Winners' Cup",
  14: "UEFA Cup / UEFA Europa League",
};
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const from = Number(option("from", "1985"));
const to = Number(option("to", String(new Date().getUTCFullYear())));
const selected = option("competitions", Object.keys(competitions).join(",")).split(",").map(Number).filter((id) => competitions[id]);
const root = "https://match.uefa.com/v5/matches";

async function fetchSeason(competitionId, seasonYear) {
  const matches = [];
  const urls = [];
  for (let offset = 0; ; offset += 500) {
    const url = `${root}?competitionId=${competitionId}&seasonYear=${seasonYear}&limit=500&offset=${offset}&order=ASC`;
    const response = await fetch(url, { headers: { "user-agent": "SportsbooksAnalyst historical-data collector" } });
    if (!response.ok) return { url, captured: false, status: response.status };
    const page = await response.json();
    if (!Array.isArray(page)) return { url, captured: false, status: "unexpected-response" };
    urls.push(url); matches.push(...page);
    if (page.length < 500) break;
  }
  const body = JSON.stringify(matches);
  const sha256 = crypto.createHash("sha256").update(body).digest("hex");
  const file = path.join("data", "teams", "history", "raw", "uefa", `${sha256}.json`);
  writeFileRetrying(file, body + "\n");
  return { competitionId, competition: competitions[competitionId], seasonYear, urls, captured: true, retrievedAt: new Date().toISOString(), sha256, file, matchCount: matches.length };
}

async function main() {
  const manifestPath = path.join("data", "teams", "history", "raw", "uefa-manifest.json");
  const prior = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { rows: [] };
  const keyed = new Map((prior.rows || []).map((row) => [`${row.competitionId}:${row.seasonYear}`, row]));
  const rows = [];
  const save = () => writeFileRetrying(manifestPath, JSON.stringify({ contract: "football-history-raw-manifest-v1", provider: "UEFA official match API", generatedAt: new Date().toISOString(), fromYear: Math.min(from, ...(keyed.values().map((row) => row.seasonYear))), toYear: Math.max(to, ...(keyed.values().map((row) => row.seasonYear))), rows: [...keyed.values()].sort((a, b) => a.seasonYear - b.seasonYear || a.competitionId - b.competitionId) }, null, 2) + "\n");
  for (let seasonYear = from; seasonYear <= to; seasonYear += 1) for (const competitionId of selected) {
    const row = await fetchSeason(competitionId, seasonYear);
    rows.push(row); keyed.set(`${row.competitionId}:${row.seasonYear}`, row); save();
  }
  console.log(JSON.stringify({ manifestPath, requested: rows.length, captured: rows.filter((row) => row.captured).length, unavailable: rows.filter((row) => !row.captured).length, matchCount: rows.reduce((count, row) => count + (row.matchCount || 0), 0) }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
