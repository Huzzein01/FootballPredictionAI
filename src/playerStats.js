const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");

const PLAYER_STATS_JSON_PATH = path.join(process.cwd(), "data", "fbref", "processed", "fbref_player_stats.json");

const PLAYER_FEATURE_NAMES = [
  "homePlayerGoalsTotal",
  "awayPlayerGoalsTotal",
  "homeTopScorerGoals",
  "awayTopScorerGoals",
  "homeGoalsPerPlayerMatch",
  "awayGoalsPerPlayerMatch",
  "homePlayerAssistsTotal",
  "awayPlayerAssistsTotal",
  "homePlayerShotsTotal",
  "awayPlayerShotsTotal",
  "homePlayerShotsOnTargetTotal",
  "awayPlayerShotsOnTargetTotal",
  "homeAssistsPerPlayerMatch",
  "awayAssistsPerPlayerMatch",
  "homeShotsPerPlayerMatch",
  "awayShotsPerPlayerMatch",
  "homeShotsOnTargetPerPlayerMatch",
  "awayShotsOnTargetPerPlayerMatch",
  "playerGoalsTotalDiff",
  "topScorerGoalsDiff",
  "goalsPerPlayerMatchDiff",
  "playerAssistsTotalDiff",
  "playerShotsTotalDiff",
  "playerShotsOnTargetTotalDiff",
  "assistsPerPlayerMatchDiff",
  "shotsPerPlayerMatchDiff",
  "shotsOnTargetPerPlayerMatchDiff",
];

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function firstValue(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return "";
}

function loadPlayerRows() {
  if (!fs.existsSync(PLAYER_STATS_JSON_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(PLAYER_STATS_JSON_PATH, "utf8"));
  return Array.isArray(data.rows) ? data.rows : [];
}

function playerSourceLabel(row) {
  return String(row.ThunderbitSource).toLowerCase() === "true" ? "Thunderbit/FBref" : "FBref";
}

function normalizePlayerName(name) {
  const text = String(name || "").trim().replace(/\s+/g, " ");
  const key = text.toLowerCase();
  const aliases = {
    "lsrvanmbeumo": "Bryan Mbeumo",
    "svan mbeumo -milcmr": "Bryan Mbeumo",
    "lbeniaminsesko": "Benjamin Sesko",
    "benjamin å eå¡ko": "Benjamin Sesko",
    "evling haaland": "Erling Haaland",
    "leciing haaland": "Erling Haaland",
    "eciing haaland": "Erling Haaland",
    "omarmarmoush": "Omar Marmoush",
    "ravan cherki": "Rayan Cherki",
    "kvlian mbapoé": "Kylian Mbappe",
    "kylian mbappã©": "Kylian Mbappe",
    "vinicius jénior": "Vinicius Junior",
    "wis diaz": "Luis Diaz",
    "terry kane": "Harry Kane",
    "sersegnabry": "Serge Gnabry",
    "jodo pedro": "Joao Pedro",
    "ccole balmer": "Cole Palmer",
    "bruno femandes": "Bruno Fernandes",
    "enzo fernéndez": "Enzo Fernandez",
    "sradley barcola": "Bradley Barcola",
    "alexander sorioth": "Alexander Sorloth",
    "ulién awarez": "Julian Alvarez",
    "julién awarez": "Julian Alvarez",
    "hugo ekitike": "Hugo Ekitike",
    "désiré dous": "Desire Doue",
    "viktor gvokeres": "Viktor Gyokeres",
    "viktor gyékeres": "Viktor Gyokeres",
    "arda guler": "Arda Guler",
    "dani olme": "Dani Olmo",
    "jamaddiallo": "Amad Diallo",
    "ude bellingham": "Jude Bellingham",
    "eder militéo": "Eder Militao",
    "eder militã©o": "Eder Militao",
    "tent alexander-arnold": "Trent Alexander-Arnold",
    "andeiy- lunin": "Andriy Lunin",
    "federico chiess": "Federico Chiesa",
    "iam delap": "Liam Delap",
    "serge-gnabry": "Serge Gnabry",
    "gabrieljesus": "Gabriel Jesus",
    "nicolés gonzélez": "Nicolas Gonzalez",
    "nicolã©s gonzã©lez": "Nicolas Gonzalez",
    "nicolás gonzález": "Nicolas Gonzalez",
    "jantoine griezmann": "Antoine Griezmann",
    "jantoine semenyo": "Antoine Semenyo",
    "vinicius jã©nior": "Vinicius Junior",
    "vinicius jãƒâ©nior": "Vinicius Junior",
    "enzo fernã©ndez": "Enzo Fernandez",
    "enzo fernãƒâ©ndez": "Enzo Fernandez",
    "viktor gyã©keres": "Viktor Gyokeres",
    "viktor gyãƒâ©keres": "Viktor Gyokeres",
    "raphã©l guerreiro": "Raphael Guerreiro",
    "raphaã©l guerreiro": "Raphael Guerreiro",
    "raphaãƒâ©l guerreiro": "Raphael Guerreiro",
    "ousmane dembã©lã©": "Ousmane Dembele",
    "ousmane dembãƒâ©lãƒâ©": "Ousmane Dembele",
    "jousmane dembã©lã©": "Ousmane Dembele",
    "jousmane dembãƒâ©lãƒâ©": "Ousmane Dembele",
    "dã©sirã© dous": "Desire Doue",
    "dãƒâ©sirãƒâ© dous": "Desire Doue",
    "luentin nã©jantou": "Quentin Ndjantou",
    "luentin nãƒâ©jantou": "Quentin Ndjantou",
    "juliã©n awarez": "Julian Alvarez",
    "uliã©n awarez": "Julian Alvarez",
    "josã© maria gimã©nez": "Jose Maria Gimenez",
    "josãƒâ© maria gimãƒâ©nez": "Jose Maria Gimenez",
    "ciã©mentlenglet": "Clement Lenglet",
    "clã©ment lenclet": "Clement Lenglet",
    "moisã©s caicedo": "Moises Caicedo",
    "estã©vlo willan": "Estevao Willian",
    "ibrahima konatã©": "Ibrahima Konate",
    "brahima konatã©": "Ibrahima Konate",
    "jurrien timber": "Jurrien Timber",
    "jurriã©n timber": "Jurrien Timber",
    "piero hincapiã©": "Piero Hincapie",
    "pierohincepiã©": "Piero Hincapie",
    "ules koundã©": "Jules Kounde",
    "ferrã©n torres": "Ferran Torres",
    "jaurã©lien tchouamã©ni": "Aurelien Tchouameni",
    "aurelien tchouameni": "Aurelien Tchouameni",
    "kvlian mbapoã©": "Kylian Mbappe",
    "marc guã©hi": "Marc Guehi",
    "mare guã©hi": "Marc Guehi",
    "nathan akã©": "Nathan Ake",
    "robert sã©nchez": "Robert Sanchez",
    "romã©o lavia": "Romeo Lavia",
    "nomã©e lava": "Romeo Lavia",
    "lestevã©owilian": "Estevao Willian",
    "radu drã©gusin": "Radu Dragusin",
    "ldosip stanisiã©": "Josip Stanisic",
    "tosipstanisiã©": "Josip Stanisic",
    "fabiã©n ruiz pefia": "Fabian Ruiz Pena",
    "dro ferã©ndez": "Dro Fernandez",
    "rodrvao": "Rodrygo",
    "mare cucurella": "Marc Cucurella",
    "mare guiu": "Marc Guiu",
    "soko gvardiol": "Josko Gvardiol",
    "ademols lookmsn": "Ademola Lookman",
    "dominik szoboszisi": "Dominik Szoboszlai",
    "gabriel martineli": "Gabriel Martinelli",
    "gebrieljesus": "Gabriel Jesus",
    "ibrahim mbave": "Ibrahim Mbaye",
    "joshua zirkee": "Joshua Zirkzee",
    "konrad tsimer": "Konrad Laimer",
    "mohamed saish": "Mohamed Salah",
    "rio naumoha": "Rio Ngumoha",
    "roony bardahii": "Roony Bardghji",
    "jroony bardahii": "Roony Bardghji",
    "tiiani rejinders": "Tijjani Reijnders",
    "wicolas jackson": "Nicolas Jackson",
    "xavisimons": "Xavi Simons",
    "alexander isak": "Alexander Isak",
    "amie cittens": "Jamie Gittens",
    "avier bofiar": "Javier Bonar",
    "kai havertz": "Kai Havertz",
    "loathys tel": "Mathys Tel",
    "tichaet otise": "Michael Olise",
    "tom bischof": "Tom Bischof",
    "tomalmusiala": "Jamal Musiala",
    "vitinha": "Vitinha",
    "wilson odebert": "Wilson Odobert",
    "savio": "Savio",
  };
  return aliases[key] || text.replace(/^[lJ](?=[A-ZÀ-Þ])/u, "");
}

function playerKey(row) {
  return [row.season, row.league, normalizeTeamName(row.Squad), normalizePlayerName(row.Player)].join("||");
}

function aggregatePlayers(rows = loadPlayerRows()) {
  const grouped = new Map();
  const standardSquads = new Set(
    rows
      .filter((row) => row.statType === "standard")
      .map((row) => [row.season, row.league, normalizeTeamName(row.Squad)].join("||"))
  );

  for (const row of rows) {
    if (!row.Player || !row.Squad) continue;
    const key = playerKey(row);
    if (!grouped.has(key)) {
      grouped.set(key, {
        season: row.season,
        league: row.league,
        squad: normalizeTeamName(row.Squad),
        player: normalizePlayerName(row.Player),
        position: firstValue(row, ["Pos"]),
        age: firstValue(row, ["Age"]),
        nineties: 0,
        goals: 0,
        assists: 0,
        shots: 0,
        shotsOnTarget: 0,
        hasAssistStats: false,
        hasShotStats: false,
        hasPreciseNineties: false,
        sourceTypes: new Set(),
        sourceLabels: new Set(),
      });
    }

    const player = grouped.get(key);
    player.sourceTypes.add(row.statType);
    player.sourceLabels.add(playerSourceLabel(row));

    if (row.statType === "standard") {
      const assistValue = firstValue(row, ["Ast", "Assists"]);
      const ninetiesValue = num(firstValue(row, ["90s", "MP"]));
      const hasPreciseNineties = firstValue(row, ["Min"]) !== "" || String(row.ScreenshotSource).toLowerCase() === "true";
      if (hasPreciseNineties) {
        player.nineties = player.hasPreciseNineties ? Math.max(player.nineties, ninetiesValue) : ninetiesValue;
        player.hasPreciseNineties = true;
      } else if (!player.hasPreciseNineties) {
        player.nineties = Math.max(player.nineties, ninetiesValue);
      }
      player.goals = Math.max(player.goals, num(firstValue(row, ["Gls", "Goals"])));
      player.assists = Math.max(player.assists, num(assistValue));
      player.hasAssistStats = player.hasAssistStats || assistValue !== "";
      player.position = player.position || firstValue(row, ["Pos"]);
      player.age = player.age || firstValue(row, ["Age"]);
    }

    if (row.statType === "shooting") {
      const squadKey = [row.season, row.league, normalizeTeamName(row.Squad)].join("||");
      const ninetiesValue = num(firstValue(row, ["90s", "MP"]));
      if (String(row.ScreenshotSource).toLowerCase() === "true") {
        player.nineties = player.hasPreciseNineties ? Math.max(player.nineties, ninetiesValue) : ninetiesValue;
        player.hasPreciseNineties = true;
      } else if (!player.hasPreciseNineties) {
        player.nineties = Math.max(player.nineties, ninetiesValue);
      }
      if (!standardSquads.has(squadKey)) {
        player.goals = Math.max(player.goals, num(firstValue(row, ["Gls", "Goals"])));
      }
      player.shots = Math.max(player.shots, num(firstValue(row, ["Sh", "Standard_Sh"])));
      player.shotsOnTarget = Math.max(player.shotsOnTarget, num(firstValue(row, ["SoT", "Standard_SoT"])));
      player.hasShotStats = true;
    }
  }

  return [...grouped.values()]
    .map((player) => ({
      ...player,
      sourceTypes: [...player.sourceTypes].filter(Boolean).sort(),
      sourceLabels: [...player.sourceLabels].filter(Boolean).sort(),
      goalsPer90: player.nineties ? player.goals / player.nineties : 0,
      assistsPer90: player.nineties ? player.assists / player.nineties : 0,
      shotsPer90: player.nineties ? player.shots / player.nineties : 0,
      shotsOnTargetPer90: player.nineties ? player.shotsOnTarget / player.nineties : 0,
      goalAssistPer90: player.nineties ? (player.goals + player.assists) / player.nineties : 0,
    }))
    .filter((player) => player.nineties >= 3);
}

function emptyTeamPlayerFeatures() {
  return {
    playerGoalsTotal: 0,
    topScorerGoals: 0,
    goalsPerPlayerMatch: 0,
    playerAssistsTotal: 0,
    playerShotsTotal: 0,
    playerShotsOnTargetTotal: 0,
    assistsPerPlayerMatch: 0,
    shotsPerPlayerMatch: 0,
    shotsOnTargetPerPlayerMatch: 0,
    playerCount: 0,
    playerMatchTotal: 0,
  };
}

function buildTeamFeatureIndex(rows = loadPlayerRows()) {
  const index = new Map();
  for (const player of aggregatePlayers(rows)) {
    const key = [player.season, player.league, player.squad].join("||");
    if (!index.has(key)) index.set(key, emptyTeamPlayerFeatures());
    const team = index.get(key);
    team.playerGoalsTotal += player.goals;
    team.playerAssistsTotal += player.assists;
    team.playerShotsTotal += player.shots;
    team.playerShotsOnTargetTotal += player.shotsOnTarget;
    team.topScorerGoals = Math.max(team.topScorerGoals, player.goals);
    team.playerMatchTotal += player.nineties;
    team.playerCount += 1;
  }

  for (const team of index.values()) {
    team.goalsPerPlayerMatch = team.playerMatchTotal ? team.playerGoalsTotal / team.playerMatchTotal : 0;
    team.assistsPerPlayerMatch = team.playerMatchTotal ? team.playerAssistsTotal / team.playerMatchTotal : 0;
    team.shotsPerPlayerMatch = team.playerMatchTotal ? team.playerShotsTotal / team.playerMatchTotal : 0;
    team.shotsOnTargetPerPlayerMatch = team.playerMatchTotal ? team.playerShotsOnTargetTotal / team.playerMatchTotal : 0;
  }

  return index;
}

let teamFeatureIndexCache = null;

function teamFeatureIndex() {
  if (!teamFeatureIndexCache) teamFeatureIndexCache = buildTeamFeatureIndex();
  return teamFeatureIndexCache;
}

function teamPlayerFeatures(league, season, team) {
  const key = [season, league, normalizeTeamName(team)].join("||");
  return teamFeatureIndex().get(key) || emptyTeamPlayerFeatures();
}

function matchPlayerFeatureRow(league, season, homeTeam, awayTeam) {
  const home = teamPlayerFeatures(league, season, homeTeam);
  const away = teamPlayerFeatures(league, season, awayTeam);
  return [
    home.playerGoalsTotal,
    away.playerGoalsTotal,
    home.topScorerGoals,
    away.topScorerGoals,
    home.goalsPerPlayerMatch,
    away.goalsPerPlayerMatch,
    home.playerAssistsTotal,
    away.playerAssistsTotal,
    home.playerShotsTotal,
    away.playerShotsTotal,
    home.playerShotsOnTargetTotal,
    away.playerShotsOnTargetTotal,
    home.assistsPerPlayerMatch,
    away.assistsPerPlayerMatch,
    home.shotsPerPlayerMatch,
    away.shotsPerPlayerMatch,
    home.shotsOnTargetPerPlayerMatch,
    away.shotsOnTargetPerPlayerMatch,
    home.playerGoalsTotal - away.playerGoalsTotal,
    home.topScorerGoals - away.topScorerGoals,
    home.goalsPerPlayerMatch - away.goalsPerPlayerMatch,
    home.playerAssistsTotal - away.playerAssistsTotal,
    home.playerShotsTotal - away.playerShotsTotal,
    home.playerShotsOnTargetTotal - away.playerShotsOnTargetTotal,
    home.assistsPerPlayerMatch - away.assistsPerPlayerMatch,
    home.shotsPerPlayerMatch - away.shotsPerPlayerMatch,
    home.shotsOnTargetPerPlayerMatch - away.shotsOnTargetPerPlayerMatch,
  ];
}

module.exports = {
  PLAYER_FEATURE_NAMES,
  PLAYER_STATS_JSON_PATH,
  aggregatePlayers,
  buildTeamFeatureIndex,
  loadPlayerRows,
  matchPlayerFeatureRow,
  teamPlayerFeatures,
};
