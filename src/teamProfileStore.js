const fs = require("fs");
const path = require("path");
const { loadMatches, normalizeTeamName } = require("./footballData");

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
  { id: "inter-milan", team: "Inter Milan", displayName: "Inter Milan", league: "Serie A" },
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

function totalsWithRates(totals = emptyTotals()) {
  const matches = totals.matches || 1;
  return {
    ...emptyTotals(),
    ...totals,
    pointsPerGame: numeric(totals.points) / matches,
    goalsForPerGame: numeric(totals.goalsFor) / matches,
    goalsAgainstPerGame: numeric(totals.goalsAgainst) / matches,
    xgForPerGame: numeric(totals.expectedGoalsFor) / matches,
    xgAgainstPerGame: numeric(totals.expectedGoalsAgainst) / matches,
    shotsForPerGame: numeric(totals.shotsFor) / matches,
    shotsAgainstPerGame: numeric(totals.shotsAgainst) / matches,
    sotForPerGame: numeric(totals.shotsOnTargetFor) / matches,
    sotAgainstPerGame: numeric(totals.shotsOnTargetAgainst) / matches,
    shotOnTargetRatio: numeric(totals.shotsFor) ? numeric(totals.shotsOnTargetFor) / numeric(totals.shotsFor) : 0,
    cornersForPerGame: numeric(totals.cornersFor) / matches,
    cornersAgainstPerGame: numeric(totals.cornersAgainst) / matches,
    cleanSheetRate: numeric(totals.cleanSheets) / matches,
  };
}

function combineTotals(base = emptyTotals(), manual = emptyTotals()) {
  return totalsWithRates({
    matches: numeric(base.matches) + numeric(manual.matches),
    wins: numeric(base.wins) + numeric(manual.wins),
    draws: numeric(base.draws) + numeric(manual.draws),
    losses: numeric(base.losses) + numeric(manual.losses),
    goalsFor: numeric(base.goalsFor) + numeric(manual.goalsFor),
    goalsAgainst: numeric(base.goalsAgainst) + numeric(manual.goalsAgainst),
    expectedGoalsFor: numeric(base.expectedGoalsFor) + numeric(manual.expectedGoalsFor),
    expectedGoalsAgainst: numeric(base.expectedGoalsAgainst) + numeric(manual.expectedGoalsAgainst),
    shotsFor: numeric(base.shotsFor) + numeric(manual.shotsFor),
    shotsAgainst: numeric(base.shotsAgainst) + numeric(manual.shotsAgainst),
    shotsOnTargetFor: numeric(base.shotsOnTargetFor) + numeric(manual.shotsOnTargetFor),
    shotsOnTargetAgainst: numeric(base.shotsOnTargetAgainst) + numeric(manual.shotsOnTargetAgainst),
    cornersFor: numeric(base.cornersFor) + numeric(manual.cornersFor),
    cornersAgainst: numeric(base.cornersAgainst) + numeric(manual.cornersAgainst),
    setPieceGoalsFor: numeric(base.setPieceGoalsFor) + numeric(manual.setPieceGoalsFor),
    setPieceGoalsAgainst: numeric(base.setPieceGoalsAgainst) + numeric(manual.setPieceGoalsAgainst),
    cleanSheets: numeric(base.cleanSheets) + numeric(manual.cleanSheets),
    points: numeric(base.points) + numeric(manual.points),
  });
}

function isCompletedMatch(row) {
  return row?.FTR && row.FTHG !== "" && row.FTAG !== "";
}

function applyMatchBaseline(totals, row, profileTeam) {
  const isHome = normalizeTeamName(row.HomeTeam) === profileTeam;
  const isAway = normalizeTeamName(row.AwayTeam) === profileTeam;
  if (!isHome && !isAway) return;
  const goalsFor = integer(isHome ? row.FTHG : row.FTAG);
  const goalsAgainst = integer(isHome ? row.FTAG : row.FTHG);
  const result = normalizeResult("", goalsFor, goalsAgainst);
  totals.matches += 1;
  totals.wins += result === "W" ? 1 : 0;
  totals.draws += result === "D" ? 1 : 0;
  totals.losses += result === "L" ? 1 : 0;
  totals.goalsFor += goalsFor;
  totals.goalsAgainst += goalsAgainst;
  totals.shotsFor += integer(isHome ? row.HS : row.AS);
  totals.shotsAgainst += integer(isHome ? row.AS : row.HS);
  totals.shotsOnTargetFor += integer(isHome ? row.HST : row.AST);
  totals.shotsOnTargetAgainst += integer(isHome ? row.AST : row.HST);
  totals.cornersFor += integer(isHome ? row.HC : row.AC);
  totals.cornersAgainst += integer(isHome ? row.AC : row.HC);
  totals.cleanSheets += goalsAgainst === 0 ? 1 : 0;
  totals.points += resultPoints(result, goalsFor, goalsAgainst);
}

function csvBaselineForProfile(profile, season) {
  const profileTeam = normalizeTeamName(profile.team);
  const totals = emptyTotals();
  for (const row of loadMatches()) {
    if (row.Season !== season || row.League !== profile.league || !isCompletedMatch(row)) continue;
    applyMatchBaseline(totals, row, profileTeam);
  }
  return totalsWithRates(totals);
}

function tableBaselineForProfile(profile, tableData) {
  const league = tableData?.leagues?.[profile.league];
  const row = (league?.standings || []).find((entry) => normalizeTeamName(entry.team) === normalizeTeamName(profile.team));
  if (!row) return totalsWithRates(emptyTotals());
  return totalsWithRates({
    matches: numeric(row.played),
    wins: numeric(row.wins),
    draws: numeric(row.draws),
    losses: numeric(row.losses),
    goalsFor: numeric(row.goalsFor),
    goalsAgainst: numeric(row.goalsAgainst),
    points: numeric(row.points),
  });
}

function scaleVolume(value, fromMatches, toMatches) {
  if (!fromMatches || !toMatches || toMatches <= fromMatches) return numeric(value);
  return Math.round((numeric(value) / fromMatches) * toMatches);
}

function mergeCsvVolumeWithTable(csvTotals, tableTotals) {
  const fromMatches = numeric(csvTotals.matches);
  const toMatches = numeric(tableTotals.matches);
  return totalsWithRates({
    ...tableTotals,
    expectedGoalsFor: scaleVolume(csvTotals.expectedGoalsFor, fromMatches, toMatches),
    expectedGoalsAgainst: scaleVolume(csvTotals.expectedGoalsAgainst, fromMatches, toMatches),
    shotsFor: scaleVolume(csvTotals.shotsFor, fromMatches, toMatches),
    shotsAgainst: scaleVolume(csvTotals.shotsAgainst, fromMatches, toMatches),
    shotsOnTargetFor: scaleVolume(csvTotals.shotsOnTargetFor, fromMatches, toMatches),
    shotsOnTargetAgainst: scaleVolume(csvTotals.shotsOnTargetAgainst, fromMatches, toMatches),
    cornersFor: scaleVolume(csvTotals.cornersFor, fromMatches, toMatches),
    cornersAgainst: scaleVolume(csvTotals.cornersAgainst, fromMatches, toMatches),
    cleanSheets: scaleVolume(csvTotals.cleanSheets, fromMatches, toMatches),
  });
}

function importedBaselineForProfile(profile, season, tableData = null) {
  const csvTotals = csvBaselineForProfile(profile, season);
  const tableTotals = tableBaselineForProfile(profile, tableData);
  if (csvTotals.matches && tableTotals.matches > csvTotals.matches) {
    return {
      totals: mergeCsvVolumeWithTable(csvTotals, tableTotals),
      source: `${tableData?.leagues?.[profile.league]?.source || "Public league table"} + Football-data match CSV baseline`,
      detail: "Standings totals use the fresher public table. Shots, SOT, corners, and clean sheets are rate-adjusted from imported match rows when the public table is ahead.",
      hasBaseline: true,
    };
  }
  if (csvTotals.matches) {
    return {
      totals: csvTotals,
      source: "Football-data match CSV baseline",
      detail: "Includes played matches, goals, shots, shots on target, corners, points, and clean sheets from imported match rows.",
      hasBaseline: true,
    };
  }
  if (tableTotals.matches) {
    return {
      totals: tableTotals,
      source: tableData?.leagues?.[profile.league]?.source || "Public league table baseline",
      detail: "Includes public standings totals. Shots, SOT, corners, xG, and set pieces need match CSV or manual entries.",
      hasBaseline: true,
    };
  }
  return {
    totals: totalsWithRates(emptyTotals()),
    source: "No imported baseline for this season yet",
    detail: "Import match data or add manual team-profile entries for this season.",
    hasBaseline: false,
  };
}

function listTeamProfiles(season = "", tableData = null) {
  const store = readStore();
  const profileSeason = season || "2025-26";
  return {
    updatedAt: store.updatedAt,
    season: profileSeason,
    profileCount: TEAM_PROFILES.length,
    entryCount: store.entries.length,
    profiles: TEAM_PROFILES.map((profile) => {
      const entries = entriesForProfile(store, profile.id, profileSeason);
      const manualTotals = totalsForEntries(entries);
      const importedBaseline = importedBaselineForProfile(profile, profileSeason, tableData);
      return {
        ...profile,
        team: normalizeTeamName(profile.team),
        totals: combineTotals(importedBaseline.totals, manualTotals),
        importedBaseline,
        manualTotals,
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
