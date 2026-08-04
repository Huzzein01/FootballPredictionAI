"use strict";

const fs = require("fs");
const path = require("path");
const { seasonFromDate } = require("../src/footballHistory/schema");

const competitionNames = { 1: "UEFA Champions League / European Cup", 2: "UEFA Cup Winners' Cup", 14: "UEFA Cup / UEFA Europa League" };
function name(team) { return team?.translations?.displayName?.EN || team?.internationalName || ""; }
function score(match, side) { return Number(match?.score?.total?.[side]); }
const manifestPath = path.join("data", "teams", "history", "raw", "uefa-manifest.json");
if (!fs.existsSync(manifestPath)) throw new Error("Run collect_uefa_club_history.js first; no UEFA raw manifest found.");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const matches = [];
for (const source of manifest.rows.filter((row) => row.captured && fs.existsSync(row.file))) {
  for (const item of JSON.parse(fs.readFileSync(source.file, "utf8"))) {
    const date = item?.kickOffTime?.date;
    const home = name(item.homeTeam); const away = name(item.awayTeam);
    const homeGoals = score(item, "home"); const awayGoals = score(item, "away");
    if (item.status !== "FINISHED" || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !home || !away || !Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) continue;
    // UEFA legacy competition query years are not uniform (the former Cup
    // Winners' Cup uses a different season-year convention). Derive the
    // football season from the actual official kick-off date instead.
    const season = seasonFromDate(date);
    const competition = { name: competitionNames[source.competitionId] || source.competition, type: "continental", country: "Europe" };
    const stage = item?.round?.translations?.name?.EN || item?.matchday?.translations?.longName?.EN || item.type || "";
    const detailUrl = `https://www.uefa.com/uefachampionsleague/match/${item.id}/`;
    const common = { date, season, competition, stage, source: { provider: "UEFA official match API", url: detailUrl, retrievedAt: source.retrievedAt, rawArtifact: source.file } };
    matches.push({ ...common, id: `uefa:${item.id}:home`, team: home, opponent: away, venue: "home", score: { for: homeGoals, against: awayGoals } }, { ...common, id: `uefa:${item.id}:away`, team: away, opponent: home, venue: "away", score: { for: awayGoals, against: homeGoals } });
  }
}
const output = path.join("data", "teams", "history", "normalized", `uefa-${Date.now()}.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ contract: "football-history-normalized-artifact-v1", provider: "UEFA official match API", generatedAt: new Date().toISOString(), sourceManifest: manifestPath, matches }, null, 2) + "\n");
console.log(JSON.stringify({ output, matches: matches.length }, null, 2));
