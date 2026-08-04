"use strict";

const fs = require("fs");
const path = require("path");
const { seasonFromDate } = require("../src/footballHistory/schema");

const months = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
function plain(html) { return html.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]+>/g, "\n").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#[0-9]+;/g, " "); }
function dateFromLine(line) {
  const found = line.match(/\b(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\s+(19\d{2}|20\d{2})\b/i);
  if (!found) return "";
  return `${found[3]}-${String(months[found[2].toLowerCase()]).padStart(2, "0")}-${String(found[1]).padStart(2, "0")}`;
}
const manifestPath = path.join("data", "teams", "history", "raw", "rsssf-coppa-italia-manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error("Run collect_rsssf_coppa_italia.js first.");
const source = JSON.parse(fs.readFileSync(manifestPath, "utf8")).rows.find((row) => row.captured && fs.existsSync(row.file));
if (!source) throw new Error("No captured RSSSF Coppa Italia artifact found.");
let date = ""; let stage = ""; const matches = [];
for (const rawLine of plain(fs.readFileSync(source.file, "utf8")).split(/\r?\n/)) {
  const line = rawLine.replace(/\s+/g, " ").trim();
  if (!line) continue;
  const foundDate = dateFromLine(line); if (foundDate) date = foundDate;
  if (/^(FIRST ROUND|SECOND ROUND|QUARTER|SEMIFINAL|FINAL|[0-9]+[a-z°]* GIRONE|ANDATA|RITORNO)/i.test(line)) stage = line;
  const result = line.match(/^(.+?)\s+-\s+(.+?)\s+(\d+)\s*-\s*(\d+)(?:\s|$)/);
  if (!result || !date || date < "1985-01-01") continue;
  const [, rawHome, rawAway, homeGoals, awayGoals] = result;
  const home = rawHome.trim().replace(/\s*\(\d+\)\s*$/, "");
  const away = rawAway.trim().replace(/\s*\(\d+\)\s*$/, "");
  if (/^(classifica|goals|referee|attendance)/i.test(home)) continue;
  const common = { date, season: seasonFromDate(date), competition: { name: "Coppa Italia", type: "cup", country: "Italy" }, stage, source: { provider: "RSSSF", url: source.url, retrievedAt: source.retrievedAt, rawArtifact: source.file } };
  const key = `${source.sha256}:${date}:${encodeURIComponent(home)}:${encodeURIComponent(away)}`;
  matches.push({ ...common, id: `rsssf-coppa-italia:${key}:home`, team: home, opponent: away, venue: "home", score: { for: Number(homeGoals), against: Number(awayGoals) } }, { ...common, id: `rsssf-coppa-italia:${key}:away`, team: away, opponent: home, venue: "away", score: { for: Number(awayGoals), against: Number(homeGoals) } });
}
const output = path.join("data", "teams", "history", "normalized", `rsssf-coppa-italia-${Date.now()}.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ contract: "football-history-normalized-artifact-v1", provider: "RSSSF", generatedAt: new Date().toISOString(), sourceManifest: manifestPath, matches }, null, 2) + "\n");
console.log(JSON.stringify({ output, matches: matches.length }, null, 2));
