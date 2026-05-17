const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");

const PLAYER_PROFILE_STATS_PATH = path.join(process.cwd(), "data", "player_profile_updates.json");
const IMPORTED_PLAYER_STATS_PATH = path.join(process.cwd(), "data", "fbref", "processed", "fbref_player_stats.json");

const PLAYER_PROFILES = [
  {
    id: "erling-haaland",
    player: "Erling Haaland",
    team: "Man City",
    league: "EPL",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/71/Erling_Haaland_June_2025.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Erling_Haaland",
  },
  {
    id: "kylian-mbappe",
    player: "Kylian Mbappe",
    team: "Real Madrid",
    league: "La Liga",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/66/Picture_with_Mbapp%C3%A9_%28cropped_and_rotated%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Kylian_Mbapp%C3%A9",
  },
  {
    id: "vinicius-junior",
    player: "Vinicius Junior",
    team: "Real Madrid",
    league: "La Liga",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Vin%C3%ADcius_J%C3%BAnior",
  },
  {
    id: "lamine-yamal",
    player: "Lamine Yamal",
    team: "Barcelona",
    league: "La Liga",
    role: "Attacker",
    position: "MF,FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Lamine_Yamal_in_2025.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Lamine_Yamal",
  },
  {
    id: "dominik-szoboszlai",
    player: "Dominik Szoboszlai",
    team: "Liverpool",
    league: "EPL",
    role: "Midfielder",
    position: "MF,DF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/52/Dominik_Szoboszlai_04012026_%281%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Dominik_Szoboszlai",
  },
  {
    id: "harry-kane",
    player: "Harry Kane",
    team: "Bayern Munich",
    league: "Bundesliga",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/91/Harry_Kane_on_October_10%2C_2023.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Harry_Kane",
  },
  {
    id: "bukayo-saka",
    player: "Bukayo Saka",
    team: "Arsenal",
    league: "EPL",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cd/1_bukayo_saka_arsenal_2025_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Bukayo_Saka",
  },
  {
    id: "bruno-fernandes",
    player: "Bruno Fernandes",
    team: "Man United",
    league: "EPL",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Bruno_Fernandes_USMNT_v_Portugal_Mar_31_2026-27_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Bruno_Fernandes",
  },
  {
    id: "jude-bellingham",
    player: "Jude Bellingham",
    team: "Real Madrid",
    league: "La Liga",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f9/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jude_Bellingham",
  },
  {
    id: "pedri",
    player: "Pedri",
    team: "Barcelona",
    league: "La Liga",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/13/Pedri.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Pedri",
  },
  {
    id: "jamal-musiala",
    player: "Jamal Musiala",
    team: "Bayern Munich",
    league: "Bundesliga",
    role: "Midfielder",
    position: "MF,FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/be/Jamal_Musiala_2022.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jamal_Musiala",
  },
  {
    id: "cole-palmer",
    player: "Cole Palmer",
    team: "Chelsea",
    league: "EPL",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://res.cloudinary.com/chelsea-production/image/upload/c_fit,h_1800,w_1200/v1/editorial/people/first-team/2025-26/With%20IFS/3333x5000_Avatar_Image_Sponsored_IFSai_Men_Palmer_SF_Home_25_26_RGB",
    photoSourceName: "Chelsea FC official profile",
    photoSourceUrl: "https://www.chelseafc.com/en/teams/profile/cole-palmer",
  },
  {
    id: "david-raya",
    player: "David Raya",
    team: "Arsenal",
    league: "EPL",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/da/David_Raya_in_2025_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/David_Raya",
  },
  {
    id: "gianluigi-donnarumma",
    player: "Gianluigi Donnarumma",
    team: "Man City",
    league: "EPL",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/04/Gianluigi_Donnarumma_ICC_2016.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Gianluigi_Donnarumma",
  },
  {
    id: "jan-oblak",
    player: "Jan Oblak",
    team: "Atletico Madrid",
    league: "La Liga",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Jan_Oblak_2019.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jan_Oblak",
  },
  {
    id: "benjamin-sesko",
    player: "Benjamin Sesko",
    team: "Man United",
    league: "EPL",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/FC_RB_Salzburg_gegen_SK_Austria_Klagenfurt_%282023-05-28%29_38_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Benjamin_%C5%A0e%C5%A1ko",
  },
  {
    id: "senne-lammens",
    player: "Senne Lammens",
    team: "Man United",
    league: "EPL",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/df/Senne_Lammens_USMNT_v_Belgium_Mar_28_2026-98_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Senne_Lammens",
  },
  {
    id: "matheus-cunha",
    player: "Matheus Cunha",
    team: "Man United",
    league: "EPL",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/80/Matheus_Cunha_em_2021.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Matheus_Cunha",
  },
  {
    id: "raphinha",
    player: "Raphinha",
    team: "Barcelona",
    league: "La Liga",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Raphael_Dias_Belloli_2023.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Raphinha",
  },
  {
    id: "fermin-lopez",
    player: "Fermin Lopez",
    team: "Barcelona",
    league: "La Liga",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Ferm%C3%ADn_L%C3%B3pez_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ferm%C3%ADn_L%C3%B3pez",
  },
  {
    id: "michael-olise",
    player: "Michael Olise",
    team: "Bayern Munich",
    league: "Bundesliga",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e2/FC_RB_Salzburg_gegen_FC_Bayern_M%C3%BCnchen_%282026-01-06_Testspiel%29_10.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Michael_Olise",
  },
  {
    id: "ousmane-dembele",
    player: "Ousmane Dembele",
    team: "Paris SG",
    league: "Ligue 1",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Ousmane_Demb%C3%A9l%C3%A9_2018_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ousmane_Demb%C3%A9l%C3%A9",
  },
  {
    id: "desire-doue",
    player: "Desire Doue",
    team: "Paris SG",
    league: "Ligue 1",
    role: "Attacker",
    position: "MF,FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Doue_asse_psg_2425.png",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/D%C3%A9sir%C3%A9_Dou%C3%A9",
  },
  {
    id: "khvicha-kvaratskhelia",
    player: "Khvicha Kvaratskhelia",
    team: "Paris SG",
    league: "Ligue 1",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Kvaratskhelia_asse_psg_2425.png",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Khvicha_Kvaratskhelia",
  },
];

const SUPPLEMENTAL_PROFILE_ROWS = [
  { season: "2025-26", league: "La Liga", Squad: "Barcelona", Player: "Lamine Yamal", Pos: "MF,FW", statType: "standard", MP: 28, Starts: 25, Min: 2218, "90s": 24.6, Gls: 16, Ast: 11, PublicProfileSource: "true" },
  { season: "2025-26", league: "EPL", Squad: "Man United", Player: "Bruno Fernandes", Pos: "MF", statType: "standard", MP: 32, Starts: 32, Min: 2799, "90s": 31.1, Gls: 8, Ast: 19, PublicProfileSource: "true" },
  { season: "2025-26", league: "La Liga", Squad: "Barcelona", Player: "Pedri", Pos: "MF", statType: "standard", MP: 26, Starts: 21, Min: 1901, "90s": 21.1, Gls: 2, Ast: 8, PublicProfileSource: "true" },
  { season: "2025-26", league: "La Liga", Squad: "Barcelona", Player: "Fermin Lopez", Pos: "MF", statType: "standard", MP: 28, Starts: 19, Min: 1662, "90s": 18.5, Gls: 6, Ast: 9, PublicProfileSource: "true" },
  { season: "2025-26", league: "La Liga", Squad: "Barcelona", Player: "Raphinha", Pos: "FW", statType: "standard", MP: 21, Starts: 15, Min: 1326, "90s": 14.7, Gls: 11, Ast: 3, PublicProfileSource: "true" },
  { season: "2025-26", league: "EPL", Squad: "Arsenal", Player: "David Raya", Pos: "GK", statType: "goalkeeping", MP: 36, Starts: 36, Min: 3240, "90s": 36, Saves: 60, PublicProfileSource: "true" },
  { season: "2025-26", league: "EPL", Squad: "Man City", Player: "Gianluigi Donnarumma", Pos: "GK", statType: "goalkeeping", MP: 32, Starts: 32, Min: 2880, "90s": 32, Saves: 74, PublicProfileSource: "true" },
  { season: "2025-26", league: "EPL", Squad: "Man United", Player: "Senne Lammens", Pos: "GK", statType: "goalkeeping", MP: 29, Starts: 29, Min: 2610, "90s": 29, Saves: 71, PublicProfileSource: "true" },
];

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function integer(value) {
  return Math.round(numeric(value));
}

function readStore() {
  if (!fs.existsSync(PLAYER_PROFILE_STATS_PATH)) {
    return { updatedAt: "", entries: [] };
  }
  const data = JSON.parse(fs.readFileSync(PLAYER_PROFILE_STATS_PATH, "utf8").replace(/^\uFEFF/, ""));
  return { updatedAt: data.updatedAt || "", entries: Array.isArray(data.entries) ? data.entries : [] };
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(PLAYER_PROFILE_STATS_PATH), { recursive: true });
  fs.writeFileSync(PLAYER_PROFILE_STATS_PATH, JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2));
}

function profileById(profileId) {
  return PLAYER_PROFILES.find((profile) => profile.id === profileId);
}

function emptyTotals() {
  return { appearances: 0, starts: 0, minutes: 0, shots: 0, shotsOnTarget: 0, goals: 0, assists: 0, saves: 0 };
}

function totalsWithRates(totals) {
  const nineties = totals.minutes ? totals.minutes / 90 : totals.appearances;
  return {
    ...totals,
    nineties,
    goalsPer90: nineties ? totals.goals / nineties : 0,
    assistsPer90: nineties ? totals.assists / nineties : 0,
    shotsPer90: nineties ? totals.shots / nineties : 0,
    shotsOnTargetPer90: nineties ? totals.shotsOnTarget / nineties : 0,
    savesPer90: nineties ? totals.saves / nineties : 0,
  };
}

function combineTotals(...totalsList) {
  const totals = totalsList.reduce((sum, totals) => {
    sum.appearances += numeric(totals?.appearances);
    sum.starts += numeric(totals?.starts);
    sum.minutes += numeric(totals?.minutes);
    sum.shots += integer(totals?.shots);
    sum.shotsOnTarget += integer(totals?.shotsOnTarget);
    sum.goals += integer(totals?.goals);
    sum.assists += integer(totals?.assists);
    sum.saves += integer(totals?.saves);
    return sum;
  }, emptyTotals());
  return totalsWithRates(totals);
}

function totalsForEntries(entries) {
  const totals = entries.reduce(
    (sum, entry) => {
      sum.appearances += 1;
      sum.starts += entry.started ? 1 : 0;
      sum.minutes += numeric(entry.minutes);
      sum.shots += integer(entry.shots);
      sum.shotsOnTarget += integer(entry.shotsOnTarget);
      sum.goals += integer(entry.goals);
      sum.assists += integer(entry.assists);
      sum.saves += integer(entry.saves);
      return sum;
    },
    emptyTotals()
  );
  return totalsWithRates(totals);
}

function entriesForProfile(store, profileId) {
  return store.entries
    .filter((entry) => entry.profileId === profileId)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function readImportedRows() {
  if (!fs.existsSync(IMPORTED_PLAYER_STATS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(IMPORTED_PLAYER_STATS_PATH, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(data.rows) ? data.rows : [];
}

function supplementalProfileRows() {
  return SUPPLEMENTAL_PROFILE_ROWS.map((row) => ({ ...row }));
}

function importedBaselineForProfile(profile) {
  const { aggregatePlayers, normalizePlayerName } = require("./playerStats");
  const profilePlayer = normalizePlayerName(profile.player);
  const profileTeam = normalizeTeamName(profile.team);
  const importedPlayer = aggregatePlayers([...readImportedRows(), ...supplementalProfileRows()]).find(
    (player) =>
      player.season === "2025-26" &&
      player.league === profile.league &&
      player.squad === profileTeam &&
      normalizePlayerName(player.player) === profilePlayer
  );

  if (!importedPlayer) {
    return {
      totals: totalsWithRates(emptyTotals()),
      source: "No imported screenshot baseline yet",
      sourceTypes: [],
      sourceLabels: [],
      hasBaseline: false,
    };
  }

  const totals = totalsWithRates({
    appearances: importedPlayer.appearances,
    starts: importedPlayer.starts,
    minutes: importedPlayer.minutes,
    goals: importedPlayer.goals,
    assists: importedPlayer.assists,
    shots: importedPlayer.shots,
    shotsOnTarget: importedPlayer.shotsOnTarget,
    saves: importedPlayer.saves,
  });
  const sourceTypes = importedPlayer.sourceTypes || [];
  const sourceLabels = importedPlayer.sourceLabels || [];
  return {
    totals,
    source: `${sourceLabels.join("+") || "FBref"} ${sourceTypes.join("+") || "stats"} baseline`,
    sourceTypes,
    sourceLabels,
    hasBaseline: true,
  };
}

function listPlayerProfiles() {
  const store = readStore();
  return {
    updatedAt: store.updatedAt,
    profileCount: PLAYER_PROFILES.length,
    entryCount: store.entries.length,
    profiles: PLAYER_PROFILES.map((profile) => {
      const entries = entriesForProfile(store, profile.id);
      const manualTotals = totalsForEntries(entries);
      const importedBaseline = importedBaselineForProfile(profile);
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

function addPlayerStatEntry(profileId, body = {}) {
  const profile = profileById(profileId);
  if (!profile) return null;
  const store = readStore();
  const entry = {
    id: `player_stat_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    profileId: profile.id,
    player: profile.player,
    team: normalizeTeamName(profile.team),
    league: profile.league,
    role: profile.role,
    season: body.season || "2025-26",
    date: body.date || new Date().toISOString().slice(0, 10),
    opponent: String(body.opponent || "").trim(),
    venue: body.venue || "",
    started: Boolean(body.started),
    minutes: numeric(body.minutes),
    shots: integer(body.shots),
    shotsOnTarget: integer(body.shotsOnTarget),
    goals: integer(body.goals),
    assists: integer(body.assists),
    saves: profile.role === "Goalkeeper" ? integer(body.saves) : 0,
    notes: String(body.notes || "").trim(),
    createdAt: new Date().toISOString(),
  };
  store.entries.push(entry);
  writeStore(store);
  return entry;
}

function manualPlayerRows() {
  const store = readStore();
  const rows = [];
  for (const profile of PLAYER_PROFILES) {
    const entries = entriesForProfile(store, profile.id);
    if (!entries.length) continue;
    const totals = totalsForEntries(entries);
    const base = {
      season: "2025-26",
      league: profile.league,
      Squad: normalizeTeamName(profile.team),
      Player: profile.player,
      Pos: profile.position,
      MP: totals.appearances,
      Starts: totals.starts,
      Min: Math.round(totals.minutes),
      "90s": Number(totals.nineties.toFixed(1)),
      ManualProfileSource: "true",
    };
    rows.push({
      ...base,
      statType: "standard",
      Gls: totals.goals,
      Ast: totals.assists,
      "G+A": totals.goals + totals.assists,
    });
    rows.push({
      ...base,
      statType: "shooting",
      Gls: totals.goals,
      Sh: totals.shots,
      SoT: totals.shotsOnTarget,
    });
    if (profile.role === "Goalkeeper") {
      rows.push({
        ...base,
        statType: "goalkeeping",
        Saves: totals.saves,
      });
    }
  }
  return rows;
}

module.exports = {
  PLAYER_PROFILE_STATS_PATH,
  PLAYER_PROFILES,
  addPlayerStatEntry,
  listPlayerProfiles,
  manualPlayerRows,
  supplementalProfileRows,
};
