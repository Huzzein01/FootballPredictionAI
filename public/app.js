const resultLabels = { H: "Home win", D: "Draw", A: "Away win" };
const shortLabels = { H: "Home", D: "Draw", A: "Away" };

const form = document.querySelector("#predictForm");
const output = document.querySelector("#predictionOutput");
const ledgerBody = document.querySelector("#ledgerBody");
const fixtureLedgerSyncStatus = document.querySelector("#fixtureLedgerSyncStatus");
const syncEspnResultsButton = document.querySelector("#syncEspnResultsButton");
const teamList = document.querySelector("#teamList");
const appContextToggle = document.querySelector("#appContextToggle");
const leagueSelect = document.querySelector("#leagueSelect");
const singleCompetitionSelect = document.querySelector("#singleCompetitionSelect");
const themeSelect = document.querySelector("#themeSelect");
const seasonSelect = document.querySelector("#seasonSelect");
const fixtureBoard = document.querySelector("#fixtureBoard");
const boardMessage = document.querySelector("#boardMessage");
const boardStatus = document.querySelector("#boardStatus");
const boardLeagueFilter = document.querySelector("#boardLeagueFilter");
const boardDateFilter = document.querySelector("#boardDateFilter");
const clearBoardDateButton = document.querySelector("#clearBoardDateButton");
const boardSortSelect = document.querySelector("#boardSortSelect");
const trackAllButton = document.querySelector("#trackAllButton");
const playedBoard = document.querySelector("#playedBoard");
const playedStatus = document.querySelector("#playedStatus");
const playedLeagueFilter = document.querySelector("#playedLeagueFilter");
const playedDateFilter = document.querySelector("#playedDateFilter");
const clearPlayedDateButton = document.querySelector("#clearPlayedDateButton");
const refreshPlayedButton = document.querySelector("#refreshPlayedButton");
const parlayStatus = document.querySelector("#parlayStatus");
const parlayLeagueFilter = document.querySelector("#parlayLeagueFilter");
const parlayDateFilter = document.querySelector("#parlayDateFilter");
const clearParlayDateButton = document.querySelector("#clearParlayDateButton");
const parlayLegCount = document.querySelector("#parlayLegCount");
const parlayTicketCount = document.querySelector("#parlayTicketCount");
const parlayTypeSelect = document.querySelector("#parlayTypeSelect");
const parlayRiskToggle = document.querySelector("#parlayRiskToggle");
const parlayLayoutToggle = document.querySelector("#parlayLayoutToggle");
const parlaySortSelect = document.querySelector("#parlaySortSelect");
const refreshParlayButton = document.querySelector("#refreshParlayButton");
const trackParlaysButton = document.querySelector("#trackParlaysButton");
const parlayMessage = document.querySelector("#parlayMessage");
const parlayOutput = document.querySelector("#parlayOutput");
const parlaySlipStatus = document.querySelector("#parlaySlipStatus");
const parlaySlipOutput = document.querySelector("#parlaySlipOutput");
const parlaySlipMessage = document.querySelector("#parlaySlipMessage");
const parlayStakeInput = document.querySelector("#parlayStakeInput");
const clearParlaySlipButton = document.querySelector("#clearParlaySlipButton");
const trackParlaySlipButton = document.querySelector("#trackParlaySlipButton");
const parlayLedgerOutput = document.querySelector("#parlayLedgerOutput");
const parlayLedgerStatus = document.querySelector("#parlayLedgerStatus");
const parlayAccuracyStats = document.querySelector("#parlayAccuracyStats");
const refreshParlayLedgerButton = document.querySelector("#refreshParlayLedgerButton");
const worldCupGroupsStatus = document.querySelector("#worldCupGroupsStatus");
const worldCupGroupsOutput = document.querySelector("#worldCupGroupsOutput");
const internationalFixturesStatus = document.querySelector("#internationalFixturesStatus");
const internationalFixturesOutput = document.querySelector("#internationalFixturesOutput");
const playerProfileStatus = document.querySelector("#playerProfileStatus");
const apiFootballStatus = document.querySelector("#apiFootballStatus");
const checkApiFootballButton = document.querySelector("#checkApiFootballButton");
const refreshPlayerProfilesButton = document.querySelector("#refreshPlayerProfilesButton");
const playerStatForm = document.querySelector("#playerStatForm");
const playerProfileSelect = document.querySelector("#playerProfileSelect");
const playerProfileMessage = document.querySelector("#playerProfileMessage");
const playerProfileGrid = document.querySelector("#playerProfileGrid");
const teamProfileStatus = document.querySelector("#teamProfileStatus");
const refreshTeamProfilesButton = document.querySelector("#refreshTeamProfilesButton");
const teamStatForm = document.querySelector("#teamStatForm");
const teamProfileSelect = document.querySelector("#teamProfileSelect");
const teamProfileMessage = document.querySelector("#teamProfileMessage");
const teamProfileGrid = document.querySelector("#teamProfileGrid");
const pageSelect = document.querySelector("#pageSelect");
const leagueTablesHeading = document.querySelector("#leagueTablesHeading");
const leagueTablesStatus = document.querySelector("#leagueTablesStatus");
const refreshLeagueTablesButton = document.querySelector("#refreshLeagueTablesButton");
const leagueTableLeagueFilter = document.querySelector("#leagueTableLeagueFilter");
const leagueTablesOutput = document.querySelector("#leagueTablesOutput");
const futuresStatus = document.querySelector("#futuresStatus");
const futuresLeagueFilter = document.querySelector("#futuresLeagueFilter");
const futuresMarketFilter = document.querySelector("#futuresMarketFilter");
const refreshFuturesButton = document.querySelector("#refreshFuturesButton");
const futuresOutput = document.querySelector("#futuresOutput");
const pageTabs = [...document.querySelectorAll("[data-page-target]")];
const pageSections = [...document.querySelectorAll("[data-page]")];
const authGate = document.querySelector("#authGate");
const authForm = document.querySelector("#authForm");
const authSignInTab = document.querySelector("#authSignInTab");
const authSignUpTab = document.querySelector("#authSignUpTab");
const authNameField = document.querySelector("#authNameField");
const authDisplayName = document.querySelector("#authDisplayName");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authSubmitButton = document.querySelector("#authSubmitButton");
const authMessage = document.querySelector("#authMessage");
const authAccount = document.querySelector("#authAccount");
const authUserEmail = document.querySelector("#authUserEmail");
const signOutButton = document.querySelector("#signOutButton");

let meta = null;
let fixturePredictions = [];
let playedPredictions = [];
let playedPredictionsSeason = "";
let currentParlays = [];
let selectedParlaySlip = { name: "Custom Parlay Slip", sourceParlayId: "", legs: [], context: "club", riskMode: "safe" };
let trackedParlayData = { parlays: [], summary: {} };
let ledgerPredictions = [];
let playerProfileData = { profiles: [], profileCount: 0, entryCount: 0 };
let teamProfileData = { profiles: [], profileCount: 0, entryCount: 0 };
let internationalStatusData = null;
let internationalFixtureData = null;
let internationalGroupTableData = null;
let leagueTableData = null;
let futuresData = null;
let parlayRefreshSeed = 0;
let editingPlayerStatEntry = null;
let editingTeamStatEntry = null;
let trainingFixtureSourcesPromise = null;
let authMode = "signin";
let authConfig = { enabled: false, hostedMode: false, hideModelStats: false, requireSignIn: false, url: "", anonKey: "" };
let authSession = null;
let appDataLoaded = false;

const CENTRAL_TIME_ZONE = "America/Chicago";
const AUTH_SESSION_STORAGE_KEY = "footballPredictionSupabaseSession";
const INTERNATIONAL_ONLY_PAGES = new Set(["world-cup-groups", "international-fixtures"]);
const HOSTED_PRIVATE_PAGES = new Set(["player-profiles", "team-profiles", "parlay-ledger", "played", "fixture-ledger"]);
const PARLAY_SLIP_STORAGE_KEY = "football-selected-parlay-slip";
const CLUB_SEASONS = [
  { value: "2025-26", label: "2025-26" },
  { value: "2026-27", label: "2026-27" },
  { value: "2024-25", label: "2024-25" },
  { value: "2023-24", label: "2023-24" },
  { value: "2022-23", label: "2022-23" },
  { value: "2021-22", label: "2021-22" },
  { value: "2020-21", label: "2020-21" },
];
const INTERNATIONAL_SEASONS = [
  { value: "2026 World Cup", label: "2026 World Cup" },
  { value: "2022 World Cup", label: "2022 World Cup" },
  { value: "2018 World Cup", label: "2018 World Cup" },
];

const TEAM_DISPLAY_NAMES = {
  "Ath Bilbao": "Athletic Club",
  "Ath Madrid": "Atletico Madrid",
  "FC Koln": "FC Koln",
  "Inter Milan": "Inter Milan",
  "Man City": "Man City",
  "Man United": "Man United",
  "Nott'm Forest": "Nottingham Forest",
  "Oviedo": "Real Oviedo",
  "Paris SG": "Paris SG",
  "Real Sociedad": "Real Sociedad",
  "Sociedad": "Real Sociedad",
  "Metz": "Metz",
  "Mets": "Metz",
  "Juventus": "Juventus",
  "Napoli": "Napoli",
  "AC Milan": "AC Milan",
  "AS Roma": "AS Roma",
  "Atalanta": "Atalanta",
  "Atalanta BC": "Atalanta",
  "Bologna": "Bologna",
  "Cagliari": "Cagliari",
  "Como": "Como",
  "Cremonese": "Cremonese",
  "Fiorentina": "Fiorentina",
  "Genoa": "Genoa",
  "Hellas Verona": "Hellas Verona",
  "Lazio": "Lazio",
  "Lecce": "Lecce",
  "Parma": "Parma",
  "Pisa": "Pisa",
  "Sassuolo": "Sassuolo",
  "Torino": "Torino",
  "Udinese": "Udinese",
  "Ajaccio": "AC Ajaccio",
  "Almeria": "Almeria",
  "Angers": "Angers",
  "Augsburg": "FC Augsburg",
  "Auxerre": "AJ Auxerre",
  "Bielefeld": "Arminia Bielefeld",
  "Bochum": "VfL Bochum",
  "Bordeaux": "Bordeaux",
  "Brest": "Brest",
  "Cadiz": "Cadiz",
  "Celta": "Celta Vigo",
  "Clermont": "Clermont Foot",
  "Dijon": "Dijon FCO",
  "Dortmund": "Borussia Dortmund",
  "Eibar": "Eibar",
  "Ein Frankfurt": "Eintracht Frankfurt",
  "Elche": "Elche",
  "Espanol": "Espanyol",
  "Freiburg": "SC Freiburg",
  "Getafe": "Getafe",
  "Greuther Furth": "Greuther Furth",
  "Hamburg": "Hamburg SV",
  "Hertha": "Hertha Berlin",
  "Hoffenheim": "TSG Hoffenheim",
  "Holstein Kiel": "Holstein Kiel",
  "Huesca": "Huesca",
  "Ipswich": "Ipswich Town",
  "Las Palmas": "Las Palmas",
  "Le Havre": "Le Havre AC",
  "Leeds": "Leeds United",
  "Leganes": "Leganes",
  "Leicester": "Leicester City",
  "Levante": "Levante",
  "Leverkusen": "Bayer Leverkusen",
  "Lille": "Lille",
  "Lorient": "Lorient",
  "Lyon": "Lyon",
  "M'gladbach": "Borussia Monchengladbach",
  "Borussia Mönchengladbach": "Borussia Monchengladbach",
  "Mainz": "Mainz",
  "Marseille": "Marseille",
  "Monaco": "AS Monaco",
  "Nantes": "Nantes",
  "Nice": "Nice",
  "Nimes": "Nimes",
  "Norwich": "Norwich City",
  "RB Leipzig": "RB Leipzig",
  "Reims": "Stade de Reims",
  "Rennes": "Stade Rennais",
  "Schalke 04": "Schalke 04",
  "Southampton": "Southampton",
  "St Etienne": "Saint-Etienne",
  "St Pauli": "St. Pauli",
  "Strasbourg": "Strasbourg",
  "Stuttgart": "VfB Stuttgart",
  "Toulouse": "Toulouse",
  "Troyes": "Troyes",
  "Valladolid": "Real Valladolid",
  "Vallecano": "Rayo Vallecano",
  "Watford": "Watford",
  "Werder Bremen": "Werder Bremen",
  "West Brom": "West Brom",
  "Wolfsburg": "VfL Wolfsburg",
  "Alaves": "Alaves",
  "Alavés": "Alaves",
  "AlavÃ©s": "Alaves",
  "Darmstadt": "Darmstadt",
  "Everton": "Everton",
  "Fulham": "Fulham",
  "Granada": "Granada",
  "Heidenheim": "Heidenheim",
  "Luton": "Luton Town",
  "Mallorca": "Mallorca",
  "Montpellier": "Montpellier",
  "Newcastle": "Newcastle United",
  "Newcastle United": "Newcastle United",
  "Osasuna": "Osasuna",
  "Sheffield United": "Sheffield United",
  "Tottenham": "Tottenham",
  "Union Berlin": "Union Berlin",
  "USA": "United States",
  "West Ham": "West Ham United",
  "West Ham United": "West Ham United",
  "Wolverhampton Wanderers": "Wolves",
  "Wolves": "Wolves",
  "Bosnia and Herzegovina": "Bosnia-Herzegovina",
  "Congo DR": "DR Congo",
  "Cote d'Ivoire": "Ivory Coast",
  "Curaçao": "Curacao",
  "CuraÃ§ao": "Curacao",
  "CuraÃƒÂ§ao": "Curacao",
  "Côte d'Ivoire": "Ivory Coast",
  "CÃ´te d'Ivoire": "Ivory Coast",
  "CÃƒÂ´te d'Ivoire": "Ivory Coast",
  "Türkiye": "Turkiye",
  "TÃ¼rkiye": "Turkiye",
  "TÃƒÂ¼rkiye": "Turkiye",
};

const TEAM_LOGOS = {
  "Alaves": "https://a.espncdn.com/i/teamlogos/soccer/500/96.png",
  "Arsenal": "https://a.espncdn.com/i/teamlogos/soccer/500/359.png",
  "Aston Villa": "https://a.espncdn.com/i/teamlogos/soccer/500/362.png",
  "Ath Bilbao": "https://a.espncdn.com/i/teamlogos/soccer/500/93.png",
  "Athletic Club": "https://a.espncdn.com/i/teamlogos/soccer/500/93.png",
  "Ath Madrid": "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png",
  "Atletico Madrid": "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png",
  "Barcelona": "https://a.espncdn.com/i/teamlogos/soccer/500/83.png",
  "Bayern Munich": "https://a.espncdn.com/i/teamlogos/soccer/500/132.png",
  "Betis": "https://a.espncdn.com/i/teamlogos/soccer/500/244.png",
  "Bournemouth": "https://a.espncdn.com/i/teamlogos/soccer/500/349.png",
  "Brentford": "https://a.espncdn.com/i/teamlogos/soccer/500/337.png",
  "Brighton": "https://a.espncdn.com/i/teamlogos/soccer/500/331.png",
  "Burnley": "https://a.espncdn.com/i/teamlogos/soccer/500/379.png",
  "Chelsea": "https://a.espncdn.com/i/teamlogos/soccer/500/363.png",
  "Crystal Palace": "https://a.espncdn.com/i/teamlogos/soccer/500/384.png",
  "FC Koln": "https://a.espncdn.com/i/teamlogos/soccer/500/122.png",
  "Girona": "https://a.espncdn.com/i/teamlogos/soccer/500/9812.png",
  "Inter Milan": "https://a.espncdn.com/i/teamlogos/soccer/500/110.png",
  "Internazionale": "https://a.espncdn.com/i/teamlogos/soccer/500/110.png",
  "Lens": "https://a.espncdn.com/i/teamlogos/soccer/500/175.png",
  "Liverpool": "https://a.espncdn.com/i/teamlogos/soccer/500/364.png",
  "Man City": "https://a.espncdn.com/i/teamlogos/soccer/500/382.png",
  "Man United": "https://a.espncdn.com/i/teamlogos/soccer/500/360.png",
  "Manchester City": "https://a.espncdn.com/i/teamlogos/soccer/500/382.png",
  "Manchester United": "https://a.espncdn.com/i/teamlogos/soccer/500/360.png",
  "Nott'm Forest": "https://a.espncdn.com/i/teamlogos/soccer/500/393.png",
  "Nottingham Forest": "https://a.espncdn.com/i/teamlogos/soccer/500/393.png",
  "Oviedo": "https://a.espncdn.com/i/teamlogos/soccer/500/92.png",
  "Paris FC": "https://a.espncdn.com/i/teamlogos/soccer/500/6851.png",
  "Paris SG": "https://a.espncdn.com/i/teamlogos/soccer/500/160.png",
  "Paris Saint-Germain": "https://a.espncdn.com/i/teamlogos/soccer/500/160.png",
  "Real Madrid": "https://a.espncdn.com/i/teamlogos/soccer/500/86.png",
  "Real Oviedo": "https://a.espncdn.com/i/teamlogos/soccer/500/92.png",
  "Real Sociedad": "https://a.espncdn.com/i/teamlogos/soccer/500/89.png",
  "Sociedad": "https://a.espncdn.com/i/teamlogos/soccer/500/89.png",
  "Cadiz": "https://a.espncdn.com/i/teamlogos/soccer/500/3842.png",
  "Alavés": "https://a.espncdn.com/i/teamlogos/soccer/500/96.png",
  "AlavÃ©s": "https://a.espncdn.com/i/teamlogos/soccer/500/96.png",
  "Darmstadt": "https://a.espncdn.com/i/teamlogos/soccer/500/3812.png",
  "SV Darmstadt 98": "https://a.espncdn.com/i/teamlogos/soccer/500/3812.png",
  "Everton": "https://a.espncdn.com/i/teamlogos/soccer/500/368.png",
  "Fulham": "https://a.espncdn.com/i/teamlogos/soccer/500/370.png",
  "Granada": "https://a.espncdn.com/i/teamlogos/soccer/500/3747.png",
  "Heidenheim": "https://a.espncdn.com/i/teamlogos/soccer/500/6418.png",
  "1. FC Heidenheim": "https://a.espncdn.com/i/teamlogos/soccer/500/6418.png",
  "1. FC Heidenheim 1846": "https://a.espncdn.com/i/teamlogos/soccer/500/6418.png",
  "Luton": "https://a.espncdn.com/i/teamlogos/soccer/500/301.png",
  "Luton Town": "https://a.espncdn.com/i/teamlogos/soccer/500/301.png",
  "Mallorca": "https://a.espncdn.com/i/teamlogos/soccer/500/84.png",
  "Montpellier": "https://a.espncdn.com/i/teamlogos/soccer/500/274.png",
  "Newcastle": "https://a.espncdn.com/i/teamlogos/soccer/500/361.png",
  "Newcastle United": "https://a.espncdn.com/i/teamlogos/soccer/500/361.png",
  "Osasuna": "https://a.espncdn.com/i/teamlogos/soccer/500/97.png",
  "Sevilla": "https://a.espncdn.com/i/teamlogos/soccer/500/243.png",
  "Sheffield United": "https://a.espncdn.com/i/teamlogos/soccer/500/398.png",
  "Sunderland": "https://a.espncdn.com/i/teamlogos/soccer/500/366.png",
  "Tottenham": "https://a.espncdn.com/i/teamlogos/soccer/500/367.png",
  "Tottenham Hotspur": "https://a.espncdn.com/i/teamlogos/soccer/500/367.png",
  "Union Berlin": "https://a.espncdn.com/i/teamlogos/soccer/500/598.png",
  "1. FC Union Berlin": "https://a.espncdn.com/i/teamlogos/soccer/500/598.png",
  "Valencia": "https://a.espncdn.com/i/teamlogos/soccer/500/94.png",
  "Villarreal": "https://a.espncdn.com/i/teamlogos/soccer/500/102.png",
  "West Ham": "https://a.espncdn.com/i/teamlogos/soccer/500/371.png",
  "West Ham United": "https://a.espncdn.com/i/teamlogos/soccer/500/371.png",
  "Wolverhampton Wanderers": "https://a.espncdn.com/i/teamlogos/soccer/500/380.png",
  "Wolves": "https://a.espncdn.com/i/teamlogos/soccer/500/380.png",
  "Metz": "https://a.espncdn.com/i/teamlogos/soccer/500/177.png",
  "Mets": "https://a.espncdn.com/i/teamlogos/soccer/500/177.png",
  "Juventus": "https://a.espncdn.com/i/teamlogos/soccer/500/111.png",
  "Napoli": "https://a.espncdn.com/i/teamlogos/soccer/500/114.png",
  "AC Milan": "https://a.espncdn.com/i/teamlogos/soccer/500/103.png",
  "AS Roma": "https://a.espncdn.com/i/teamlogos/soccer/500/104.png",
  "Atalanta": "https://a.espncdn.com/i/teamlogos/soccer/500/105.png",
  "Atalanta BC": "https://a.espncdn.com/i/teamlogos/soccer/500/105.png",
  "Bologna": "https://a.espncdn.com/i/teamlogos/soccer/500/107.png",
  "Cagliari": "https://a.espncdn.com/i/teamlogos/soccer/500/2925.png",
  "Como": "https://a.espncdn.com/i/teamlogos/soccer/500/2572.png",
  "Cremonese": "https://a.espncdn.com/i/teamlogos/soccer/500/4050.png",
  "Fiorentina": "https://a.espncdn.com/i/teamlogos/soccer/500/109.png",
  "Genoa": "https://a.espncdn.com/i/teamlogos/soccer/500/3263.png",
  "Hellas Verona": "https://a.espncdn.com/i/teamlogos/soccer/500/119.png",
  "Lazio": "https://a.espncdn.com/i/teamlogos/soccer/500/112.png",
  "Lecce": "https://a.espncdn.com/i/teamlogos/soccer/500/113.png",
  "Parma": "https://a.espncdn.com/i/teamlogos/soccer/500/115.png",
  "Pisa": "https://a.espncdn.com/i/teamlogos/soccer/500/3956.png",
  "Sassuolo": "https://a.espncdn.com/i/teamlogos/soccer/500/3997.png",
  "Torino": "https://a.espncdn.com/i/teamlogos/soccer/500/239.png",
  "Udinese": "https://a.espncdn.com/i/teamlogos/soccer/500/118.png",
  "Ajaccio": "https://a.espncdn.com/i/teamlogos/soccer/500/2503.png",
  "AC Ajaccio": "https://a.espncdn.com/i/teamlogos/soccer/500/2503.png",
  "Almeria": "https://a.espncdn.com/i/teamlogos/soccer/500/6832.png",
  "Angers": "https://a.espncdn.com/i/teamlogos/soccer/500/7868.png",
  "Augsburg": "https://a.espncdn.com/i/teamlogos/soccer/500/3841.png",
  "FC Augsburg": "https://a.espncdn.com/i/teamlogos/soccer/500/3841.png",
  "Auxerre": "https://a.espncdn.com/i/teamlogos/soccer/500/172.png",
  "AJ Auxerre": "https://a.espncdn.com/i/teamlogos/soccer/500/172.png",
  "Bielefeld": "https://a.espncdn.com/i/teamlogos/soccer/500/2506.png",
  "Arminia Bielefeld": "https://a.espncdn.com/i/teamlogos/soccer/500/2506.png",
  "Bochum": "https://a.espncdn.com/i/teamlogos/soccer/500/121.png",
  "VfL Bochum": "https://a.espncdn.com/i/teamlogos/soccer/500/121.png",
  "Bordeaux": "https://a.espncdn.com/i/teamlogos/soccer/500/159.png",
  "Brest": "https://a.espncdn.com/i/teamlogos/soccer/500/6997.png",
  "Celta": "https://a.espncdn.com/i/teamlogos/soccer/500/85.png",
  "Celta Vigo": "https://a.espncdn.com/i/teamlogos/soccer/500/85.png",
  "Clermont": "https://a.espncdn.com/i/teamlogos/soccer/500/3171.png",
  "Clermont Foot": "https://a.espncdn.com/i/teamlogos/soccer/500/3171.png",
  "Dijon": "https://a.espncdn.com/i/teamlogos/soccer/500/3170.png",
  "Dijon FCO": "https://a.espncdn.com/i/teamlogos/soccer/500/3170.png",
  "Dortmund": "https://a.espncdn.com/i/teamlogos/soccer/500/124.png",
  "Borussia Dortmund": "https://a.espncdn.com/i/teamlogos/soccer/500/124.png",
  "Eibar": "https://a.espncdn.com/i/teamlogos/soccer/500/3752.png",
  "Ein Frankfurt": "https://a.espncdn.com/i/teamlogos/soccer/500/125.png",
  "Eintracht Frankfurt": "https://a.espncdn.com/i/teamlogos/soccer/500/125.png",
  "Elche": "https://a.espncdn.com/i/teamlogos/soccer/500/3751.png",
  "Espanol": "https://a.espncdn.com/i/teamlogos/soccer/500/88.png",
  "Espanyol": "https://a.espncdn.com/i/teamlogos/soccer/500/88.png",
  "Freiburg": "https://a.espncdn.com/i/teamlogos/soccer/500/126.png",
  "SC Freiburg": "https://a.espncdn.com/i/teamlogos/soccer/500/126.png",
  "Getafe": "https://a.espncdn.com/i/teamlogos/soccer/500/2922.png",
  "Greuther Furth": "https://a.espncdn.com/i/teamlogos/soccer/500/3070.png",
  "Hamburg": "https://a.espncdn.com/i/teamlogos/soccer/500/127.png",
  "Hamburg SV": "https://a.espncdn.com/i/teamlogos/soccer/500/127.png",
  "Hertha": "https://a.espncdn.com/i/teamlogos/soccer/500/129.png",
  "Hertha Berlin": "https://a.espncdn.com/i/teamlogos/soccer/500/129.png",
  "Hoffenheim": "https://a.espncdn.com/i/teamlogos/soccer/500/7911.png",
  "TSG Hoffenheim": "https://a.espncdn.com/i/teamlogos/soccer/500/7911.png",
  "Holstein Kiel": "https://a.espncdn.com/i/teamlogos/soccer/500/7884.png",
  "Huesca": "https://a.espncdn.com/i/teamlogos/soccer/500/5413.png",
  "Ipswich": "https://a.espncdn.com/i/teamlogos/soccer/500/373.png",
  "Ipswich Town": "https://a.espncdn.com/i/teamlogos/soccer/500/373.png",
  "Las Palmas": "https://a.espncdn.com/i/teamlogos/soccer/500/98.png",
  "Le Havre": "https://a.espncdn.com/i/teamlogos/soccer/500/3236.png",
  "Le Havre AC": "https://a.espncdn.com/i/teamlogos/soccer/500/3236.png",
  "Leeds": "https://a.espncdn.com/i/teamlogos/soccer/500/357.png",
  "Leeds United": "https://a.espncdn.com/i/teamlogos/soccer/500/357.png",
  "Leganes": "https://a.espncdn.com/i/teamlogos/soccer/500/17534.png",
  "Leicester": "https://a.espncdn.com/i/teamlogos/soccer/500/375.png",
  "Leicester City": "https://a.espncdn.com/i/teamlogos/soccer/500/375.png",
  "Levante": "https://a.espncdn.com/i/teamlogos/soccer/500/1538.png",
  "Leverkusen": "https://a.espncdn.com/i/teamlogos/soccer/500/131.png",
  "Bayer Leverkusen": "https://a.espncdn.com/i/teamlogos/soccer/500/131.png",
  "Lille": "https://a.espncdn.com/i/teamlogos/soccer/500/166.png",
  "Lorient": "https://a.espncdn.com/i/teamlogos/soccer/500/273.png",
  "Lyon": "https://a.espncdn.com/i/teamlogos/soccer/500/167.png",
  "M'gladbach": "https://a.espncdn.com/i/teamlogos/soccer/500/268.png",
  "Borussia Monchengladbach": "https://a.espncdn.com/i/teamlogos/soccer/500/268.png",
  "Borussia Mönchengladbach": "https://a.espncdn.com/i/teamlogos/soccer/500/268.png",
  "Mainz": "https://a.espncdn.com/i/teamlogos/soccer/500/2950.png",
  "Marseille": "https://a.espncdn.com/i/teamlogos/soccer/500/176.png",
  "Monaco": "https://a.espncdn.com/i/teamlogos/soccer/500/174.png",
  "AS Monaco": "https://a.espncdn.com/i/teamlogos/soccer/500/174.png",
  "Nantes": "https://a.espncdn.com/i/teamlogos/soccer/500/165.png",
  "Nice": "https://a.espncdn.com/i/teamlogos/soccer/500/2502.png",
  "Nimes": "https://a.espncdn.com/i/teamlogos/soccer/500/7730.png",
  "Norwich": "https://a.espncdn.com/i/teamlogos/soccer/500/381.png",
  "Norwich City": "https://a.espncdn.com/i/teamlogos/soccer/500/381.png",
  "RB Leipzig": "https://a.espncdn.com/i/teamlogos/soccer/500/11420.png",
  "Reims": "https://a.espncdn.com/i/teamlogos/soccer/500/3243.png",
  "Stade de Reims": "https://a.espncdn.com/i/teamlogos/soccer/500/3243.png",
  "Rennes": "https://a.espncdn.com/i/teamlogos/soccer/500/169.png",
  "Stade Rennais": "https://a.espncdn.com/i/teamlogos/soccer/500/169.png",
  "Schalke 04": "https://a.espncdn.com/i/teamlogos/soccer/500/133.png",
  "Southampton": "https://a.espncdn.com/i/teamlogos/soccer/500/376.png",
  "St Etienne": "https://a.espncdn.com/i/teamlogos/soccer/500/178.png",
  "Saint-Etienne": "https://a.espncdn.com/i/teamlogos/soccer/500/178.png",
  "St Pauli": "https://a.espncdn.com/i/teamlogos/soccer/500/270.png",
  "St. Pauli": "https://a.espncdn.com/i/teamlogos/soccer/500/270.png",
  "Strasbourg": "https://a.espncdn.com/i/teamlogos/soccer/500/180.png",
  "Stuttgart": "https://a.espncdn.com/i/teamlogos/soccer/500/134.png",
  "VfB Stuttgart": "https://a.espncdn.com/i/teamlogos/soccer/500/134.png",
  "Toulouse": "https://a.espncdn.com/i/teamlogos/soccer/500/179.png",
  "Troyes": "https://a.espncdn.com/i/teamlogos/soccer/500/170.png",
  "Valladolid": "https://a.espncdn.com/i/teamlogos/soccer/500/95.png",
  "Real Valladolid": "https://a.espncdn.com/i/teamlogos/soccer/500/95.png",
  "Vallecano": "https://a.espncdn.com/i/teamlogos/soccer/500/101.png",
  "Rayo Vallecano": "https://a.espncdn.com/i/teamlogos/soccer/500/101.png",
  "Watford": "https://a.espncdn.com/i/teamlogos/soccer/500/395.png",
  "Werder Bremen": "https://a.espncdn.com/i/teamlogos/soccer/500/137.png",
  "West Brom": "https://a.espncdn.com/i/teamlogos/soccer/500/383.png",
  "Wolfsburg": "https://a.espncdn.com/i/teamlogos/soccer/500/138.png",
  "VfL Wolfsburg": "https://a.espncdn.com/i/teamlogos/soccer/500/138.png",
  "Al-Nassr": "https://a.espncdn.com/i/teamlogos/soccer/500/817.png",
  "Inter Miami": "https://a.espncdn.com/i/teamlogos/soccer/500/20232.png",
  "Argentina": "https://flagcdn.com/w160/ar.png",
  "Belgium": "https://flagcdn.com/w160/be.png",
  "Brazil": "https://flagcdn.com/w160/br.png",
  "England": "https://flagcdn.com/w160/gb-eng.png",
  "France": "https://flagcdn.com/w160/fr.png",
  "Georgia": "https://flagcdn.com/w160/ge.png",
  "Germany": "https://flagcdn.com/w160/de.png",
  "Hungary": "https://flagcdn.com/w160/hu.png",
  "Italy": "https://flagcdn.com/w160/it.png",
  "Morocco": "https://flagcdn.com/w160/ma.png",
  "Nigeria": "https://flagcdn.com/w160/ng.png",
  "Norway": "https://flagcdn.com/w160/no.png",
  "Portugal": "https://flagcdn.com/w160/pt.png",
  "Slovenia": "https://flagcdn.com/w160/si.png",
  "Spain": "https://flagcdn.com/w160/es.png",
  "Sweden": "https://flagcdn.com/w160/se.png",
  "USA": "https://flagcdn.com/w160/us.png",
  "Australia": "https://flagcdn.com/w160/au.png",
  "Paraguay": "https://flagcdn.com/w160/py.png",
  "Mexico": "https://flagcdn.com/w160/mx.png",
  "South Africa": "https://flagcdn.com/w160/za.png",
  "Korea Republic": "https://flagcdn.com/w160/kr.png",
  "Canada": "https://flagcdn.com/w160/ca.png",
  "Qatar": "https://flagcdn.com/w160/qa.png",
  "Switzerland": "https://flagcdn.com/w160/ch.png",
  "Haiti": "https://flagcdn.com/w160/ht.png",
  "Scotland": "https://flagcdn.com/w160/gb-sct.png",
  "Curacao": "https://flagcdn.com/w160/cw.png",
  "Ivory Coast": "https://flagcdn.com/w160/ci.png",
  "Ecuador": "https://flagcdn.com/w160/ec.png",
  "Netherlands": "https://flagcdn.com/w160/nl.png",
  "Japan": "https://flagcdn.com/w160/jp.png",
  "Tunisia": "https://flagcdn.com/w160/tn.png",
  "Egypt": "https://flagcdn.com/w160/eg.png",
  "IR Iran": "https://flagcdn.com/w160/ir.png",
  "New Zealand": "https://flagcdn.com/w160/nz.png",
  "Cabo Verde": "https://flagcdn.com/w160/cv.png",
  "Saudi Arabia": "https://flagcdn.com/w160/sa.png",
  "Uruguay": "https://flagcdn.com/w160/uy.png",
  "Senegal": "https://flagcdn.com/w160/sn.png",
  "Algeria": "https://flagcdn.com/w160/dz.png",
  "Austria": "https://flagcdn.com/w160/at.png",
  "Jordan": "https://flagcdn.com/w160/jo.png",
  "Colombia": "https://flagcdn.com/w160/co.png",
  "Uzbekistan": "https://flagcdn.com/w160/uz.png",
  "Croatia": "https://flagcdn.com/w160/hr.png",
  "Ghana": "https://flagcdn.com/w160/gh.png",
  "Panama": "https://flagcdn.com/w160/pa.png",
  "Denmark": "https://flagcdn.com/w160/dk.png",
  "North Macedonia": "https://flagcdn.com/w160/mk.png",
  "Czechia": "https://flagcdn.com/w160/cz.png",
  "Republic of Ireland": "https://flagcdn.com/w160/ie.png",
  "Wales": "https://flagcdn.com/w160/gb-wls.png",
  "Bosnia-Herzegovina": "https://flagcdn.com/w160/ba.png",
  "Bosnia and Herzegovina": "https://flagcdn.com/w160/ba.png",
  "Northern Ireland": "https://flagcdn.com/w160/gb-nir.png",
  "Slovakia": "https://flagcdn.com/w160/sk.png",
  "Kosovo": "https://flagcdn.com/w160/xk.png",
  "Turkiye": "https://flagcdn.com/w160/tr.png",
  "Türkiye": "https://flagcdn.com/w160/tr.png",
  "TÃ¼rkiye": "https://flagcdn.com/w160/tr.png",
  "TÃƒÂ¼rkiye": "https://flagcdn.com/w160/tr.png",
  "Romania": "https://flagcdn.com/w160/ro.png",
  "Ukraine": "https://flagcdn.com/w160/ua.png",
  "Poland": "https://flagcdn.com/w160/pl.png",
  "Albania": "https://flagcdn.com/w160/al.png",
  "Bolivia": "https://flagcdn.com/w160/bo.png",
  "Suriname": "https://flagcdn.com/w160/sr.png",
  "Iraq": "https://flagcdn.com/w160/iq.png",
  "New Caledonia": "https://flagcdn.com/w160/nc.png",
  "Jamaica": "https://flagcdn.com/w160/jm.png",
  "DR Congo": "https://flagcdn.com/w160/cd.png",
  "Congo DR": "https://flagcdn.com/w160/cd.png",
  "Costa Rica": "https://flagcdn.com/w160/cr.png",
  "Cameroon": "https://flagcdn.com/w160/cm.png",
  "Serbia": "https://flagcdn.com/w160/rs.png",
  "Russia": "https://flagcdn.com/w160/ru.png",
  "Peru": "https://flagcdn.com/w160/pe.png",
  "Iceland": "https://flagcdn.com/w160/is.png",
  "Curaçao": "https://flagcdn.com/w160/cw.png",
  "CuraÃ§ao": "https://flagcdn.com/w160/cw.png",
  "CuraÃƒÂ§ao": "https://flagcdn.com/w160/cw.png",
  "Cote d'Ivoire": "https://flagcdn.com/w160/ci.png",
  "Côte d'Ivoire": "https://flagcdn.com/w160/ci.png",
  "CÃ´te d'Ivoire": "https://flagcdn.com/w160/ci.png",
  "CÃƒÂ´te d'Ivoire": "https://flagcdn.com/w160/ci.png",
};

const TEAM_COLORS = {
  "Arsenal": "#ef0107",
  "Aston Villa": "#95bfe5",
  "Atletico Madrid": "#cb3524",
  "Barcelona": "#a50044",
  "Bayern Munich": "#dc052d",
  "Chelsea": "#034694",
  "Inter Milan": "#0057b8",
  "Liverpool": "#c8102e",
  "Man City": "#6cabdd",
  "Man United": "#da291c",
  "Paris SG": "#004170",
  "Real Madrid": "#febe10",
  "Tottenham": "#132257",
  "Al-Nassr": "#f7c600",
  "Inter Miami": "#f7b5cd",
  "Real Sociedad": "#0067b1",
  "Sheffield United": "#ee2737",
  "Wolves": "#fdb913",
  "Wolverhampton Wanderers": "#fdb913",
  "Metz": "#7a0019",
  "Juventus": "#111111",
  "Napoli": "#12a0d7",
  "AC Milan": "#fb090b",
  "AS Roma": "#8e1f2f",
  "Atalanta": "#1b3f8b",
  "Bologna": "#1f3c88",
  "Cagliari": "#003b79",
  "Como": "#005baa",
  "Cremonese": "#a30c21",
  "Fiorentina": "#4b2e83",
  "Genoa": "#003b79",
  "Hellas Verona": "#ffcc00",
  "Lazio": "#87d8f7",
  "Lecce": "#d71920",
  "Parma": "#003b79",
  "Pisa": "#111111",
  "Sassuolo": "#00a650",
  "Torino": "#7c1620",
  "Udinese": "#111111",
  "Cadiz": "#f4d100",
  "Alaves": "#005baa",
  "Alavés": "#005baa",
  "Darmstadt": "#003b79",
  "Everton": "#003399",
  "Fulham": "#cc0000",
  "Granada": "#d71920",
  "Heidenheim": "#e30613",
  "Luton": "#f78f1e",
  "Luton Town": "#f78f1e",
  "Mallorca": "#e30613",
  "Montpellier": "#f58220",
  "Newcastle United": "#111111",
  "Osasuna": "#d71920",
  "Union Berlin": "#ed1c24",
  "West Ham United": "#7a263a",
  "Borussia Monchengladbach": "#004b93",
  "Borussia Mönchengladbach": "#004b93",
  "Argentina": "#75aadb",
  "Belgium": "#fae042",
  "Brazil": "#009c3b",
  "England": "#cf142b",
  "France": "#0055a4",
  "Georgia": "#ff0000",
  "Germany": "#dd0000",
  "Hungary": "#477050",
  "Italy": "#008c45",
  "Morocco": "#c1272d",
  "Nigeria": "#008751",
  "Norway": "#ba0c2f",
  "Portugal": "#006600",
  "Slovenia": "#005da4",
  "Spain": "#aa151b",
  "Sweden": "#006aa7",
  "USA": "#3c3b6e",
  "Australia": "#00008b",
  "Paraguay": "#d52b1e",
  "Mexico": "#006847",
  "South Africa": "#007a4d",
  "Korea Republic": "#c60c30",
  "Canada": "#d80621",
  "Qatar": "#8a1538",
  "Switzerland": "#ff0000",
  "Haiti": "#00209f",
  "Scotland": "#005eb8",
  "Curacao": "#002b7f",
  "Ivory Coast": "#f77f00",
  "Ecuador": "#ffdd00",
  "Netherlands": "#f36c21",
  "Japan": "#bc002d",
  "Tunisia": "#e70013",
  "Egypt": "#ce1126",
  "IR Iran": "#239f40",
  "New Zealand": "#00247d",
  "Cabo Verde": "#003893",
  "Saudi Arabia": "#006c35",
  "Uruguay": "#0038a8",
  "Senegal": "#00853f",
  "Algeria": "#006233",
  "Austria": "#ed2939",
  "Jordan": "#007a3d",
  "Colombia": "#fcd116",
  "Uzbekistan": "#0099b5",
  "Croatia": "#171796",
  "Ghana": "#006b3f",
  "Panama": "#005293",
  "Costa Rica": "#002b7f",
  "Cameroon": "#007a5e",
  "Serbia": "#c6363c",
  "Russia": "#0039a6",
  "Peru": "#d91023",
  "Iceland": "#02529c",
  "Turkiye": "#e30a17",
  "Türkiye": "#e30a17",
};

const INTERNATIONAL_SUMMARY = { total: 0, pending: 0, pickAccuracy: 0, scoreAccuracy: 0 };

const WORLD_CUP_GROUPS = [
  { group: "A", teams: ["Mexico", "South Africa", "Korea Republic", "UEFA Playoff D"], playoff: "Denmark, North Macedonia, Czechia, Republic of Ireland" },
  { group: "B", teams: ["Canada", "UEFA Playoff A", "Qatar", "Switzerland"], playoff: "Wales, Bosnia-Herzegovina, Italy, Northern Ireland" },
  { group: "C", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
  { group: "D", teams: ["USA", "Paraguay", "Australia", "UEFA Playoff C"], playoff: "Slovakia, Kosovo, Turkiye, Romania" },
  { group: "E", teams: ["Germany", "Curacao", "Ivory Coast", "Ecuador"] },
  { group: "F", teams: ["Netherlands", "Japan", "UEFA Playoff B", "Tunisia"], playoff: "Ukraine, Sweden, Poland, Albania" },
  { group: "G", teams: ["Belgium", "Egypt", "IR Iran", "New Zealand"] },
  { group: "H", teams: ["Spain", "Cabo Verde", "Saudi Arabia", "Uruguay"] },
  { group: "I", teams: ["France", "Senegal", "FIFA Playoff 2", "Norway"], playoff: "Bolivia, Suriname, Iraq" },
  { group: "J", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
  { group: "K", teams: ["Portugal", "FIFA Playoff 1", "Uzbekistan", "Colombia"], playoff: "New Caledonia, Jamaica, DR Congo" },
  { group: "L", teams: ["England", "Croatia", "Ghana", "Panama"] },
];

const WORLD_CUP_GROUPS_SOURCE = {
  name: "U.S. Soccer, 2026 FIFA World Cup Groups",
  url: "https://www.ussoccer.com/stories/2025/12/usmnt-draws-paraguay-australia-uefa-playoff-group-d-2026-fifa-world-cup",
};

const HISTORICAL_WORLD_CUPS = {
  "2022 World Cup": {
    champion: "Argentina",
    groups: [
      { group: "A", teams: ["Netherlands", "Senegal", "Ecuador", "Qatar"], standings: [["Netherlands", 7], ["Senegal", 6], ["Ecuador", 4], ["Qatar", 0]] },
      { group: "B", teams: ["England", "USA", "IR Iran", "Wales"], standings: [["England", 7], ["USA", 5], ["IR Iran", 3], ["Wales", 1]] },
      { group: "C", teams: ["Argentina", "Poland", "Mexico", "Saudi Arabia"], standings: [["Argentina", 6], ["Poland", 4], ["Mexico", 4], ["Saudi Arabia", 3]] },
      { group: "D", teams: ["France", "Australia", "Tunisia", "Denmark"], standings: [["France", 6], ["Australia", 6], ["Tunisia", 4], ["Denmark", 1]] },
      { group: "E", teams: ["Japan", "Spain", "Germany", "Costa Rica"], standings: [["Japan", 6], ["Spain", 4], ["Germany", 4], ["Costa Rica", 3]] },
      { group: "F", teams: ["Morocco", "Croatia", "Belgium", "Canada"], standings: [["Morocco", 7], ["Croatia", 5], ["Belgium", 4], ["Canada", 0]] },
      { group: "G", teams: ["Brazil", "Switzerland", "Cameroon", "Serbia"], standings: [["Brazil", 6], ["Switzerland", 6], ["Cameroon", 4], ["Serbia", 1]] },
      { group: "H", teams: ["Portugal", "Korea Republic", "Uruguay", "Ghana"], standings: [["Portugal", 6], ["Korea Republic", 4], ["Uruguay", 4], ["Ghana", 3]] },
    ],
    knockout: [
      { round: "Final", matches: [["Argentina", "France", "3-3", "Argentina won on penalties"]] },
      { round: "Semi-finals", matches: [["Argentina", "Croatia", "3-0", ""], ["France", "Morocco", "2-0", ""]] },
      { round: "Quarter-finals", matches: [["Croatia", "Brazil", "1-1", "Croatia won on penalties"], ["Argentina", "Netherlands", "2-2", "Argentina won on penalties"], ["Morocco", "Portugal", "1-0", ""], ["France", "England", "2-1", ""]] },
      { round: "Round of 16", matches: [["Netherlands", "USA", "3-1", ""], ["Argentina", "Australia", "2-1", ""], ["France", "Poland", "3-1", ""], ["England", "Senegal", "3-0", ""], ["Japan", "Croatia", "1-1", "Croatia won on penalties"], ["Brazil", "Korea Republic", "4-1", ""], ["Morocco", "Spain", "0-0", "Morocco won on penalties"], ["Portugal", "Switzerland", "6-1", ""]] },
    ],
  },
  "2018 World Cup": {
    champion: "France",
    groups: [
      { group: "A", teams: ["Uruguay", "Russia", "Saudi Arabia", "Egypt"], standings: [["Uruguay", 9], ["Russia", 6], ["Saudi Arabia", 3], ["Egypt", 0]] },
      { group: "B", teams: ["Spain", "Portugal", "IR Iran", "Morocco"], standings: [["Spain", 5], ["Portugal", 5], ["IR Iran", 4], ["Morocco", 1]] },
      { group: "C", teams: ["France", "Denmark", "Peru", "Australia"], standings: [["France", 7], ["Denmark", 5], ["Peru", 3], ["Australia", 1]] },
      { group: "D", teams: ["Croatia", "Argentina", "Nigeria", "Iceland"], standings: [["Croatia", 9], ["Argentina", 4], ["Nigeria", 3], ["Iceland", 1]] },
      { group: "E", teams: ["Brazil", "Switzerland", "Serbia", "Costa Rica"], standings: [["Brazil", 7], ["Switzerland", 5], ["Serbia", 3], ["Costa Rica", 1]] },
      { group: "F", teams: ["Sweden", "Mexico", "Korea Republic", "Germany"], standings: [["Sweden", 6], ["Mexico", 6], ["Korea Republic", 3], ["Germany", 3]] },
      { group: "G", teams: ["Belgium", "England", "Tunisia", "Panama"], standings: [["Belgium", 9], ["England", 6], ["Tunisia", 3], ["Panama", 0]] },
      { group: "H", teams: ["Colombia", "Japan", "Senegal", "Poland"], standings: [["Colombia", 6], ["Japan", 4], ["Senegal", 4], ["Poland", 3]] },
    ],
    knockout: [
      { round: "Final", matches: [["France", "Croatia", "4-2", ""]] },
      { round: "Semi-finals", matches: [["France", "Belgium", "1-0", ""], ["Croatia", "England", "2-1", "after extra time"]] },
      { round: "Quarter-finals", matches: [["France", "Uruguay", "2-0", ""], ["Belgium", "Brazil", "2-1", ""], ["Croatia", "Russia", "2-2", "Croatia won on penalties"], ["England", "Sweden", "2-0", ""]] },
      { round: "Round of 16", matches: [["France", "Argentina", "4-3", ""], ["Uruguay", "Portugal", "2-1", ""], ["Russia", "Spain", "1-1", "Russia won on penalties"], ["Croatia", "Denmark", "1-1", "Croatia won on penalties"], ["Brazil", "Mexico", "2-0", ""], ["Belgium", "Japan", "3-2", ""], ["Sweden", "Switzerland", "1-0", ""], ["England", "Colombia", "1-1", "England won on penalties"]] },
    ],
  },
};

const CLUB_PARLAY_LEAGUES = ["All", "EPL", "La Liga", "Bundesliga", "Ligue 1", "Serie A"];

function centralHour() {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: CENTRAL_TIME_ZONE,
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value);
  } catch {
    return new Date().getHours();
  }
}

function adaptiveTheme() {
  const hour = centralHour();
  return hour >= 6 && hour < 18 ? "light" : "dark";
}

function applyTheme(mode) {
  const selected = ["light", "dark", "adaptive"].includes(mode) ? mode : "adaptive";
  const resolved = selected === "adaptive" ? adaptiveTheme() : selected;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = selected;
  if (themeSelect) themeSelect.value = selected;
  localStorage.setItem("football-theme-mode", selected);
}

function initTheme() {
  applyTheme(localStorage.getItem("football-theme-mode") || "adaptive");
  window.setInterval(() => {
    if ((localStorage.getItem("football-theme-mode") || "adaptive") === "adaptive") applyTheme("adaptive");
  }, 60000);
}

function currentAppContext() {
  return appContextToggle?.checked ? "international" : "club";
}

function isInternationalMode() {
  return currentAppContext() === "international";
}

function currentProfileContext() {
  return currentAppContext();
}

function selectedSeason() {
  return seasonSelect?.value || (isInternationalMode() ? "2026 World Cup" : "2025-26");
}

function isCurrentClubSeason() {
  return !isInternationalMode() && selectedSeason() === "2025-26";
}

function hasCurrentInternationalFixtures() {
  return isInternationalMode() && selectedSeason() === "2026 World Cup";
}

function isHostedPublic() {
  return Boolean(authConfig.hideModelStats);
}

function isHiddenHostedPage(page) {
  return isHostedPublic() && HOSTED_PRIVATE_PAGES.has(page);
}

function seasonUnavailableMessage() {
  return isInternationalMode()
    ? `${selectedSeason()} fixture and group-table data is not imported yet. Keep the historical stats as training context until a verified fixture feed is added.`
    : `${selectedSeason()} fixture data is not available yet. Import the season fixtures and tables when they are released.`;
}

function updateSeasonOptions() {
  if (!seasonSelect) return;
  const key = isInternationalMode() ? "football-international-season" : "football-club-season";
  const options = isInternationalMode() ? INTERNATIONAL_SEASONS : CLUB_SEASONS;
  const saved = localStorage.getItem(key);
  const previous = options.some((option) => option.value === saved) ? saved : options[0].value;
  seasonSelect.innerHTML = options.map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join("");
  seasonSelect.value = previous;
}

function persistSelectedSeason() {
  if (!seasonSelect) return;
  localStorage.setItem(isInternationalMode() ? "football-international-season" : "football-club-season", selectedSeason());
}

function updateContextLabels() {
  const tableLabel = isInternationalMode() ? "Group Stage Tables" : "League Tables";
  if (leagueTablesHeading) leagueTablesHeading.textContent = tableLabel;
  if (leagueTableLeagueFilter) leagueTableLeagueFilter.closest("label").hidden = isInternationalMode();
  if (futuresLeagueFilter) futuresLeagueFilter.closest("label").hidden = isInternationalMode();
  if (futuresMarketFilter) futuresMarketFilter.closest("label").hidden = false;
  if (parlayLeagueFilter) parlayLeagueFilter.closest("label").hidden = isInternationalMode();
  if (playedLeagueFilter) playedLeagueFilter.closest("label").hidden = isInternationalMode();
  if (leagueSelect) {
    const leagueField = leagueSelect.closest("label");
    leagueField.hidden = isInternationalMode();
    leagueField.style.display = isInternationalMode() ? "none" : "";
  }
  if (singleCompetitionSelect) {
    const competitionField = singleCompetitionSelect.closest("label");
    competitionField.hidden = !isInternationalMode();
    competitionField.style.display = isInternationalMode() ? "" : "none";
  }
  pageTabs
    .filter((tab) => tab.dataset.pageTarget === "league-tables")
    .forEach((tab) => {
      tab.textContent = isInternationalMode() ? "Group Tables" : "League Tables";
    });
  if (pageSelect) {
    [...pageSelect.options].forEach((option) => {
      if (option.value === "league-tables") option.textContent = isInternationalMode() ? "Group Tables" : "League Tables";
    });
  }
}

function initContextMode() {
  if (!appContextToggle) return;
  appContextToggle.checked = localStorage.getItem("football-context-mode") === "international";
  updateSeasonOptions();
  updateContextLabels();
}

function activeProfileView(profile) {
  if (currentProfileContext() !== "international") {
    return {
      context: "club",
      team: profile.team,
      league: profile.league,
      totals: profile.totals || {},
      importedBaseline: profile.importedBaseline,
      manualTotals: profile.manualTotals,
      latestEntries: profile.latestEntries || [],
      emptyEntryText: "Imported baseline active",
      emptyEntrySubtext: "Add today's match stats here after kickoff/full time.",
    };
  }
  const international = profile.internationalProfile || {};
  return {
    context: "international",
    team: international.team || "National team not set",
    league: international.league || "International",
    totals: international.totals || {},
    importedBaseline: international.importedBaseline,
    manualTotals: international.manualTotals,
    latestEntries: international.latestEntries || [],
    emptyEntryText: international.importedBaseline?.hasBaseline ? "International baseline active" : "No senior international baseline",
    emptyEntrySubtext: international.importedBaseline?.hasBaseline
      ? "Add World Cup, Euros, qualifier, or friendly match stats here as you collect them."
      : "If this player has no senior caps yet, keep this at zero until match data is available.",
  };
}

function internationalEmptyState(title, detail) {
  return `
    <div class="empty-state international-empty">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function resetInternationalSummary() {
  const fixtureCount = hasCurrentInternationalFixtures() ? internationalStatusData?.fixtureCount || fixturePredictions.length || 0 : 0;
  updateSummary({
    ...INTERNATIONAL_SUMMARY,
    total: fixtureCount,
    pending: fixtureCount,
  });
}

function renderInternationalModelMeta() {
  const rows = internationalStatusData?.playerRows || 0;
  const seasons = internationalStatusData?.seasons?.join(", ") || "World Cup data";
  const fixtures = internationalStatusData?.fixtureCount || 0;
  document.querySelector("#modelMeta").textContent =
    `International mode | ${selectedSeason()} | ${rows} imported player-stat rows from ${seasons} | ${fixtures} World Cup 2026 fixtures loaded | Backtest accuracy 0.0%`;
}

function renderInternationalFixtureBoard() {
  trackAllButton.disabled = !hasCurrentInternationalFixtures() || !fixturePredictions.length;
  if (!hasCurrentInternationalFixtures()) {
    fixturePredictions = [];
    document.querySelector("#boardTotal").textContent = "0";
    document.querySelector("#boardWithOdds").textContent = "0";
    document.querySelector("#boardModelOnly").textContent = "0";
    boardStatus.textContent = `${selectedSeason()} fixtures not available`;
    fixtureBoard.innerHTML = internationalEmptyState("Information not available", seasonUnavailableMessage());
    return;
  }
  if (!fixturePredictions.length) {
    document.querySelector("#boardTotal").textContent = "0";
    document.querySelector("#boardWithOdds").textContent = "0";
    document.querySelector("#boardModelOnly").textContent = "0";
    boardStatus.textContent = "Waiting for international fixture data";
    fixtureBoard.innerHTML = internationalEmptyState(
      "Waiting for more international data",
      "World Cup predictions will appear here after the international fixture feed is imported."
    );
    return;
  }
  renderBoard();
}

function renderInternationalPlayedBoard() {
  const historical = HISTORICAL_WORLD_CUPS[selectedSeason()];
  if (historical) {
    const matchCount = historical.knockout.reduce((sum, round) => sum + round.matches.length, 0);
    document.querySelector("#playedTotal").textContent = matchCount;
    document.querySelector("#playedCorrect").textContent = "0";
    document.querySelector("#playedWrong").textContent = "0";
    document.querySelector("#playedExact").textContent = "0";
    document.querySelector("#playedVoided").textContent = "0";
    playedStatus.textContent = `${selectedSeason()} knockout results | Champion: ${historical.champion}`;
    playedBoard.innerHTML = `
      <div class="world-cup-knockout">
        ${historical.knockout.map((round) => `
          <section class="knockout-round">
            <h3>${escapeHtml(round.round)}</h3>
            ${round.matches.map(([home, away, score, note]) => `
              <article class="knockout-match">
                ${fixtureTeamLine(home)}
                <strong>${escapeHtml(score)}</strong>
                ${fixtureTeamLine(away)}
                ${note ? `<small>${escapeHtml(note)}</small>` : ""}
              </article>
            `).join("")}
          </section>
        `).join("")}
      </div>
    `;
    return;
  }
  playedPredictions = [];
  playedLeagueFilter.innerHTML = `<option value="International">International</option>`;
  playedLeagueFilter.value = "International";
  playedDateFilter.value = "";
  playedDateFilter.min = "";
  playedDateFilter.max = "";
  document.querySelector("#playedTotal").textContent = "0";
  document.querySelector("#playedCorrect").textContent = "0";
  document.querySelector("#playedWrong").textContent = "0";
  document.querySelector("#playedExact").textContent = "0";
  document.querySelector("#playedVoided").textContent = "0";
  playedStatus.textContent = "No international matches have been imported as played";
  playedBoard.innerHTML = internationalEmptyState(
    "No international played matches yet",
    "Played matches and settled results will stay empty until World Cup, Euros, or friendly results are imported."
  );
}

function renderInternationalParlay() {
  currentParlays = [];
  parlayLeagueFilter.innerHTML = `<option value="International">International</option>`;
  parlayLeagueFilter.value = "International";
  parlayDateFilter.value = "";
  parlayDateFilter.min = "";
  parlayDateFilter.max = "";
  document.querySelector("#fbrefRows").textContent = internationalStatusData?.playerRows || "0";
  document.querySelector("#fbrefPlayers").textContent = internationalStatusData?.players || "0";
  document.querySelector("#playerLegCount").textContent = "0";
  document.querySelector("#propLegCount").textContent = "0";
  document.querySelector("#cornerLegCount").textContent = "0";
  document.querySelector("#teamScoreLegCount").textContent = "0";
  if (!hasCurrentInternationalFixtures()) {
    parlayStatus.textContent = `${selectedSeason()} parlay generation is waiting for fixtures, odds, and player-prop baselines`;
    setParlayMessage("", "info");
    trackParlaysButton.disabled = true;
    parlayOutput.innerHTML = internationalEmptyState("Information not available", seasonUnavailableMessage());
    return;
  }
  parlayStatus.textContent = `${internationalStatusData?.fixtureCount || 0} World Cup fixtures loaded; building model-only international parlays`;
  setParlayMessage("Building World Cup parlays from imported fixtures and 2018/2022 player baselines...", "info");
  trackParlaysButton.disabled = false;
  parlayOutput.innerHTML = `<div class="empty-state">Building World Cup parlay options...</div>`;
}

function restoreClubControls() {
  const previousParlayLeague = CLUB_PARLAY_LEAGUES.includes(parlayLeagueFilter.value) ? parlayLeagueFilter.value : "All";
  parlayLeagueFilter.innerHTML = CLUB_PARLAY_LEAGUES.map((league) => `<option value="${escapeHtml(league)}">${escapeHtml(league === "All" ? "All leagues" : league)}</option>`).join("");
  parlayLeagueFilter.value = previousParlayLeague;
  const wasInternationalSingle =
    leagueSelect.value === "International" ||
    /World Cup|Euro|Africa Cup|Copa America|Asian Cup|Gold Cup/i.test(form.elements.season.value || "") ||
    ["Mexico", "South Africa", "Argentina", "France"].includes(form.elements.homeTeam.value) ||
    ["Mexico", "South Africa", "Argentina", "France"].includes(form.elements.awayTeam.value);
  if (wasInternationalSingle) {
    leagueSelect.value = "EPL";
    form.elements.season.value = CLUB_SEASONS.some((season) => season.value === selectedSeason()) ? selectedSeason() : "2025-26";
    form.elements.homeTeam.value = "Man United";
    form.elements.awayTeam.value = "Chelsea";
    form.elements.date.value = "";
    form.elements.homeOdds.value = "";
    form.elements.drawOdds.value = "";
    form.elements.awayOdds.value = "";
    form.elements.save.checked = true;
    output.classList.remove("is-visible");
    output.innerHTML = "";
  }
}

function ensureSelectOption(select, value, label = value) {
  if (!select || [...select.options].some((option) => option.value === value)) return;
  select.append(new Option(label, value));
}

function renderInternationalSingleUnavailable(competition) {
  form.elements.league.value = "International";
  form.elements.season.value = selectedSeason();
  form.elements.date.value = "";
  form.elements.homeTeam.value = "TBD";
  form.elements.awayTeam.value = "TBD";
  form.elements.homeOdds.value = "2.40";
  form.elements.drawOdds.value = "3.50";
  form.elements.awayOdds.value = "2.90";
  form.elements.save.checked = false;
  output.classList.add("is-visible");
  output.innerHTML = `
    <div class="pick-line">
      <div>
        <strong>${escapeHtml(competition)}</strong>
        <p class="muted">International mode | ${escapeHtml(selectedSeason())}</p>
      </div>
      <span class="pick-pill tag-D">Fixture feed pending</span>
    </div>
    <div class="info-box">
      ${escapeHtml(competition)} is selectable now, but this model only has a connected World Cup fixture feed at the moment. Once fixtures are imported, this form will use the same international-only prediction flow.
    </div>
  `;
  updateTeamList();
}

function renderInternationalParlayLedger() {
  trackedParlayData = { parlays: [], summary: {} };
  parlayLedgerStatus.textContent = "0 tracked international tickets | 0 pending | 0 void | 0 DNP/void legs";
  parlayAccuracyStats.innerHTML = `
    <span><strong>0.0%</strong> parlay accuracy <small>0 hit / 0 miss</small></span>
    <span><strong>0.0%</strong> player stats accuracy <small>0 hit / 0 miss / 0 void</small></span>
    <span><strong>0.0%</strong> all-leg accuracy <small>0 total legs</small></span>
    <span><strong>0</strong> player props pending <small>0 settled player legs</small></span>
  `;
  parlayLedgerOutput.innerHTML = internationalEmptyState(
    "No international parlay backtests yet",
    "International tickets will be tracked separately from club parlays once generated."
  );
}

function renderInternationalLedger() {
  ledgerPredictions = [];
  ledgerBody.innerHTML = `<tr><td colspan="7" class="muted">No international predictions saved yet. This ledger is independent from club backtests.</td></tr>`;
}

function setInternationalSingleDemo() {
  if (!form) return;
  if (singleCompetitionSelect && singleCompetitionSelect.value !== "World Cup") {
    renderInternationalSingleUnavailable(singleCompetitionSelect.value);
    return;
  }
  if (selectedSeason() !== "2026 World Cup") {
    renderInternationalSingleUnavailable(selectedSeason());
    return;
  }
  const firstFixture = (internationalFixtureData?.fixtures || [])[0] || {
    date: "2026-06-11",
    homeTeam: "Mexico",
    awayTeam: "South Africa",
    group: "Group A",
    venue: "Estadio Azteca",
  };
  if (singleCompetitionSelect) singleCompetitionSelect.value = "World Cup";
  ensureSelectOption(form.elements.season, selectedSeason());
  form.elements.league.value = "International";
  form.elements.season.value = selectedSeason();
  form.elements.date.value = firstFixture.date || "";
  form.elements.homeTeam.value = firstFixture.homeTeam || "Mexico";
  form.elements.awayTeam.value = firstFixture.awayTeam || "South Africa";
  form.elements.homeOdds.value = "2.40";
  form.elements.drawOdds.value = "3.50";
  form.elements.awayOdds.value = "2.90";
  form.elements.save.checked = false;
  output.classList.add("is-visible");
  output.innerHTML = `
    <div class="pick-line">
      <div>
        <strong>${escapeHtml(firstFixture.homeTeam || "Mexico")} vs ${escapeHtml(firstFixture.awayTeam || "South Africa")}</strong>
        <p class="muted">International mode | 2026 World Cup opener | ${escapeHtml(firstFixture.date || "2026-06-11")}</p>
      </div>
      <span class="pick-pill tag-H">World Cup fixture</span>
    </div>
    <div class="info-box">
      The first imported World Cup fixture is loaded as the international single-match default. Odds are placeholders and can be edited once public market lines are available.
    </div>
  `;
  updateTeamList();
}

function renderWorldCupGroups() {
  if (!worldCupGroupsOutput) return;
  const historical = HISTORICAL_WORLD_CUPS[selectedSeason()];
  if (historical) {
    worldCupGroupsStatus.textContent = `${selectedSeason()} initial groups | Champion: ${historical.champion}`;
    worldCupGroupsOutput.innerHTML = historical.groups.map((group) => `
      <article class="world-cup-group-card">
        <div class="group-card-head">
          <span>Group ${escapeHtml(group.group)}</span>
          <small>Historical draw</small>
        </div>
        <ul>
          ${group.teams.map((team) => `
            <li>
              ${teamBadge(team)}
              <span>${escapeHtml(displayTeam(team))}</span>
            </li>
          `).join("")}
        </ul>
      </article>
    `).join("");
    return;
  }
  if (!hasCurrentInternationalFixtures()) {
    worldCupGroupsStatus.textContent = `${selectedSeason()} groups are not connected yet`;
    worldCupGroupsOutput.innerHTML = internationalEmptyState("Information not available", seasonUnavailableMessage());
    return;
  }
  const groups = internationalFixtureData?.groups
    ? Object.entries(internationalFixtureData.groups).map(([group, teams]) => ({ group, teams }))
    : WORLD_CUP_GROUPS;
  const source = internationalFixtureData?.source || WORLD_CUP_GROUPS_SOURCE;
  worldCupGroupsStatus.innerHTML = `2026 groups loaded from <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name || "FIFA fixture feed")}</a>`;
  worldCupGroupsOutput.innerHTML = groups.map((group) => `
    <article class="world-cup-group-card">
      <div class="group-card-head">
        <span>Group ${escapeHtml(group.group)}</span>
        <small>${internationalFixtureData?.groups ? "Fixture feed teams" : group.playoff ? "Includes playoff placeholder" : "Confirmed teams"}</small>
      </div>
      <ul>
        ${group.teams.map((team) => `
          <li>
            ${teamBadge(team)}
            <span>${escapeHtml(team)}</span>
          </li>
        `).join("")}
      </ul>
      ${!internationalFixtureData?.groups && group.playoff ? `<p class="muted">Placeholder pool: ${escapeHtml(group.playoff)}</p>` : ""}
    </article>
  `).join("");
}

function renderInternationalFixturesPage() {
  if (!internationalFixturesOutput) return;
  if (!hasCurrentInternationalFixtures()) {
    internationalFixturesStatus.textContent = `${selectedSeason()} fixture feed not connected yet`;
    internationalFixturesOutput.innerHTML = internationalEmptyState("Information not available", seasonUnavailableMessage());
    return;
  }
  const fixtures = internationalFixtureData?.fixtures || [];
  const source = internationalFixtureData?.source;
  if (!fixtures.length) {
    internationalFixturesStatus.textContent = "Waiting for imported fixture, venue, odds, and kickoff-time data";
    internationalFixturesOutput.innerHTML = internationalEmptyState(
      "Fixture feed not connected yet",
      "The international fixture page is ready, but predictions and parlays remain blank until a verified World Cup or Euros fixture feed is imported into the model."
    );
    return;
  }
  internationalFixturesStatus.innerHTML = `${fixtures.length} World Cup 2026 group-stage fixtures loaded from <a href="${escapeHtml(source?.url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(source?.name || "FIFA fixture feed")}</a>`;
  internationalFixturesOutput.innerHTML = fixtures
    .map((fixture) => `
      <article class="international-fixture-card">
        <div class="card-topline">
          <span>Match ${fixture.matchNumber}</span>
          <span>${escapeHtml(fixture.group)}</span>
          <span>${escapeHtml(fixture.date)}</span>
        </div>
        <div class="fixture-teams">
          ${fixtureTeamLine(fixture.homeTeam, fixture.homeFlagUrl)}
          <span class="versus">vs</span>
          ${fixtureTeamLine(fixture.awayTeam, fixture.awayFlagUrl)}
        </div>
        <p class="muted">${escapeHtml(fixture.venue || "Venue TBA")} | ${escapeHtml(fixture.city || "")}</p>
        <strong>${escapeHtml(formatKickoff(fixture.kickoffUtc))}</strong>
      </article>
    `)
    .join("");
}

function renderInternationalLeagueTables() {
  if (!leagueTablesOutput) return;
  const historical = HISTORICAL_WORLD_CUPS[selectedSeason()];
  if (historical) {
    leagueTablesStatus.textContent = `${selectedSeason()} final group tables | Champion: ${historical.champion}`;
    leagueTablesOutput.innerHTML = historical.groups.map((group) => `
      <article class="league-table-card">
        <div class="league-table-head">
          <div>
            <h3>Group ${escapeHtml(group.group)}</h3>
            <p class="muted">Historical final group-stage table</p>
          </div>
        </div>
        <div class="league-table-scroll">
          <table class="league-table">
            <thead>
              <tr><th>#</th><th>Team</th><th>Pts</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${group.standings.map(([team, points], index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${tableTeamCell(team)}</td>
                  <td><strong>${points}</strong></td>
                  <td><span class="table-status">${index < 2 ? "Advanced" : "Eliminated"}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `).join("");
    return;
  }
  if (!hasCurrentInternationalFixtures()) {
    leagueTablesStatus.textContent = `${selectedSeason()} group tables not available`;
    leagueTablesOutput.innerHTML = internationalEmptyState("Information not available", seasonUnavailableMessage());
    return;
  }
  const groups = internationalGroupTableData?.groups || [];
  if (!groups.length) {
    leagueTablesStatus.textContent = "Waiting for international group and fixture table data";
    leagueTablesOutput.innerHTML = internationalEmptyState(
      "International tables waiting for match data",
      "World Cup and Euros group tables will appear here once fixtures and results are imported for international mode."
    );
    return;
  }
  const applied = groups.reduce((sum, group) => sum + Number(group.appliedResults || 0), 0);
  leagueTablesStatus.textContent = `${groups.length} World Cup 2026 groups | ${applied} settled group result${applied === 1 ? "" : "s"} applied`;
  leagueTablesOutput.innerHTML = groups
    .map((group) => `
      <article class="league-table-card">
        <div class="league-table-head">
          <div>
            <h3>Group ${escapeHtml(group.group)}</h3>
            <p class="muted">${group.fixtures.length} scheduled fixtures | ${group.appliedResults || 0} settled result${Number(group.appliedResults || 0) === 1 ? "" : "s"} applied</p>
          </div>
        </div>
        <div class="league-table-scroll">
          <table class="league-table">
            <thead>
              <tr><th>#</th><th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${group.standings.map((entry) => `
                <tr>
                  <td>${entry.rank}</td>
                  <td>${tableTeamCell(entry.team)}</td>
                  <td>${entry.played}</td>
                  <td>${entry.wins}</td>
                  <td>${entry.draws}</td>
                  <td>${entry.losses}</td>
                  <td>${entry.goalsFor}</td>
                  <td>${entry.goalsAgainst}</td>
                  <td>${entry.goalDifference}</td>
                  <td><strong>${entry.points}</strong></td>
                  <td><span class="table-status">${escapeHtml(entry.status)}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `)
    .join("");
}

function leagueTableStatusLabel(entry, league) {
  const totalGames = Number(league.totalGames || 38);
  const gamesLeft = Math.max(0, totalGames - Number(entry.played || 0));
  const leader = league.standings?.[0];
  const second = league.standings?.[1];
  const secondGamesLeft = second ? Math.max(0, totalGames - Number(second.played || 0)) : 0;
  if (entry.rank === 1 && second && Number(entry.points || 0) > Number(second.points || 0) + secondGamesLeft * 3) return "Title secured";
  if (entry.rank === 1 && gamesLeft > 0) return "Leader";
  if (entry.rank <= 4) return "Champions League";
  if (entry.rank <= 7) return "Europe race";
  if (gamesLeft <= 1 && entry.rank >= (league.standings?.length || 0) - 2) return "Relegation zone";
  if (leader && entry.team === leader.team) return "Leader";
  return "Mid table";
}

function renderLeagueTables() {
  if (!leagueTablesOutput) return;
  if (isInternationalMode()) {
    renderInternationalLeagueTables();
    return;
  }
  if (leagueTableData?.unavailable) {
    leagueTablesStatus.textContent = `${leagueTableData.season || selectedSeason()} tables not available`;
    leagueTablesOutput.innerHTML = internationalEmptyState("Information not available", leagueTableData.message || seasonUnavailableMessage());
    return;
  }
  const leagues = leagueTableData?.leagues || {};
  const selectedLeague = leagueTableLeagueFilter?.value || "All";
  const leagueEntries = Object.entries(leagues).filter(([leagueName]) => selectedLeague === "All" || leagueName === selectedLeague);
  if (!leagueEntries.length) {
    leagueTablesStatus.textContent = selectedLeague === "All" ? "Waiting for league table data" : `No ${selectedLeague} table data available`;
    leagueTablesOutput.innerHTML = `<div class="empty-state">No league table data available for this filter yet.</div>`;
    return;
  }
  const refreshed = leagueTableData.refreshed?.length ? ` | refreshed ${leagueTableData.refreshed.join(", ")}` : "";
  leagueTablesStatus.textContent = `${leagueTableData.season || selectedSeason()} tables updated ${new Date(leagueTableData.generatedAt || leagueTableData.updatedAt || Date.now()).toLocaleString()}${refreshed}`;
  leagueTablesOutput.innerHTML = leagueEntries
    .map(([leagueName, league]) => `
      <article class="league-table-card">
        <div class="league-table-head">
          <div>
            <h3>${escapeHtml(league.name || leagueName)}</h3>
            <p class="muted">${escapeHtml(league.source || "Local table")} | ${league.trackedResultsApplied || 0} ledger result${Number(league.trackedResultsApplied || 0) === 1 ? "" : "s"} layered</p>
          </div>
          ${league.sourceUrl ? `<a href="${escapeHtml(league.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>` : ""}
        </div>
        <div class="league-table-notes">
          ${(league.notes || []).map((note) => `<span>${escapeHtml(note)}</span>`).join("")}
        </div>
        <div class="league-table-scroll">
          <table class="league-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Team</th>
                <th>MP</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GF</th>
                <th>GA</th>
                <th>GD</th>
                <th>Pts</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${(league.standings || []).map((entry) => `
                <tr>
                  <td>${entry.rank}</td>
                  <td>${tableTeamCell(entry.team, entry.ledgerDelta?.played ? `<small>+${entry.ledgerDelta.played} ledger match</small>` : "")}</td>
                  <td>${entry.played}</td>
                  <td>${entry.wins}</td>
                  <td>${entry.draws}</td>
                  <td>${entry.losses}</td>
                  <td>${entry.goalsFor}</td>
                  <td>${entry.goalsAgainst}</td>
                  <td>${entry.goalDifference}</td>
                  <td><strong>${entry.points}</strong></td>
                  <td><span class="table-status">${escapeHtml(leagueTableStatusLabel(entry, league))}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `)
    .join("");
}

async function refreshLeagueTables() {
  if (isInternationalMode()) {
    if (!hasCurrentInternationalFixtures()) {
      internationalGroupTableData = { groups: [] };
      renderInternationalLeagueTables();
      return;
    }
    leagueTablesStatus.textContent = "Refreshing World Cup group tables from settled international results...";
    internationalGroupTableData = await api("/api/international/group-tables");
    renderInternationalLeagueTables();
    renderTeamProfiles();
    return;
  }
  leagueTablesStatus.textContent = "Refreshing public tables and fixture-ledger deltas...";
  leagueTableData = await api(`/api/league-tables?season=${encodeURIComponent(selectedSeason())}`);
  renderLeagueTables();
  renderTeamProfiles();
}

function renderFutures() {
  if (!futuresOutput || !futuresStatus) return;
  const data = futuresData || {};
  if (data.unavailable) {
    futuresStatus.textContent = `${data.season || selectedSeason()} futures not available`;
    futuresOutput.innerHTML = internationalEmptyState("Information not available", data.message || seasonUnavailableMessage());
    return;
  }
  const sections = data.sections || [];
  if (!sections.length) {
    futuresStatus.textContent = "Waiting for futures data";
    futuresOutput.innerHTML = `<div class="empty-state">No futures prediction data is available yet.</div>`;
    return;
  }
  const market = futuresMarketFilter?.value || "winners";
  const marketMatches = (pick) => {
    const text = `${pick.market || ""} ${pick.label || ""}`.toLowerCase();
    if (market === "winners") return text.includes("winner") || text.includes("runner-up") || text.includes("semi-finalist") || text.includes("challenger");
    if (market === "scorers") return text.includes("top scorer");
    if (market === "assists") return text.includes("assist");
    if (market === "team-scorers") return text.includes("team top scorer");
    if (market === "europe") return text.includes("champions league") || text.includes("europa") || text.includes("conference") || text.includes("league phase") || text.includes("qualifier");
    return false;
  };
  const filteredSections = sections
    .map((section) => ({ ...section, picks: (section.picks || []).filter(marketMatches) }))
    .filter((section) => section.picks.length);
  if (!filteredSections.length) {
    futuresStatus.textContent = `${data.context === "international" ? "International" : "Club"} futures | ${data.season || selectedSeason()} | no ${market} market picks`;
    futuresOutput.innerHTML = `<div class="empty-state">No futures picks match this market filter.</div>`;
    return;
  }
  futuresStatus.textContent = `${data.context === "international" ? "International" : "Club"} futures | ${data.season || selectedSeason()} | generated ${new Date(data.generatedAt || Date.now()).toLocaleString()}`;
  futuresOutput.innerHTML = `
    ${data.sourcePolicy ? `<p class="futures-policy">${escapeHtml(data.sourcePolicy)}</p>` : ""}
    ${filteredSections
      .map((section) => {
        const listLayout = section.picks.every((pick) => /top scorer|top assist|team top scorer/i.test(pick.market || ""));
        return `
          <article class="futures-section">
            <div class="league-table-head">
              <div>
                <h3>${escapeHtml(section.title)}</h3>
                <p class="muted">${escapeHtml(section.subtitle || "")} ${section.picks.length ? `| ${section.picks.length} visible pick${section.picks.length === 1 ? "" : "s"}` : ""}</p>
              </div>
            </div>
            <div class="futures-pick-grid ${listLayout ? "is-list" : ""}">
              ${(section.picks || [])
                .map(
                  (pick) => `
                    <div class="futures-pick-card">
                      <div class="card-topline">
                        <span>${escapeHtml(pick.market || "Futures lean")}</span>
                        <span>#${escapeHtml(pick.rank || "")}</span>
                      </div>
                      <h4>${escapeHtml(pick.label || "")}</h4>
                      <strong>${statNumber(pick.confidence, 1)}%</strong>
                      <p>${escapeHtml(pick.detail || "")}</p>
                      ${pick.note ? `<p class="fbref-line">${escapeHtml(pick.note)}</p>` : ""}
                      ${pick.source?.url ? `<a href="${escapeHtml(pick.source.url)}" target="_blank" rel="noreferrer">${escapeHtml(pick.source.name || "Source")}</a>` : `<span class="profile-source">${escapeHtml(pick.source?.name || "")}</span>`}
                    </div>
                  `
                )
                .join("")}
            </div>
          </article>
        `;
      })
      .join("")}
  `;
}

async function refreshFutures() {
  if (!futuresOutput || !futuresStatus) return;
  futuresStatus.textContent = isInternationalMode() ? "Refreshing international futures..." : "Refreshing club futures from public tables and profile baselines...";
  const league = isInternationalMode() ? "International" : futuresLeagueFilter?.value || "All";
  futuresData = await api(`/api/futures?context=${encodeURIComponent(currentAppContext())}&season=${encodeURIComponent(selectedSeason())}&league=${encodeURIComponent(league)}`);
  renderFutures();
}

async function refreshInternationalStatus() {
  try {
    internationalStatusData = await api("/api/international/status");
  } catch {
    internationalStatusData = null;
  }
}

async function refreshInternationalFixtureBoard() {
  if (!hasCurrentInternationalFixtures()) {
    fixturePredictions = [];
    internationalFixtureData = null;
    internationalGroupTableData = { groups: [] };
    boardLeagueFilter.innerHTML = `<option value="All">All groups</option>`;
    boardLeagueFilter.value = "All";
    syncDateFilter(boardDateFilter, [], "");
    syncDateFilter(parlayDateFilter, [], "");
    renderInternationalFixtureBoard();
    renderInternationalFixturesPage();
    renderWorldCupGroups();
    setBoardMessage("", "info");
    return;
  }
  setBoardMessage("Loading World Cup 2026 fixtures...", "info");
  const previousLeague = boardLeagueFilter.value;
  const previousDate = boardDateFilter.value;
  const [predictionData, fixtureData, groupTableData] = await Promise.all([
    api("/api/international/fixture-predictions"),
    api("/api/international/fixtures"),
    api("/api/international/group-tables"),
  ]);
  fixturePredictions = predictionData.predictions || [];
  internationalFixtureData = fixtureData;
  internationalGroupTableData = groupTableData;
  const leagues = [...new Set(fixturePredictions.map((prediction) => prediction.league))].sort();
  boardLeagueFilter.innerHTML = `<option value="All">All groups</option>${leagues.map((league) => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}`;
  boardLeagueFilter.value = leagues.includes(previousLeague) ? previousLeague : "All";
  syncDateFilter(boardDateFilter, uniqueSortedDates(fixturePredictions), previousDate);
  syncDateFilter(parlayDateFilter, uniqueSortedDates(fixturePredictions), parlayDateFilter.value);
  renderInternationalFixtureBoard();
  renderInternationalFixturesPage();
  setBoardMessage("", "info");
}

async function renderInternationalContext() {
  resetInternationalSummary();
  renderInternationalModelMeta();
  await refreshInternationalFixtureBoard();
  resetInternationalSummary();
  renderInternationalPlayedBoard();
  await refreshParlay();
  renderInternationalParlayLedger();
  await refreshLedger();
  await refreshLeagueTables();
  await refreshFutures();
  await refreshTeamProfiles();
  renderWorldCupGroups();
  renderInternationalFixturesPage();
  renderPlayerProfiles();
  setInternationalSingleDemo();
}

async function renderClubContext() {
  restoreClubControls();
  trackAllButton.disabled = false;
  trackParlaysButton.disabled = false;
  if (meta) renderModelMeta(meta, meta.trainingStatus || {});
  updateTeamList();
  await refreshFixtureBoard();
  await refreshPlayedBoard();
  await refreshParlay();
  await refreshParlayLedger();
  await refreshPlayerProfiles();
  await refreshLeagueTables();
  await refreshTeamProfiles();
  await refreshLedger();
  await refreshFutures();
}

async function applyAppContext() {
  localStorage.setItem("football-context-mode", currentAppContext());
  updateSeasonOptions();
  updateContextLabels();
  updateContextNavigation();
  if (isInternationalMode()) {
    await refreshInternationalStatus();
    await renderInternationalContext();
  } else {
    await renderClubContext();
  }
  updateContextNavigation();
  autofillTrainingFixture({ showMessage: false });
}

function updateContextNavigation() {
  const international = isInternationalMode();
  updateContextLabels();
  pageTabs.forEach((tab) => {
    const internationalOnly = INTERNATIONAL_ONLY_PAGES.has(tab.dataset.pageTarget);
    const hostedPrivate = isHiddenHostedPage(tab.dataset.pageTarget);
    tab.hidden = hostedPrivate || (internationalOnly && !international);
    tab.setAttribute("aria-hidden", hostedPrivate || (internationalOnly && !international) ? "true" : "false");
  });
  if (pageSelect) {
    [...pageSelect.options].forEach((option) => {
      const internationalOnly = INTERNATIONAL_ONLY_PAGES.has(option.value);
      const hostedPrivate = isHiddenHostedPage(option.value);
      option.hidden = hostedPrivate || (internationalOnly && !international);
      option.disabled = hostedPrivate || (internationalOnly && !international);
    });
  }
  const activeSection = pageSections.find((section) => section.classList.contains("is-active"));
  if (isHiddenHostedPage(activeSection?.dataset.page) || (!international && INTERNATIONAL_ONLY_PAGES.has(activeSection?.dataset.page))) {
    showPage("predictions");
  }
}

function showPage(page) {
  const requested = isHiddenHostedPage(page) || (!isInternationalMode() && INTERNATIONAL_ONLY_PAGES.has(page)) ? "predictions" : page;
  const fallback = pageSections.some((section) => section.dataset.page === requested) ? requested : "predictions";
  pageSections.forEach((section) => section.classList.toggle("is-active", section.dataset.page === fallback));
  pageTabs.forEach((tab) => {
    const active = tab.dataset.pageTarget === fallback;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-current", active ? "page" : "false");
  });
  if (pageSelect) pageSelect.value = fallback;
  history.replaceState(null, "", `#${fallback}`);
  if (isInternationalMode()) {
    renderWorldCupGroups();
    renderInternationalFixturesPage();
    if (fallback === "league-tables") renderInternationalLeagueTables();
    if (fallback === "single") setInternationalSingleDemo();
  }
}

function formJson(formElement) {
  return Object.fromEntries(new FormData(formElement).entries());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function uniqueSortedDates(items, dateGetter = (item) => item.date) {
  return [...new Set(items.map(dateGetter).filter(Boolean))].sort();
}

function syncDateFilter(input, dates, previousValue = input.value) {
  input.min = dates[0] || "";
  input.max = dates[dates.length - 1] || "";
  input.value = previousValue && dates.includes(previousValue) ? previousValue : "";
}

function displayTeam(team) {
  return TEAM_DISPLAY_NAMES[team] || team;
}

function teamMatchKey(team) {
  const key = displayTeam(team)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const aliases = {
    "ath madrid": "atletico madrid",
    "athletic club": "ath bilbao",
    "manchester city": "man city",
    "manchester united": "man united",
    "nottingham forest": "nottm forest",
    "nott m forest": "nottm forest",
    "paris saint germain": "paris sg",
    "real oviedo": "oviedo",
    "tottenham hotspur": "tottenham",
  };
  return aliases[key] || key;
}

function sameTeam(left, right) {
  return teamMatchKey(left) === teamMatchKey(right);
}

function fixtureSignature(fixture) {
  return [fixture.date || "", fixture.league || "", fixture.homeTeam || "", fixture.awayTeam || ""]
    .map((part) => String(part).toLowerCase())
    .join("|");
}

function trainingFixtures() {
  const seen = new Set();
  return [...fixturePredictions, ...playedPredictions, ...ledgerPredictions].filter((fixture) => {
    const signature = fixtureSignature(fixture);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return fixture.date && fixture.homeTeam && fixture.awayTeam;
  });
}

function findTrainingFixture(profile, date) {
  if (!profile || !date) return null;
  return trainingFixtures()
    .filter((fixture) => fixture.date === date && (sameTeam(fixture.homeTeam, profile.team) || sameTeam(fixture.awayTeam, profile.team)))
    .sort((a, b) => Number(b.league === profile.league) - Number(a.league === profile.league))[0] || null;
}

async function ensureTrainingFixtureSources() {
  if (isInternationalMode()) return;
  const season = selectedSeason();
  const playedReady = playedPredictions.length && playedPredictionsSeason === season;
  const currentSeasonReady = !isCurrentClubSeason() || (fixturePredictions.length && ledgerPredictions.length);
  if (playedReady && currentSeasonReady) return;
  if (!trainingFixtureSourcesPromise) {
    trainingFixtureSourcesPromise = Promise.all([
      isCurrentClubSeason() && !fixturePredictions.length ? api("/api/fixture-predictions") : Promise.resolve(null),
      playedReady ? Promise.resolve(null) : api(`/api/played-fixtures?context=club&season=${encodeURIComponent(season)}`),
      isCurrentClubSeason() && !ledgerPredictions.length ? api("/api/backtests") : Promise.resolve(null),
    ])
      .then(([fixtureData, playedData, ledgerData]) => {
        if (fixtureData) fixturePredictions = fixtureData.predictions || [];
        if (playedData) {
          playedPredictions = playedData.predictions || [];
          playedPredictionsSeason = season;
        }
        if (ledgerData) ledgerPredictions = ledgerData.predictions || [];
      })
      .finally(() => {
        trainingFixtureSourcesPromise = null;
      });
  }
  await trainingFixtureSourcesPromise;
}

async function autofillTrainingFixture({ showMessage = true } = {}) {
  const profile = (playerProfileData.profiles || []).find((item) => item.id === playerProfileSelect.value);
  const date = playerStatForm.elements.date?.value || "";
  if (!profile || !date) return;
  await ensureTrainingFixtureSources();
  if (playerProfileSelect.value !== profile.id || playerStatForm.elements.date?.value !== date) return;
  const fixture = findTrainingFixture(profile, date);
  if (!fixture) {
    playerStatForm.elements.opponent.value = "";
    playerStatForm.elements.venue.value = "";
    const context = currentProfileContext() === "international" ? "international" : displayTeam(profile.team);
    if (showMessage) setPlayerProfileMessage(`No ${context} fixture found for ${date}. Opponent and venue are still editable.`, "info");
    return;
  }

  const isHome = sameTeam(fixture.homeTeam, profile.team);
  const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
  playerStatForm.elements.opponent.value = displayTeam(opponent);
  playerStatForm.elements.venue.value = isHome ? "Home" : "Away";
  if (showMessage) {
    setPlayerProfileMessage(`Matched ${displayTeam(profile.team)} ${isHome ? "vs" : "at"} ${displayTeam(opponent)} on ${date}. Opponent and venue filled from fixtures.`, "info");
  }
}

function teamInitials(team) {
  return displayTeam(team)
    .replaceAll("'", "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function teamLogo(team) {
  return TEAM_LOGOS[team] || TEAM_LOGOS[displayTeam(team)] || "";
}

function teamColor(team) {
  return TEAM_COLORS[team] || TEAM_COLORS[displayTeam(team)] || "#2563eb";
}

function teamBadge(team) {
  const logo = teamLogo(team);
  const initials = teamInitials(team);
  const color = teamColor(team);
  const image = logo
    ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('is-fallback'); this.remove();">`
    : "";
  return `<span class="team-badge${logo ? "" : " is-fallback"}" style="--team-color:${escapeHtml(color)}">${image}<span>${escapeHtml(initials)}</span></span>`;
}

function fixtureTeamLine(team, flagUrl = "") {
  const image = flagUrl
    ? `<img src="${escapeHtml(flagUrl)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('is-fallback'); this.remove();">`
    : "";
  const badge = image
    ? `<span class="team-badge">${image}<span>${escapeHtml(teamInitials(team))}</span></span>`
    : teamBadge(team);
  return `<span class="team-line">${badge}<span class="team-name">${escapeHtml(displayTeam(team))}</span></span>`;
}

function tableTeamCell(team, meta = "") {
  return `
    <span class="table-team-cell">
      ${teamBadge(team)}
      <span class="table-team-text">
        <strong>${escapeHtml(displayTeam(team))}</strong>
        ${meta}
      </span>
    </span>
  `;
}

function formatKickoff(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kickoff TBA";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function playerInitials(player) {
  return String(player || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function playerPhoto(profile) {
  const initials = playerInitials(profile.player);
  if (!profile.photoUrl) {
    return `<span class="player-photo is-fallback" aria-hidden="true"><span>${escapeHtml(initials)}</span></span>`;
  }
  return `
    <span class="player-photo">
      <img src="${escapeHtml(profile.photoUrl)}" alt="${escapeHtml(profile.player)} profile photograph" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('is-fallback'); this.remove();">
      <span>${escapeHtml(initials)}</span>
    </span>
  `;
}

function photoSourceMarkup(profile) {
  if (!profile.photoSourceName) return "";
  const label = escapeHtml(profile.photoSourceName);
  if (profile.photoSourceUrl) {
    return `<a href="${escapeHtml(profile.photoSourceUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
  }
  return label;
}

function teamLine(team) {
  return `<span class="team-line">${teamBadge(team)}<span class="team-name">${escapeHtml(displayTeam(team))}</span></span>`;
}

function fixtureTeams(prediction) {
  return `
    <h3 class="fixture-teams">
      ${fixtureTeamLine(prediction.homeTeam, prediction.homeFlagUrl)}
      <span class="versus">vs</span>
      ${fixtureTeamLine(prediction.awayTeam, prediction.awayFlagUrl)}
    </h3>
  `;
}

function fixtureMiniLine(fixture) {
  const [homeTeam, awayTeam] = String(fixture || "").split(/\s+vs\s+/i);
  if (!homeTeam || !awayTeam) return `<p>${escapeHtml(fixture || "")}</p>`;
  return `
    <p class="fixture-mini">
      ${teamBadge(homeTeam)}
      <span class="mini-team">${escapeHtml(displayTeam(homeTeam))}</span>
      <span class="mini-vs">vs</span>
      ${teamBadge(awayTeam)}
      <span class="mini-team">${escapeHtml(displayTeam(awayTeam))}</span>
    </p>
  `;
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    ...options,
  }).finally(() => window.clearTimeout(timeout));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "signin";
  authSignInTab?.classList.toggle("is-active", authMode === "signin");
  authSignUpTab?.classList.toggle("is-active", authMode === "signup");
  if (authNameField) authNameField.hidden = authMode !== "signup";
  if (authSubmitButton) authSubmitButton.textContent = authMode === "signup" ? "Create account" : "Sign in";
  if (authPassword) authPassword.autocomplete = authMode === "signup" ? "new-password" : "current-password";
  if (authMessage) authMessage.textContent = "";
}

function storedAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_STORAGE_KEY) || "null");
    if (!session?.access_token || !session?.expires_at) return null;
    if (Number(session.expires_at) * 1000 <= Date.now() + 15_000) return null;
    return session;
  } catch (error) {
    return null;
  }
}

function saveAuthSession(session) {
  authSession = session || null;
  if (authSession) {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(authSession));
  } else {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  }
}

function authHeaders(session = authSession) {
  return {
    apikey: authConfig.anonKey,
    Authorization: `Bearer ${session?.access_token || authConfig.anonKey}`,
    "Content-Type": "application/json",
  };
}

async function supabaseAuthRequest(path, options = {}) {
  const response = await fetch(`${authConfig.url}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: authConfig.anonKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Authentication failed");
  return data;
}

async function fetchSupabaseUser(session) {
  const response = await fetch(`${authConfig.url}/auth/v1/user`, {
    headers: authHeaders(session),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.msg || data.message || "Session expired");
  return data;
}

async function upsertUserProfile(session, user) {
  if (!session?.access_token || !user?.id) return;
  const displayName = authDisplayName?.value?.trim() || user.user_metadata?.display_name || user.email?.split("@")[0] || "";
  await fetch(`${authConfig.url}/rest/v1/user_profiles?on_conflict=id`, {
    method: "POST",
    headers: {
      ...authHeaders(session),
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: user.id,
      email: user.email || "",
      display_name: displayName,
      last_sign_in_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }),
  }).catch(() => {});
}

async function applyAuthenticatedSession(session) {
  const user = session?.user || (await fetchSupabaseUser(session));
  saveAuthSession({ ...session, user });
  await upsertUserProfile(session, user);
  document.body.classList.add("is-authenticated");
  if (authGate) authGate.hidden = true;
  if (authAccount) authAccount.hidden = false;
  if (authUserEmail) authUserEmail.textContent = user.email || "Signed in";
  await loadAppData();
}

function showAuthGate(message = "") {
  document.body.classList.add("auth-required");
  document.body.classList.remove("is-authenticated");
  if (authGate) authGate.hidden = false;
  if (authAccount) authAccount.hidden = true;
  if (authMessage) authMessage.textContent = message;
}

async function initAuth() {
  authConfig = await api("/api/auth/config").catch(() => authConfig);
  document.body.classList.toggle("hosted-public", Boolean(authConfig.hideModelStats));
  updateContextNavigation();
  const requiresAuth = Boolean(authConfig.requireSignIn && authConfig.enabled);
  if (!requiresAuth) {
    if (authGate) authGate.hidden = true;
    if (authAccount) authAccount.hidden = true;
    const activeSection = pageSections.find((section) => section.classList.contains("is-active"));
    if (isHiddenHostedPage(activeSection?.dataset.page)) showPage("predictions");
    return true;
  }

  const stored = storedAuthSession();
  if (!stored) {
    showAuthGate();
    return false;
  }

  try {
    await applyAuthenticatedSession(stored);
    return false;
  } catch (error) {
    saveAuthSession(null);
    showAuthGate("Your session expired. Please sign in again.");
    return false;
  }
}

function updateSummary(summary) {
  document.querySelector("#totalCount").textContent = summary.total;
  document.querySelector("#pendingCount").textContent = summary.pending;
  document.querySelector("#accuracyCount").textContent = `${((summary.pickAccuracy ?? summary.accuracy ?? 0) * 100).toFixed(1)}%`;
  document.querySelector("#scoreAccuracyCount").textContent = `${((summary.scoreAccuracy || 0) * 100).toFixed(1)}%`;
}

function percent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`;
}

function renderModelMeta(modelMeta, trainingStatus = {}) {
  if (isInternationalMode()) {
    renderInternationalModelMeta();
    return;
  }
  const test = modelMeta?.metrics?.test;
  const accuracy = test ? `Holdout accuracy ${(test.accuracy * 100).toFixed(1)}%` : "Holdout accuracy unavailable";
  const feedback = Number(modelMeta?.feedbackRows || 0);
  const training = trainingStatus.status ? `Continuous training ${trainingStatus.status.toLowerCase()}` : "Continuous training idle";
  document.querySelector("#modelMeta").textContent = `Trained ${new Date(modelMeta.trainedAt).toLocaleString()} | ${accuracy} | ${feedback} feedback rows | ${training}`;
}

async function refreshTrainingStatus() {
  const status = await api("/api/training-status");
  renderModelMeta(meta, status);
}

function pickText(prediction) {
  if (prediction.prediction === "H") return `${displayTeam(prediction.homeTeam)} win`;
  if (prediction.prediction === "A") return `${displayTeam(prediction.awayTeam)} win`;
  return "Draw";
}

function predictionKey(prediction) {
  return [prediction.date || "", prediction.league || "", prediction.homeTeam || "", prediction.awayTeam || ""].join("|");
}

function predictionDecimalOdds(prediction) {
  if (!prediction?.hasOdds) return null;
  if (prediction.prediction === "H") return Number(prediction.odds?.homeOdds);
  if (prediction.prediction === "A") return Number(prediction.odds?.awayOdds);
  return Number(prediction.odds?.drawOdds);
}

function predictionSlipLeg(prediction) {
  const price = predictionDecimalOdds(prediction);
  const hasSportsbookPrice = Number.isFinite(price) && price > 1;
  return {
    type: "match",
    date: prediction.date || "",
    fixture: `${prediction.homeTeam} vs ${prediction.awayTeam}`,
    league: prediction.league || "",
    market: "match result",
    pick: pickText(prediction),
    confidence: Number(prediction.confidence || 0),
    projectedScore: prediction.projectedScore || "",
    source: prediction.judgment?.summary || motivationText(prediction) || "Prediction board model pick",
    decimalOdds: hasSportsbookPrice ? Number(price.toFixed(2)) : null,
    oddsType: hasSportsbookPrice ? "sportsbook" : "model-estimate",
    oddsSource: hasSportsbookPrice ? prediction.oddsSource || "The Odds API" : "Model-estimated fair price",
    oddsStatus: hasSportsbookPrice ? prediction.oddsStatus || "Public match-result odds" : "No sportsbook price connected for this prediction",
    oddsSourceUrl: prediction.oddsSourceUrl || "",
    oddsSnapshotAt: prediction.oddsSnapshotAt || "",
  };
}

function probabilityRows(prediction) {
  const rows = [
    ["H", displayTeam(prediction.homeTeam), prediction.probabilities.homeWinPct],
    ["D", "Draw", prediction.probabilities.drawPct],
    ["A", displayTeam(prediction.awayTeam), prediction.probabilities.awayWinPct],
  ];

  return rows
    .map(
      ([code, label, value]) => `
        <div class="prob-row">
          <span>${escapeHtml(label)}</span>
          <span class="prob-track"><span class="prob-fill tag-${code}" style="width:${Math.max(2, value)}%"></span></span>
          <strong>${value.toFixed(1)}%</strong>
        </div>
      `
    )
    .join("");
}

function oddsText(prediction) {
  if (!prediction.hasOdds) return "Model only";
  return `H ${prediction.odds.homeOdds} | D ${prediction.odds.drawOdds} | A ${prediction.odds.awayOdds}`;
}

function oddsSourceLabel(prediction) {
  return prediction.oddsSource || prediction.oddsStatus || "Model only";
}

function oddsSourceMarkup(prediction) {
  const label = escapeHtml(oddsSourceLabel(prediction));
  if (prediction.oddsSourceUrl) {
    return `<a href="${escapeHtml(prediction.oddsSourceUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
  }
  return label;
}

function motivationText(prediction) {
  const context = prediction.standingContext;
  if (!context?.home || !context?.away) return "";
  if (context.source === "international-fixtures") {
    return `World Cup context: ${displayTeam(prediction.homeTeam)} ${context.home.note}; ${displayTeam(prediction.awayTeam)} ${context.away.note}`;
  }
  const source = context.source === "public-standings" ? "Live table" : "Local form table";
  const homeManual = context.home.manualNote ? ` (${context.home.manualNote})` : "";
  const awayManual = context.away.manualNote ? ` (${context.away.manualNote})` : "";
  return `${source}: ${displayTeam(prediction.homeTeam)} ${context.home.note}${homeManual}; ${displayTeam(prediction.awayTeam)} ${context.away.note}${awayManual}`;
}

function motivationLine(prediction) {
  const text = motivationText(prediction);
  return text ? `<div class="motivation-line">${escapeHtml(text)}</div>` : "";
}

function judgmentMarkup(prediction) {
  const judgment = prediction.judgment;
  if (!judgment) return motivationLine(prediction);
  const factors = (judgment.factors || []).filter(Boolean);
  const source = judgment.sourceUrl
    ? `<a href="${escapeHtml(judgment.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(judgment.tableSource || "Standings source")}</a>`
    : escapeHtml(judgment.tableSource || "Standings source");
  return `
    <div class="judgment-card">
      <div class="judgment-card-head">
        <strong>Prediction judgment</strong>
        <span>${source}</span>
      </div>
      <p>${escapeHtml(judgment.summary || motivationText(prediction) || "")}</p>
      ${
        factors.length
          ? `<ul>${factors.map((factor) => `<li>${escapeHtml(factor)}</li>`).join("")}</ul>`
          : ""
      }
    </div>
  `;
}

function setBoardMessage(message, kind = "info") {
  boardMessage.className = `board-message ${message ? "is-visible" : ""} ${kind}`;
  boardMessage.textContent = message;
}

function setParlayMessage(message, kind = "info") {
  parlayMessage.className = `board-message ${message ? "is-visible" : ""} ${kind}`;
  parlayMessage.textContent = message;
}

function setParlaySlipMessage(message, kind = "info") {
  if (!parlaySlipMessage) return;
  parlaySlipMessage.className = `board-message ${message ? "is-visible" : ""} ${kind}`;
  parlaySlipMessage.textContent = message;
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function formatDecimalOdds(value) {
  const odds = Number(value);
  return Number.isFinite(odds) && odds > 1 ? odds.toFixed(2) : "N/A";
}

function legSignature(leg) {
  return [leg.type || "", leg.date || "", leg.fixture || "", leg.player || "", leg.market || "", leg.pick || ""].join("||").toLowerCase();
}

function slipEffectiveLegCount(legs) {
  const groupedFixtures = new Set();
  let standalone = 0;
  for (const leg of legs || []) {
    const fixture = String(leg.fixture || "").trim().toLowerCase();
    if (fixture && ["match", "score"].includes(leg.type)) {
      groupedFixtures.add(fixture);
    } else if (!fixture) {
      standalone += 1;
    }
  }
  for (const leg of legs || []) {
    const fixture = String(leg.fixture || "").trim().toLowerCase();
    if (!fixture || groupedFixtures.has(fixture)) continue;
    standalone += 1;
  }
  return groupedFixtures.size + standalone;
}

function combinedDecimalOdds(legs) {
  return (legs || []).reduce((product, leg) => product * Math.max(1, Number(leg.decimalOdds || 1)), 1);
}

function slipStake() {
  return Math.max(0, Number(parlayStakeInput?.value || 0));
}

function averageLegConfidence(legs) {
  return legs?.length ? legs.reduce((sum, leg) => sum + Number(leg.confidence || 0), 0) / legs.length : 0;
}

function confidenceBand(confidence) {
  const score = Number(confidence || 0);
  if (score >= 70) return { label: "Confident", tone: "strong", note: "Above the preferred confidence line." };
  if (score >= 65) return { label: "Playable", tone: "watch", note: "Inside the 65-70% review band." };
  return { label: "Potential miss", tone: "risk", note: "Below the preferred confidence baseline." };
}

function slipConfidenceAssessment(legs) {
  if (!legs?.length) {
    return {
      average: 0,
      verdict: "No picks",
      tone: "empty",
      note: "Select props to calculate confidence.",
      weakCount: 0,
      reviewCount: 0,
      strongCount: 0,
    };
  }
  const average = averageLegConfidence(legs);
  const weakCount = legs.filter((leg) => Number(leg.confidence || 0) < 65).length;
  const reviewCount = legs.filter((leg) => Number(leg.confidence || 0) >= 65 && Number(leg.confidence || 0) < 70).length;
  const strongCount = legs.filter((leg) => Number(leg.confidence || 0) >= 70).length;
  if (average >= 70 && weakCount === 0) {
    return {
      average,
      verdict: "Confident slip",
      tone: "strong",
      note: `${strongCount} selection${strongCount === 1 ? "" : "s"} above 70%; no leg below 65%.`,
      weakCount,
      reviewCount,
      strongCount,
    };
  }
  if (average >= 65 && weakCount <= 1) {
    return {
      average,
      verdict: "Playable, review risk",
      tone: "watch",
      note: `${weakCount} below-baseline selection${weakCount === 1 ? "" : "s"}; keep stake controlled.`,
      weakCount,
      reviewCount,
      strongCount,
    };
  }
  return {
    average,
    verdict: "Potential miss risk",
    tone: "risk",
    note: `${weakCount} selection${weakCount === 1 ? "" : "s"} below 65%; this slip needs trimming.`,
    weakCount,
    reviewCount,
    strongCount,
  };
}

function parlaySlipForTracking() {
  const confidence = slipConfidenceAssessment(selectedParlaySlip.legs);
  return {
    name: selectedParlaySlip.name || "Potential Parlay Slip",
    riskMode: selectedParlaySlip.riskMode || (parlayRiskToggle?.checked ? "risky" : "safe"),
    averageConfidence: confidence.average,
    confidenceVerdict: confidence.verdict,
    legs: selectedParlaySlip.legs,
    stake: slipStake(),
    decimalOdds: Number(combinedDecimalOdds(selectedParlaySlip.legs).toFixed(2)),
    potentialReturn: Number((slipStake() * combinedDecimalOdds(selectedParlaySlip.legs)).toFixed(2)),
    source: "parlay-slip",
  };
}

function saveParlaySlip() {
  try {
    localStorage.setItem(PARLAY_SLIP_STORAGE_KEY, JSON.stringify(selectedParlaySlip));
  } catch {
    /* localStorage can fail in private browsing; the in-memory slip still works. */
  }
}

function loadParlaySlip() {
  try {
    const saved = JSON.parse(localStorage.getItem(PARLAY_SLIP_STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.legs)) selectedParlaySlip = saved;
  } catch {
    selectedParlaySlip = { name: "Custom Parlay Slip", sourceParlayId: "", legs: [], context: currentAppContext(), riskMode: "safe" };
  }
}

function addLegToParlaySlip(leg, { replace = false, sourceParlay = null } = {}) {
  const pricedLeg = {
    ...leg,
    decimalOdds: Number(leg.decimalOdds || 0) > 1 ? Number(leg.decimalOdds) : Math.max(1.01, 100 / Math.max(8, Number(leg.confidence || 50))),
    oddsType: leg.oddsType || "model-estimate",
    oddsSource: leg.oddsSource || "Model-estimated fair price",
    oddsStatus: leg.oddsStatus || "No sportsbook prop line connected",
  };
  const nextLegs = replace ? [] : [...selectedParlaySlip.legs];
  if (!nextLegs.some((item) => legSignature(item) === legSignature(pricedLeg))) nextLegs.push(pricedLeg);
  selectedParlaySlip = {
    name: sourceParlay?.name || (replace ? "Selected Parlay Slip" : selectedParlaySlip.name || "Custom Parlay Slip"),
    sourceParlayId: sourceParlay?.id || selectedParlaySlip.sourceParlayId || "",
    context: currentAppContext(),
    riskMode: sourceParlay?.riskMode || selectedParlaySlip.riskMode || (parlayRiskToggle?.checked ? "risky" : "safe"),
    legs: nextLegs.slice(0, 20),
  };
  saveParlaySlip();
  renderParlaySlip();
}

function selectParlayForSlip(parlay) {
  selectedParlaySlip = {
    name: parlay.name || "Selected Parlay Slip",
    sourceParlayId: parlay.id || "",
    context: currentAppContext(),
    riskMode: parlay.riskMode || (parlayRiskToggle?.checked ? "risky" : "safe"),
    legs: (parlay.legs || []).slice(0, 20),
  };
  saveParlaySlip();
  renderParlayTickets();
  renderParlaySlip();
  showPage("parlay-slip");
  setParlaySlipMessage("Selected parlay loaded. Adjust the stake to preview the potential return.", "info");
}

function removeSlipLeg(signature) {
  selectedParlaySlip = {
    ...selectedParlaySlip,
    legs: selectedParlaySlip.legs.filter((leg) => legSignature(leg) !== signature),
  };
  saveParlaySlip();
  renderParlayTickets();
  renderParlaySlip();
}

function renderParlaySlip() {
  if (!parlaySlipOutput) return;
  const legs = selectedParlaySlip.legs || [];
  const combined = combinedDecimalOdds(legs);
  const stake = slipStake();
  const potentialReturn = stake * combined;
  const potentialProfit = Math.max(0, potentialReturn - stake);
  const confidence = slipConfidenceAssessment(legs);
  document.querySelector("#slipSelectionCount").textContent = legs.length;
  document.querySelector("#slipEffectiveLegs").textContent = slipEffectiveLegCount(legs);
  document.querySelector("#slipAverageConfidence").textContent = `${confidence.average.toFixed(1)}%`;
  document.querySelector("#slipConfidenceVerdict").textContent = confidence.verdict;
  document.querySelector("#slipConfidenceVerdict").className = `confidence-verdict ${confidence.tone}`;
  document.querySelector("#slipCombinedOdds").textContent = formatDecimalOdds(combined);
  document.querySelector("#slipPotentialReturn").textContent = formatMoney(potentialReturn);
  document.querySelector("#slipPotentialProfit").textContent = formatMoney(potentialProfit);
  if (parlaySlipStatus) {
    const sportsbookCount = legs.filter((leg) => leg.oddsType === "sportsbook").length;
    const estimatedCount = legs.length - sportsbookCount;
    parlaySlipStatus.textContent = legs.length
      ? `${selectedParlaySlip.name || "Potential slip"} | ${sportsbookCount} sportsbook price${sportsbookCount === 1 ? "" : "s"} | ${estimatedCount} model estimate${estimatedCount === 1 ? "" : "s"}`
      : "Select a generated parlay or individual props to preview stake and return";
  }
  if (trackParlaySlipButton) trackParlaySlipButton.disabled = !legs.length;
  if (!legs.length) {
    parlaySlipOutput.innerHTML = `<div class="empty-state">No selections yet. Go to Parlays and use Select parlay or Add to slip on individual props.</div>`;
    return;
  }
  parlaySlipOutput.innerHTML = `
    <article class="parlay-slip-card">
      <div class="ticket-head">
        <div>
          <h3>${escapeHtml(selectedParlaySlip.name || "Potential Parlay Slip")}</h3>
          <p class="muted">Estimated payout multiplies selection prices. Confidence baseline: 65-70% and above. ${escapeHtml(confidence.note)}</p>
        </div>
        <span class="ticket-result">${formatDecimalOdds(combined)}x</span>
      </div>
      <ol class="parlay-leg-list slip-leg-list">
        ${legs.map((leg, index) => renderSlipLeg(leg, index + 1)).join("")}
      </ol>
    </article>
  `;
}

function renderSlipLeg(leg, index) {
  const sourceLabel = leg.oddsType === "sportsbook" ? leg.oddsSource || "Sportsbook odds" : "Model est.";
  const confidence = confidenceBand(leg.confidence);
  return `
    <li class="parlay-leg-row ${leg.type}-leg">
      <span class="leg-number">${index}</span>
      <div>
        <strong>${escapeHtml(leg.pick)}</strong>
        ${fixtureMiniLine(leg.fixture)}
        <p class="fbref-line">${escapeHtml(leg.market || "")} | ${escapeHtml(leg.oddsStatus || "")}</p>
      </div>
      <div class="leg-row-meta">
        <span>${escapeHtml(sourceLabel)}</span>
        <strong>${formatDecimalOdds(leg.decimalOdds)}</strong>
        <small class="confidence-chip ${confidence.tone}">${Number(leg.confidence || 0).toFixed(1)}% - ${escapeHtml(confidence.label)}</small>
        <button class="ghost-button compact-button" type="button" data-remove-slip-leg="${escapeHtml(legSignature(leg))}">Remove</button>
      </div>
    </li>
  `;
}

function setPlayerProfileMessage(message, kind = "info") {
  playerProfileMessage.className = `board-message ${message ? "is-visible" : ""} ${kind}`;
  playerProfileMessage.textContent = message;
}

function setTeamProfileMessage(message, kind = "info") {
  if (!teamProfileMessage) return;
  teamProfileMessage.className = `board-message ${message ? "is-visible" : ""} ${kind}`;
  teamProfileMessage.textContent = message;
}

function playerTrainingEntrySummary(entry, isGoalkeeper) {
  const opponent = entry.opponent ? ` vs ${entry.opponent}` : "";
  const venue = entry.venue ? ` | ${entry.venue}` : "";
  const saveHint = isGoalkeeper ? "Goalkeeper entry" : "Match entry";
  return `${entry.date || "Date n/a"}${opponent}${venue} - ${saveHint}`;
}

function profileTrainingEntryMarkup(profile, view, isGoalkeeper) {
  const latest = (view.latestEntries || [])[0];
  if (!latest) {
    return `
      <li class="profile-training-empty">
        <strong>${escapeHtml(view.emptyEntryText)}</strong>
        <span>${escapeHtml(view.emptyEntrySubtext)}</span>
      </li>
    `;
  }
  return `
    <li class="profile-training-latest">
      <div>
        <strong>Latest trained match</strong>
        <span>${escapeHtml(playerTrainingEntrySummary(latest, isGoalkeeper))}</span>
      </div>
      <button class="profile-entry-edit-button" type="button" data-profile-id="${escapeHtml(profile.id)}" data-entry-id="${escapeHtml(latest.id)}">Edit</button>
    </li>
  `;
}

function setPlayerFormMode(entry = null) {
  editingPlayerStatEntry = entry;
  const button = playerStatForm.querySelector('button[type="submit"]');
  if (!button) return;
  button.textContent = entry ? "Update Player Stats" : "Save Player Stats";
}

function fillPlayerStatFormFromEntry(profile, entry) {
  if (!profile || !entry) return;
  playerProfileSelect.value = profile.id;
  playerStatForm.elements.date.value = entry.date || "";
  playerStatForm.elements.opponent.value = entry.opponent || "";
  playerStatForm.elements.venue.value = entry.venue || "";
  playerStatForm.elements.minutes.value = Number(entry.minutes || 0);
  playerStatForm.elements.shots.value = Number(entry.shots || 0);
  playerStatForm.elements.shotsOnTarget.value = Number(entry.shotsOnTarget || 0);
  playerStatForm.elements.goals.value = Number(entry.goals || 0);
  playerStatForm.elements.assists.value = Number(entry.assists || 0);
  playerStatForm.elements.saves.value = Number(entry.saves || 0);
  playerStatForm.elements.started.checked = Boolean(entry.started);
  playerStatForm.elements.notes.value = entry.notes || "";
  setPlayerFormMode({ ...entry, profileId: profile.id });
  renderPlayerProfiles();
  playerStatForm.scrollIntoView({ behavior: "smooth", block: "start" });
  setPlayerProfileMessage(`Editing latest trained match for ${profile.player}. Update the fields and save to correct the training entry.`, "info");
}

function teamTrainingEntrySummary(entry) {
  const opponent = entry.opponent ? ` vs ${displayTeam(entry.opponent)}` : "";
  const venue = entry.venue ? ` (${entry.venue})` : "";
  const score = `${entry.goalsFor ?? 0}-${entry.goalsAgainst ?? 0}`;
  return `${entry.date || "Date n/a"}${opponent}${venue} - ${entry.result || "N/A"} ${score}`;
}

function setTeamFormMode(entry = null) {
  editingTeamStatEntry = entry;
  const button = teamStatForm?.querySelector('button[type="submit"]');
  if (!button) return;
  button.textContent = entry ? "Update Team Stats" : "Save Team Stats";
}

function fillTeamStatFormFromEntry(profile, entry) {
  if (!profile || !entry || !teamStatForm) return;
  teamProfileSelect.value = profile.id;
  [
    "date",
    "opponent",
    "venue",
    "result",
    "goalsFor",
    "goalsAgainst",
    "expectedGoalsFor",
    "expectedGoalsAgainst",
    "shotsFor",
    "shotsAgainst",
    "shotsOnTargetFor",
    "shotsOnTargetAgainst",
    "sga",
    "cornersFor",
    "cornersAgainst",
    "setPieceGoalsFor",
    "setPieceGoalsAgainst",
    "possession",
    "restDays",
    "absences",
    "motivation",
    "notes",
  ].forEach((name) => {
    if (teamStatForm.elements[name]) teamStatForm.elements[name].value = entry[name] ?? "";
  });
  teamStatForm.elements.cleanSheet.checked = Boolean(entry.cleanSheet);
  setTeamFormMode({ ...entry, profileId: profile.id });
  renderTeamProfiles();
  teamStatForm.scrollIntoView({ behavior: "smooth", block: "start" });
  setTeamProfileMessage(`Editing latest trained match for ${profile.displayName || displayTeam(profile.team)}. Update the fields and save to correct the team profile entry.`, "info");
}

async function autofillTeamTrainingFixture({ showMessage = true } = {}) {
  if (!teamStatForm || editingTeamStatEntry) return;
  const profile = (teamProfileData.profiles || []).find((item) => item.id === teamProfileSelect.value);
  const date = teamStatForm.elements.date?.value || "";
  if (!profile || !date) return;
  await ensureTrainingFixtureSources();
  if (teamProfileSelect.value !== profile.id || teamStatForm.elements.date?.value !== date) return;
  const fixture = findTrainingFixture(profile, date);
  if (!fixture) {
    teamStatForm.elements.opponent.value = "";
    teamStatForm.elements.venue.value = "";
    if (showMessage) setTeamProfileMessage(`No ${displayTeam(profile.team)} fixture found on ${date}. Enter opponent and venue manually.`, "info");
    return;
  }
  const isHome = sameTeam(fixture.homeTeam, profile.team);
  const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;
  teamStatForm.elements.opponent.value = displayTeam(opponent);
  teamStatForm.elements.venue.value = isHome ? "Home" : "Away";
  if (showMessage) {
    setTeamProfileMessage(`Matched ${displayTeam(profile.team)} ${isHome ? "vs" : "at"} ${displayTeam(opponent)} on ${date}. Opponent and venue filled from fixtures.`, "info");
  }
}

function renderBoard() {
  const selectedLeague = boardLeagueFilter.value;
  const selectedDate = boardDateFilter.value;
  const filteredBase = fixturePredictions.filter((prediction) => {
    const leagueMatches = selectedLeague === "All" || prediction.league === selectedLeague;
    const dateMatches = !selectedDate || prediction.date === selectedDate;
    return leagueMatches && dateMatches;
  });
  const filtered = sortFixturePredictions(filteredBase, boardSortSelect.value);

  document.querySelector("#boardTotal").textContent = fixturePredictions.length;
  document.querySelector("#boardWithOdds").textContent = fixturePredictions.filter((prediction) => prediction.hasOdds).length;
  document.querySelector("#boardModelOnly").textContent = fixturePredictions.filter((prediction) => !prediction.hasOdds).length;
  const dateText = selectedDate ? ` on ${selectedDate}` : "";
  boardStatus.textContent = `${filtered.length} fixture${filtered.length === 1 ? "" : "s"} shown${dateText}`;

  if (!filtered.length) {
    fixtureBoard.innerHTML = `<div class="empty-state">No fixtures match this filter.</div>`;
    return;
  }

  fixtureBoard.innerHTML = filtered
    .map(
      (prediction) => `
        <article class="fixture-card scoreboard-row pick-${prediction.prediction}">
          <div class="card-topline">
            <span>${escapeHtml(prediction.date)}</span>
            <span>${escapeHtml(prediction.league)}</span>
          </div>
          ${fixtureTeams(prediction)}
          <div class="callout">
            <span class="pick-pill tag-${prediction.prediction}">${escapeHtml(pickText(prediction))}</span>
            <strong>${prediction.confidence.toFixed(1)}%</strong>
            <button class="select-prediction-button compact-button" type="button" data-select-prediction="${escapeHtml(predictionKey(prediction))}">
              ${selectedParlaySlip.legs.some((leg) => legSignature(leg) === legSignature(predictionSlipLeg(prediction))) ? "Added" : "Select"}
            </button>
          </div>
          <div class="score-line">
            <span>Projected score</span>
            <strong>${escapeHtml(prediction.projectedScore || "")}</strong>
          </div>
          <div class="odds-line">
            <span>${oddsSourceMarkup(prediction)}</span>
            <strong>${escapeHtml(oddsText(prediction))}</strong>
          </div>
          ${motivationLine(prediction)}
          <div class="prob-bars">${probabilityRows(prediction)}</div>
        </article>
      `
    )
    .join("");
}

function sortFixturePredictions(predictions, mode) {
  const sorted = [...predictions];
  const dateKey = (prediction) => `${prediction.date || "9999-99-99"} ${prediction.league || ""} ${prediction.homeTeam || ""}`;
  if (mode === "date-desc") {
    return sorted.sort((a, b) => dateKey(b).localeCompare(dateKey(a)));
  }
  if (mode === "league-date") {
    return sorted.sort((a, b) => `${a.league} ${dateKey(a)}`.localeCompare(`${b.league} ${dateKey(b)}`));
  }
  if (mode === "confidence-desc") {
    return sorted.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  }
  if (mode === "draw-risk-desc") {
    return sorted.sort((a, b) => Number(b.probabilities?.drawPct || 0) - Number(a.probabilities?.drawPct || 0));
  }
  return sorted.sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
}

function playedClass(prediction) {
  if (prediction.played?.modelCorrect === true) return "played-correct";
  if (prediction.played?.modelCorrect === false) return "played-wrong";
  return "played-void";
}

function playedStatusText(prediction) {
  return prediction.played?.statusLabel || "Settled";
}

function playedOutcomeClass(value) {
  if (value === true || value === "HIT") return "status-hit";
  if (value === false || value === "MISS") return "status-miss";
  return "status-void";
}

function playedOutcomeText(value) {
  if (value === true) return "Hit";
  if (value === false) return "Miss";
  if (value === "HIT" || value === "MISS" || value === "VOID") return value;
  return "Void";
}

function actualResultText(prediction) {
  const result = prediction.played?.actualResult || prediction.actualResult;
  if (result === "H") return `${displayTeam(prediction.homeTeam)} win`;
  if (result === "A") return `${displayTeam(prediction.awayTeam)} win`;
  if (result === "D") return "Draw";
  return "Pending";
}

function isHistoricalResult(prediction) {
  return ["Historical result", "API result"].includes(prediction.played?.statusLabel) || prediction.played?.sourceName === "Imported historical match CSV";
}

function renderHistoricalPlayedCard(prediction) {
  const settled = prediction.played || {};
  const hasFinalGoals = Number.isFinite(Number(settled.homeGoals)) && Number.isFinite(Number(settled.awayGoals));
  const finalScore = settled.actualScore || (hasFinalGoals ? `${settled.homeGoals}-${settled.awayGoals}` : "n/a");
  return `
    <article class="historical-played-card" aria-label="${escapeHtml(displayTeam(prediction.homeTeam))} ${escapeHtml(finalScore)} ${escapeHtml(displayTeam(prediction.awayTeam))}">
      <div class="historical-played-meta">
        <span>${escapeHtml(prediction.date || "")}</span>
        <span>${escapeHtml(prediction.league || "")}</span>
      </div>
      <div class="historical-played-score">
        ${fixtureTeamLine(prediction.homeTeam, prediction.homeFlagUrl)}
        <strong>${escapeHtml(finalScore.replace("-", " - "))}</strong>
        ${fixtureTeamLine(prediction.awayTeam, prediction.awayFlagUrl)}
      </div>
    </article>
  `;
}

function renderPlayedBoard() {
  if (isInternationalMode()) {
    renderInternationalPlayedBoard();
    return;
  }
  const selectedLeague = playedLeagueFilter.value;
  const selectedDate = playedDateFilter.value;
  const filtered = playedPredictions.filter((prediction) => {
    const leagueMatches = selectedLeague === "All" || prediction.league === selectedLeague;
    const dateMatches = !selectedDate || prediction.date === selectedDate;
    return leagueMatches && dateMatches;
  });
  const backtestedRows = playedPredictions.filter((prediction) => !isHistoricalResult(prediction));
  const correct = backtestedRows.filter((prediction) => prediction.played?.modelCorrect === true).length;
  const wrong = backtestedRows.filter((prediction) => prediction.played?.modelCorrect === false).length;
  const voided = backtestedRows.filter((prediction) => prediction.played?.modelCorrect === null).length;
  const exact = backtestedRows.filter((prediction) => prediction.played?.exactScoreCorrect === true).length;

  document.querySelector("#playedTotal").textContent = playedPredictions.length;
  document.querySelector("#playedCorrect").textContent = correct;
  document.querySelector("#playedWrong").textContent = wrong;
  document.querySelector("#playedExact").textContent = exact;
  document.querySelector("#playedVoided").textContent = voided;
  playedStatus.textContent = `${filtered.length} played match${filtered.length === 1 ? "" : "es"} shown${selectedDate ? ` on ${selectedDate}` : ""}`;

  if (!filtered.length) {
    playedBoard.innerHTML = `<div class="empty-state">No played fixtures found for the selected season/date filters.</div>`;
    return;
  }

  playedBoard.innerHTML = filtered
    .map((prediction) => {
      if (isHistoricalResult(prediction)) return renderHistoricalPlayedCard(prediction);
      const settled = prediction.played || {};
      const picks = settled.picks || [];
      const hasFinalGoals = Number.isFinite(Number(settled.homeGoals)) && Number.isFinite(Number(settled.awayGoals));
      const finalScore = settled.actualScore || (hasFinalGoals ? `${settled.homeGoals}-${settled.awayGoals}` : "Pending");
      const exactScoreText = settled.exactScoreCorrect === true ? "Exact" : settled.exactScoreCorrect === false ? "Miss" : "Pending";
      return `
        <article class="played-grid-card ${playedClass(prediction)}">
          <div class="played-card-head">
            <div class="card-topline">
              <span>${escapeHtml(prediction.date)}</span>
              <span>${escapeHtml(prediction.league)}</span>
            </div>
            <span class="pick-pill played-result ${playedOutcomeClass(settled.modelCorrect)}">${escapeHtml(playedStatusText(prediction))}</span>
          </div>
          ${fixtureTeams(prediction)}

          <div class="played-scoreboard" aria-label="Final score">
            <span>${escapeHtml(displayTeam(prediction.homeTeam))}</span>
            <strong>${escapeHtml(finalScore.replace("-", " - "))}</strong>
            <span>${escapeHtml(displayTeam(prediction.awayTeam))}</span>
          </div>

          <div class="played-result-grid">
            <div>
              <span>Model pick</span>
              <strong>${escapeHtml(pickText(prediction))}</strong>
              <small class="${playedOutcomeClass(settled.modelCorrect)}">${escapeHtml(playedOutcomeText(settled.modelCorrect))}</small>
            </div>
            <div>
              <span>Final result</span>
              <strong>${escapeHtml(actualResultText(prediction))}</strong>
            </div>
            <div>
              <span>Projected score</span>
              <strong>${escapeHtml(prediction.projectedScore || "n/a")}</strong>
              <small class="${playedOutcomeClass(settled.exactScoreCorrect)}">${escapeHtml(exactScoreText)}</small>
            </div>
            <div>
              <span>Parlay legs</span>
              <strong>${settled.hits || 0} hit / ${settled.misses || 0} miss / ${settled.voids || 0} void</strong>
            </div>
          </div>
          ${
            settled.sourceUrl
              ? `<div class="played-source"><span>Verified by</span><a href="${escapeHtml(settled.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(settled.sourceName || "Source")}</a></div>`
              : ""
          }
          ${motivationLine(prediction)}
          <ul class="played-pick-list">
            ${picks.length ? picks.map((pick) => `
              <li class="${playedOutcomeClass(pick.status)}">
                <span>${escapeHtml(playedOutcomeText(pick.status))}</span>
                <strong>${escapeHtml(pick.pick)}</strong>
                <small>${escapeHtml(pick.market)}</small>
              </li>
            `).join("") : `<li class="status-void"><span>n/a</span><strong>No parlay legs tracked for this fixture.</strong><small>Fixture ledger result</small></li>`}
          </ul>
        </article>
      `;
    })
    .join("");
}

function updateTeamList() {
  if (isInternationalMode()) {
    const teams = WORLD_CUP_GROUPS.flatMap((group) => group.teams).filter((team) => !team.includes("Playoff"));
    teamList.innerHTML = teams.map((team) => `<option value="${escapeHtml(team)}"></option>`).join("");
    return;
  }
  const teams = meta?.teamsByLeague?.[leagueSelect.value] || [];
  teamList.innerHTML = teams.map((team) => `<option value="${escapeHtml(team)}"></option>`).join("");
}

function renderPrediction(prediction) {
  output.classList.add("is-visible");
  output.innerHTML = `
    <div class="pick-line">
      <div>
        <strong>${escapeHtml(displayTeam(prediction.homeTeam))} vs ${escapeHtml(displayTeam(prediction.awayTeam))}</strong>
        <p class="muted">${escapeHtml(prediction.league)} ${escapeHtml(prediction.season)}</p>
      </div>
      <span class="pick-pill tag-${prediction.prediction}">${escapeHtml(pickText(prediction))} ${prediction.confidence.toFixed(1)}%</span>
    </div>
    <div class="score-line compact">
      <span>Projected score</span>
      <strong>${escapeHtml(prediction.projectedScore || "")}</strong>
    </div>
    <div class="prob-bars">${probabilityRows(prediction)}</div>
    ${judgmentMarkup(prediction)}
  `;
}

function renderParlay(data) {
  const fbref = data.fbref || {};
  const riskMode = data.filters?.riskMode || (parlayRiskToggle.checked ? "risky" : "safe");
  const parlays = data.parlays?.length ? data.parlays : data.parlay?.legs?.length ? [data.parlay] : [];
  const legs = parlays.flatMap((parlay) => parlay.legs || []);
  currentParlays = parlays;
  const selectedDate = parlayDateFilter.value;

  document.querySelector("#fbrefRows").textContent = fbref.processedRows || 0;
  document.querySelector("#fbrefPlayers").textContent = fbref.players || 0;
  document.querySelector("#playerLegCount").textContent = data.playerCandidateCount || 0;
  document.querySelector("#propLegCount").textContent = data.propCandidateCount || 0;
  document.querySelector("#cornerLegCount").textContent = data.cornerCandidateCount || 0;
  document.querySelector("#teamScoreLegCount").textContent = data.teamScoreCandidateCount || 0;
  const generationMode = data.filters?.generationMode || (parlayLayoutToggle.checked ? "fixture-grid" : "multi");
  parlayStatus.textContent = fbref.hasPlayerStats
    ? `${riskMode === "risky" ? "Risk mode" : "Safe mode"} | ${generationMode === "fixture-grid" ? "Fixture grid" : "Multi-ticket"} | Using imported FBref stats from ${fbref.seasons.join(", ") || "local files"} | ${data.availableFixtureCount || 0} fixtures available${selectedDate ? ` on ${selectedDate}` : ""} | ${data.excludedFixtureCount || 0} played excluded${riskMode === "risky" ? ` | ${data.riskyPlayerCandidateCount || 0} risky player legs` : ""}`
    : "Waiting for imported FBref player stats";

  setParlayMessage(data.parlay?.note || "", fbref.hasPlayerStats ? "info" : "error");

  if (!legs.length) {
    parlayOutput.innerHTML = `<div class="empty-state">Import player-stat CSVs, run npm.cmd run import:thunderbit or npm.cmd run import:fbref, then refresh this parlay builder.</div>`;
    return;
  }

  renderParlayTickets();
}

function sortedParlays() {
  const parlays = [...currentParlays];
  if (parlaySortSelect.value === "confidence-desc") {
    return parlays.sort((a, b) => Number(b.averageConfidence || 0) - Number(a.averageConfidence || 0));
  }
  if (parlaySortSelect.value === "confidence-asc") {
    return parlays.sort((a, b) => Number(a.averageConfidence || 0) - Number(b.averageConfidence || 0));
  }
  return parlays;
}

function renderParlayTickets() {
  parlayOutput.innerHTML = sortedParlays().map(renderParlayTicket).join("");
  renderParlaySlip();
}

function renderParlayTicket(parlay) {
  const legs = parlay.legs || [];
  const riskCount = legs.filter((leg) => leg.riskMode).length;
  const selectedTicket = selectedParlaySlip.sourceParlayId && selectedParlaySlip.sourceParlayId === parlay.id;
  return `
    <article class="parlay-ticket ${parlay.mode === "fixture-grid" ? "fixture-grid-ticket" : ""}">
      <div class="ticket-head">
        <div>
          <h3>${escapeHtml(parlay.name)}</h3>
          <p class="muted">${legs.length} selections | ${slipEffectiveLegCount(legs)} effective legs | average confidence ${Number(parlay.averageConfidence || 0).toFixed(1)}%</p>
        </div>
        <div class="ticket-actions">
          <div class="ticket-stats">
            <span>${(parlay.playerStatLegs || []).length} player</span>
            <span>${(parlay.propLegs || []).length} BTTS/corner</span>
            <span>${(parlay.teamScoreLegs || []).length} score</span>
            <span>${(parlay.matchResultLegs || []).length} result</span>
            <span>${formatDecimalOdds(combinedDecimalOdds(legs))}x</span>
            ${riskCount ? `<span>${riskCount} risk</span>` : ""}
          </div>
          <button class="select-ticket-button" type="button" data-select-ticket="${escapeHtml(parlay.id)}">${selectedTicket ? "Selected in slip" : "Select parlay"}</button>
          <button class="track-ticket-button" type="button" data-track-ticket="${escapeHtml(parlay.id)}">Track this option</button>
        </div>
      </div>
      <ol class="parlay-leg-list">
        ${legs.map((leg, index) => renderLegListItem(leg, index + 1, parlay.id, index)).join("")}
      </ol>
    </article>
  `;
}

function renderLegSection(title, legs, emptyText) {
  return `
    <section class="leg-section">
      <div class="leg-section-head">
        <h4>${escapeHtml(title)}</h4>
        <span>${legs.length} leg${legs.length === 1 ? "" : "s"}</span>
      </div>
      ${
        legs.length
          ? `<div class="leg-list">${legs.map(renderLegCard).join("")}</div>`
          : `<div class="empty-state compact-empty">${escapeHtml(emptyText)}</div>`
      }
    </section>
  `;
}

function renderLegListItem(leg, index, parlayId = "", legIndex = 0) {
  const detail =
    leg.type === "player"
      ? `${leg.fbrefMetric} | ${leg.fbrefSeason} | ${leg.source}`
      : leg.type === "corner"
      ? `${leg.fbrefMetric || "corner model"} | ${leg.source || ""}`
      : leg.type === "btts"
      ? `${leg.projectedScore ? `Projected score ${leg.projectedScore} | ` : ""}${leg.source || ""}`
      : `Projected score ${leg.projectedScore || "N/A"} | ${leg.source || ""}`;
  const selected = selectedParlaySlip.legs.some((item) => legSignature(item) === legSignature(leg));
  const oddsLabel = leg.oddsType === "sportsbook" ? "Odds API" : "Model est.";
  return `
    <li class="parlay-leg-row ${leg.type}-leg">
      <span class="leg-number">${index}</span>
      <div>
        <strong>${escapeHtml(leg.pick)}</strong>
        ${leg.riskMode ? `<span class="risk-leg-badge">Risk mode</span>` : ""}
        ${fixtureMiniLine(leg.fixture)}
        <p class="fbref-line">${escapeHtml(detail)}</p>
      </div>
      <div class="leg-row-meta">
        <span>${escapeHtml(leg.market)}</span>
        <strong>${formatDecimalOdds(leg.decimalOdds)}</strong>
        <small>${escapeHtml(oddsLabel)} | ${Number(leg.confidence || 0).toFixed(1)}%</small>
        <button class="select-leg-button compact-button" type="button" data-select-leg="${escapeHtml(parlayId)}" data-leg-index="${legIndex}">${selected ? "Added" : "Add to slip"}</button>
      </div>
    </li>
  `;
}

function renderLegCard(leg) {
  const typeClass = leg.type === "player" ? "player-leg" : leg.type === "score" ? "score-leg" : leg.type === "corner" ? "corner-leg" : leg.type === "btts" ? "btts-leg" : "match-leg";
  const detail =
    leg.type === "player"
      ? `FBref: ${leg.fbrefMetric} | ${leg.fbrefSeason} | ${leg.source}`
      : leg.type === "corner"
      ? `Corner model: ${leg.fbrefMetric || "team corner average"} | ${leg.source || ""}`
      : leg.type === "btts"
      ? `BTTS model: projected score ${leg.projectedScore || "N/A"} | ${leg.source || ""}`
      : `Model: projected score ${leg.projectedScore || "N/A"} | ${leg.source || ""}`;
  return `
    <article class="leg-card ${typeClass}">
      <div class="card-topline">
        <span>${escapeHtml(leg.date || "")}</span>
        <span>${escapeHtml(leg.league || "")}</span>
      </div>
      <h4>${escapeHtml(leg.pick)}</h4>
      <div class="leg-meta">
        <span>${escapeHtml(leg.market)}</span>
        <strong>${Number(leg.confidence || 0).toFixed(1)}%</strong>
      </div>
      ${fixtureMiniLine(leg.fixture)}
      <p class="fbref-line">${escapeHtml(detail)}</p>
    </article>
  `;
}

function renderParlayLedger(data = trackedParlayData) {
  trackedParlayData = data;
  const parlays = data.parlays || [];
  const summary = data.summary || {};
  parlayLedgerStatus.textContent = `${summary.total || 0} tracked tickets | ${summary.pending || 0} pending | ${summary.voids || 0} void | ${summary.legVoids || 0} DNP/void legs`;
  parlayAccuracyStats.innerHTML = `
    <span>
      <strong>${percent(summary.ticketHitRate)}</strong>
      parlay accuracy
      <small>${summary.wins || 0} hit / ${summary.losses || 0} miss</small>
    </span>
    <span>
      <strong>${percent(summary.playerLegHitRate)}</strong>
      player stats accuracy
      <small>${summary.playerLegHits || 0} hit / ${summary.playerLegMisses || 0} miss / ${summary.playerLegVoids || 0} void</small>
    </span>
    <span>
      <strong>${percent(summary.legHitRate)}</strong>
      all-leg accuracy
      <small>${summary.legTotal || 0} total legs</small>
    </span>
    <span>
      <strong>${summary.playerLegPending || 0}</strong>
      player props pending
      <small>${summary.playerLegSettled || 0} settled player legs</small>
    </span>
  `;

  if (!parlays.length) {
    parlayLedgerOutput.innerHTML = `<div class="empty-state">No parlays tracked yet. Generate options above, then use Track this option or Track Generated Parlays. Hit/Miss buttons appear here once a ticket is tracked.</div>`;
    return;
  }

  parlayLedgerOutput.innerHTML = parlays
    .map(
      (parlay) => `
        <article class="tracked-parlay status-${parlay.status}">
          <div class="ticket-head">
            <div>
              <h3>${escapeHtml(parlay.name)}</h3>
              <p class="muted">${parlay.legs.length} legs | ${escapeHtml(parlay.status)} | ${escapeHtml(parlay.riskMode === "risky" ? "Risk mode" : "Safe mode")} | created ${new Date(parlay.createdAt).toLocaleString()}</p>
            </div>
            <span class="ticket-result">${escapeHtml(parlay.status)}</span>
          </div>
          <ol class="tracked-leg-list">
            ${parlay.legs.map((leg, index) => renderTrackedLeg(parlay.id, leg, index + 1)).join("")}
          </ol>
        </article>
      `
    )
    .join("");
}

function renderTrackedLeg(parlayId, leg, index) {
  const detail =
    leg.type === "player"
      ? `${leg.fbrefMetric || ""} | ${leg.source || ""}`
      : `Projected score ${leg.projectedScore || "N/A"} | ${leg.source || ""}`;
  return `
    <li class="tracked-leg-row ${leg.type}-leg status-${leg.status}">
      <span class="leg-number">${index}</span>
      <div>
        <strong>${escapeHtml(leg.pick)}</strong>
        ${leg.riskMode ? `<span class="risk-leg-badge">Risk mode</span>` : ""}
        ${fixtureMiniLine(leg.fixture)}
        <p class="fbref-line">${escapeHtml(detail)}</p>
      </div>
      <div class="leg-actions" data-parlay-id="${escapeHtml(parlayId)}" data-leg-id="${escapeHtml(leg.id)}">
        <span class="leg-status status-${escapeHtml(leg.status)}">${escapeHtml(leg.status)}</span>
        <button class="hit-button" type="button" data-status="HIT">Hit</button>
        <button class="miss-button" type="button" data-status="MISS">Miss</button>
        <button class="void-button" type="button" data-status="VOID">DNP/Void</button>
        <button class="reset-button" type="button" data-status="PENDING">Reset</button>
      </div>
    </li>
  `;
}

function statNumber(value, decimals = 0) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(decimals) : (0).toFixed(decimals);
}

function renderPlayerProfiles() {
  const profiles = playerProfileData.profiles || [];
  const profileContext = currentProfileContext();
  const selectedProfileId = playerProfileSelect.value || profiles[0]?.id || "";
  playerProfileStatus.textContent = `${profileContext === "international" ? "International" : "Club"} profiles | ${profiles.length} tracked players | ${playerProfileData.entryCount || 0} saved match stat entries`;
  playerProfileSelect.innerHTML = profiles
    .map((profile) => {
      const view = activeProfileView(profile);
      return `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.player)} | ${escapeHtml(view.team)} | ${escapeHtml(profile.role)}</option>`;
    })
    .join("");
  if (selectedProfileId) playerProfileSelect.value = selectedProfileId;

  if (!profiles.length) {
    playerProfileGrid.innerHTML = `<div class="empty-state">No player profiles are configured yet.</div>`;
    return;
  }

  playerProfileGrid.innerHTML = profiles
    .map((profile) => {
      const view = activeProfileView(profile);
      const totals = view.totals || {};
      const isGoalkeeper = profile.role === "Goalkeeper";
      const isSelected = profile.id === playerProfileSelect.value;
      return `
        <article class="player-profile-card ${isGoalkeeper ? "goalkeeper-profile" : ""} ${isSelected ? "is-selected-profile" : ""}" data-profile-id="${escapeHtml(profile.id)}" role="button" tabindex="0" aria-pressed="${isSelected ? "true" : "false"}" aria-label="Select ${escapeHtml(profile.player)} for player profile training">
          ${isSelected ? `<span class="selected-profile-star" role="img" aria-label="Selected player profile" title="Selected player profile">★</span>` : ""}
          <div class="profile-card-head">
            ${playerPhoto(profile)}
            <div>
              <span class="role-pill">${escapeHtml(profile.role)}</span>
              <h3>${escapeHtml(profile.player)}</h3>
              <p class="muted">${escapeHtml(view.team)} | ${escapeHtml(view.league)} | ${escapeHtml(profile.position)}</p>
              <p class="profile-source">Photo source: ${photoSourceMarkup(profile) || "Not set"}</p>
              <p class="profile-source">Stats source: ${escapeHtml(view.importedBaseline?.source || "Manual entries only")}</p>
              ${view.importedBaseline?.detail ? `<p class="profile-source">Profile note: ${escapeHtml(view.importedBaseline.detail)}</p>` : ""}
            </div>
            ${teamBadge(view.team)}
          </div>
          <div class="profile-stat-grid">
            <span><strong>${totals.appearances || 0}</strong> apps</span>
            <span><strong>${Math.round(totals.minutes || 0)}</strong> min</span>
            <span><strong>${totals.goals || 0}</strong> goals</span>
            <span><strong>${totals.assists || 0}</strong> assists</span>
            <span><strong>${totals.shots || 0}</strong> shots</span>
            <span><strong>${totals.shotsOnTarget || 0}</strong> SOT</span>
            ${
              isGoalkeeper
                ? `<span><strong>${totals.saves || 0}</strong> saves</span><span><strong>${statNumber(totals.savesPer90, 2)}</strong> saves/90</span>`
                : `<span><strong>${statNumber(totals.shotsPer90, 2)}</strong> shots/90</span><span><strong>${statNumber(totals.shotsOnTargetPer90, 2)}</strong> SOT/90</span>`
            }
          </div>
          <div class="profile-rate-line">
            <span>${statNumber(totals.goalsPer90, 2)} goals/90</span>
            <span>${statNumber(totals.assistsPer90, 2)} assists/90</span>
          </div>
          <ul class="profile-entry-list">
            ${profileTrainingEntryMarkup(profile, view, isGoalkeeper)}
          </ul>
        </article>
      `;
    })
    .join("");
}

function formChip(result) {
  const value = ["W", "D", "L"].includes(result) ? result : "D";
  return `<span class="form-chip form-${value}">${escapeHtml(value)}</span>`;
}

function teamTableEntry(profile) {
  const league = leagueTableData?.leagues?.[profile.league];
  return (league?.standings || []).find((entry) => sameTeam(entry.team, profile.team)) || null;
}

function internationalGroupTableEntry(profile) {
  for (const group of internationalGroupTableData?.groups || []) {
    const entry = (group.standings || []).find((row) => sameTeam(row.team, profile.team));
    if (entry) return { group: group.group, entry };
  }
  return null;
}

function teamProfileLinkedTableText(profile) {
  if (isInternationalMode()) {
    const groupRow = internationalGroupTableEntry(profile);
    if (!groupRow) return "group row not available yet";
    const { group, entry } = groupRow;
    return `Group ${group} | #${entry.rank} | ${entry.points} pts | ${entry.status}`;
  }
  const tableEntry = teamTableEntry(profile);
  if (!tableEntry) return "table row not available for this season";
  return `#${tableEntry.rank} | ${tableEntry.points} pts | ${leagueTableStatusLabel(tableEntry, leagueTableData?.leagues?.[profile.league] || {})}`;
}

function teamProfileEntryMarkup(profile) {
  const latest = (profile.latestEntries || [])[0];
  if (!latest) {
    return `
      <li class="profile-training-empty">
        <strong>No manual team entries yet</strong>
        <span>Add the latest match or rolling team snapshot to calibrate form, corners, xG, and motivation.</span>
      </li>
    `;
  }
  return `
    <li class="profile-training-latest">
      <div>
        <strong>Latest trained match</strong>
        <span>${escapeHtml(teamTrainingEntrySummary(latest))}</span>
      </div>
      <button class="profile-entry-edit-button" type="button" data-team-profile-id="${escapeHtml(profile.id)}" data-entry-id="${escapeHtml(latest.id)}">Edit</button>
    </li>
  `;
}

function renderTeamProfiles() {
  if (!teamProfileGrid || !teamProfileSelect) return;
  const profiles = teamProfileData.profiles || [];
  const selectedProfileId = profiles.some((profile) => profile.id === teamProfileSelect.value) ? teamProfileSelect.value : profiles[0]?.id || "";
  const baselineCount = profiles.filter((profile) => profile.importedBaseline?.hasBaseline).length;
  const contextLabel = isInternationalMode() ? "international team profiles" : "club team profiles";
  teamProfileStatus.textContent = `${selectedSeason()} ${contextLabel} | ${profiles.length} tracked teams | ${baselineCount} imported season baselines | ${teamProfileData.entryCount || 0} saved team stat entries`;
  teamProfileSelect.innerHTML = profiles
    .map((profile) => `<option value="${escapeHtml(profile.id)}">${escapeHtml(profile.displayName || displayTeam(profile.team))} | ${escapeHtml(profile.league)}</option>`)
    .join("");
  if (selectedProfileId) teamProfileSelect.value = selectedProfileId;

  if (!profiles.length) {
    teamProfileGrid.innerHTML = `<div class="empty-state">No team profiles are configured yet.</div>`;
    return;
  }

  teamProfileGrid.innerHTML = profiles
    .map((profile) => {
      const totals = profile.totals || {};
      const isSelected = profile.id === teamProfileSelect.value;
      const lastFive = (profile.latestEntries || []).slice(0, 5);
      return `
        <article class="player-profile-card team-profile-card ${isSelected ? "is-selected-profile" : ""}" data-team-profile-id="${escapeHtml(profile.id)}" role="button" tabindex="0" aria-pressed="${isSelected ? "true" : "false"}" aria-label="Select ${escapeHtml(profile.displayName || displayTeam(profile.team))} for team profile training">
          ${isSelected ? `<span class="selected-profile-star" role="img" aria-label="Selected team profile" title="Selected team profile">&#9733;</span>` : ""}
          <div class="profile-card-head">
            <div>
              <span class="role-pill">Team</span>
              <h3>${escapeHtml(profile.displayName || displayTeam(profile.team))}</h3>
              <p class="muted">${escapeHtml(profile.league)} | ${escapeHtml(selectedSeason())}</p>
              <p class="profile-source">Stats source: ${escapeHtml(profile.importedBaseline?.source || "Manual entries only")}</p>
              <p class="profile-source">Linked table: ${escapeHtml(teamProfileLinkedTableText(profile))}</p>
            </div>
            ${teamBadge(profile.team)}
          </div>
          <div class="team-form-strip">
            ${lastFive.length ? lastFive.map((entry) => formChip(entry.result)).join("") : `<span class="muted">Last five waiting for entries</span>`}
          </div>
          <div class="profile-stat-grid team-stat-grid">
            <span><strong>${totals.matches || 0}</strong> matches</span>
            <span><strong>${statNumber(totals.pointsPerGame, 2)}</strong> PPG</span>
            <span><strong>${statNumber(totals.xgForPerGame, 2)}</strong> xG</span>
            <span><strong>${statNumber(totals.xgAgainstPerGame, 2)}</strong> xGA</span>
            <span><strong>${statNumber(totals.shotsForPerGame, 1)}</strong> shots</span>
            <span><strong>${statNumber(totals.sotForPerGame, 1)}</strong> SOT</span>
            <span><strong>${statNumber(totals.shotOnTargetRatio * 100, 1)}%</strong> SOT ratio</span>
            <span><strong>${statNumber(totals.cornersForPerGame, 1)}</strong> corners</span>
            <span><strong>${statNumber(totals.cornersAgainstPerGame, 1)}</strong> corners against</span>
            <span><strong>${totals.setPieceGoalsFor || 0}</strong> set-piece GF</span>
            <span><strong>${totals.setPieceGoalsAgainst || 0}</strong> set-piece GA</span>
            <span><strong>${statNumber(totals.cleanSheetRate * 100, 1)}%</strong> clean sheets</span>
          </div>
          <ul class="profile-entry-list">
            ${teamProfileEntryMarkup(profile)}
          </ul>
        </article>
      `;
    })
    .join("");
}

function showMessage(message, kind = "error") {
  output.classList.add("is-visible");
  output.innerHTML = `<div class="${kind === "error" ? "error-box" : "info-box"}">${escapeHtml(message)}</div>`;
}

function scoreCorrect(item) {
  return String(item.projectedScore || "").trim() === `${item.homeGoals}-${item.awayGoals}`;
}

function renderLedger(predictions = ledgerPredictions) {
  if (!predictions.length) {
    ledgerBody.innerHTML = `<tr><td colspan="7" class="muted">No predictions saved yet.</td></tr>`;
    return;
  }

  ledgerBody.innerHTML = predictions
    .map((item) => {
      const status =
        item.status === "SETTLED"
          ? `
            <div class="status-stack">
              <span class="${item.correct ? "settled-ok" : "settled-miss"}">Pick ${item.correct ? "correct" : "missed"}</span>
              <span class="${scoreCorrect(item) ? "settled-ok" : "settled-miss"}">Score ${scoreCorrect(item) ? "correct" : "missed"}</span>
            </div>
          `
          : `<span class="pending">Pending</span>`;
      const resultCell =
        item.status === "SETTLED"
          ? `<span class="pick-pill tag-${item.actualResult}">${shortLabels[item.actualResult]}</span> ${escapeHtml(item.homeGoals)}-${escapeHtml(item.awayGoals)}`
          : `
            <div class="settle" data-id="${escapeHtml(item.id)}">
              <input data-role="homeGoals" type="text" inputmode="numeric" aria-label="Home goals" placeholder="Home">
              <input data-role="awayGoals" type="text" inputmode="numeric" aria-label="Away goals" placeholder="Away">
              <button data-role="settle" type="button">Settle</button>
            </div>
          `;

      return `
        <tr>
          <td>${escapeHtml(item.date || "")}</td>
          <td><span class="fixture">${escapeHtml(displayTeam(item.homeTeam))} vs ${escapeHtml(displayTeam(item.awayTeam))}</span><br><span class="muted">${escapeHtml(item.league)} | ${escapeHtml(item.source || "")}</span></td>
          <td><span class="pick-pill tag-${item.prediction}">${escapeHtml(pickText(item))}</span></td>
          <td>${escapeHtml(item.projectedScore || "N/A")}</td>
          <td>${Number(item.confidence || 0).toFixed(1)}%</td>
          <td>${resultCell}</td>
          <td>${status}</td>
        </tr>
      `;
    })
    .join("");
}

async function refreshLedger() {
  if (isInternationalMode()) {
    if (!hasCurrentInternationalFixtures()) {
      ledgerPredictions = [];
      resetInternationalSummary();
      ledgerBody.innerHTML = `<tr><td colspan="7" class="muted">${escapeHtml(seasonUnavailableMessage())}</td></tr>`;
      return;
    }
    const data = await api("/api/backtests");
    ledgerPredictions = (data.predictions || []).filter((entry) => entry.source === "international-fixture-board");
    const settled = ledgerPredictions.filter((entry) => entry.status === "SETTLED");
    const correct = settled.filter((entry) => entry.correct).length;
    const exact = settled.filter(scoreCorrect).length;
    updateSummary({
      total: ledgerPredictions.length,
      pending: ledgerPredictions.filter((entry) => entry.status !== "SETTLED").length,
      pickAccuracy: settled.length ? correct / settled.length : 0,
      scoreAccuracy: settled.length ? exact / settled.length : 0,
    });
    renderLedger(ledgerPredictions);
    return;
  }
  if (!isCurrentClubSeason()) {
    ledgerPredictions = [];
    updateSummary({ total: 0, pending: 0, pickAccuracy: 0, scoreAccuracy: 0 });
    ledgerBody.innerHTML = `<tr><td colspan="7" class="muted">${escapeHtml(seasonUnavailableMessage())}</td></tr>`;
    return;
  }
  const data = await api("/api/backtests");
  ledgerPredictions = data.predictions || [];
  updateSummary(data.summary);
  renderLedger();
}

async function refreshFixtureBoard() {
  if (isInternationalMode()) {
    await refreshInternationalFixtureBoard();
    resetInternationalSummary();
    return;
  }
  if (!isCurrentClubSeason()) {
    fixturePredictions = [];
    trackAllButton.disabled = true;
    boardLeagueFilter.innerHTML = `<option value="All">All leagues</option>`;
    boardLeagueFilter.value = "All";
    syncDateFilter(boardDateFilter, [], "");
    syncDateFilter(parlayDateFilter, [], "");
    document.querySelector("#boardTotal").textContent = "0";
    document.querySelector("#boardWithOdds").textContent = "0";
    document.querySelector("#boardModelOnly").textContent = "0";
    boardStatus.textContent = `${selectedSeason()} fixtures not available`;
    fixtureBoard.innerHTML = internationalEmptyState("Information not available", seasonUnavailableMessage());
    setBoardMessage("", "info");
    return;
  }
  setBoardMessage("Loading fixture predictions...", "info");
  trackAllButton.disabled = false;
  const previousLeague = boardLeagueFilter.value;
  const previousDate = boardDateFilter.value;
  const data = await api("/api/fixture-predictions");
  fixturePredictions = data.predictions;
  const refreshState = data.liveRefresh?.running
    ? "ESPN fixtures/results and Odds API prices are refreshing in the background; refresh again in a moment for newly matched odds."
    : data.liveRefresh?.cached
      ? "Using the latest cached ESPN/Odds API refresh; predictions blend market odds whenever a complete 1X2 line is available."
      : "Predictions blend model, table motivation, and market odds whenever a complete 1X2 line is available.";

  const leagues = [...new Set(fixturePredictions.map((prediction) => prediction.league))].sort();
  boardLeagueFilter.innerHTML = `<option value="All">All leagues</option>${leagues.map((league) => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}`;
  boardLeagueFilter.value = leagues.includes(previousLeague) ? previousLeague : "All";

  const dates = fixturePredictions.map((prediction) => prediction.date).filter(Boolean).sort();
  boardDateFilter.min = dates[0] || "";
  boardDateFilter.max = dates[dates.length - 1] || "";
  boardDateFilter.value = previousDate && dates.includes(previousDate) ? previousDate : "";
  syncDateFilter(parlayDateFilter, dates, parlayDateFilter.value);

  renderBoard();
  setBoardMessage(refreshState, "info");
}

async function refreshPlayedBoard() {
  if (isInternationalMode()) {
    renderInternationalPlayedBoard();
    return;
  }
  const previousLeague = playedLeagueFilter.value;
  const previousDate = playedDateFilter.value;
  const data = await api(`/api/played-fixtures?context=club&season=${encodeURIComponent(selectedSeason())}`);
  playedPredictions = data.predictions || [];
  playedPredictionsSeason = selectedSeason();

  const leagues = [...new Set(playedPredictions.map((prediction) => prediction.league))].sort();
  playedLeagueFilter.innerHTML = `<option value="All">All leagues</option>${leagues.map((league) => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}`;
  playedLeagueFilter.value = leagues.includes(previousLeague) ? previousLeague : "All";
  syncDateFilter(playedDateFilter, uniqueSortedDates(playedPredictions), previousDate);

  renderPlayedBoard();
}

function setFixtureLedgerSyncStatus(message, kind = "info") {
  if (!fixtureLedgerSyncStatus) return;
  fixtureLedgerSyncStatus.textContent = message;
  fixtureLedgerSyncStatus.dataset.kind = kind;
}

async function syncEspnResults({ force = false, background = false } = {}) {
  if (isInternationalMode() || !isCurrentClubSeason()) return null;
  if (!background) setFixtureLedgerSyncStatus("ESPN results sync: checking completed matches...", "info");
  if (syncEspnResultsButton) syncEspnResultsButton.disabled = true;
  try {
    const data = await api("/api/fixtures/espn-results-refresh", { method: "POST", body: JSON.stringify({ force }) });
    const cacheLabel = data.cached ? "cached" : "live";
    if (data.settled > 0) {
      setFixtureLedgerSyncStatus(`ESPN results sync: settled ${data.settled} fixture${data.settled === 1 ? "" : "s"} from ${data.fetched || 0} ${cacheLabel} results. Retraining queued.`, "info");
      await refreshLeagueTables();
      await refreshFixtureBoard();
      await refreshPlayedBoard();
      await refreshTrainingStatus();
    } else if (!background) {
      setFixtureLedgerSyncStatus(`ESPN results sync: no new pending ledger fixtures matched ${data.fetched || 0} completed ${cacheLabel} results.`, "info");
    }
    return data;
  } catch (error) {
    setFixtureLedgerSyncStatus(`ESPN results sync failed: ${error.message}`, "error");
    return null;
  } finally {
    if (syncEspnResultsButton) syncEspnResultsButton.disabled = false;
  }
}

async function refreshParlay({ forceNew = false } = {}) {
  if (isInternationalMode()) {
    if (!hasCurrentInternationalFixtures()) {
      renderInternationalParlay();
      return;
    }
    if (forceNew) parlayRefreshSeed += 1;
    const legs = encodeURIComponent(parlayLegCount.value);
    const tickets = encodeURIComponent(parlayTicketCount.value);
    const type = encodeURIComponent(parlayTypeSelect.value);
    const riskMode = encodeURIComponent(parlayRiskToggle.checked ? "risky" : "safe");
    const generationMode = encodeURIComponent(parlayLayoutToggle.checked ? "fixture-grid" : "multi");
    const date = encodeURIComponent(parlayDateFilter.value);
    setParlayMessage(forceNew ? "Building a fresh World Cup parlay variation..." : "Building World Cup parlays from fixtures and imported player baselines...", "info");
    const data = await api(`/api/parlay?context=international&league=International&legs=${legs}&tickets=${tickets}&type=${type}&riskMode=${riskMode}&generationMode=${generationMode}&date=${date}&refreshSeed=${parlayRefreshSeed}`);
    renderParlay(data);
    return;
  }
  if (!isCurrentClubSeason()) {
    currentParlays = [];
    parlayStatus.textContent = `${selectedSeason()} parlay generation is waiting for fixture imports`;
    setParlayMessage("", "info");
    trackParlaysButton.disabled = true;
    parlayOutput.innerHTML = internationalEmptyState("Information not available", seasonUnavailableMessage());
    return;
  }
  if (forceNew) parlayRefreshSeed += 1;
  const league = encodeURIComponent(parlayLeagueFilter.value);
  const legs = encodeURIComponent(parlayLegCount.value);
  const tickets = encodeURIComponent(parlayTicketCount.value);
  const type = encodeURIComponent(parlayTypeSelect.value);
  const riskMode = encodeURIComponent(parlayRiskToggle.checked ? "risky" : "safe");
  const generationMode = encodeURIComponent(parlayLayoutToggle.checked ? "fixture-grid" : "multi");
  const date = encodeURIComponent(parlayDateFilter.value);
  setParlayMessage(forceNew ? "Building a fresh parlay variation..." : "Building parlay from fixtures and imported player stats...", "info");
  const data = await api(`/api/parlay?context=club&league=${league}&legs=${legs}&tickets=${tickets}&type=${type}&riskMode=${riskMode}&generationMode=${generationMode}&date=${date}&refreshSeed=${parlayRefreshSeed}`);
  renderParlay(data);
}

async function refreshParlayLedger() {
  if (isInternationalMode()) {
    renderInternationalParlayLedger();
    return;
  }
  if (!isCurrentClubSeason()) {
    trackedParlayData = { parlays: [], summary: {} };
    parlayLedgerStatus.textContent = `${selectedSeason()} parlay ledger not available`;
    parlayAccuracyStats.innerHTML = "";
    parlayLedgerOutput.innerHTML = internationalEmptyState("Information not available", seasonUnavailableMessage());
    return;
  }
  const data = await api("/api/parlay-backtests");
  trackedParlayData = data;
  renderParlayLedger();
}

function renderApiFootballPlayerRefreshStatus(refresh) {
  if (!apiFootballStatus || !refresh) return;
  if (refresh.status === "UPDATED") {
    const cacheLabel = refresh.cached ? "cached" : "live";
    apiFootballStatus.textContent = `API-Football: ${cacheLabel} player stats synced for ${refresh.updatedProfiles || 0} profiles (${refresh.rowCount || 0} rows)`;
    return;
  }
  if (refresh.status === "BLOCKED_BY_PLAN") {
    apiFootballStatus.textContent = `API-Football: connected, but the Free plan cannot access ${refresh.apiSeason || selectedSeason()} current-season player stats. Existing trained/manual baselines remain active.`;
    return;
  }
  if (refresh.status === "FAILED") {
    apiFootballStatus.textContent = `API-Football: player refresh failed (${refresh.error || "unknown error"})`;
    return;
  }
  if (refresh.status === "RATE_LIMITED") {
    apiFootballStatus.textContent = `API-Football: rate limit reached while syncing ${refresh.season || selectedSeason()}. Cached or manual baselines remain active until the quota resets.`;
    return;
  }
  if (refresh.status === "CURRENT_SEASON_SKIPPED") {
    apiFootballStatus.textContent = `API-Football: current-season player sync is skipped on normal loads because the Free plan blocks 2025-26. Use Check API-Football to verify the key, or Refresh Profiles to force a check.`;
    return;
  }
  if (refresh.status === "UNAVAILABLE_SEASON") {
    apiFootballStatus.textContent = `API-Football: ${refresh.season || selectedSeason()} player stats are not available yet.`;
    return;
  }
  if (refresh.cached) {
    apiFootballStatus.textContent = `API-Football: using cached player refresh for ${refresh.season || selectedSeason()}`;
    return;
  }
  apiFootballStatus.textContent = `API-Football: no player rows returned for ${refresh.season || selectedSeason()}`;
}

async function refreshPlayerProfiles(options = {}) {
  const forceLive = Boolean(options.forceLive);
  if (!options.background) setPlayerProfileMessage(forceLive ? "Syncing API-Football player stats..." : "Loading player profiles...", "info");
  const query = new URLSearchParams({
    season: selectedSeason(),
    forceLive: forceLive ? "1" : "0",
  });
  playerProfileData = await api(`/api/player-profiles?${query.toString()}`);
  renderPlayerProfiles();
  renderApiFootballPlayerRefreshStatus(playerProfileData.liveRefresh);
  if (!options.background) {
    if (playerProfileData.liveRefresh?.changed) {
      setPlayerProfileMessage("API-Football player stats changed. Continuous training has been queued with the updated profile baseline.", "info");
      await refreshTrainingStatus();
    } else {
      setPlayerProfileMessage("", "info");
    }
  }
}

async function checkApiFootballStatus() {
  if (!apiFootballStatus || !checkApiFootballButton) return;
  const originalText = checkApiFootballButton.textContent;
  checkApiFootballButton.disabled = true;
  checkApiFootballButton.textContent = "Checking...";
  apiFootballStatus.textContent = "API-Football: checking connection...";
  try {
    const status = await api("/api/live/api-football/status");
    if (!status.connected) {
      apiFootballStatus.textContent = `API-Football: not connected. ${status.message || "Set the API key locally."}`;
      return;
    }
    const plan = status.subscription?.plan || "plan unknown";
    const current = Number(status.requests?.current || 0);
    const dailyLimit = Number(status.requests?.limit_day || 0);
    const requestText = dailyLimit ? `${current}/${dailyLimit} requests used today` : `${current} requests used today`;
    apiFootballStatus.textContent = `API-Football: connected (${plan}) | ${requestText}`;
  } catch (error) {
    apiFootballStatus.textContent = `API-Football: connection failed (${error.message})`;
  } finally {
    checkApiFootballButton.disabled = false;
    checkApiFootballButton.textContent = originalText;
  }
}

async function refreshTeamProfiles() {
  if (!teamProfileGrid) return;
  setTeamProfileMessage("Loading team profiles...", "info");
  if (!isInternationalMode() && !leagueTableData) {
    try {
      leagueTableData = await api(`/api/league-tables?season=${encodeURIComponent(selectedSeason())}`);
    } catch {
      leagueTableData = null;
    }
  }
  teamProfileData = await api(`/api/team-profiles?season=${encodeURIComponent(selectedSeason())}&context=${encodeURIComponent(currentAppContext())}`);
  renderTeamProfiles();
  setTeamProfileMessage("", "info");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isInternationalMode()) {
    setInternationalSingleDemo();
    return;
  }
  const button = form.querySelector("button[type='submit']");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Predicting...";
  showMessage("Calculating prediction...", "info");
  try {
    const body = formJson(form);
    body.save = form.save.checked;
    const data = await api("/api/predict", { method: "POST", body: JSON.stringify(body) });
    renderPrediction(data.prediction);
    updateSummary(data.summary);
    await refreshLedger();
  } catch (error) {
    showMessage(error.name === "AbortError" ? "Prediction request timed out. The server may need a restart." : error.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});

trackAllButton.addEventListener("click", async () => {
  const originalText = trackAllButton.textContent;
  trackAllButton.disabled = true;
  trackAllButton.textContent = "Tracking...";
  setBoardMessage("Saving fixture-board predictions to the backtest ledger...", "info");
  try {
    const data = await api("/api/fixture-predictions/backtest", {
      method: "POST",
      body: JSON.stringify({ league: boardLeagueFilter.value, date: boardDateFilter.value, context: currentAppContext() }),
    });
    updateSummary(data.summary);
    await refreshLedger();
    setBoardMessage(data.saved.length ? `Added ${data.saved.length} predictions to the ledger.` : "These fixture-board predictions are already being tracked.", "info");
  } catch (error) {
    setBoardMessage(error.name === "AbortError" ? "Saving predictions timed out." : error.message, "error");
  } finally {
    trackAllButton.disabled = isInternationalMode() ? !hasCurrentInternationalFixtures() || !fixturePredictions.length : !isCurrentClubSeason();
    trackAllButton.textContent = originalText;
  }
});

fixtureBoard.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-select-prediction]");
  if (!button) return;
  const prediction = fixturePredictions.find((item) => predictionKey(item) === button.dataset.selectPrediction);
  if (!prediction) {
    setBoardMessage("That prediction is no longer available. Refresh the prediction board and try again.", "error");
    return;
  }
  const leg = predictionSlipLeg(prediction);
  addLegToParlaySlip(leg, { sourceParlay: { name: selectedParlaySlip.name || "Custom Prediction Slip", riskMode: parlayRiskToggle?.checked ? "risky" : "safe" } });
  renderBoard();
  setBoardMessage(`Added ${pickText(prediction)} from ${displayTeam(prediction.homeTeam)} vs ${displayTeam(prediction.awayTeam)} to the parlay slip.`, "info");
});

ledgerBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-role='settle']");
  if (!button) return;
  const row = button.closest("[data-id]");
  const id = row.dataset.id;
  const homeGoals = row.querySelector("[data-role='homeGoals']").value;
  const awayGoals = row.querySelector("[data-role='awayGoals']").value;
  await api(`/api/backtests/${id}/result`, {
    method: "PATCH",
    body: JSON.stringify({ homeGoals, awayGoals }),
  });
  await refreshLedger();
  await refreshLeagueTables();
  await refreshFixtureBoard();
  await refreshPlayedBoard();
  await refreshTrainingStatus();
});

document.querySelector("#refreshButton").addEventListener("click", refreshLedger);
syncEspnResultsButton?.addEventListener("click", async () => {
  await syncEspnResults({ force: true });
  await refreshLedger();
});
leagueSelect.addEventListener("change", updateTeamList);
singleCompetitionSelect?.addEventListener("change", () => {
  if (!isInternationalMode()) return;
  setInternationalSingleDemo();
});
boardLeagueFilter.addEventListener("change", renderBoard);
boardDateFilter.addEventListener("change", renderBoard);
clearBoardDateButton.addEventListener("click", () => {
  boardDateFilter.value = "";
  renderBoard();
});
boardSortSelect.addEventListener("change", renderBoard);
playedLeagueFilter.addEventListener("change", renderPlayedBoard);
playedDateFilter.addEventListener("change", renderPlayedBoard);
clearPlayedDateButton.addEventListener("click", () => {
  playedDateFilter.value = "";
  renderPlayedBoard();
});
refreshPlayedButton.addEventListener("click", refreshPlayedBoard);
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
seasonSelect?.addEventListener("change", async () => {
  persistSelectedSeason();
  updateContextLabels();
  if (isInternationalMode()) {
    await renderInternationalContext();
  } else {
    await renderClubContext();
  }
});
refreshParlayButton.addEventListener("click", () => refreshParlay({ forceNew: true }));
parlayOutput.addEventListener("click", async (event) => {
  const ticketSelectButton = event.target.closest("button[data-select-ticket]");
  if (ticketSelectButton) {
    const parlay = currentParlays.find((ticket) => ticket.id === ticketSelectButton.dataset.selectTicket);
    if (!parlay) {
      setParlayMessage("This parlay option is no longer available. Refresh parlays and try again.", "error");
      return;
    }
    selectParlayForSlip(parlay);
    return;
  }

  const legSelectButton = event.target.closest("button[data-select-leg][data-leg-index]");
  if (legSelectButton) {
    const parlay = currentParlays.find((ticket) => ticket.id === legSelectButton.dataset.selectLeg);
    const leg = parlay?.legs?.[Number(legSelectButton.dataset.legIndex)];
    if (!leg) {
      setParlayMessage("This leg is no longer available. Refresh parlays and try again.", "error");
      return;
    }
    addLegToParlaySlip(leg, { sourceParlay: { name: selectedParlaySlip.name || "Custom Parlay Slip", riskMode: parlay.riskMode } });
    renderParlayTickets();
    setParlayMessage(`Added ${leg.pick} to the potential parlay slip.`, "info");
    return;
  }

  const button = event.target.closest("button[data-track-ticket]");
  if (!button) return;
  const parlay = currentParlays.find((ticket) => ticket.id === button.dataset.trackTicket);
  if (!parlay) {
    setParlayMessage("This parlay option is no longer available. Refresh parlays and try again.", "error");
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Tracking...";
  try {
    const data = await api("/api/parlay/backtest", {
      method: "POST",
      body: JSON.stringify({ parlays: [parlay] }),
    });
    setParlayMessage(data.saved.length ? `Added ${parlay.name} to the parlay backtest ledger. Use Hit/Miss below after the real results come in.` : "That parlay option is already tracked.", "info");
    await refreshParlayLedger();
    await refreshPlayedBoard();
  } catch (error) {
    setParlayMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
trackParlaysButton.addEventListener("click", async () => {
  const originalText = trackParlaysButton.textContent;
  trackParlaysButton.disabled = true;
  trackParlaysButton.textContent = "Tracking...";
  try {
    const data = await api("/api/parlay/backtest", {
      method: "POST",
      body: JSON.stringify({ parlays: currentParlays }),
    });
    setParlayMessage(data.saved.length ? `Added ${data.saved.length} generated parlay option${data.saved.length === 1 ? "" : "s"} to the backtest ledger.` : "These generated parlays are already tracked.", "info");
    await refreshParlayLedger();
    await refreshPlayedBoard();
  } catch (error) {
    setParlayMessage(error.message, "error");
  } finally {
    trackParlaysButton.disabled = false;
    trackParlaysButton.textContent = originalText;
  }
});
parlayStakeInput?.addEventListener("input", renderParlaySlip);
clearParlaySlipButton?.addEventListener("click", () => {
  selectedParlaySlip = { name: "Custom Parlay Slip", sourceParlayId: "", legs: [], context: currentAppContext(), riskMode: parlayRiskToggle?.checked ? "risky" : "safe" };
  saveParlaySlip();
  renderParlayTickets();
  renderParlaySlip();
  setParlaySlipMessage("Slip cleared.", "info");
});
parlaySlipOutput?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-remove-slip-leg]");
  if (!button) return;
  removeSlipLeg(button.dataset.removeSlipLeg);
  setParlaySlipMessage("Selection removed from slip.", "info");
});
trackParlaySlipButton?.addEventListener("click", async () => {
  if (!selectedParlaySlip.legs.length) {
    setParlaySlipMessage("Add selections before tracking this slip.", "error");
    return;
  }
  const originalText = trackParlaySlipButton.textContent;
  trackParlaySlipButton.disabled = true;
  trackParlaySlipButton.textContent = "Tracking...";
  try {
    const data = await api("/api/parlay/backtest", {
      method: "POST",
      body: JSON.stringify({ parlays: [parlaySlipForTracking()] }),
    });
    setParlaySlipMessage(data.saved.length ? "Selected slip added to the parlay backtest ledger." : "This selected slip is already tracked.", "info");
    await refreshParlayLedger();
  } catch (error) {
    setParlaySlipMessage(error.message, "error");
  } finally {
    trackParlaySlipButton.disabled = false;
    trackParlaySlipButton.textContent = originalText;
  }
});
parlayLeagueFilter.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlayDateFilter.addEventListener("change", () => refreshParlay({ forceNew: true }));
clearParlayDateButton.addEventListener("click", () => {
  parlayDateFilter.value = "";
  refreshParlay({ forceNew: true });
});
parlayLegCount.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlayTicketCount.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlayTypeSelect.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlayRiskToggle.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlayLayoutToggle.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlaySortSelect.addEventListener("change", renderParlayTickets);
refreshParlayLedgerButton.addEventListener("click", refreshParlayLedger);
checkApiFootballButton?.addEventListener("click", checkApiFootballStatus);
refreshPlayerProfilesButton.addEventListener("click", () => refreshPlayerProfiles({ forceLive: true }));
refreshTeamProfilesButton?.addEventListener("click", refreshTeamProfiles);
refreshLeagueTablesButton?.addEventListener("click", refreshLeagueTables);
leagueTableLeagueFilter?.addEventListener("change", renderLeagueTables);
refreshFuturesButton?.addEventListener("click", refreshFutures);
futuresLeagueFilter?.addEventListener("change", refreshFutures);
futuresMarketFilter?.addEventListener("change", renderFutures);
pageSelect?.addEventListener("change", () => showPage(pageSelect.value));
playerProfileSelect.addEventListener("change", () => {
  setPlayerFormMode(null);
  renderPlayerProfiles();
  autofillTrainingFixture();
});
playerStatForm.elements.date.addEventListener("change", () => {
  if (!editingPlayerStatEntry) autofillTrainingFixture();
});
playerProfileGrid.addEventListener("click", (event) => {
  const editButton = event.target.closest(".profile-entry-edit-button[data-profile-id][data-entry-id]");
  if (editButton) {
    const profile = (playerProfileData.profiles || []).find((item) => item.id === editButton.dataset.profileId);
    const view = profile ? activeProfileView(profile) : null;
    const entry = (view?.latestEntries || []).find((item) => item.id === editButton.dataset.entryId);
    if (profile && entry) fillPlayerStatFormFromEntry(profile, entry);
    return;
  }
  if (event.target.closest("a, button, input, select, textarea")) return;
  const card = event.target.closest(".player-profile-card[data-profile-id]");
  if (!card) return;
  setPlayerFormMode(null);
  playerProfileSelect.value = card.dataset.profileId;
  renderPlayerProfiles();
  autofillTrainingFixture();
  playerStatForm.scrollIntoView({ behavior: "smooth", block: "start" });
});
playerProfileGrid.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest(".player-profile-card[data-profile-id]");
  if (!card) return;
  event.preventDefault();
  setPlayerFormMode(null);
  playerProfileSelect.value = card.dataset.profileId;
  renderPlayerProfiles();
  autofillTrainingFixture();
  playerProfileSelect.focus({ preventScroll: true });
});
teamProfileSelect?.addEventListener("change", () => {
  setTeamFormMode(null);
  renderTeamProfiles();
  autofillTeamTrainingFixture();
});
teamStatForm?.elements.date?.addEventListener("change", () => {
  autofillTeamTrainingFixture();
});
teamProfileGrid?.addEventListener("click", (event) => {
  const editButton = event.target.closest(".profile-entry-edit-button[data-team-profile-id][data-entry-id]");
  if (editButton) {
    const profile = (teamProfileData.profiles || []).find((item) => item.id === editButton.dataset.teamProfileId);
    const entry = (profile?.latestEntries || []).find((item) => item.id === editButton.dataset.entryId);
    if (profile && entry) fillTeamStatFormFromEntry(profile, entry);
    return;
  }
  if (event.target.closest("a, button, input, select, textarea")) return;
  const card = event.target.closest(".team-profile-card[data-team-profile-id]");
  if (!card) return;
  setTeamFormMode(null);
  teamProfileSelect.value = card.dataset.teamProfileId;
  renderTeamProfiles();
  teamStatForm.scrollIntoView({ behavior: "smooth", block: "start" });
});
teamProfileGrid?.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest(".team-profile-card[data-team-profile-id]");
  if (!card) return;
  event.preventDefault();
  setTeamFormMode(null);
  teamProfileSelect.value = card.dataset.teamProfileId;
  renderTeamProfiles();
  teamProfileSelect.focus({ preventScroll: true });
});
appContextToggle.addEventListener("change", () => {
  applyAppContext();
});
playerStatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = playerStatForm.querySelector("button[type='submit']");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = editingPlayerStatEntry ? "Updating..." : "Saving...";
  try {
    const body = formJson(playerStatForm);
    body.context = currentProfileContext();
    body.started = Boolean(playerStatForm.elements.started.checked);
    const isEditing = Boolean(editingPlayerStatEntry?.id);
    const endpoint = isEditing
      ? `/api/player-profiles/${encodeURIComponent(editingPlayerStatEntry.profileId)}/stats/${encodeURIComponent(editingPlayerStatEntry.id)}`
      : `/api/player-profiles/${encodeURIComponent(body.profileId)}/stats`;
    const data = await api(endpoint, {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    playerProfileData = data.profiles;
    setPlayerFormMode(null);
    renderPlayerProfiles();
    setPlayerProfileMessage(isEditing ? "Player stat entry updated. Continuous training has been queued with the corrected profile data." : "Player stat entry saved. Continuous training has been queued so future fixture predictions can use the updated profile.", "info");
    await refreshTrainingStatus();
    playerStatForm.reset();
    playerProfileSelect.value = body.profileId;
    playerStatForm.elements.minutes.value = "90";
    ["shots", "shotsOnTarget", "goals", "assists", "saves"].forEach((name) => {
      playerStatForm.elements[name].value = "0";
    });
  } catch (error) {
    setPlayerProfileMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
teamStatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = teamStatForm.querySelector("button[type='submit']");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = editingTeamStatEntry ? "Updating..." : "Saving...";
  try {
    const body = formJson(teamStatForm);
    body.season = selectedSeason();
    body.context = currentAppContext();
    body.cleanSheet = Boolean(teamStatForm.elements.cleanSheet.checked);
    const isEditing = Boolean(editingTeamStatEntry?.id);
    const endpoint = isEditing
      ? `/api/team-profiles/${encodeURIComponent(editingTeamStatEntry.profileId)}/stats/${encodeURIComponent(editingTeamStatEntry.id)}`
      : `/api/team-profiles/${encodeURIComponent(body.profileId)}/stats`;
    const data = await api(endpoint, {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    teamProfileData = data.profiles;
    setTeamFormMode(null);
    renderTeamProfiles();
    setTeamProfileMessage(isEditing ? "Team stat entry updated. Current prediction features will use the corrected team profile data." : "Team stat entry saved. Current prediction features will layer this team profile data into future judgments.", "info");
    await refreshTrainingStatus();
    teamStatForm.reset();
    teamProfileSelect.value = body.profileId;
    [
      "goalsFor",
      "goalsAgainst",
      "expectedGoalsFor",
      "expectedGoalsAgainst",
      "shotsFor",
      "shotsAgainst",
      "shotsOnTargetFor",
      "shotsOnTargetAgainst",
      "sga",
      "cornersFor",
      "cornersAgainst",
      "setPieceGoalsFor",
      "setPieceGoalsAgainst",
      "possession",
      "restDays",
    ].forEach((name) => {
      teamStatForm.elements[name].value = "0";
    });
    teamStatForm.elements.result.value = "W";
  } catch (error) {
    setTeamProfileMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
});
pageTabs.forEach((tab) => {
  tab.addEventListener("click", () => showPage(tab.dataset.pageTarget));
});
parlayLedgerOutput.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-status]");
  if (!button) return;
  const row = button.closest("[data-parlay-id][data-leg-id]");
  const data = await api(`/api/parlay-backtests/${row.dataset.parlayId}/legs/${row.dataset.legId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: button.dataset.status }),
  });
  if (data.updated?.affectedLegs > 1) {
    setParlayMessage(`Synced ${data.updated.affectedLegs} matching pick instances across ${data.updated.affectedParlays} parlay options.`, "info");
  }
  await refreshParlayLedger();
  await refreshParlay();
  if (data.updated?.newlyMissedParlays > 0) {
    setParlayMessage(`Parlay missed. Retraining has started, and new parlay options were regenerated without ${data.updated.playedFixture?.fixture || "that played fixture"}.`, "info");
  }
  await refreshLeagueTables();
  await refreshFixtureBoard();
  await refreshPlayedBoard();
  await refreshTrainingStatus();
});

authSignInTab?.addEventListener("click", () => setAuthMode("signin"));
authSignUpTab?.addEventListener("click", () => setAuthMode("signup"));

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authConfig.enabled) {
    if (authMessage) authMessage.textContent = "Supabase sign-in is not configured for this deployment yet.";
    return;
  }

  const email = authEmail?.value?.trim();
  const password = authPassword?.value || "";
  if (!email || !password) return;

  if (authSubmitButton) authSubmitButton.disabled = true;
  if (authMessage) authMessage.textContent = authMode === "signup" ? "Creating your account..." : "Signing you in...";

  try {
    if (authMode === "signup") {
      const data = await supabaseAuthRequest("signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          data: { display_name: authDisplayName?.value?.trim() || "" },
        }),
      });
      if (!data.access_token) {
        if (authMessage) authMessage.textContent = "Account created. Check your email to confirm before signing in.";
        setAuthMode("signin");
        return;
      }
      await applyAuthenticatedSession(data);
      return;
    }

    const data = await supabaseAuthRequest("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await applyAuthenticatedSession(data);
  } catch (error) {
    if (authMessage) authMessage.textContent = error.message || "Unable to sign in. Check the email and password.";
  } finally {
    if (authSubmitButton) authSubmitButton.disabled = false;
  }
});

signOutButton?.addEventListener("click", () => {
  saveAuthSession(null);
  showAuthGate("You signed out.");
});

async function loadAppData() {
  if (appDataLoaded) return;
  appDataLoaded = true;
  try {
    meta = await api("/api/meta");
    renderModelMeta(meta, meta.trainingStatus);
    updateTeamList();
    if (!isHostedPublic()) {
      await refreshPlayerProfiles();
      await refreshTeamProfiles();
    }
    if (isInternationalMode()) {
      await refreshInternationalStatus();
      await renderInternationalContext();
    } else {
      await refreshFixtureBoard();
      await refreshParlay();
      await refreshLeagueTables();
      if (!isHostedPublic()) {
        await refreshPlayedBoard();
        await refreshParlayLedger();
        await refreshLedger();
      }
    }
  } catch (error) {
    appDataLoaded = false;
    document.querySelector("#modelMeta").textContent = "Unable to load model status";
    setBoardMessage(error.name === "AbortError" ? "The app could not reach the local prediction server." : error.message, "error");
    showMessage(error.name === "AbortError" ? "The app could not reach the local prediction server." : error.message);
  }
}

async function init() {
  try {
    initTheme();
    initContextMode();
    updateSeasonOptions();
    updateContextLabels();
    updateContextNavigation();
    loadParlaySlip();
    renderParlaySlip();
    showPage(location.hash.replace("#", "") || "predictions");
    if (await initAuth()) await loadAppData();
  } catch (error) {
    document.querySelector("#modelMeta").textContent = "Unable to load model status";
    setBoardMessage(error.name === "AbortError" ? "The app could not reach the local prediction server." : error.message, "error");
    showMessage(error.name === "AbortError" ? "The app could not reach the local prediction server." : error.message);
  }
}

init();

window.setInterval(() => {
  if (document.visibilityState === "hidden") return;
  if (isHostedPublic()) return;
  if (authConfig.hostedMode && authConfig.enabled && !authSession) return;
  refreshPlayerProfiles({ background: true }).catch(() => {});
}, 15 * 60 * 1000);

window.setInterval(() => {
  if (document.visibilityState === "hidden") return;
  if (isHostedPublic()) return;
  if (authConfig.hostedMode && authConfig.enabled && !authSession) return;
  syncEspnResults({ background: true }).then((data) => {
    if (data?.settled > 0) refreshLedger();
  }).catch(() => {});
}, 3 * 60 * 1000);
