const fs = require("fs");
const path = require("path");
const { mutableDataPath, repoDataPath, readJsonWithFallback, writeJson } = require("./runtimePaths");

const CACHE_PATH = mutableDataPath("club_crests.json");
const SEEDED_CACHE_PATH = repoDataPath("club_crests.json");
const cache = readJsonWithFallback(CACHE_PATH, SEEDED_CACHE_PATH, {});
const normalize = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function loadFixtureCrests() {
  for (const file of ["remaining_fixtures_2025_26_with_odds.csv", "fixtures_2026_27_with_odds.csv"]) {
    const source = path.join(repoDataPath(), file);
    if (!fs.existsSync(source)) continue;
    const rows = fs.readFileSync(source, "utf8").trim().split(/\r?\n/);
    const headers = rows.shift().split(",");
    const index = (name) => headers.indexOf(name);
    for (const row of rows) {
      const cells = row.split(",");
      [["homeTeam", "homeLogoUrl"], ["awayTeam", "awayLogoUrl"]].forEach(([team, logo]) => {
        const name = cells[index(team)], url = cells[index(logo)];
        if (name && /^https:\/\/a\.espncdn\.com\//.test(url || "")) cache[normalize(name)] ||= url;
      });
    }
  }
}
loadFixtureCrests();

async function resolveClubCrest(team) {
  const key = normalize(team);
  if (!key) return "";
  if (cache[key]) return cache[key];
  try {
    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team)}`, { headers: { "User-Agent": "SportsbooksAnalyst/1.0" } });
    const candidates = (await response.json()).teams || [];
    const exact = candidates.find((entry) => normalize(entry.strTeam) === key || normalize(entry.strTeamAlternate) === key);
    const crest = exact?.strTeamBadge || "";
    if (/^https:\/\//.test(crest)) {
      cache[key] = crest;
      writeJson(CACHE_PATH, cache);
      return crest;
    }
  } catch (_) { /* the bundled ESPN crest and SVG fallback remain available */ }
  return "";
}

function fallbackSvg(team) {
  const initials = String(team || "Club").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FC";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#176de6" d="M32 2 59 12 54 50 32 62 10 50 5 12z"/><text x="32" y="39" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700" fill="white">${initials}</text></svg>`;
}

module.exports = { resolveClubCrest, fallbackSvg };
