"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { writeFileRetrying } = require("../src/runtimePaths");

const url = "https://www.rsssf.org/tablesi/italcuphistfull.html";
async function main() {
  const response = await fetch(url, { headers: { "user-agent": "SportsbooksAnalyst historical-data collector" } });
  if (!response.ok) throw new Error(`RSSSF request failed: ${response.status}`);
  const body = await response.text();
  const sha256 = crypto.createHash("sha256").update(body).digest("hex");
  const file = path.join("data", "teams", "history", "raw", "rsssf", `${sha256}.html`);
  writeFileRetrying(file, body);
  const manifestPath = path.join("data", "teams", "history", "raw", "rsssf-coppa-italia-manifest.json");
  writeFileRetrying(manifestPath, JSON.stringify({ contract: "football-history-raw-manifest-v1", provider: "RSSSF", generatedAt: new Date().toISOString(), scope: "Coppa Italia historical archive through the main archive page", rows: [{ url, captured: true, retrievedAt: new Date().toISOString(), sha256, file }] }, null, 2) + "\n");
  console.log(JSON.stringify({ manifestPath, file, sha256, bytes: Buffer.byteLength(body) }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
