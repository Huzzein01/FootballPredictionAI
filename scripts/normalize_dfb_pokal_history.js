"use strict";

const fs = require("fs");
const path = require("path");
const { seasonFromDate } = require("../src/footballHistory/schema");

function text(value) { return String(value || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(); }
// Each DFB fixture begins a distinct MatchTable row. Splitting at the next row
// marker avoids trying to balance the nested layout <div>s with a regex.
function matchRows(html) { return html.split(/<div\s+class="c-MatchTable-row"\s*>/).slice(1); }
function parseRow(row, source) {
  const date = text(row.match(/c-MatchTable-description">[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/)?.[1]).match(/(\d{2})\.(\d{2})\.(\d{4})/) || [];
  const teams = [...row.matchAll(/c-MatchTable-team--(?:home|away)[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g)].map((match) => text(match[1]));
  const score = text(row.match(/c-MatchTable-score">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1]).match(/^(\d+)\s*:\s*(\d+)/);
  const fixtureUrl = row.match(/c-MatchTable-score">[\s\S]*?<a href="([^"]+)"/)?.[1] || source.url;
  if (!date.length || teams.length !== 2 || !score) return null;
  return { date: `${date[3]}-${date[2]}-${date[1]}`, home: teams[0], away: teams[1], homeGoals: Number(score[1]), awayGoals: Number(score[2]), fixtureUrl };
}
const manifestPath = path.join("data", "teams", "history", "raw", "dfb-pokal-manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error("Run collect_dfb_pokal_history.js first.");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const matches = [];
for (const source of manifest.rows.filter((row) => row.captured && fs.existsSync(row.file))) {
  for (const fixture of matchRows(fs.readFileSync(source.file, "utf8")).map((row) => parseRow(row, source)).filter(Boolean)) {
    if (fixture.date < "1985-01-01") continue;
    const common = { date: fixture.date, season: seasonFromDate(fixture.date), competition: { name: "DFB-Pokal", type: "cup", country: "Germany" }, stage: "", source: { provider: "DFB Datencenter", url: fixture.fixtureUrl, retrievedAt: source.retrievedAt, rawArtifact: source.file } };
    const key = `${source.sha256}:${fixture.date}:${encodeURIComponent(fixture.home)}:${encodeURIComponent(fixture.away)}`;
    matches.push({ ...common, id: `dfb-pokal:${key}:home`, team: fixture.home, opponent: fixture.away, venue: "home", score: { for: fixture.homeGoals, against: fixture.awayGoals } }, { ...common, id: `dfb-pokal:${key}:away`, team: fixture.away, opponent: fixture.home, venue: "away", score: { for: fixture.awayGoals, against: fixture.homeGoals } });
  }
}
const output = path.join("data", "teams", "history", "normalized", `dfb-pokal-${Date.now()}.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ contract: "football-history-normalized-artifact-v1", provider: "DFB Datencenter", generatedAt: new Date().toISOString(), sourceManifest: manifestPath, matches }, null, 2)}\n`);
console.log(JSON.stringify({ output, matches: matches.length }, null, 2));
