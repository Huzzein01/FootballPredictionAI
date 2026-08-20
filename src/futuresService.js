const fs = require("fs");
const path = require("path");
const { archivedLeagueTables } = require("./leagueTableService");
const { readFixtureData, internationalGroupTables } = require("./internationalData");
const { listPlayerProfiles } = require("./playerProfileStore");
const { listTeamProfiles } = require("./teamProfileStore");
const { loadMatches, normalizeTeamName } = require("./footballData");
const { aggregatePlayers, loadPlayerRows } = require("./playerStats");
const { lookupMatchOdds } = require("./oddsApiService");

const CLUB_LEAGUES = ["EPL", "La Liga", "Bundesliga", "Ligue 1", "Serie A"];
const HISTORICAL_SEASONS = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2025-26"];
const UEFA_DATA_ROOT = process.env.UEFA_DATA_ROOT || path.join(process.cwd(), "data", "uefa");
const UEFA_SEASONS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"];
const UEFA_COMPETITION_FILES = {
  "Champions League": ["cl.txt", "clq.txt"],
  "Europa League": ["el.txt", "elq.txt"],
  "Conference League": ["conf.txt", "confq.txt"],
};
const DOMESTIC_CUPS = {
  EPL: [
    { id: "fa-cup", name: "FA Cup", notes: "Open to all English football clubs. Third round begins in January." },
    { id: "carabao-cup", name: "Carabao Cup", notes: "Also known as the EFL Cup or League Cup." },
  ],
  "La Liga": [
    { id: "copa-del-rey", name: "Copa del Rey", notes: "Spain's primary domestic knockout cup competition." },
    { id: "supercopa-espana", name: "Supercopa de España", notes: "Four-team mini-tournament held in January." },
  ],
  Bundesliga: [
    { id: "dfb-pokal", name: "DFB-Pokal", notes: "Germany's premier domestic cup competition." },
  ],
  "Ligue 1": [
    { id: "coupe-de-france", name: "Coupe de France", notes: "Open to all French football clubs." },
  ],
  "Serie A": [
    { id: "coppa-italia", name: "Coppa Italia", notes: "Italy's domestic cup with group stage format for top clubs." },
  ],
};

const CUP_ROUNDS = {
  "fa-cup": ["Third Round", "Fourth Round", "Fifth Round", "Quarter-Finals", "Semi-Finals", "Final"],
  "carabao-cup": ["Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
  "copa-del-rey": ["Round of 32", "Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
  "supercopa-espana": ["Semi-Finals", "Final"],
  "dfb-pokal": ["First Round", "Second Round", "Quarter-Finals", "Semi-Finals", "Final"],
  "coupe-de-france": ["Round of 32", "Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
  "coppa-italia": ["Round of 16", "Quarter-Finals", "Semi-Finals", "Final"],
};

// Standings projection formula ("Weighted Recency-Adjusted Rating"):
//   1. For each of the last 6 seasons, compute PPG, GF/match, GA/match, GD/match.
//   2. Weight season i by (1 + 0.25*i) so recent seasons count more (season
//      weights range 1.0 -> 2.25 across the 2020-21..2025-26 window).
//   3. rating = Σ(weight * (PPG*38 + GD*10 + GF*5 - GA*4 + top-4 bonus)) / Σ(weight)
//   4. Promoted teams use the same formula against their last two second-tier
//      seasons, compressed by ~0.6-0.68x (fewer points/goals translate up a tier).
//   5. The weighted PPG/GF/GA are then projected across a full season's match
//      count (38, or 34 for Bundesliga) to produce Played, Wins, Draws, Losses,
//      Points, GF, GA, and GD for every team, then sorted into a final table.
const STANDINGS_METHODOLOGY =
  "Weighted Recency-Adjusted Rating (WRAR): multi-season PPG, goal-difference/match, and goals-for/match are weighted by recency (weight = 1 + 0.25 x seasons-ago) and blended into a composite rating. The rating implies a season PPG/GF/GA baseline that is projected across the full match calendar (38 games, 34 for Bundesliga) to produce Played, Won, Drawn, Lost, GF, GA, GD, and Points for every team. Promoted teams use the same formula scaled from their last two second-tier seasons.";

const NEXT_SEASON_RULES = {
  EPL: { relegatedCount: 3, promotedCount: 3, secondTierCode: "eng.2", secondTierName: "Championship" },
  "La Liga": { relegatedCount: 3, promotedCount: 3, secondTierCode: "esp.2", secondTierName: "LaLiga 2" },
  Bundesliga: { relegatedCount: 2, promotedCount: 2, secondTierCode: "ger.2", secondTierName: "2. Bundesliga" },
  "Ligue 1": { relegatedCount: 2, promotedCount: 2, secondTierCode: "fra.2", secondTierName: "Ligue 2" },
  "Serie A": { relegatedCount: 3, promotedCount: 3, secondTierCode: "ita.2", secondTierName: "Serie B" },
};

const TEAM_SCORER_CANDIDATES = {
  EPL: {
    Arsenal: ["Viktor Gyokeres", "Bukayo Saka"],
    "Man City": ["Erling Haaland", "Phil Foden"],
    "Man United": ["Benjamin Sesko", "Matheus Cunha", "Bruno Fernandes"],
    "Aston Villa": ["Ollie Watkins"],
    Liverpool: ["Alexander Isak", "Dominik Szoboszlai"],
    Bournemouth: ["Evanilson"],
    Brighton: ["Kaoru Mitoma", "Danny Welbeck"],
    Chelsea: ["Cole Palmer"],
    Brentford: ["Igor Thiago", "Kevin Schade"],
    Sunderland: ["Wilson Isidor"],
    "Newcastle United": ["Anthony Gordon", "Harvey Barnes"],
    Everton: ["Beto"],
    Fulham: ["Raul Jimenez"],
    "Leeds United": ["Joel Piroe"],
    "Crystal Palace": ["Jean-Philippe Mateta"],
    "Nott'm Forest": ["Chris Wood"],
    Tottenham: ["Dominic Solanke", "Brennan Johnson"],
    "West Ham United": ["Jarrod Bowen"],
    Burnley: ["Lyle Foster"],
    "Wolverhampton Wanderers": ["Jorgen Strand Larsen"],
    "Coventry City": ["Haji Wright"],
    "Ipswich Town": ["George Hirst"],
    Millwall: ["Mihailo Ivanovic"],
  },
  "La Liga": {
    Barcelona: ["Raphinha", "Lamine Yamal", "Fermin Lopez"],
    "Real Madrid": ["Kylian Mbappe", "Vinicius Junior", "Jude Bellingham"],
    Villarreal: ["Ayoze Perez"],
    "Ath Madrid": ["Julian Alvarez", "Antoine Griezmann"],
    Betis: ["Antony"],
    "Celta Vigo": ["Iago Aspas"],
    Getafe: ["Borja Mayoral"],
    "Rayo Vallecano": ["Alvaro Garcia"],
    Valencia: ["Hugo Duro"],
    "Real Sociedad": ["Mikel Oyarzabal"],
    Espanyol: ["Javi Puado"],
    "Ath Bilbao": ["Inaki Williams", "Nico Williams"],
    "Alavés": ["Kike Garcia"],
    Sevilla: ["Isaac Romero"],
    Osasuna: ["Ante Budimir"],
    Elche: ["Rafa Mir"],
    Levante: ["Jose Luis Morales"],
    Girona: ["Cristhian Stuani"],
    Mallorca: ["Vedat Muriqi"],
    Oviedo: ["Santi Cazorla"],
    "Racing Santander": ["Andres Martin"],
    "Deportivo La Coruña": ["Lucas Perez"],
    "Almería": ["Luis Suarez"],
  },
  Bundesliga: {
    "Bayern Munich": ["Harry Kane", "Michael Olise", "Jamal Musiala"],
    "Borussia Dortmund": ["Serhou Guirassy"],
    "RB Leipzig": ["Lois Openda"],
    "VfB Stuttgart": ["Deniz Undav"],
    "TSG Hoffenheim": ["Andrej Kramaric"],
    "Bayer Leverkusen": ["Patrik Schick", "Florian Wirtz"],
    "SC Freiburg": ["Vincenzo Grifo"],
    "Eintracht Frankfurt": ["Omar Marmoush"],
    "FC Augsburg": ["Ermedin Demirovic"],
    Mainz: ["Jonathan Burkardt"],
    "1. FC Union Berlin": ["Benedict Hollerbach"],
    "Borussia Mönchengladbach": ["Tim Kleindienst"],
    "Hamburg SV": ["Robert Glatzel"],
    "FC Koln": ["Davie Selke"],
    "Werder Bremen": ["Marvin Ducksch"],
    "VfL Wolfsburg": ["Jonas Wind"],
    "1. FC Heidenheim 1846": ["Marvin Pieringer"],
    "St. Pauli": ["Oladapo Afolayan"],
    "Schalke 04": ["Kenan Karaman"],
    "SV 07 Elversberg": ["Fisnik Asllani"],
  },
  "Ligue 1": {
    "Paris SG": ["Ousmane Dembele", "Desire Doue", "Khvicha Kvaratskhelia"],
    Lens: ["Florian Sotoca"],
    Lille: ["Jonathan David"],
    Lyon: ["Alexandre Lacazette"],
    Marseille: ["Pierre-Emerick Aubameyang"],
    "Stade Rennais": ["Arnaud Kalimuendo"],
    "AS Monaco": ["Folarin Balogun"],
    Strasbourg: ["Emanuel Emegha"],
    Lorient: ["Eli Junior Kroupi"],
    Toulouse: ["Thijs Dallinga"],
    "Paris FC": ["Jean-Philippe Krasso"],
    Brest: ["Ludovic Ajorque"],
    Angers: ["Himad Abdelli"],
    "Le Havre AC": ["Emmanuel Sabbi"],
    "AJ Auxerre": ["Lassine Sinayoko"],
    Nice: ["Terem Moffi"],
    Nantes: ["Mostafa Mohamed"],
    Metz: ["Georges Mikautadze"],
    Troyes: ["Rafiki Said"],
    "Le Mans": ["Antoine Rabillard"],
  },
  "Serie A": {
    "Inter Milan": ["Marcus Thuram", "Lautaro Martinez"],
    Napoli: ["Victor Osimhen", "Romelu Lukaku"],
    "AS Roma": ["Paulo Dybala"],
    "AC Milan": ["Rafael Leao"],
    Como: ["Patrick Cutrone"],
    Juventus: ["Dusan Vlahovic"],
    Atalanta: ["Ademola Lookman"],
    Bologna: ["Riccardo Orsolini"],
    Lazio: ["Mattia Zaccagni"],
    Udinese: ["Lorenzo Lucca"],
    Sassuolo: ["Domenico Berardi"],
    Torino: ["Duvan Zapata"],
    Parma: ["Dennis Man"],
    Genoa: ["Mateo Retegui"],
    Fiorentina: ["Moise Kean"],
    Cagliari: ["Zito Luvumbo"],
    Lecce: ["Nikola Krstovic"],
    Cremonese: ["Massimo Coda"],
    "Hellas Verona": ["Casper Tengstedt"],
    Pisa: ["Stefano Moreo"],
    Venezia: ["Joel Pohjanpalo"],
    Frosinone: ["Gennaro Borrelli"],
    Monza: ["Dany Mota"],
  },
};

const TEAM_ASSIST_CANDIDATES = {
  Arsenal: "Bukayo Saka",
  "Man City": "Phil Foden",
  "Man United": "Bruno Fernandes",
  Liverpool: "Dominik Szoboszlai",
  Chelsea: "Cole Palmer",
  Brighton: "Kaoru Mitoma",
  Brentford: "Mikkel Damsgaard",
  Tottenham: "James Maddison",
  "Newcastle United": "Anthony Gordon",
  Bournemouth: "Marcus Tavernier",
  Barcelona: "Lamine Yamal",
  "Real Madrid": "Jude Bellingham",
  "Celta Vigo": "Iago Aspas",
  Getafe: "Luis Milla",
  "Rayo Vallecano": "Alvaro Garcia",
  "Bayern Munich": "Michael Olise",
  "TSG Hoffenheim": "Andrej Kramaric",
  "Bayer Leverkusen": "Florian Wirtz",
  "SC Freiburg": "Vincenzo Grifo",
  "Paris SG": "Ousmane Dembele",
  Marseille: "Pierre-Emerick Aubameyang",
  Lyon: "Rayan Cherki",
  "Stade Rennais": "Ludovic Blas",
  "Inter Milan": "Marcus Thuram",
  Juventus: "Kenan Yildiz",
  Como: "Nico Paz",
  Atalanta: "Ademola Lookman",
};

const TEAM_GOALKEEPER_CANDIDATES = {
  EPL: {
    Arsenal: "David Raya", "Man City": "Ederson", "Man United": "Altay Bayindir",
    "Aston Villa": "Emiliano Martinez", Liverpool: "Alisson", Bournemouth: "Djordje Petrovic",
    Brighton: "Bart Verbruggen", Chelsea: "Robert Sanchez", Brentford: "Caoimhin Kelleher",
    Sunderland: "Robin Roefs", "Newcastle United": "Nick Pope", Everton: "Jordan Pickford",
    Fulham: "Bernd Leno", "Leeds United": "Lucas Perri", "Crystal Palace": "Dean Henderson",
    "Nott'm Forest": "Matz Sels", Tottenham: "Guglielmo Vicario", "West Ham United": "Alphonse Areola",
    Burnley: "Max Weiss", "Wolverhampton Wanderers": "Jose Sa", "Coventry City": "Ben Wilson",
    "Ipswich Town": "Alex Palmer", Millwall: "Liam Roberts",
  },
  "La Liga": {
    Barcelona: "Joan Garcia", "Real Madrid": "Thibaut Courtois", Villarreal: "Luiz Junior",
    "Ath Madrid": "Jan Oblak", Betis: "Adrian", "Celta Vigo": "Vicente Guaita", Getafe: "David Soria",
    "Rayo Vallecano": "Augusto Batalla", Valencia: "Giorgi Mamardashvili", "Real Sociedad": "Alex Remiro",
    Espanyol: "Fernando Pacheco", "Ath Bilbao": "Unai Simon", "Alavés": "Antonio Sivera",
    Sevilla: "Alfonso Herrero", Osasuna: "Sergio Herrera", Elche: "Matthieu Dreyer",
    Levante: "Andres Fernandez", Girona: "Paulo Gazzaniga", Mallorca: "Leo Roman",
    Oviedo: "Aron Escandell", "Racing Santander": "Jokin Ezkieta", "Deportivo La Coruña": "Ivan Villar",
    "Almería": "Fernando Martinez",
  },
  Bundesliga: {
    "Bayern Munich": "Manuel Neuer", "Borussia Dortmund": "Gregor Kobel", "RB Leipzig": "Peter Gulacsi",
    "VfB Stuttgart": "Alexander Nubel", "TSG Hoffenheim": "Oliver Baumann", "Bayer Leverkusen": "Mark Flekken",
    "SC Freiburg": "Noah Atubolu", "Eintracht Frankfurt": "Kevin Trapp", "FC Augsburg": "Nediljko Labrovic",
    Mainz: "Robin Zentner", "1. FC Union Berlin": "Frederik Ronnow", "Borussia Mönchengladbach": "Moritz Nicolas",
    "Hamburg SV": "Daniel Heuer Fernandes", "FC Koln": "Marvin Schwabe", "Werder Bremen": "Michael Zetterer",
    "VfL Wolfsburg": "Kamil Grabara", "1. FC Heidenheim 1846": "Kevin Muller", "St. Pauli": "Nikola Vasilj",
    "Schalke 04": "Justin Heekeren", "SV 07 Elversberg": "Nicolas Kristof",
  },
  "Ligue 1": {
    "Paris SG": "Gianluigi Donnarumma", Lens: "Brice Samba", Lille: "Berke Ozer", Lyon: "Remy Descamps",
    Marseille: "Geronimo Rulli", "Stade Rennais": "Brice Samba", "AS Monaco": "Radoslaw Majecki",
    Strasbourg: "Kevin Trussart", Lorient: "Yannis Clementia", Toulouse: "Guillaume Restes",
    "Paris FC": "Obed Nkambadio", Brest: "Marco Bizot", Angers: "Yahia Fofana",
    "Le Havre AC": "Arthur Desmas", "AJ Auxerre": "Donovan Leon", Nice: "Marcin Bulka",
    Nantes: "Anthony Lopes", Metz: "Koffi Kouao", Troyes: "Mateusz Kudla", "Le Mans": "Simon Bertrand",
  },
  "Serie A": {
    "Inter Milan": "Yann Sommer", Napoli: "Alex Meret", "AS Roma": "Mile Svilar", "AC Milan": "Mike Maignan",
    Como: "Pepe Reina", Juventus: "Michele Di Gregorio", Atalanta: "Marco Carnesecchi", Bologna: "Lukasz Skorupski",
    Lazio: "Ivan Provedel", Udinese: "Razvan Sava", Sassuolo: "Stefano Turati", Torino: "Franco Israel",
    Parma: "Zion Suzuki", Genoa: "Nicola Leali", Fiorentina: "David De Gea", Cagliari: "Elia Caprile",
    Lecce: "Wladimiro Falcone", Cremonese: "Marco Silvestri", "Hellas Verona": "Lorenzo Montipo",
    Pisa: "Adrian Semper", Venezia: "Jesse Joronen", Frosinone: "Cerofolini Marco", Monza: "Stefano Turati",
  },
};

const CHAMPIONS_LEAGUE_QUALIFIED = [
  { team: "Arsenal", league: "EPL", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Man City", league: "EPL", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Man United", league: "EPL", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Aston Villa", league: "EPL", status: "Projected league phase from EPL top four", source: "Current Premier League table baseline" },
  { team: "Liverpool", league: "EPL", status: "European Performance Spot as it stands", source: "UEFA European Performance Spot tracker" },
  { team: "Barcelona", league: "La Liga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Real Madrid", league: "La Liga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Villarreal", league: "La Liga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Ath Madrid", league: "La Liga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Betis", league: "La Liga", status: "Projected league phase from Spain performance spot", source: "UEFA European Performance Spot tracker" },
  { team: "Bayern Munich", league: "Bundesliga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Borussia Dortmund", league: "Bundesliga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "RB Leipzig", league: "Bundesliga", status: "League phase qualified", source: "FourFourTwo qualification tracker" },
  { team: "VfB Stuttgart", league: "Bundesliga", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Inter Milan", league: "Serie A", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Napoli", league: "Serie A", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Paris SG", league: "Ligue 1", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Lens", league: "Ligue 1", status: "League phase qualified", source: "FourFourTwo qualification tracker" },
  { team: "Lille", league: "Ligue 1", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "PSV Eindhoven", league: "Eredivisie", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Feyenoord", league: "Eredivisie", status: "League phase qualified", source: "FourFourTwo qualification tracker" },
  { team: "Porto", league: "Primeira Liga", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Slavia Prague", league: "Czech First League", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Galatasaray", league: "Turkiye", status: "League phase qualified", source: "FourFourTwo qualification tracker" },
  { team: "Shakhtar Donetsk", league: "Ukraine", status: "League phase qualified via UEFA rebalancing", source: "UEFA rebalancing update" },
];

const FUTURES_SOURCES = {
  championsLeague: {
    name: "BBC Sport 2026-27 Champions League qualified-team tracker",
    url: "https://www.bbc.co.uk/sport/football/articles/crl177pxrl4o",
  },
  performanceSpots: {
    name: "UEFA European Performance Spot tracker",
    url: "https://www.uefa.com/uefachampionsleague/news/02a2-1fdbe9a25733-8d37ff5f9226-1000--202627-uefa-champions-league-which-teams-are-in-the-european-performance-spots-as-it-stands/",
  },
};

// Ranks that actually earn a European qualification slot per league, mirrored
// exactly from tableZone()'s zone thresholds below — a rank outside these
// ranges did not qualify for anything and must never appear in a European
// futures pool (e.g. a 10th-place EPL finish gets no European football).
// EL/Conference pools are consequently small (real leagues send only 1-2
// teams to each), so those brackets realistically open at Quarterfinals/
// Semifinals rather than Round of 16 — only Champions League's larger,
// standings-derived pool supports a genuine Round of 16.
const EUROPE_PROFILE_RANGES = {
  "Europa League": {
    EPL: [5, 6],
    "La Liga": [5, 6],
    Bundesliga: [5, 6],
    "Ligue 1": [4, 5],
    "Serie A": [5, 6],
  },
  "Conference League": {
    EPL: [7],
    "La Liga": [7],
    Bundesliga: [7],
    "Ligue 1": [6],
    "Serie A": [7],
  },
};

const EUROPEAN_PLAYER_CANDIDATES = {
  "Champions League": {
    goals: [
      { player: "Erling Haaland", team: "Man City", prior: "recent Champions League Golden Boot-level scorer" },
      { player: "Kylian Mbappe", team: "Real Madrid", prior: "elite knockout-stage scorer profile" },
      { player: "Harry Kane", team: "Bayern Munich", prior: "high-volume domestic and European finisher" },
      { player: "Viktor Gyokeres", team: "Arsenal", prior: "high-volume striker profile" },
      { player: "Ousmane Dembele", team: "Paris SG", prior: "PSG attacking focal point" },
      { player: "Raphinha", team: "Barcelona", prior: "wing scorer and creator profile" },
      { player: "Vinicius Junior", team: "Real Madrid", prior: "Madrid knockout scorer profile" },
      { player: "Marcus Thuram", team: "Inter Milan", prior: "Inter striker profile" },
      { player: "Michael Olise", team: "Bayern Munich", prior: "Bayern creator/scorer profile" },
      { player: "Khvicha Kvaratskhelia", team: "Paris SG", prior: "wide forward shot-creation profile" },
    ],
    assists: [
      { player: "Lamine Yamal", team: "Barcelona", prior: "elite chance creation and crossing profile" },
      { player: "Raphinha", team: "Barcelona", prior: "set-piece and open-play creator" },
      { player: "Michael Olise", team: "Bayern Munich", prior: "high assist and final-ball profile" },
      { player: "Ousmane Dembele", team: "Paris SG", prior: "dribble creation and final pass profile" },
      { player: "Bruno Fernandes", team: "Man United", prior: "set-piece and key-pass volume profile" },
      { player: "Dominik Szoboszlai", team: "Liverpool", prior: "set-piece and chance-creation profile" },
      { player: "Jude Bellingham", team: "Real Madrid", prior: "advanced midfield creator profile" },
      { player: "Khvicha Kvaratskhelia", team: "Paris SG", prior: "wide creator profile" },
    ],
  },
  "Europa League": {
    goals: [
      { player: "Cole Palmer", team: "Chelsea", prior: "penalty and open-play scorer profile" },
      { player: "Antony", team: "Betis", prior: "wide forward focal point profile" },
      { player: "Benjamin Sesko", team: "Man United", prior: "central striker profile if Europa allocation holds" },
      { player: "Jonathan David", team: "Lille", prior: "Ligue 1 volume scorer profile" },
      { player: "Julian Alvarez", team: "Ath Madrid", prior: "pressing striker and penalty-box profile" },
      { player: "Folarin Balogun", team: "AS Monaco", prior: "central striker profile" },
      { player: "Rafael Leao", team: "AC Milan", prior: "transition scorer profile" },
      { player: "Dominic Solanke", team: "Tottenham", prior: "central striker profile" },
    ],
    assists: [
      { player: "Cole Palmer", team: "Chelsea", prior: "set-piece and penalty-area chance creation" },
      { player: "Bruno Fernandes", team: "Man United", prior: "set-piece and chance-volume profile" },
      { player: "Antoine Griezmann", team: "Ath Madrid", prior: "creative forward profile" },
      { player: "James Maddison", team: "Tottenham", prior: "set-piece and central creation profile" },
      { player: "Florian Wirtz", team: "Bayer Leverkusen", prior: "elite creator profile if allocation holds" },
      { player: "Rafael Leao", team: "AC Milan", prior: "wide creator profile" },
    ],
  },
  "Conference League": {
    goals: [
      { player: "Igor Thiago", team: "Brentford", prior: "central striker profile" },
      { player: "Ademola Lookman", team: "Atalanta", prior: "European knockout scorer profile" },
      { player: "Jean-Philippe Mateta", team: "Crystal Palace", prior: "central striker profile" },
      { player: "Kaoru Mitoma", team: "Brighton", prior: "wide forward profile" },
      { player: "Deniz Undav", team: "VfB Stuttgart", prior: "Bundesliga striker profile" },
    ],
    assists: [
      { player: "Mikkel Damsgaard", team: "Brentford", prior: "creative midfield profile" },
      { player: "Ademola Lookman", team: "Atalanta", prior: "wide forward creator profile" },
      { player: "Kaoru Mitoma", team: "Brighton", prior: "dribble creation profile" },
      { player: "Vincenzo Grifo", team: "SC Freiburg", prior: "set-piece profile" },
      { player: "Riccardo Orsolini", team: "Bologna", prior: "wide creator/scorer profile" },
    ],
  },
};

const UEFA_TEAM_ALIASES = {
  "1. FC Heidenheim 1846": "1. FC Heidenheim 1846",
  "1899 Hoffenheim": "TSG Hoffenheim",
  "AC Milan": "AC Milan",
  "AFC Ajax": "Ajax",
  "Arsenal FC": "Arsenal",
  "AS Monaco FC": "AS Monaco",
  "AS Roma": "AS Roma",
  "Aston Villa FC": "Aston Villa",
  "Atalanta BC": "Atalanta",
  "Athletic Club": "Ath Bilbao",
  "Bayer 04 Leverkusen": "Bayer Leverkusen",
  "Borussia Dortmund": "Borussia Dortmund",
  "Chelsea FC": "Chelsea",
  "Club AtlÃ©tico de Madrid": "Ath Madrid",
  "Club Atlético de Madrid": "Ath Madrid",
  "FC Barcelona": "Barcelona",
  "FC Bayern MÃ¼nchen": "Bayern Munich",
  "FC Bayern München": "Bayern Munich",
  "FC Internazionale Milano": "Inter Milan",
  "FC Porto": "Porto",
  "FC Red Bull Salzburg": "RB Salzburg",
  "FC St. Gallen": "St. Gallen",
  "FenerbahÃ§e": "Fenerbahce",
  "Fenerbahçe": "Fenerbahce",
  "Feyenoord Rotterdam": "Feyenoord",
  "FK Shakhtar Donetsk": "Shakhtar Donetsk",
  "Galatasaray": "Galatasaray",
  "Juventus FC": "Juventus",
  "Lazio Roma": "Lazio",
  "Liverpool FC": "Liverpool",
  "Manchester City FC": "Man City",
  "Manchester United": "Man United",
  "Olympique Lyonnais": "Lyon",
  "Olympique de Marseille": "Marseille",
  "Paris Saint-Germain FC": "Paris SG",
  "PSV": "PSV Eindhoven",
  "RB Leipzig": "RB Leipzig",
  "Real Betis": "Betis",
  "Real Madrid CF": "Real Madrid",
  "Real Sociedad": "Real Sociedad",
  "Sport Lisboa e Benfica": "Benfica",
  "Sporting Clube de Portugal": "Sporting CP",
  "Tottenham Hotspur": "Tottenham",
  "VfB Stuttgart": "VfB Stuttgart",
};

const INTERNATIONAL_RATINGS = {
  Argentina: 92,
  France: 91,
  Brazil: 90,
  Spain: 89,
  England: 88,
  Portugal: 87,
  Netherlands: 86,
  Belgium: 84,
  Germany: 84,
  Croatia: 83,
  Uruguay: 82,
  Colombia: 82,
  Morocco: 81,
  Switzerland: 80,
  USA: 79,
  Mexico: 79,
  Japan: 79,
  Senegal: 78,
  Ecuador: 78,
  Austria: 76,
  Denmark: 76,
  Serbia: 75,
  Sweden: 75,
  Australia: 74,
  Tunisia: 73,
  Ghana: 72,
  Canada: 72,
  Qatar: 71,
  "Saudi Arabia": 71,
};

const INTERNATIONAL_PRIORITY_PLAYERS = new Set([
  "Lionel Messi",
  "Kylian Mbappe",
  "Harry Kane",
  "Cristiano Ronaldo",
  "Neymar",
  "Vinicius Junior",
  "Bukayo Saka",
  "Jude Bellingham",
  "Phil Foden",
  "Bruno Fernandes",
  "Ousmane Dembele",
  "Raphinha",
  "Lamine Yamal",
  "Antoine Griezmann",
  "Julian Alvarez",
  "Lautaro Martinez",
  "Christian Pulisic",
  "Memphis",
  "Son Heung-min",
  "Goncalo Ramos",
  "Olivier Giroud",
  "Kai Havertz",
  "Romelu Lukaku",
  "Robert Lewandowski",
  "Luis Suarez",
  "Achraf Hakimi",
  "Hakim Ziyech",
  "Luka Modric",
  "Ivan Perisic",
  "Federico Valverde",
  "Kevin De Bruyne",
  "Jamal Musiala",
  "Michael Olise",
]);

function tableZone(league, rank, total) {
  if (league === "EPL" || league === "La Liga" || league === "Serie A") {
    if (rank <= 4) return "CL";
    if (rank <= 6) return "EL";
    if (rank === 7) return "CONF";
    if (rank > total - 3) return "REL";
    return "";
  }
  if (league === "Bundesliga") {
    if (rank <= 4) return "CL";
    if (rank <= 6) return "EL";
    if (rank === 7) return "CONF";
    if (rank === total - 1) return "PO";
    if (rank >= total) return "REL";
    return "";
  }
  if (league === "Ligue 1") {
    if (rank <= 3) return "CL";
    if (rank <= 5) return "EL";
    if (rank === 6) return "CONF";
    if (rank === total - 1) return "PO";
    if (rank >= total) return "REL";
    return "";
  }
  return "";
}

function simulateForm(team, wins, draws, losses) {
  const total = wins + draws + losses;
  if (!total) return ["D", "D", "D", "D", "D"];
  const wRate = wins / total;
  const dRate = draws / total;
  let seed = 0;
  for (const c of team) seed = ((seed * 31) + c.charCodeAt(0)) >>> 0;
  // Mix the seed so different teams don't end up with similar initial patterns
  seed = (seed ^ (seed >>> 16)) >>> 0;
  const form = [];
  for (let i = 0; i < 5; i++) {
    seed = ((seed * 1664525) + 1013904223) >>> 0;
    const r = seed / 4294967296;
    form.push(r < wRate ? "W" : r < wRate + dRate ? "D" : "L");
  }
  return form;
}

function projectedLeagueTable(league, trends) {
  const matchCount = leagueMatchCount(league);
  const rows = trends.map((trend) => {
    const isPromoted = trend.promoted || false;
    let ppg = clamp(numeric(trend.ppg) || 1.3, 0.3, 2.8);
    let gfPer = clamp(numeric(trend.goalsForPerMatch) || 1.3, 0.3, 3.5);
    let gaPer = clamp(numeric(trend.goalsAgainstPerMatch) || 1.3, 0.3, 3.5);
    if (isPromoted) {
      ppg = clamp(ppg * 0.60, 0.65, 1.15);
      gfPer = clamp(gfPer * 0.68, 0.7, 1.5);
      gaPer = clamp(gaPer * 1.18, 0.9, 2.0);
    }
    const pts = Math.round(ppg * matchCount);
    const rawWins = (pts - 0.25 * matchCount) / 2.75;
    const w = Math.min(matchCount, Math.max(0, Math.round(rawWins)));
    const d = Math.max(0, Math.min(matchCount - w, Math.round(pts - w * 3)));
    const l = Math.max(0, matchCount - w - d);
    const goalsFor = Math.round(gfPer * matchCount);
    const goalsAgainst = Math.round(gaPer * matchCount);
    return {
      team: trend.team, played: matchCount, wins: w, draws: d, losses: l,
      points: pts, goalsFor, goalsAgainst, goalDifference: goalsFor - goalsAgainst,
      promoted: isPromoted, rating: round(trend.rating, 1),
    };
  });
  rows.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team));
  const total = rows.length;
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    zone: tableZone(league, index + 1, total),
    form: simulateForm(row.team, row.wins, row.draws, row.losses),
  }));
}

function domesticCupSection(cup) {
  const rounds = CUP_ROUNDS[cup.id] || [];
  return {
    id: `${cup.id}-2026-27`,
    title: `${cup.name} 2026-27`,
    subtitle: `${cup.notes} Draw and bracket data will be imported once the competition begins.`,
    type: "cup-skeleton",
    rounds: rounds.map((name) => ({ name })),
    picks: [],
  };
}

function domesticCupSections(league) {
  return (DOMESTIC_CUPS[league] || []).map(domesticCupSection);
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value, decimals = 1) {
  const scale = 10 ** decimals;
  return Math.round(numeric(value) * scale) / scale;
}

function confidenceFromRank(index, total, floor = 54, ceiling = 76) {
  if (!total || total === 1) return ceiling;
  return round(ceiling - (index / Math.max(1, total - 1)) * (ceiling - floor), 1);
}

function leagueMatchCount(league) {
  return league === "Bundesliga" ? 34 : 38;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, numeric(value)));
}

function marketShares(candidates, floor = 1.5) {
  const weights = candidates.map((candidate, index) => Math.max(0.5, numeric(candidate.rating) - index * 0.35));
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  const safeFloor = candidates.length * floor >= 100 ? 0 : floor;
  const remaining = Math.max(0, 100 - safeFloor * candidates.length);
  const shares = weights.map((weight) => safeFloor + (weight / total) * remaining);
  const rounded = shares.map((value) => Math.floor(value * 10) / 10);
  let delta = round(100 - rounded.reduce((sum, value) => sum + value, 0), 1);
  const order = shares
    .map((value, index) => ({ index, remainder: value * 10 - Math.floor(value * 10) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  let cursor = 0;
  while (Math.abs(delta) >= 0.1 && order.length) {
    const target = order[cursor % order.length].index;
    if (delta > 0) {
      rounded[target] = round(rounded[target] + 0.1, 1);
      delta = round(delta - 0.1, 1);
    } else if (rounded[target] > safeFloor) {
      rounded[target] = round(rounded[target] - 0.1, 1);
      delta = round(delta + 0.1, 1);
    }
    cursor += 1;
    if (cursor > 500) break;
  }
  return rounded;
}

function projectedPlayerOutput(candidate, metric, league, teamTrend) {
  const matches = leagueMatchCount(league);
  const teamGoals = teamTrend?.goalsForPerMatch
    ? numeric(teamTrend.goalsForPerMatch) * matches
    : Math.max(42, numeric(teamTrend?.latestGoalsFor) || 58);
  const role90s = candidate.rate
    ? clamp(candidate.value / Math.max(0.1, candidate.rate), 16, metric === "assists" ? 31 : 33)
    : metric === "assists" ? 25 : 28;
  const roleShare = metric === "assists" ? 0.18 : 0.28;
  const rateProjection = numeric(candidate.rate) * role90s;
  const teamProjection = teamGoals * roleShare;
  const ratingLift = Math.max(0, numeric(candidate.rating) - 25) * (metric === "assists" ? 0.035 : 0.045);
  const projection = rateProjection * 0.58 + teamProjection * 0.34 + ratingLift;
  const minimum = metric === "assists" ? 5 : 8;
  const maximum = metric === "assists" ? 22 : 36;
  return Math.round(clamp(projection, minimum, maximum));
}

function projectedEuropeanOutput(candidate, metric, team) {
  const uefa = team?.uefaStats;
  const expectedMatches = team?.rating >= 105 ? 11 : team?.rating >= 92 ? 9 : 7;
  const teamGoals = uefa?.goalsForPerMatch
    ? numeric(uefa.goalsForPerMatch) * expectedMatches
    : Math.max(10, numeric(team?.trend?.goalsForPerMatch) * expectedMatches || 14);
  const role90s = candidate.rate
    ? clamp(candidate.value / Math.max(0.1, candidate.rate), 5, metric === "assists" ? 10 : 11)
    : metric === "assists" ? 7 : 8;
  const roleShare = metric === "assists" ? 0.2 : 0.34;
  const rateProjection = numeric(candidate.rate) * role90s;
  const teamProjection = teamGoals * roleShare;
  const ratingLift = Math.max(0, numeric(team?.rating) - 70) * (metric === "assists" ? 0.025 : 0.03);
  const projection = rateProjection * 0.54 + teamProjection * 0.38 + ratingLift;
  const minimum = metric === "assists" ? 3 : 4;
  const maximum = metric === "assists" ? 13 : 18;
  return Math.round(clamp(projection, minimum, maximum));
}

function projectedWorldCupOutput(candidate, metric) {
  const rating = INTERNATIONAL_RATINGS[candidate.team] || 68;
  const expectedMatches = rating >= 88 ? 6.4 : rating >= 82 ? 5.2 : rating >= 76 ? 4.1 : 3.2;
  const rate = metric === "assists" ? numeric(candidate.assistsPer90) : numeric(candidate.goalsPer90);
  const baseline = rate * expectedMatches;
  const prior = metric === "assists" ? numeric(candidate.assists) * 0.12 : numeric(candidate.goals) * 0.13;
  const teamLift = Math.max(0, rating - 72) * (metric === "assists" ? 0.025 : 0.035);
  return Math.round(clamp(baseline * 0.68 + prior + teamLift, metric === "assists" ? 2 : 3, metric === "assists" ? 9 : 12));
}

function saneInternationalPlayer(candidate) {
  return numeric(candidate.goals) <= 20 &&
    numeric(candidate.assists) <= 15 &&
    numeric(candidate.goalsPer90) <= 3 &&
    numeric(candidate.assistsPer90) <= 3;
}

function pickSource(league) {
  return {
    name: "ESPN public standings API",
    url: league?.sourceUrl || "https://www.espn.com/soccer/standings",
  };
}

function statMap(entry) {
  return Object.fromEntries((entry.stats || []).map((stat) => [stat.name, stat.value]));
}

async function fetchEspnStandingsByCode(sourceCode, season = "2025") {
  const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/${sourceCode}/standings?region=us&lang=en&contentorigin=espn&season=${season}`;
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 FootballPredictionAI futures-refresh" } });
  if (!response.ok) return { standings: [], sourceUrl: url };
  const payload = await response.json();
  const entries = payload?.children?.[0]?.standings?.entries || payload?.standings?.entries || [];
  return {
    sourceUrl: url,
    standings: entries
      .map((entry, index) => {
        const stats = statMap(entry);
        return {
          rank: numeric(stats.rank) || index + 1,
          team: normalizeTeamName(entry.team?.displayName || entry.team?.name || entry.team?.shortDisplayName || ""),
          played: numeric(stats.gamesPlayed),
          wins: numeric(stats.wins),
          draws: numeric(stats.ties),
          losses: numeric(stats.losses),
          points: numeric(stats.points),
          goalsFor: numeric(stats.pointsFor),
          goalsAgainst: numeric(stats.pointsAgainst),
          goalDifference: numeric(stats.pointDifferential),
        };
      })
      .filter((entry) => entry.team),
  };
}

function tablePickFromLeague(leagueName, league, season) {
  const standings = league?.standings || [];
  const leader = standings[0];
  if (!leader) return null;
  const complete = standings.every((entry) => numeric(entry.played) >= numeric(league.totalGames || 38));
  const second = standings[1];
  const pointsGap = second ? numeric(leader.points) - numeric(second.points) : 0;
  return {
    rank: 1,
    label: leader.team,
    detail: `${leagueName} ${season}: ${leader.points} pts, +${leader.goalDifference} GD${complete ? "; final-table baseline" : `; ${pointsGap} point lead`}.`,
    confidence: complete ? 72 : Math.min(74, 58 + Math.max(0, pointsGap) * 2),
    note: complete
      ? "Use this as a next-season futures baseline until fresh fixtures, transfers, odds, and summer form are imported."
      : "Current table leader with ledger results layered into the standings feed.",
    source: pickSource(league),
  };
}

function scorerPicksForLeague(leagueName, profiles) {
  const candidates = profiles
    .filter((profile) => profile.league === leagueName)
    .map((profile) => {
      const totals = profile.totals || {};
      return {
        player: profile.player,
        team: profile.team,
        goals: numeric(totals.goals),
        goalsPer90: numeric(totals.goalsPer90),
        assists: numeric(totals.assists),
      };
    })
    .filter((candidate) => candidate.goals > 0 || candidate.goalsPer90 > 0)
    .sort((a, b) => b.goals - a.goals || b.goalsPer90 - a.goalsPer90)
    .slice(0, 15);
  const shares = marketShares(candidates, 2);
  return candidates
    .map((candidate, index, list) => {
      const projected = projectedPlayerOutput({ ...candidate, value: candidate.goals, rate: candidate.goalsPer90, rating: candidate.goals * 2 + candidate.goalsPer90 * 9 }, "goals", leagueName, null);
      return {
        rank: index + 1,
        label: candidate.player,
        projected,
        unit: "goals",
        detail: `${candidate.team}: projected ${projected} goals for the next comparable league season from a ${round(candidate.goalsPer90, 2)} goals/90 baseline.`,
        confidence: shares[index],
        note: `Market share is normalized to 100% across these ${list.length} scorer candidates. Improve this market with match-by-match minutes, shots, SOT, transfers, and fixture difficulty.`,
        source: { name: "Player profile baselines and manual training", url: "" },
      };
    });
}

function emptyTeamTrend(team, league) {
  return {
    team,
    league,
    seasons: 0,
    weightSum: 0,
    weightedScore: 0,
    weightedPpg: 0,
    weightedGf: 0,
    weightedGa: 0,
    weightedGd: 0,
    titles: 0,
    topFour: 0,
    latestRank: 99,
    latestPoints: 0,
    latestGoalsFor: 0,
  };
}

function localSeasonTable(league, season) {
  const table = new Map();
  for (const row of loadMatches()) {
    if (row.League !== league || row.Season !== season || row.FTHG === "" || row.FTAG === "") continue;
    const home = normalizeTeamName(row.HomeTeam);
    const away = normalizeTeamName(row.AwayTeam);
    for (const team of [home, away]) {
      if (!table.has(team)) {
        table.set(team, {
          team,
          league,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
        });
      }
    }
    const homeGoals = numeric(row.FTHG);
    const awayGoals = numeric(row.FTAG);
    const homeRow = table.get(home);
    const awayRow = table.get(away);
    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += homeGoals;
    homeRow.goalsAgainst += awayGoals;
    awayRow.goalsFor += awayGoals;
    awayRow.goalsAgainst += homeGoals;
    if (homeGoals > awayGoals) {
      homeRow.wins += 1;
      awayRow.losses += 1;
      homeRow.points += 3;
    } else if (awayGoals > homeGoals) {
      awayRow.wins += 1;
      homeRow.losses += 1;
      awayRow.points += 3;
    } else {
      homeRow.draws += 1;
      awayRow.draws += 1;
      homeRow.points += 1;
      awayRow.points += 1;
    }
  }
  return [...table.values()]
    .map((entry) => ({ ...entry, goalDifference: entry.goalsFor - entry.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function updateTrend(trend, row, seasonIndex) {
  const weight = 1 + seasonIndex * 0.25;
  const ppg = numeric(row.played) ? numeric(row.points) / numeric(row.played) : 0;
  const gf = numeric(row.played) ? numeric(row.goalsFor) / numeric(row.played) : 0;
  const ga = numeric(row.played) ? numeric(row.goalsAgainst) / numeric(row.played) : 0;
  const gd = numeric(row.played) ? numeric(row.goalDifference) / numeric(row.played) : 0;
  trend.seasons += 1;
  trend.weightSum += weight;
  trend.weightedPpg += ppg * weight;
  trend.weightedGf += gf * weight;
  trend.weightedGa += ga * weight;
  trend.weightedGd += gd * weight;
  trend.weightedScore += (ppg * 38 + gd * 10 + gf * 5 - ga * 4 + Math.max(0, 7 - numeric(row.rank)) * 1.4) * weight;
  trend.titles += numeric(row.rank) === 1 ? 1 : 0;
  trend.topFour += numeric(row.rank) <= 4 ? 1 : 0;
  if (seasonIndex === HISTORICAL_SEASONS.length - 1) {
    trend.latestRank = numeric(row.rank);
    trend.latestPoints = numeric(row.points);
    trend.latestGoalsFor = numeric(row.goalsFor);
  }
}

async function historicalTablesForLeague(league) {
  const tables = {};
  for (const [seasonIndex, season] of HISTORICAL_SEASONS.entries()) {
    if (league === "Serie A") {
      const data = await archivedLeagueTables(season);
      tables[season] = data.leagues?.[league]?.standings || [];
    } else {
      tables[season] = localSeasonTable(league, season);
    }
    tables[season].forEach((row) => {
      row.seasonIndex = seasonIndex;
    });
  }
  return tables;
}

async function currentTopLeagueTable(league) {
  const data = await archivedLeagueTables("2025-26");
  return data.leagues?.[league]?.standings || localSeasonTable(league, "2025-26");
}

async function secondTierTablesForLeague(league) {
  const rule = NEXT_SEASON_RULES[league];
  if (!rule) return { "2024-25": [], "2025-26": [], sourceUrl: "" };
  const [previous, current] = await Promise.all([
    fetchEspnStandingsByCode(rule.secondTierCode, "2024"),
    fetchEspnStandingsByCode(rule.secondTierCode, "2025"),
  ]);
  return {
    "2024-25": previous.standings,
    "2025-26": current.standings,
    sourceUrl: current.sourceUrl || previous.sourceUrl || "",
  };
}

function promotedTrendFromSecondTier(league, team, secondTables, promotionRank) {
  const rows = ["2024-25", "2025-26"]
    .map((season) => ({ season, row: (secondTables[season] || []).find((entry) => normalizeTeamName(entry.team) === team) }))
    .filter((item) => item.row);
  const trend = emptyTeamTrend(team, league);
  for (const [index, item] of rows.entries()) {
    const weight = 1 + index * 0.35;
    const row = item.row;
    const ppg = numeric(row.played) ? numeric(row.points) / numeric(row.played) : 0;
    const gf = numeric(row.played) ? numeric(row.goalsFor) / numeric(row.played) : 0;
    const ga = numeric(row.played) ? numeric(row.goalsAgainst) / numeric(row.played) : 0;
    const gd = numeric(row.played) ? numeric(row.goalDifference) / numeric(row.played) : 0;
    trend.seasons += 1;
    trend.weightSum += weight;
    trend.weightedPpg += ppg * weight;
    trend.weightedGf += gf * weight;
    trend.weightedGa += ga * weight;
    trend.weightedGd += gd * weight;
    trend.weightedScore += (ppg * 34 + gd * 8 + gf * 4 - ga * 5 + Math.max(0, 4 - promotionRank) * 1.5 - 18) * weight;
    if (item.season === "2025-26") {
      trend.latestRank = numeric(row.rank);
      trend.latestPoints = numeric(row.points);
      trend.latestGoalsFor = numeric(row.goalsFor);
    }
  }
  if (!rows.length) {
    trend.weightSum = 1;
    trend.weightedScore = 28;
  }
  const divisor = trend.weightSum || 1;
  return {
    ...trend,
    promoted: true,
    promotionRank,
    secondTierSummary: rows
      .map((item) => `${item.season}: #${item.row.rank}, ${item.row.points} pts, ${item.row.goalsFor}-${item.row.goalsAgainst} goals`)
      .join("; "),
    rating: round(trend.weightedScore / divisor, 2),
    ppg: round(trend.weightedPpg / divisor, 2),
    goalsForPerMatch: round(trend.weightedGf / divisor, 2),
    goalsAgainstPerMatch: round(trend.weightedGa / divisor, 2),
    gdPerMatch: round(trend.weightedGd / divisor, 2),
  };
}

async function nextSeasonComposition(league) {
  const rule = NEXT_SEASON_RULES[league];
  const topTable = await currentTopLeagueTable(league);
  const secondTables = await secondTierTablesForLeague(league);
  if (!rule || !topTable.length) {
    return {
      teams: topTable.map((entry) => normalizeTeamName(entry.team)),
      relegated: [],
      promoted: [],
      secondTables,
    };
  }
  const relegated = topTable.slice(-rule.relegatedCount).map((entry) => normalizeTeamName(entry.team));
  const promoted = (secondTables["2025-26"] || [])
    .slice(0, rule.promotedCount)
    .map((entry, index) => ({
      team: normalizeTeamName(entry.team),
      rank: index + 1,
      row: entry,
      secondTierName: rule.secondTierName,
    }));
  const teams = [
    ...topTable
      .map((entry) => normalizeTeamName(entry.team))
      .filter((team) => !relegated.includes(team)),
    ...promoted.map((entry) => entry.team),
  ];
  return { teams, relegated, promoted, secondTables };
}

async function leagueTrends(league) {
  const tables = await historicalTablesForLeague(league);
  const composition = await nextSeasonComposition(league);
  const currentTeams = composition.teams.length ? composition.teams : (tables["2025-26"] || []).map((row) => row.team);
  const trends = new Map(currentTeams.map((team) => [team, emptyTeamTrend(team, league)]));
  for (const [seasonIndex, season] of HISTORICAL_SEASONS.entries()) {
    for (const row of tables[season] || []) {
      const team = normalizeTeamName(row.team);
      if (!trends.has(team)) continue;
      updateTrend(trends.get(team), row, seasonIndex);
    }
  }
  for (const promoted of composition.promoted || []) {
    trends.set(promoted.team, promotedTrendFromSecondTier(league, promoted.team, composition.secondTables, promoted.rank));
  }
  return [...trends.values()]
    .map((trend) => {
      if (trend.promoted) return trend;
      const divisor = trend.weightSum || trend.seasons || 1;
      return {
        ...trend,
        rating: round(trend.weightedScore / divisor, 2),
        ppg: round(trend.weightedPpg / divisor, 2),
        goalsForPerMatch: round(trend.weightedGf / divisor, 2),
        goalsAgainstPerMatch: round(trend.weightedGa / divisor, 2),
        gdPerMatch: round(trend.weightedGd / divisor, 2),
      };
    })
    .sort((a, b) => b.rating - a.rating || a.latestRank - b.latestRank || a.team.localeCompare(b.team));
}

function playerProfileCandidates(league, profiles, metric = "goals") {
  const rateKey = metric === "assists" ? "assistsPer90" : "goalsPer90";
  const staleCandidates = new Set([
    "Brentford|Bryan Mbeumo",
    "Brighton|Joao Pedro",
    "Tottenham|Son Heung-min",
    "Liverpool|Darwin Nunez",
    "Newcastle United|Alexander Isak",
  ].map((item) => item.toLowerCase()));
  return profiles
    .filter((profile) => profile.league === league)
    .map((profile) => {
      const totals = profile.totals || {};
      return {
        player: profile.player,
        team: normalizeTeamName(profile.team),
        value: numeric(totals[metric]),
        rate: numeric(totals[rateKey]),
      };
    })
    .filter((candidate) => !staleCandidates.has(`${candidate.team}|${candidate.player}`.toLowerCase()))
    .filter((candidate) => candidate.value > 0 || candidate.rate > 0);
}

// Clean-sheet projection: p(clean sheet in a match) is modeled as the Poisson
// probability of conceding zero goals, e^(-goalsAgainstPerMatch), scaled by the
// primary goalkeeper's expected share of starts across the season.
function projectedCleanSheets(gaPerMatch, league, promoted = false) {
  const matches = leagueMatchCount(league);
  const pClean = Math.exp(-clamp(gaPerMatch, 0.3, 3.5));
  const startShare = promoted ? 0.8 : 0.88;
  return Math.round(clamp(matches * pClean * startShare, 2, 24));
}

function cleanSheetWatchlist(league, trends) {
  const candidates = trends
    .map((trend) => {
      const team = normalizeTeamName(trend.team);
      const keeper = TEAM_GOALKEEPER_CANDIDATES[league]?.[team] || `${team} No.1 goalkeeper`;
      const gaPerMatch = numeric(trend.goalsAgainstPerMatch) || 1.3;
      const projected = projectedCleanSheets(gaPerMatch, league, trend.promoted);
      return { player: keeper, team, gaPerMatch, projected, rating: projected };
    })
    .sort((a, b) => b.projected - a.projected || a.player.localeCompare(b.player))
    .slice(0, 15);
  const shares = marketShares(candidates, 1.5);
  return candidates.map((candidate, index, list) => ({
    rank: index + 1,
    market: "Projected clean sheet leader",
    label: candidate.player,
    projected: candidate.projected,
    unit: "clean sheets",
    detail: `${candidate.team}: projected ${candidate.projected} clean sheets in ${league} 2026-27 from a ${round(candidate.gaPerMatch, 2)} goals-against/match baseline.`,
    confidence: shares[index],
    note: `Market share is normalized to 100% across these ${list.length} clean-sheet candidates. Formula: projected clean sheets ≈ matches × e^(-goals-against per match) × keeper start-share. Recalculate after squad, injury, and fixture-difficulty data are imported.`,
    source: { name: "Historical team defensive trend and goalkeeper candidate baseline", url: "" },
  }));
}

function cleanSheetWatchlistFromStandings(league, standings) {
  const matches = leagueMatchCount(league);
  const candidates = (standings || [])
    .map((row) => {
      const team = normalizeTeamName(row.team);
      const played = numeric(row.played) || matches;
      const gaPerMatch = played ? numeric(row.goalsAgainst) / played : 1.3;
      const keeper = TEAM_GOALKEEPER_CANDIDATES[league]?.[team] || `${team} No.1 goalkeeper`;
      const projected = projectedCleanSheets(gaPerMatch, league);
      return { player: keeper, team, gaPerMatch, projected, rating: projected };
    })
    .sort((a, b) => b.projected - a.projected || a.player.localeCompare(b.player))
    .slice(0, 15);
  const shares = marketShares(candidates, 1.5);
  return candidates.map((candidate, index, list) => ({
    rank: index + 1,
    market: "Projected clean sheet leader",
    label: candidate.player,
    projected: candidate.projected,
    unit: "clean sheets",
    detail: `${candidate.team}: projected ${candidate.projected} clean sheets for the next comparable ${league} season from a ${round(candidate.gaPerMatch, 2)} goals-against/match baseline.`,
    confidence: shares[index],
    note: `Market share is normalized to 100% across these ${list.length} clean-sheet candidates. Formula: projected clean sheets ≈ matches × e^(-goals-against per match) × keeper start-share.`,
    source: { name: "Current-season defensive record and goalkeeper candidate baseline", url: "" },
  }));
}

function teamScorerWatchlist(league, trends, profiles) {
  const profileByTeam = new Map();
  for (const candidate of playerProfileCandidates(league, profiles, "goals")) {
    const key = normalizeTeamName(candidate.team);
    const existing = profileByTeam.get(key);
    if (!existing || candidate.value > existing.value || candidate.rate > existing.rate) profileByTeam.set(key, candidate);
  }
  const shares = marketShares(trends, 1);
  return trends.map((trend, index) => {
    const team = normalizeTeamName(trend.team);
    const profileCandidate = profileByTeam.get(team);
    const names = profileCandidate ? [profileCandidate.player] : TEAM_SCORER_CANDIDATES[league]?.[team] || ["Primary striker/penalty taker"];
    const projectionCandidate = profileCandidate || { player: names[0], team, value: 0, rate: 0, rating: numeric(trend.rating) };
    const projectedTeamGoals = Math.round(clamp(numeric(trend.goalsForPerMatch) * leagueMatchCount(league), 28, 96));
    return {
      rank: index + 1,
      market: "Team top scorer candidate",
      label: `${trend.team}: ${names.join(" / ")}`,
      detail: `${trend.team}: projected ${projectedTeamGoals} team goals in ${league} 2026-27; primary scorer projection ${projectedPlayerOutput(projectionCandidate, "goals", league, trend)} goals.`,
      confidence: shares[index],
      note: profileCandidate
        ? "Candidate selected from the tracked player-profile scoring baseline and converted into a forward-season projection."
        : "Candidate is a pre-season projection placeholder until squad, transfer, and scorer feed data are imported.",
      source: { name: profileCandidate ? "Player profile baselines" : "Historical team scoring trend plus candidate watchlist", url: "" },
    };
  });
}

function topMarketWatchlist(league, trends, profiles, metric) {
  const trendsByTeam = new Map(trends.map((trend) => [normalizeTeamName(trend.team), trend]));
  const profileCandidates = playerProfileCandidates(league, profiles, metric).map((candidate) => ({
    ...candidate,
    rating: candidate.value * 2 + candidate.rate * 9,
    sourceName: "Player profile baseline",
  }));
  const fallbackCandidates = trends
    .slice(0, 20)
    .map((trend) => {
      const team = normalizeTeamName(trend.team);
      const scorer = (TEAM_SCORER_CANDIDATES[league]?.[team] || [])[0];
      const assister = TEAM_ASSIST_CANDIDATES[team];
      const player = metric === "assists" ? assister || scorer : scorer;
      if (!player) return null;
      return {
        player,
        team: trend.team,
        value: 0,
        rate: 0,
        rating: trend.goalsForPerMatch * 8 + Math.max(0, 8 - trend.latestRank),
        sourceName: "Team scoring trend watchlist",
      };
    })
    .filter(Boolean);
  const seen = new Set();
  const candidates = [...profileCandidates, ...fallbackCandidates]
    .sort((a, b) => b.rating - a.rating || a.player.localeCompare(b.player))
    .filter((candidate) => {
      const key = `${candidate.player}|${candidate.team}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 15);
  const shares = marketShares(candidates);
  return candidates
    .map((candidate, index, list) => {
      const projected = projectedPlayerOutput(candidate, metric, league, trendsByTeam.get(normalizeTeamName(candidate.team)));
      return {
        rank: index + 1,
        market: metric === "assists" ? "Projected top assist market" : "Projected league top scorer market",
        label: candidate.player,
        projected,
        unit: metric,
        detail: `${candidate.team}: projected ${projected} ${metric} for ${league} 2026-27${candidate.rate ? ` from a ${round(candidate.rate, 2)} per-90 baseline` : " from team scoring trend and role baseline"}.`,
        confidence: shares[index],
        note: metric === "assists"
          ? `Market share is normalized to 100% across these ${list.length} assist candidates. Recalculate after transfers, minutes, set pieces, and fixture difficulty are imported.`
          : `Market share is normalized to 100% across these ${list.length} scorer candidates. Recalculate after transfers, penalties, minutes, and fixture difficulty are imported.`,
        source: { name: candidate.sourceName, url: "" },
      };
    });
}

function leagueWinnerPicksFromTrends(league, tableName, trends) {
  const candidates = trends.slice(0, 4);
  const shares = marketShares(candidates, 4);
  return candidates.map((trend, index, list) => ({
    rank: index + 1,
    market: index === 0 ? "Projected 2026-27 league winner" : "Title challenger",
    label: trend.team,
    detail: trend.promoted
      ? `${tableName || league}: promoted side baseline, ${trend.secondTierSummary || "second-tier profile imported"}.`
      : `${tableName || league}: trend rating ${trend.rating}, ${trend.ppg} weighted PPG, ${trend.titles} title baseline(s), ${trend.topFour} top-four baseline(s) since 2020-21.`,
    confidence: shares[index],
    note: trend.promoted
      ? "Promoted-team projection uses the past two second-tier seasons and should be rechecked once top-flight odds and fixture difficulty are imported."
      : `Winner market share is normalized to 100% across these ${list.length} teams. Refresh this after transfers, fixtures, odds, injuries, and preseason minutes are imported.`,
    source: { name: trend.promoted ? "Second-tier promotion table baseline" : "2020-21 through 2025-26 league-table and result compilation", url: "" },
  }));
}

function promotedTeamBaselinePicks(league, trends) {
  return trends
    .filter((trend) => trend.promoted)
    .sort((a, b) => a.promotionRank - b.promotionRank)
    .map((trend, index, list) => ({
      rank: index + 1,
      market: "Promoted team baseline",
      label: trend.team,
      detail: `${league}: promotion rank #${trend.promotionRank}. ${trend.secondTierSummary || "Second-tier table profile imported."}`,
      confidence: confidenceFromRank(index, list.length, 44, 58),
      note: "This replaces relegated top-flight teams in the 2026-27 futures board. Re-score once fixtures, transfer windows, and top-flight odds are imported.",
      source: { name: "Past two second-tier seasons and 2025-26 promotion table", url: "" },
    }));
}

function trendLookup(allLeagueTrends = []) {
  const lookup = new Map();
  for (const trend of allLeagueTrends.flat()) {
    lookup.set(`${trend.league}|${normalizeTeamName(trend.team)}`, trend);
    lookup.set(normalizeTeamName(trend.team), trend);
  }
  return lookup;
}

function profileLookup(profiles = []) {
  return new Map(profiles.map((profile) => [String(profile.player || "").toLowerCase(), profile]));
}

let uefaHistoryCache = null;

function compactTeamKey(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const UEFA_COMPACT_TEAM_ALIASES = Object.fromEntries(
  Object.entries({
    ...UEFA_TEAM_ALIASES,
    "1. FC Heidenheim 1846": "1. FC Heidenheim 1846",
    "1899 Hoffenheim": "TSG Hoffenheim",
    "BSC Young Boys": "Young Boys",
    "Club Atlético de Madrid": "Ath Madrid",
    "FC Bayern München": "Bayern Munich",
    "Fenerbahçe": "Fenerbahce",
    "Lille OSC": "Lille",
    "Manchester United FC": "Man United",
    "Slavia Praha": "Slavia Prague",
  }).map(([key, value]) => [compactTeamKey(key), value])
);

function normalizeUefaTeamName(value) {
  const cleaned = String(value || "")
    .replace(/\s+\([A-Z]{2,3}\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const key = compactTeamKey(cleaned);
  return UEFA_TEAM_ALIASES[cleaned] || UEFA_COMPACT_TEAM_ALIASES[key] || normalizeTeamName(cleaned);
}

function parseUefaMatchLine(line) {
  const match = String(line || "").match(/^\s*(?:\d{1,2}\.\d{2}\s+)?(.+?)\s+v\s+(.+?)\s+(\d+)-(\d+)(?:\s|\(|$)/);
  if (!match) return null;
  const home = normalizeUefaTeamName(match[1]);
  const away = normalizeUefaTeamName(match[2]);
  if (!home || !away || home === away) return null;
  return {
    home,
    away,
    homeGoals: numeric(match[3]),
    awayGoals: numeric(match[4]),
  };
}

function emptyUefaStats(team, competition) {
  return {
    team,
    competition,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    weightedScore: 0,
    weightSum: 0,
    seasons: new Set(),
    mainMatches: 0,
    qualifierMatches: 0,
  };
}

function updateUefaStats(stats, season, goalsFor, goalsAgainst, weight, isQualifier) {
  const points = goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0;
  stats.matches += 1;
  stats.wins += points === 3 ? 1 : 0;
  stats.draws += points === 1 ? 1 : 0;
  stats.losses += points === 0 ? 1 : 0;
  stats.goalsFor += goalsFor;
  stats.goalsAgainst += goalsAgainst;
  stats.points += points;
  stats.weightSum += weight;
  stats.weightedScore += (points * 8 + goalsFor * 1.7 - goalsAgainst * 1.1 + (goalsFor - goalsAgainst) * 2.2) * weight;
  stats.seasons.add(season);
  if (isQualifier) stats.qualifierMatches += 1;
  else stats.mainMatches += 1;
}

function finalizeUefaStats(stats) {
  const ppg = stats.matches ? stats.points / stats.matches : 0;
  const goalsForPerMatch = stats.matches ? stats.goalsFor / stats.matches : 0;
  const goalsAgainstPerMatch = stats.matches ? stats.goalsAgainst / stats.matches : 0;
  const gdPerMatch = goalsForPerMatch - goalsAgainstPerMatch;
  const recentScore = stats.weightSum ? stats.weightedScore / stats.weightSum : 0;
  const rating = 42 + ppg * 7.5 + gdPerMatch * 5.5 + goalsForPerMatch * 1.8 + Math.min(9, stats.mainMatches * 0.12) + stats.seasons.size * 1.2 + recentScore * 0.32;
  return {
    ...stats,
    seasons: [...stats.seasons],
    ppg: round(ppg, 2),
    goalsForPerMatch: round(goalsForPerMatch, 2),
    goalsAgainstPerMatch: round(goalsAgainstPerMatch, 2),
    goalDifference: stats.goalsFor - stats.goalsAgainst,
    rating: round(Math.max(38, Math.min(88, rating)), 2),
  };
}

function loadUefaCompetitionHistory() {
  if (uefaHistoryCache) return uefaHistoryCache;
  const history = {};
  for (const competition of Object.keys(UEFA_COMPETITION_FILES)) {
    const table = new Map();
    for (const [seasonIndex, season] of UEFA_SEASONS.entries()) {
      for (const file of UEFA_COMPETITION_FILES[competition] || []) {
        const filePath = path.join(UEFA_DATA_ROOT, season, file);
        if (!fs.existsSync(filePath)) continue;
        const isQualifier = file.includes("q.");
        const seasonWeight = 1 + seasonIndex * 0.28;
        const stageWeight = isQualifier ? 0.45 : 1;
        const text = fs.readFileSync(filePath, "utf8");
        for (const line of text.split(/\r?\n/)) {
          const match = parseUefaMatchLine(line);
          if (!match) continue;
          for (const team of [match.home, match.away]) {
            if (!table.has(team)) table.set(team, emptyUefaStats(team, competition));
          }
          const weight = seasonWeight * stageWeight;
          updateUefaStats(table.get(match.home), season, match.homeGoals, match.awayGoals, weight, isQualifier);
          updateUefaStats(table.get(match.away), season, match.awayGoals, match.homeGoals, weight, isQualifier);
        }
      }
    }
    history[competition] = new Map([...table.entries()].map(([team, stats]) => [team, finalizeUefaStats(stats)]));
  }
  uefaHistoryCache = history;
  return history;
}

function uefaStatsForTeam(competition, team) {
  return loadUefaCompetitionHistory()[competition]?.get(normalizeUefaTeamName(team)) || null;
}

function europeanWinnerPicks(competition, teams) {
  const candidates = teams.slice(0, 4);
  const shares = marketShares(candidates, 3);
  const outcomes = ["Winner", "Runner-up", "Semi-finalist", "Semi-finalist"];
  return candidates.map((candidate, index, list) => ({
    rank: index + 1,
    market: `${competition} ${outcomes[index]} prediction`,
    label: candidate.team,
    detail: `${outcomes[index]} projection. ${candidate.league}: ${competition} rating ${round(candidate.rating, 1)}${candidate.trend ? `, ${candidate.trend.ppg} domestic weighted PPG` : ""}${candidate.uefaStats ? `; imported UEFA record ${candidate.uefaStats.wins}W-${candidate.uefaStats.draws}D-${candidate.uefaStats.losses}L, ${candidate.uefaStats.goalsFor}-${candidate.uefaStats.goalsAgainst} goals` : ""}.`,
    confidence: shares[index],
    note: `Knockout-outcome share is normalized to 100% across the predicted final four. Pre-draw projection uses domestic trend strength, imported UEFA result history, recent European profile, and squad/player baselines.`,
    source: { name: `${competition} qualification tracker plus imported UEFA result files`, url: competition === "Champions League" ? FUTURES_SOURCES.championsLeague.url : "" },
  }));
}

function europeanProfilePicks(competition, teams) {
  return teams.map((candidate, index, list) => ({
    rank: index + 1,
    market: `${competition} qualification profile`,
    label: candidate.team,
    detail: `${candidate.league}: ${candidate.status || `domestic rank band #${candidate.rank || "n/a"}`}${candidate.trend ? `, 2026-27 trend rating ${candidate.trend.rating}` : ""}.`,
    confidence: confidenceFromRank(index, list.length, 42, 60),
    note: "Qualification/profile baseline with imported UEFA history layered in. Fixture draw is not required for futures, but will improve confidence once imported.",
    source: { name: "Qualification/profile tracker and imported UEFA result files", url: competition === "Champions League" ? FUTURES_SOURCES.championsLeague.url : "" },
  }));
}

function europeanPlayerWatchlist(competition, teams, profiles, metric) {
  const teamSet = new Set(teams.map((team) => normalizeTeamName(team.team)));
  const teamRatings = new Map(teams.map((team) => [normalizeTeamName(team.team), numeric(team.rating)]));
  const teamsByName = new Map(teams.map((team) => [normalizeTeamName(team.team), team]));
  const profilesByPlayer = profileLookup(profiles);
  const configured = EUROPEAN_PLAYER_CANDIDATES[competition]?.[metric] || [];
  const profileCandidates = [];
  for (const league of CLUB_LEAGUES) {
    for (const candidate of playerProfileCandidates(league, profiles, metric)) {
      if (!teamSet.has(normalizeTeamName(candidate.team))) continue;
      profileCandidates.push({
        player: candidate.player,
        team: normalizeTeamName(candidate.team),
        prior: "tracked player-profile baseline",
        value: candidate.value,
        rate: candidate.rate,
      });
    }
  }
  const fallbackCandidates = teams.flatMap((team) => {
    const normalizedTeam = normalizeTeamName(team.team);
    const scorer = TEAM_SCORER_CANDIDATES[team.league]?.[normalizedTeam]?.[0];
    const assister = TEAM_ASSIST_CANDIDATES[normalizedTeam];
    const player = metric === "assists" ? assister : scorer;
    if (!player) return [];
    return [{
      player,
      team: normalizedTeam,
      prior: metric === "assists" ? "projected team creator baseline" : "projected team scoring focal point",
      value: 0,
      rate: 0,
    }];
  });
  // Build a profile-team map so we can validate hardcoded candidates against current player location
  const profileTeamByPlayer = new Map(
    profiles.map((p) => [String(p.player || "").toLowerCase(), normalizeTeamName(p.team)])
  );
  const rawCandidates = [...configured, ...profileCandidates, ...fallbackCandidates]
    .filter((candidate) => {
      if (teamSet.size && !teamSet.has(normalizeTeamName(candidate.team))) return false;
      // If profile says this player is at a DIFFERENT team, discard the hardcoded entry
      const profileTeam = profileTeamByPlayer.get(String(candidate.player || "").toLowerCase());
      if (profileTeam && profileTeam !== normalizeTeamName(candidate.team) && candidate.prior !== "tracked player-profile baseline") {
        return false;
      }
      return true;
    })
    .map((candidate) => {
      const profile = profilesByPlayer.get(String(candidate.player || "").toLowerCase());
      const totals = profile?.totals || {};
      const value = numeric(candidate.value ?? totals[metric]);
      const rate = numeric(candidate.rate ?? totals[metric === "assists" ? "assistsPer90" : "goalsPer90"]);
      const teamRating = teamRatings.get(normalizeTeamName(candidate.team)) || 45;
      return {
        ...candidate,
        value,
        rate,
        rating: teamRating * 0.42 + value * 2.2 + rate * 11,
        sourceName: profile ? "Tracked player profile and European futures baseline" : "European futures candidate baseline",
      };
    });
  const seen = new Set();
  const candidates = rawCandidates
    .sort((a, b) => b.rating - a.rating || a.player.localeCompare(b.player))
    .filter((candidate) => {
      const key = `${candidate.player}|${candidate.team}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 15);
  const shares = marketShares(candidates);
  return candidates
    .map((candidate, index, list) => {
      const projected = projectedEuropeanOutput(candidate, metric, teamsByName.get(normalizeTeamName(candidate.team)));
      return {
        rank: index + 1,
        market: metric === "assists" ? `${competition} top assist prediction` : `${competition} top scorer prediction`,
        label: candidate.player,
        projected,
        unit: metric,
        detail: `${candidate.team}: projected ${projected} ${metric} in ${competition} 2026-27${candidate.rate ? ` from a ${round(candidate.rate, 2)} per-90 baseline` : " from team European strength and role baseline"}; ${candidate.prior || "European futures profile"}.`,
        confidence: shares[index],
        note: `Market share is normalized to 100% across these ${list.length} ${metric === "assists" ? "assist" : "scorer"} candidates. Team European strength uses imported UEFA result files; draw difficulty, minutes, injuries, penalties, and squad lists will sharpen this later.`,
        source: { name: candidate.sourceName, url: "" },
      };
    });
}

function rankedEuropeanTeams(competition, teamRows, allLeagueTrends) {
  const lookup = trendLookup(allLeagueTrends);
  return teamRows
    .map((team) => {
      const normalized = normalizeTeamName(team.team);
      const trend = lookup.get(`${team.league}|${normalized}`) || lookup.get(normalized);
      const uefaStats = uefaStatsForTeam(competition, normalized);
      const baseRating = numeric(team.rating) || trend?.rating || Math.max(40, 70 - numeric(team.rank || 8) * 2.2);
      const rating = uefaStats
        ? baseRating * 0.72 + uefaStats.rating * 0.34 + Math.min(5, uefaStats.mainMatches * 0.05)
        : baseRating;
      return {
        ...team,
        team: normalized,
        trend,
        uefaStats,
        rating: round(rating, 2),
      };
    })
    .sort((a, b) => b.rating - a.rating || numeric(a.rank) - numeric(b.rank) || a.team.localeCompare(b.team));
}

function europeanCompetitionSection(competition, teamRows, allLeagueTrends, profiles) {
  const teams = rankedEuropeanTeams(competition, teamRows, allLeagueTrends);
  return {
    id: `${competition.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-futures`,
    title: `${competition} Futures`,
    subtitle: `${teams.length} teams in the current ${competition} futures pool. Winner, scorer, and assist markets are pre-draw predictions.`,
    type: "knockout",
    picks: [
      ...europeanWinnerPicks(competition, teams),
      ...europeanPlayerWatchlist(competition, teams, profiles, "goals"),
      ...europeanPlayerWatchlist(competition, teams, profiles, "assists"),
      ...(competition === "Champions League" ? [] : europeanProfilePicks(competition, teams)),
    ],
  };
}

function championsLeagueProfileSections(allLeagueTrends) {
  return europeanCompetitionSection("Champions League", CHAMPIONS_LEAGUE_QUALIFIED, allLeagueTrends, listPlayerProfiles().profiles || []);
}

async function europeanProfileTeamRows(competition, allLeagueTrends = []) {
  const ranges = EUROPE_PROFILE_RANGES[competition];
  const trendLookupMap = new Map();
  for (const trend of allLeagueTrends.flat()) trendLookupMap.set(`${trend.league}|${normalizeTeamName(trend.team)}`, trend);
  const teams = [];
  for (const league of CLUB_LEAGUES) {
    const table = await currentTopLeagueTable(league);
    for (const rank of ranges?.[league] || []) {
      const row = table[rank - 1];
      if (!row) continue;
      const team = normalizeTeamName(row.team);
      const trend = trendLookupMap.get(`${league}|${team}`);
      teams.push({
        team,
        league,
        rank,
        status: `${competition} projected qualifier`,
        rating: trend?.rating || Math.max(40, 70 - rank * 3),
        trend,
      });
    }
  }
  return teams;
}

async function projectedEuropeanProfileSection(competition, allLeagueTrends = []) {
  const teams = await europeanProfileTeamRows(competition, allLeagueTrends);
  return europeanCompetitionSection(competition, teams, allLeagueTrends, listPlayerProfiles().profiles || []);
}

// Simulated 2026-27 knockout projection for a UEFA club competition, built
// from each club's rating (five-season weighted form — see
// STANDINGS_METHODOLOGY — plus UEFA history). Distinct from the real,
// completed-season bracket parsed by clubBracketProjection.js — that one
// shows what already happened; this one is a forward-looking futures market.
function impliedProbsFromOdds(odds) {
  const inv = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 1 ? 1 / n : null;
  };
  const home = inv(odds?.homeOdds);
  const away = inv(odds?.awayOdds);
  const draw = inv(odds?.drawOdds) || 0;
  if (home == null || away == null) return null;
  const total = home + draw + away;
  if (!total) return null;
  return { homePct: (home / total) * 100, awayPct: (away / total) * 100, drawPct: (draw / total) * 100 };
}

// Best-effort: a hypothetical future round has no scheduled fixture, so a
// public odds market almost never exists for it yet. When one does show up
// (e.g. the draw has since been made and this cache is regenerated), fold it
// in — market price carries more weight than the form-only rating once it's
// actually available.
async function simulateFuturesTie(teamA, teamB, competition) {
  const diff = numeric(teamA.rating) - numeric(teamB.rating);
  let aPct = Math.round(clamp(50 + diff * 1.1, 8, 92));
  let oddsApplied = false;
  try {
    const lookup = await lookupMatchOdds({ homeTeam: teamA.team, awayTeam: teamB.team, context: "club", league: competition });
    const market = lookup?.found ? impliedProbsFromOdds(lookup.odds) : null;
    if (market) {
      const drawSplit = market.drawPct / 2;
      const marketAPct = market.homePct + drawSplit;
      aPct = Math.round(aPct * 0.35 + marketAPct * 0.65);
      oddsApplied = true;
    }
  } catch (_) { /* odds lookup is best-effort only */ }
  const bPct = 100 - aPct;
  return { winner: aPct >= bPct ? teamA : teamB, aPct, bPct, oddsApplied };
}

// Standard tournament seed order (e.g. for 8: 1v8, 4v5, 2v7, 3v6 as adjacent
// bracket slots) so that top seeds can only meet in later rounds AND adjacent
// matches in the display always merge into the next round's next match —
// which is what lets the bracket be drawn with simple, correctly-aligned
// connector lines instead of needing a seed-aware layout.
const BRACKET_SEED_ORDER = {
  2: [1, 2],
  4: [1, 4, 2, 3],
  8: [1, 8, 4, 5, 2, 7, 3, 6],
  16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11],
};

async function projectFuturesKnockoutBracket(competition, teamsRanked) {
  const sizeOptions = [16, 8, 4, 2];
  const size = sizeOptions.find((option) => teamsRanked.length >= option) || 2;
  const roundKeysBySize = { 16: ["r16", "qf", "sf", "final"], 8: ["qf", "sf", "final"], 4: ["sf", "final"], 2: ["final"] };
  const roundLabels = { r16: "Round of 16", qf: "Quarterfinals", sf: "Semifinals", final: "Final" };
  const roundKeys = roundKeysBySize[size] || [];
  const seeded = [...teamsRanked].sort((a, b) => numeric(b.rating) - numeric(a.rating)).slice(0, size);
  const seedOrder = BRACKET_SEED_ORDER[size] || seeded.map((_, index) => index + 1);
  let field = seedOrder.map((seed) => seeded[seed - 1]);
  const bracket = {};
  let oddsApplied = false;
  for (const key of roundKeys) {
    if (field.length < 2) break;
    const n = field.length;
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([field[i * 2], field[i * 2 + 1]]);
    const results = await Promise.all(pairs.map(async ([a, b]) => ({ a, b, ...(await simulateFuturesTie(a, b, competition)) })));
    if (results.some((r) => r.oddsApplied)) oddsApplied = true;
    bracket[key] = {
      label: roundLabels[key],
      subtitle: `${n} clubs · path to the ${competition} final`,
      matches: results.map((r) => ({
        home: { team: r.a.team, flag: null },
        away: { team: r.b.team, flag: null },
        winner: r.winner.team,
        homeWinPct: r.aPct,
        awayWinPct: r.bPct,
        source: r.oddsApplied ? "odds-adjusted" : "projected",
        score: null,
      })),
      advancers: results.map((r) => ({ team: r.winner.team, flag: null })),
    };
    field = results.map((r) => r.winner);
  }
  const rounds = roundKeys.filter((key) => bracket[key]).map((key) => ({ id: key, ...bracket[key] }));
  const champion = field[0] ? { team: field[0].team } : null;
  return {
    generatedAt: new Date().toISOString(),
    competition: { label: competition, season: "2026-27" },
    bracket,
    rounds,
    champion,
    championLabel: `${competition} Champion — 2026-27 Forecast`,
    disclaimer: `${competition} 2026-27 path to the final, built from five seasons of club form and UEFA history.${oddsApplied ? " Live market odds were folded in wherever a price is already posted." : " Market odds will be blended in automatically as soon as a price is posted for a tie."}`,
  };
}

// Real Champions League berth count per domestic league (matches the CL
// zone thresholds already used by tableZone()). Used to derive next
// season's futures-bracket field directly from each league's previous
// (2025-26) final standings, rather than a hand-maintained qualifier list.
const CHAMPIONS_LEAGUE_BERTHS = { EPL: 4, "La Liga": 4, Bundesliga: 4, "Ligue 1": 3, "Serie A": 4 };

async function standingsQualifiedChampionsLeagueTeams() {
  const rows = [];
  for (const league of CLUB_LEAGUES) {
    const table = await currentTopLeagueTable(league);
    const berths = CHAMPIONS_LEAGUE_BERTHS[league] || 4;
    for (let rank = 1; rank <= berths; rank++) {
      const row = table[rank - 1];
      if (!row) continue;
      rows.push({
        team: normalizeTeamName(row.team),
        league,
        rank,
        status: `${league} previous-season rank #${rank}`,
      });
    }
  }
  return rows;
}

async function futuresKnockoutBracket(competition) {
  if (!["Champions League", "Europa League", "Conference League"].includes(competition)) {
    throw new Error(`Unknown futures bracket competition: ${competition}`);
  }
  const allTrends = await Promise.all(CLUB_LEAGUES.map((leagueName) => leagueTrends(leagueName)));
  const teamRows = competition === "Champions League" ? await standingsQualifiedChampionsLeagueTeams() : await europeanProfileTeamRows(competition, allTrends);
  const teams = rankedEuropeanTeams(competition, teamRows, allTrends);
  return projectFuturesKnockoutBracket(competition, teams);
}

async function nextSeasonClubFutures({ league = "All" } = {}) {
  const playerProfiles = listPlayerProfiles().profiles || [];
  const europeanProfileOnly = ["Champions League", "Europa League", "Conference League"].includes(league);
  const leagueNames = league && league !== "All" && !europeanProfileOnly ? [league] : CLUB_LEAGUES;
  const trendPairs = [];
  for (const leagueName of leagueNames) {
    trendPairs.push([leagueName, await leagueTrends(leagueName)]);
  }
  const sections = [];
  if (!europeanProfileOnly) {
    for (const [leagueName, trends] of trendPairs) {
      sections.push({
        id: `${leagueName}-2026-27-futures`,
        title: `${leagueName} — 2026-27 Season Projection`,
        subtitle: `Projected final standings based on ${HISTORICAL_SEASONS[0]}–${HISTORICAL_SEASONS[HISTORICAL_SEASONS.length - 1]} form trends. Re-runs after transfers and preseason data are imported.`,
        type: "league-table",
        methodology: STANDINGS_METHODOLOGY,
        projectedTable: projectedLeagueTable(leagueName, trends),
        picks: [
          ...leagueWinnerPicksFromTrends(leagueName, leagueName, trends),
          ...promotedTeamBaselinePicks(leagueName, trends),
          ...topMarketWatchlist(leagueName, trends, playerProfiles, "goals"),
          ...topMarketWatchlist(leagueName, trends, playerProfiles, "assists"),
          ...cleanSheetWatchlist(leagueName, trends),
          ...teamScorerWatchlist(leagueName, trends, playerProfiles),
        ],
      });
      if (league !== "All") {
        sections.push(...domesticCupSections(leagueName));
      }
    }
  }
  if (league === "All" || league === "Champions League") {
    const allTrends = league === "Champions League" ? await Promise.all(CLUB_LEAGUES.map((leagueName) => leagueTrends(leagueName))) : trendPairs.map(([, trends]) => trends);
    sections.unshift(championsLeagueProfileSections(allTrends));
  }
  if (league === "All" || league === "Europa League" || league === "Conference League") {
    const allTrends = league === "All" ? trendPairs.map(([, trends]) => trends) : await Promise.all(CLUB_LEAGUES.map((leagueName) => leagueTrends(leagueName)));
    const profiles = league === "All"
      ? [await projectedEuropeanProfileSection("Europa League", allTrends), await projectedEuropeanProfileSection("Conference League", allTrends)]
      : [await projectedEuropeanProfileSection(league, allTrends)];
    sections.splice(league === "All" ? 1 : 0, 0, ...profiles);
  }
  return {
    context: "club",
    season: "2026-27",
    league,
    generatedAt: new Date().toISOString(),
    unavailable: false,
    sourcePolicy:
      "2026-27 futures are pre-fixture projections compiled from 2020-21 through 2025-26 league results/tables, tracked player profiles, and a dated Champions League qualification profile. Re-train after transfers, fixtures, odds, injuries, and squad lists are available.",
    sections,
  };
}

async function clubFutures({ season = "2025-26", league = "All" } = {}) {
  if (season === "2026-27") return nextSeasonClubFutures({ league });
  const tableData = await archivedLeagueTables(season);
  const playerProfiles = listPlayerProfiles().profiles || [];
  const teamProfiles = listTeamProfiles(season, tableData).profiles || [];
  if (tableData.unavailable) {
    return {
      context: "club",
      season,
      league,
      generatedAt: new Date().toISOString(),
      unavailable: true,
      message: tableData.message,
      sections: [],
    };
  }

  const leagueNames = league && league !== "All" ? [league] : CLUB_LEAGUES;
  const sections = [];
  for (const leagueName of leagueNames) {
    const tableLeague = tableData.leagues?.[leagueName];
    if (!tableLeague) continue;
    const leagueWinner = tablePickFromLeague(leagueName, tableLeague, season);
    const scorerPicks = scorerPicksForLeague(leagueName, playerProfiles);
    const trainedTeams = teamProfiles.filter((profile) => profile.league === leagueName && numeric(profile.totals?.matches) > 0).length;
    sections.push({
      id: `${leagueName}-futures`,
      title: `${tableLeague.name || leagueName} — ${season} Live Table`,
      subtitle: `${trainedTeams} manually trained team profile${trainedTeams === 1 ? "" : "s"} layered in. Current standings as of latest ESPN refresh.`,
      type: "league-table",
      methodology: STANDINGS_METHODOLOGY,
      projectedTable: (tableLeague.standings || []).map((row, index) => ({
        rank: index + 1,
        team: normalizeTeamName(row.team),
        played: numeric(row.played),
        wins: numeric(row.wins),
        draws: numeric(row.draws),
        losses: numeric(row.losses),
        points: numeric(row.points),
        goalsFor: numeric(row.goalsFor),
        goalsAgainst: numeric(row.goalsAgainst),
        goalDifference: numeric(row.goalDifference),
        zone: tableZone(leagueName, index + 1, (tableLeague.standings || []).length),
        promoted: false,
      })),
      picks: [
        ...(leagueWinner ? [{ ...leagueWinner, market: "League winner / next-season baseline" }] : []),
        ...scorerPicks.map((pick) => ({ ...pick, market: "Top scorer watchlist" })),
        ...cleanSheetWatchlistFromStandings(leagueName, tableLeague.standings || []),
      ],
    });
    if (league !== "All") {
      sections.push(...domesticCupSections(leagueName));
    }
  }

  return {
    context: "club",
    season,
    league,
    generatedAt: new Date().toISOString(),
    unavailable: false,
    sourcePolicy: "Futures use public league tables, tracked player profiles, and manually trained team-profile form. Treat completed seasons as baseline priors for the next campaign.",
    sections,
  };
}

function internationalWinnerPicks() {
  const fixtureData = readFixtureData();
  const teams = fixtureData.teams?.length ? fixtureData.teams : Object.values(fixtureData.groups || {}).flat();
  const candidates = [...new Set(teams)]
    .map((team) => ({
      team,
      rating: INTERNATIONAL_RATINGS[team] || 68,
      group: Object.entries(fixtureData.groups || {}).find(([, groupTeams]) => groupTeams.includes(team))?.[0] || "",
    }))
    .sort((a, b) => b.rating - a.rating || a.team.localeCompare(b.team))
    .slice(0, 8);
  const shares = marketShares(candidates, 4);
  return candidates
    .map((candidate, index, list) => ({
      rank: index + 1,
      market: "World Cup winner watchlist",
      label: candidate.team,
      detail: `${candidate.group ? `Group ${candidate.group}; ` : ""}international baseline rating ${candidate.rating}.`,
      confidence: shares[index],
      note: `Winner market share is normalized to 100% across these ${list.length} teams. Re-rank after final squads, injuries, odds, and group-stage results are layered in.`,
      source: { name: "World Cup 2026 fixture feed and model ratings", url: fixtureData.source?.url || "" },
    }));
}

function internationalPlayerFutures(metric = "goals") {
  const fixtureTeams = new Set(readFixtureData().teams || []);
  const seenPlayers = new Set();
  const importedCandidates = aggregatePlayers(loadPlayerRows())
    .filter((player) => player.league === "International")
    .filter((player) => !fixtureTeams.size || fixtureTeams.has(player.squad))
    .map((player) => ({
      player: player.player,
      team: player.squad,
      goals: numeric(player.goals),
      assists: numeric(player.assists),
      goalsPer90: numeric(player.goalsPer90),
      assistsPer90: numeric(player.assistsPer90),
      shotsPer90: numeric(player.shotsPer90),
      rating:
        (INTERNATIONAL_RATINGS[player.squad] || 68) * 0.34 +
        (metric === "assists" ? numeric(player.assists) * 4.5 + numeric(player.assistsPer90) * 16 : numeric(player.goals) * 4.2 + numeric(player.goalsPer90) * 18),
    }))
    .filter(saneInternationalPlayer)
    .filter((candidate) => INTERNATIONAL_PRIORITY_PLAYERS.has(candidate.player))
    .filter((candidate) => metric === "assists" ? candidate.assists > 0 || candidate.assistsPer90 > 0 : candidate.goals > 0 || candidate.goalsPer90 > 0)
    .sort((a, b) => b.rating - a.rating || a.player.localeCompare(b.player))
    .filter((candidate) => {
      const key = `${candidate.player}|${candidate.team}`;
      if (seenPlayers.has(key)) return false;
      seenPlayers.add(key);
      return true;
    });
  const fallbackCandidates = (listPlayerProfiles().profiles || [])
    .map((profile) => {
      const international = profile.internationalProfile || {};
      const totals = international.totals || {};
      return {
        player: profile.player,
        team: international.team,
        goals: numeric(totals.goals),
        assists: numeric(totals.assists),
        goalsPer90: numeric(totals.goalsPer90),
        assistsPer90: numeric(totals.assistsPer90),
        shotsPer90: numeric(totals.shotsPer90),
        rating:
          (INTERNATIONAL_RATINGS[international.team] || 68) * 0.3 +
          (metric === "assists" ? numeric(totals.assists) * 3.5 + numeric(totals.assistsPer90) * 12 : numeric(totals.goals) * 3.5 + numeric(totals.goalsPer90) * 14),
      };
    })
    .filter((candidate) => candidate.team && (!fixtureTeams.size || fixtureTeams.has(candidate.team)))
    .filter(saneInternationalPlayer)
    .filter((candidate) => INTERNATIONAL_PRIORITY_PLAYERS.has(candidate.player));
  const candidates = [...importedCandidates, ...fallbackCandidates]
    .filter((candidate) => metric === "assists" ? candidate.assists > 0 || candidate.assistsPer90 > 0 || importedCandidates.length < 10 : candidate.goals > 0 || candidate.goalsPer90 > 0 || importedCandidates.length < 10)
    .sort((a, b) => b.rating - a.rating || a.player.localeCompare(b.player))
    .filter((candidate, index, list) => list.findIndex((item) => `${item.player}|${item.team}` === `${candidate.player}|${candidate.team}`) === index)
    .slice(0, 10);
  const shares = marketShares(candidates, 2);
  return candidates
    .map((candidate, index, list) => ({
      rank: index + 1,
      market: metric === "assists" ? "World Cup top assist watchlist" : "World Cup top scorer watchlist",
      label: candidate.player,
      detail: `${candidate.team}: projected ${projectedWorldCupOutput(candidate, metric)} ${metric === "assists" ? "assists" : "goals"} for World Cup 2026 from ${metric === "assists" ? `${candidate.assists} assists, ${round(candidate.assistsPer90, 2)} assists/90` : `${candidate.goals} goals, ${round(candidate.goalsPer90, 2)} goals/90`} in imported 2018/2022 World Cup rows.`,
      confidence: shares[index],
      note: `Market share is normalized to 100% across these ${list.length} ${metric === "assists" ? "assist" : "scorer"} candidates. Final squads, minutes, penalties, injuries, and odds should move the shares once imported.`,
      source: { name: "International player profiles and imported World Cup screenshots", url: "" },
    }));
}

function historicalWorldCupResultPicks(season) {
  const champions = { "2022 World Cup": "Argentina", "2018 World Cup": "France" };
  const runnersUp = { "2022 World Cup": "France", "2018 World Cup": "Croatia" };
  const semifinalists = { "2022 World Cup": ["Croatia", "Morocco"], "2018 World Cup": ["Belgium", "England"] };
  const teams = [champions[season], runnersUp[season], ...(semifinalists[season] || [])].filter(Boolean);
  const shares = marketShares(teams.map((team, index) => ({ team, rating: 100 - index * 8 })), 3);
  const markets = ["Winner", "Runner-up", "Semi-finalist", "Semi-finalist"];
  return teams.map((team, index) => ({
    rank: index + 1,
    market: `World Cup ${markets[index]} archive`,
    label: team,
    detail: `${team} finished as ${markets[index].toLowerCase()} in the ${season}.`,
    confidence: shares[index],
    note: "Archive outcome share is distributed across the final four so completed World Cup seasons display in the same ranked market format as current futures.",
    source: { name: "Imported World Cup history baseline", url: "" },
  }));
}

function historicalWorldCupPlayerPicks(season, metric = "goals") {
  const rows = loadPlayerRows()
    .filter((row) => row.season === season && row.league === "International")
    .map((row) => ({
      player: row.Player,
      team: row.Squad,
      value: numeric(metric === "assists" ? row.Ast : row.Gls),
      minutes: numeric(row.Min),
    }))
    .filter((row) => row.player && row.team && row.value > 0)
    .sort((a, b) => b.value - a.value || b.minutes - a.minutes || a.player.localeCompare(b.player))
    .slice(0, 10);
  const shares = marketShares(rows.map((row, index) => ({ rating: row.value * 10 + Math.max(0, 10 - index) })), 1);
  return rows.map((row, index, list) => ({
    rank: index + 1,
    market: metric === "assists" ? "World Cup top assist archive" : "World Cup top scorer archive",
    label: row.player,
    detail: `${row.team}: ${row.value} ${metric === "assists" ? "assists" : "goals"} in ${season}.`,
    confidence: shares[index],
    note: `Archive share is normalized to 100% across these ${list.length} players for comparison with predictive futures markets.`,
    source: { name: "Imported World Cup player standard stats", url: "" },
  }));
}

async function internationalFutures({ season = "2026 World Cup" } = {}) {
  const groups = internationalGroupTables();
  if (season !== "2026 World Cup") {
    return {
      context: "international",
      season,
      league: "International",
      generatedAt: new Date().toISOString(),
      unavailable: false,
      sourcePolicy: "Historical World Cup seasons show archive outcomes and imported top scorer/assist tables rather than future projections.",
      sections: [
        {
          id: "world-cup-archive-outcome",
          title: `${season} World Cup Outcome`,
          subtitle: "Completed tournament final-four outcome.",
          picks: historicalWorldCupResultPicks(season),
        },
        {
          id: "world-cup-archive-scorers",
          title: `${season} Top Scorers`,
          subtitle: "Imported World Cup player standard stats.",
          picks: historicalWorldCupPlayerPicks(season, "goals"),
        },
        {
          id: "world-cup-archive-assists",
          title: `${season} Top Assists`,
          subtitle: "Imported World Cup player standard stats.",
          picks: historicalWorldCupPlayerPicks(season, "assists"),
        },
      ],
    };
  }
  return {
    context: "international",
    season,
    league: "International",
    generatedAt: new Date().toISOString(),
    unavailable: false,
    message: "",
    sourcePolicy: "International futures use World Cup fixtures, group-table state, model ratings, and player-profile international baselines.",
    sections:
      season === "2026 World Cup"
        ? [
            {
              id: "world-cup-winner",
              title: "World Cup Winner Futures",
              subtitle: `${groups.length} group table${groups.length === 1 ? "" : "s"} active. Results will update these leans after each settled international fixture.`,
              picks: internationalWinnerPicks(),
            },
            {
              id: "world-cup-top-scorer",
              title: "World Cup Top Scorer Futures",
              subtitle: "Based on tracked international player profiles and prior World Cup training rows.",
              picks: internationalPlayerFutures("goals"),
            },
            {
              id: "world-cup-top-assist",
              title: "World Cup Top Assist Futures",
              subtitle: "Based on tracked international player profiles and prior World Cup training rows.",
              picks: internationalPlayerFutures("assists"),
            },
          ]
        : [],
  };
}

async function futuresPredictions({ context = "club", season, league } = {}) {
  if (context === "international") return internationalFutures({ season: season || "2026 World Cup" });
  const allCups = Object.values(DOMESTIC_CUPS).flat();
  const cupMatch = allCups.find((cup) => cup.name === league);
  if (cupMatch) {
    return {
      context: "club",
      season: season || "2026-27",
      league,
      generatedAt: new Date().toISOString(),
      unavailable: false,
      sourcePolicy: "",
      sections: [domesticCupSection(cupMatch)],
    };
  }
  return clubFutures({ season: season || "2025-26", league: league || "All" });
}

module.exports = {
  futuresPredictions,
  futuresKnockoutBracket,
};
