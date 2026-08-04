"use strict";
// Public English professional league archive (1888–2024). This source supplies
// final tables; its match file has no fixture date and is therefore never used as
// a pregame training row without date-level corroboration.
const fs = require("fs"); const path = require("path"); const crypto = require("crypto");
const url = "https://raw.githubusercontent.com/jfjelstul/englishfootball/master/data-csv/standings.csv";
async function main() { const response = await fetch(url, { headers: { "user-agent": "SportsbooksAnalyst historical-data collector" } }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const body = await response.text(); const sha256 = crypto.createHash("sha256").update(body).digest("hex"); const file = path.join("data", "teams", "history", "raw", "englishfootball", `${sha256}.csv`); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); const manifest = { contract: "football-history-raw-manifest-v1", provider: "jfjelstul/englishfootball", retrievedAt: new Date().toISOString(), url, sha256, file, scope: "English professional final league tables; date-free match data excluded from pregame rows" }; const manifestPath = path.join("data", "teams", "history", "raw", "englishfootball-standings-manifest.json"); fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n"); console.log(JSON.stringify({ manifestPath, file, bytes: body.length }, null, 2)); }
main().catch((error) => { console.error(error); process.exitCode = 1; });
