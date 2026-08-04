"use strict";

// Imports reviewed source URLs only. This script does not scrape or infer identities.
const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { CONTRACT, validateRegistry } = require("../src/footballHistory/sourceRegistry");

const input = process.argv.find((arg) => arg.startsWith("--input="))?.slice("--input=".length);
const output = process.argv.find((arg) => arg.startsWith("--output="))?.slice("--output=".length) || path.join("data", "teams", "history", "source-registry.json");
if (!input) throw new Error("Usage: node scripts/import_team_history_source_registry.js --input=reviewed-sources.json [--output=...]");
const candidate = JSON.parse(fs.readFileSync(input, "utf8"));
const registry = { contract: CONTRACT, sources: candidate.sources || candidate };
const knownSlugs = new Set(fs.readdirSync(historyDir()).filter((name) => name.endsWith(".json") && !name.startsWith("_")).map((name) => readHistory(path.basename(name, ".json"))?.team?.slug).filter(Boolean));
const errors = [...validateRegistry(registry), ...registry.sources.filter((source) => !knownSlugs.has(source.teamSlug)).map((source) => `unknown teamSlug: ${source.teamSlug}`)];
if (errors.length) throw new Error(`Source registry rejected:\n${errors.join("\n")}`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify({ ...registry, importedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(JSON.stringify({ output, sources: registry.sources.length, teams: new Set(registry.sources.map((source) => source.teamSlug)).size }, null, 2));
