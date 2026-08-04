"use strict";

const { URL } = require("url");

const CONTRACT = "football-team-history-source-registry-v1";
const REQUIRED_PROVIDERS = [
  "Official club archive",
  "Official domestic competition / association",
  "UEFA",
  "RSSSF",
  "worldfootball.net",
];

function normalizedProvider(provider) {
  return String(provider || "").trim().toLowerCase();
}

function validHttpsUrl(value) {
  try { return new URL(String(value)).protocol === "https:"; } catch { return false; }
}

function validateRegistry(registry) {
  const errors = [];
  if (!registry || registry.contract !== CONTRACT) errors.push(`contract must be ${CONTRACT}`);
  if (!Array.isArray(registry?.sources)) errors.push("sources must be an array");
  const seen = new Set();
  for (const [index, source] of (registry?.sources || []).entries()) {
    const label = `sources[${index}]`;
    if (!source?.teamSlug) errors.push(`${label}.teamSlug is required`);
    if (!source?.provider) errors.push(`${label}.provider is required`);
    if (!validHttpsUrl(source?.url)) errors.push(`${label}.url must be an https URL`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(source?.verifiedAt || ""))) errors.push(`${label}.verifiedAt must be YYYY-MM-DD`);
    if (!source?.evidence) errors.push(`${label}.evidence is required`);
    const key = `${source?.teamSlug}|${normalizedProvider(source?.provider)}`;
    if (seen.has(key)) errors.push(`${label} duplicates ${key}`);
    seen.add(key);
  }
  return errors;
}

function verifiedSourcesForTeam(registry, teamSlug) {
  return (registry?.sources || []).filter((source) => source.teamSlug === teamSlug && validHttpsUrl(source.url));
}

function isRequiredProvider(provider) {
  return REQUIRED_PROVIDERS.map(normalizedProvider).includes(normalizedProvider(provider));
}

module.exports = { CONTRACT, REQUIRED_PROVIDERS, validHttpsUrl, validateRegistry, verifiedSourcesForTeam, isRequiredProvider };
