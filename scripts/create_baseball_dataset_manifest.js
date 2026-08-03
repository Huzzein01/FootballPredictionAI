"use strict";

const fs = require("fs");
const path = require("path");
const { createDatasetManifest } = require("../src/baseballModel/datasetManifest");

function main() {
  const input = process.argv[2];
  const output = process.argv[3] || path.join("data", "baseball", "mlb_pregame_manifest.json");
  if (!input) throw new Error("Usage: node scripts/create_baseball_dataset_manifest.js <dataset.json> [output.json]");
  const manifest = createDatasetManifest(JSON.parse(fs.readFileSync(input, "utf8")), { sourceVersions: { builder: "historicalDataset-v1" } });
  if (!manifest.qa.valid) throw new Error("Refusing to create a manifest for a dataset that fails QA");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ output, rowCount: manifest.rowCount, datasetSha256: manifest.datasetSha256, qa: manifest.qa }, null, 2));
}

if (require.main === module) { try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; } }
