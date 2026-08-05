"use strict";
// First backfill collector: downloads dated raw CSV artifacts before normalization.
// It intentionally supports only sources with a stable documented file pattern; all
// other competitions must enter through `ingest:team-history` with provenance.
const fs = require("fs"); const path = require("path"); const crypto = require("crypto");
const { writeFileRetrying } = require("../src/runtimePaths");
const leagues = { EPL: "E0", "La Liga": "SP1", Bundesliga: "D1", "Ligue 1": "F1" };
const arg = (name, fallback) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const from = Number(arg("from", "1985")); const to = Number(arg("to", String(new Date().getUTCFullYear())));
const selected = arg("leagues", Object.keys(leagues).join(",")).split(",").map((name) => name.trim()).filter((name) => leagues[name]);
function code(year) { return `${String(year).slice(-2)}${String(year + 1).slice(-2)}`; }
async function main() {
  const output = [];
  for (let year = from; year <= to; year += 1) for (const name of selected) {
    const url = `https://www.football-data.co.uk/mmz4281/${code(year)}/${leagues[name]}.csv`;
    const response = await fetch(url, { headers: { "user-agent": "SportsbooksAnalyst historical-data collector" } });
    if (!response.ok) { output.push({ season: `${year}-${String(year + 1).slice(-2)}`, competition: name, url, status: response.status, captured: false }); continue; }
    const body = await response.text();
    const digest = crypto.createHash("sha256").update(body).digest("hex");
    const destination = path.join("data", "teams", "history", "raw", "football-data", digest + ".csv");
    writeFileRetrying(destination, body);
    output.push({ season: `${year}-${String(year + 1).slice(-2)}`, competition: name, url, capturedAt: new Date().toISOString(), sha256: digest, file: destination, captured: true });
  }
  const manifestPath = path.join("data", "teams", "history", "raw", "football-data-manifest.json"); const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { rows: [] }; const byUrl = new Map((previous.rows || []).map((row) => [row.url, row])); for (const row of output) byUrl.set(row.url, row);
  const manifest = { contract: "football-history-raw-manifest-v1", generatedAt: new Date().toISOString(), provider: "football-data.co.uk", fromYear: Math.min(from, ...(previous.rows || []).map((row) => Number(String(row.season).slice(0, 4))).filter(Number.isFinite)), toYear: to, rows: [...byUrl.values()].sort((a, b) => String(a.season).localeCompare(String(b.season)) || String(a.competition).localeCompare(String(b.competition))) };
  writeFileRetrying(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ manifestPath, requested: output.length, captured: output.filter((item) => item.captured).length, unavailable: output.filter((item) => !item.captured).length, manifestRows: manifest.rows.length }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
