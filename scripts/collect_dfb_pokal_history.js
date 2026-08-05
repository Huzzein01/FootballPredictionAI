"use strict";

// Public, official DFB Datencenter collector. It is deliberately sequential and
// resumable: a manifest records every season URL and raw artifact hash.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { writeFileRetrying } = require("../src/runtimePaths");

const from = Number(process.argv.find((arg) => arg.startsWith("--from="))?.slice(7) || 1985);
const to = Number(process.argv.find((arg) => arg.startsWith("--to="))?.slice(5) || new Date().getUTCFullYear());
if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1985 || to < from) throw new Error("Use valid --from and --to years (from >= 1985).");
const manifestPath = path.join("data", "teams", "history", "raw", "dfb-pokal-manifest.json");
const rawDir = path.join("data", "teams", "history", "raw", "dfb");
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : { contract: "football-history-raw-manifest-v1", provider: "DFB Datencenter", scope: "DFB-Pokal individually dated fixtures", rows: [] };
const bySeason = new Map(manifest.rows.map((row) => [row.season, row]));

function persist() { manifest.generatedAt = new Date().toISOString(); writeFileRetrying(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`); }
async function main() {
  let sinceSave = 0;
  try {
    for (let year = from; year <= to; year += 1) {
      const season = `${year}-${year + 1}`;
      const previous = bySeason.get(season);
      if (previous?.captured && fs.existsSync(previous.file)) continue;
      const url = `https://datencenter.dfb.de/competitions/dfb-pokal/seasons/${season}?datacenter_name=datencenter`;
      const response = await fetch(url, { headers: { "user-agent": "SportsbooksAnalyst historical-data collector" } });
      if (!response.ok) throw new Error(`DFB request failed for ${season}: ${response.status}`);
      const body = await response.text();
      if (Buffer.byteLength(body) < 500) {
        // The site occasionally returns HTTP 200 with an empty body under load;
        // never record that as a captured artifact — leave it unresumed for a later retry.
        console.log(JSON.stringify({ season, captured: false, reason: "empty-response", bytes: Buffer.byteLength(body) }));
        continue;
      }
      const sha256 = crypto.createHash("sha256").update(body).digest("hex");
      const file = path.join(rawDir, `${sha256}.html`);
      writeFileRetrying(file, body);
      const row = { season, url, captured: true, retrievedAt: new Date().toISOString(), sha256, file };
      if (previous) manifest.rows[manifest.rows.indexOf(previous)] = row; else manifest.rows.push(row);
      bySeason.set(season, row);
      sinceSave += 1;
      if (sinceSave >= 5) { persist(); sinceSave = 0; }
      console.log(JSON.stringify({ season, file, bytes: Buffer.byteLength(body) }));
    }
  } finally {
    if (sinceSave > 0) persist();
  }
  console.log(JSON.stringify({ manifestPath, captured: manifest.rows.filter((row) => row.captured).length }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
