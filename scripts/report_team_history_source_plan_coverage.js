"use strict";

// Read-only audit. Generic provider home pages never count as verified club resources.
const fs = require("fs");
const path = require("path");
const { historyDir, readHistory } = require("../src/footballHistory/store");
const { CONTRACT, REQUIRED_PROVIDERS, validateRegistry, verifiedSourcesForTeam, isRequiredProvider } = require("../src/footballHistory/sourceRegistry");

const registryPath = process.argv.find((arg) => arg.startsWith("--registry="))?.slice("--registry=".length) || path.join("data", "teams", "history", "source-registry.json");
let registry = { contract: CONTRACT, sources: [] };
let registryStatus = "not-created";
if (fs.existsSync(registryPath)) {
  registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registryStatus = validateRegistry(registry).length ? "invalid" : "valid";
}
const registryErrors = registryStatus === "invalid" ? validateRegistry(registry) : [];
const records = fs.readdirSync(historyDir()).filter((name) => name.endsWith(".json") && !name.startsWith("_")).map((name) => readHistory(path.basename(name, ".json"))).filter((record) => record?.contract === "football-team-history-v1");
const teams = records.map((record) => {
  const verified = verifiedSourcesForTeam(registry, record.team.slug);
  const required = new Set(verified.filter((source) => isRequiredProvider(source.provider)).map((source) => String(source.provider).toLowerCase()));
  const genericPlanUrls = (record.sourcePlan || []).filter((source) => source.url).length;
  return { name: record.team.name, slug: record.team.slug, genericPlanUrls, verifiedUrls: verified.length, verifiedRequiredProviders: required.size, missingRequiredProviders: REQUIRED_PROVIDERS.filter((provider) => !required.has(provider.toLowerCase())) };
});
const output = {
  contract: "football-team-history-source-plan-coverage-v1",
  generatedAt: new Date().toISOString(),
  registry: { path: registryPath, status: registryStatus, errors: registryErrors },
  totals: {
    teams: teams.length,
    teamsWithFiveNamedProviders: records.filter((record) => (record.sourcePlan || []).length >= 5).length,
    teamsWithFiveGenericPlanUrls: teams.filter((team) => team.genericPlanUrls >= 5).length,
    teamsWithFiveVerifiedUrls: teams.filter((team) => team.verifiedUrls >= 5).length,
    teamsWithAllFiveRequiredProvidersVerified: teams.filter((team) => team.verifiedRequiredProviders === REQUIRED_PROVIDERS.length).length,
  },
  nextReview: teams.filter((team) => team.verifiedRequiredProviders < REQUIRED_PROVIDERS.length).slice(0, 100),
};
console.log(JSON.stringify(output, null, 2));
