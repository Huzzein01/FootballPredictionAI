const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");

const TEAM_PROFILE_STATS_PATH = path.join(process.cwd(), "data", "team_profile_updates.json");

const TEAM_PROFILES = [
  { id: "man-united", team: "Man United", displayName: "Man United", league: "EPL" },
  { id: "man-city", team: "Man City", displayName: "Man City", league: "EPL" },
  { id: "chelsea", team: "Chelsea", displayName: "Chelsea", league: "EPL" },
  { id: "arsenal", team: "Arsenal", displayName: "Arsenal", league: "EPL" },
  { id: "tottenham", team: "Tottenham", displayName: "Tottenham", league: "EPL" },
  { id: "liverpool", team: "Liverpool", displayName: "Liverpool", league: "EPL" },
  { id: "paris-sg", team: "Paris SG", displayName: "PSG", league: "Ligue 1" },
  { id: "atletico-madrid", team: "Ath Madrid", displayName: "Atletico Madrid", league: "La Liga" },
  { id: "real-madrid", team: "Real Madrid", displayName: "Real Madrid", league: "La Liga" },
  { id: "barcelona", team: "Barcelona", displayName: "Barcelona", league: "La Liga" },
  { id: "bayern-munich", team: "Bayern Munich", displayName: "Bayern Munich", league: "Bundesliga" },
];

function defaultStore() {
  return { updatedAt: "", entries: [] };
}

function readStore() {
  if (!fs.existsSync(TEAM_PROFILE_STATS_PATH)) return defaultStore();
  try {
    const data = JSON.parse(fs.readFileSync(TEAM_PROFILE_STATS_PATH, "utf8").replace(/^\uFEFF/, ""));
    return { ...defaultStore(), ...data, entries: Array.isArray(data.entries) ? data.entries : [] };
  } catch {
    return defaultStore();
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(TEAM_PROFILE_STATS_PATH), { recursive: true });
  fs.writeFileSync(TEAM_PROFILE_STATS_PATH, JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2));
}

function profileById(profileId) {
  return TEAM_PROFILES.find((profile) => profile.id === profileId);
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function integer(value) {
  return Math.max(0, Math.round(numeric(value)));
}

function resultPoints(result, goalsFor, goalsAgainst) {
  if (result === "W") return 3;
  if (result === "D") return 1;
  if (result === "L") return 0;
  if (goalsFor > goalsAgainst) return 3;
  if (goalsFor === goalsAgainst) return 1;
  return 0;
}

function normalizeResult(result, goalsFor, goalsAgainst) {
  if (["W", "D", "L"].includes(result)) return result;
  if (goalsFor > goalsAgainst) return "W";
  if (goalsFor === goalsAgainst) return "D";
  return "L";
}

function teamEntryFromBody(profile, body = {}, existing = {}) {
  const goalsFor = integer(body.goalsFor);
  const goalsAgainst = integer(body.goalsAgainst);
  const result = normalizeResult(String(body.result || "").toUpperCase(), goalsFor, goalsAgainst);
  return {
    ...existing,
    id: existing.id || `team_stat_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    profileId: profile.id,
    team: normalizeTeamName(profile.team),
    displayName: profile.displayName,
    league: profile.league,
    season: body.season || "2025-26",
    date: body.date || new Date().toISOString().slice(0, 10),
    opponent: normalizeTeamName(String(body.opponent || "").trim()),
    venue: body.venue || "",
    result,
    goalsFor,
    goalsAgainst,
    expectedGoalsFor: numeric(body.expectedGoalsFor),
    expectedGoalsAgainst: numeric(body.expectedGoalsAgainst),
    shotsFor: integer(body.shotsFor),
    shotsAgainst: integer(body.shotsAgainst),
    shotsOnTargetFor: integer(body.shotsOnTargetFor),
    shotsOnTargetAgainst: integer(body.shotsOnTargetAgainst),
    sga: numeric(body.sga),
    cornersFor: integer(body.cornersFor),
    cornersAgainst: integer(body.cornersAgainst),
    setPieceGoalsFor: integer(body.setPieceGoalsFor),
    setPieceGoalsAgainst: integer(body.setPieceGoalsAgainst),
    cleanSheet: Boolean(body.cleanSheet),
    possession: numeric(body.possession),
    restDays: numeric(body.restDays),
    absences: String(body.absences || "").trim(),
    motivation: String(body.motivation || "").trim(),
    notes: String(body.notes || "").trim(),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: existing.id ? new Date().toISOString() : existing.updatedAt,
  };
}

function entriesForProfile(store, profileId, season = "") {
  return store.entries
    .filter((entry) => entry.profileId === profileId && (!season || entry.season === season))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function emptyTotals() {
  return {
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    expectedGoalsFor: 0,
    expectedGoalsAgainst: 0,
    shotsFor: 0,
    shotsAgainst: 0,
    shotsOnTargetFor: 0,
    shotsOnTargetAgainst: 0,
    cornersFor: 0,
    cornersAgainst: 0,
    setPieceGoalsFor: 0,
    setPieceGoalsAgainst: 0,
    cleanSheets: 0,
    points: 0,
  };
}

function totalsForEntries(entries) {
  const totals = entries.reduce((acc, entry) => {
    acc.matches += 1;
    acc.wins += entry.result === "W" ? 1 : 0;
    acc.draws += entry.result === "D" ? 1 : 0;
    acc.losses += entry.result === "L" ? 1 : 0;
    acc.goalsFor += numeric(entry.goalsFor);
    acc.goalsAgainst += numeric(entry.goalsAgainst);
    acc.expectedGoalsFor += numeric(entry.expectedGoalsFor);
    acc.expectedGoalsAgainst += numeric(entry.expectedGoalsAgainst);
    acc.shotsFor += numeric(entry.shotsFor);
    acc.shotsAgainst += numeric(entry.shotsAgainst);
    acc.shotsOnTargetFor += numeric(entry.shotsOnTargetFor);
    acc.shotsOnTargetAgainst += numeric(entry.shotsOnTargetAgainst);
    acc.cornersFor += numeric(entry.cornersFor);
    acc.cornersAgainst += numeric(entry.cornersAgainst);
    acc.setPieceGoalsFor += numeric(entry.setPieceGoalsFor);
    acc.setPieceGoalsAgainst += numeric(entry.setPieceGoalsAgainst);
    acc.cleanSheets += entry.cleanSheet ? 1 : numeric(entry.goalsAgainst) === 0 ? 1 : 0;
    acc.points += resultPoints(entry.result, numeric(entry.goalsFor), numeric(entry.goalsAgainst));
    return acc;
  }, emptyTotals());
  const matches = totals.matches || 1;
  return {
    ...totals,
    pointsPerGame: totals.points / matches,
    goalsForPerGame: totals.goalsFor / matches,
    goalsAgainstPerGame: totals.goalsAgainst / matches,
    xgForPerGame: totals.expectedGoalsFor / matches,
    xgAgainstPerGame: totals.expectedGoalsAgainst / matches,
    shotsForPerGame: totals.shotsFor / matches,
    shotsAgainstPerGame: totals.shotsAgainst / matches,
    sotForPerGame: totals.shotsOnTargetFor / matches,
    sotAgainstPerGame: totals.shotsOnTargetAgainst / matches,
    shotOnTargetRatio: totals.shotsFor ? totals.shotsOnTargetFor / totals.shotsFor : 0,
    cornersForPerGame: totals.cornersFor / matches,
    cornersAgainstPerGame: totals.cornersAgainst / matches,
    cleanSheetRate: totals.cleanSheets / matches,
  };
}

function listTeamProfiles(season = "") {
  const store = readStore();
  return {
    updatedAt: store.updatedAt,
    season,
    profileCount: TEAM_PROFILES.length,
    entryCount: store.entries.length,
    profiles: TEAM_PROFILES.map((profile) => {
      const entries = entriesForProfile(store, profile.id, season);
      return {
        ...profile,
        team: normalizeTeamName(profile.team),
        totals: totalsForEntries(entries),
        latestEntries: entries.slice(0, 5),
      };
    }),
  };
}

function addTeamStatEntry(profileId, body = {}) {
  const profile = profileById(profileId);
  if (!profile) return null;
  const store = readStore();
  const entry = teamEntryFromBody(profile, body);
  store.entries.push(entry);
  writeStore(store);
  return entry;
}

function updateTeamStatEntry(profileId, entryId, body = {}) {
  const profile = profileById(profileId);
  if (!profile) return null;
  const store = readStore();
  const index = store.entries.findIndex((entry) => entry.id === entryId && entry.profileId === profile.id);
  if (index === -1) return null;
  const updated = teamEntryFromBody(profile, body, store.entries[index]);
  store.entries[index] = updated;
  writeStore(store);
  return updated;
}

function manualTeamStatEntries(league, season = "2025-26") {
  const store = readStore();
  return store.entries
    .filter((entry) => entry.league === league && entry.season === season)
    .map((entry) => ({
      ...entry,
      team: normalizeTeamName(entry.team),
      opponent: normalizeTeamName(entry.opponent),
    }));
}

module.exports = {
  TEAM_PROFILE_STATS_PATH,
  TEAM_PROFILES,
  addTeamStatEntry,
  listTeamProfiles,
  manualTeamStatEntries,
  updateTeamStatEntry,
};
