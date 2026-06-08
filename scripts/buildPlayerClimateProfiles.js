/**
 * scripts/buildPlayerClimateProfiles.js
 *
 * Fetches all 48 WC 2026 squad pages from Wikipedia and builds
 * a per-player climate profile for every one of the 1,248 players.
 *
 * Each profile contains:
 *   name          — player full name
 *   position      — GK / DF / MF / FW
 *   club          — current club name
 *   clubCity      — city the club plays in
 *   clubCountry   — country the club is based in
 *   avgSeasonTemp_C — average match-day temperature at that city
 *                    during the playing season (Aug–May NH / Feb–Nov SH)
 *   climateTier   — 1–5 (inherited from CLUB_COUNTRY_TIER lookup)
 *   nationalTeam  — country they represent at WC 2026
 *
 * Output → data/international/player_climate_profiles.json
 *
 * Run:  node scripts/buildPlayerClimateProfiles.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const OUT_PATH = path.join(__dirname, "..", "data", "international", "player_climate_profiles.json");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Wikipedia section title  →  fixture JSON team name
// ─────────────────────────────────────────────────────────────────────────────
const WIKI_TO_FIXTURE_TEAM = {
  "Czech Republic":  "Czechia",
  "United States":   "USA",
  "Turkey":          "Türkiye",
  "Ivory Coast":     "Côte d'Ivoire",
  "South Korea":     "Korea Republic",
  "Iran":            "IR Iran",
  "DR Congo":        "Congo DR",
  "Cape Verde":      "Cabo Verde",
  // exact matches that also need explicit listing:
  "Algeria": "Algeria", "Argentina": "Argentina", "Australia": "Australia",
  "Austria": "Austria", "Belgium": "Belgium",
  "Bosnia and Herzegovina": "Bosnia and Herzegovina",
  "Brazil": "Brazil", "Canada": "Canada", "Colombia": "Colombia",
  "Croatia": "Croatia", "Curaçao": "Curaçao", "Ecuador": "Ecuador",
  "Egypt": "Egypt", "England": "England", "France": "France",
  "Germany": "Germany", "Ghana": "Ghana", "Haiti": "Haiti",
  "Iraq": "Iraq", "Japan": "Japan", "Jordan": "Jordan",
  "Mexico": "Mexico", "Morocco": "Morocco", "Netherlands": "Netherlands",
  "New Zealand": "New Zealand", "Norway": "Norway", "Panama": "Panama",
  "Paraguay": "Paraguay", "Portugal": "Portugal", "Qatar": "Qatar",
  "Saudi Arabia": "Saudi Arabia", "Scotland": "Scotland",
  "Senegal": "Senegal", "South Africa": "South Africa", "Spain": "Spain",
  "Sweden": "Sweden", "Switzerland": "Switzerland", "Tunisia": "Tunisia",
  "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistan",
  "Republic of the Congo": "Congo DR",
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Federation flag alt-text  →  country name
// ─────────────────────────────────────────────────────────────────────────────
const FEDERATION_ALT_TO_COUNTRY = {
  // Europe
  "The Football Association":                            "England",
  "Football Association":                                "England",
  "German Football Association":                         "Germany",
  "Deutsche Fußball-Liga":                               "Germany",
  "Royal Dutch Football Association":                    "Netherlands",
  "French Football Federation":                          "France",
  "Fédération Française de Football":                    "France",
  "Royal Spanish Football Federation":                   "Spain",
  "Italian Football Federation":                         "Italy",
  "Belgian Football Association":                        "Belgium",
  "Royal Belgian Football Association":                  "Belgium",
  "Austrian Football Association":                       "Austria",
  "Swiss Football Association":                          "Switzerland",
  "Portuguese Football Federation":                      "Portugal",
  "Turkish Football Federation":                         "Turkey",
  "Scottish Football Association":                       "Scotland",
  "Football Association of the Czech Republic":          "Czech Republic",
  "Croatian Football Federation":                        "Croatia",
  "Serbian Football Association":                        "Serbia",
  "Norwegian Football Federation":                       "Norway",
  "Swedish Football Association":                        "Sweden",
  "Danish Football Association":                         "Denmark",
  "Football Federation of Ukraine":                      "Ukraine",
  "Football Association of Bosnia and Herzegovina":      "Bosnia",
  "Football Association of Bosnia-Herzegovina":          "Bosnia",
  "Football Federation of Bosnia and Herzegovina":       "Bosnia",
  "Hellenic Football Federation":                        "Greece",
  "Polish Football Association":                         "Poland",
  "Slovak Football Association":                         "Slovakia",
  "Football Federation of the Republic of Ireland":      "Ireland",
  "Football Association of Wales":                       "Wales",
  "Hungarian Football Federation":                       "Hungary",
  "Football Federation of Russia":                       "Russia",
  "Football Federation of Belarus":                      "Belarus",
  "Romanian Football Federation":                        "Romania",
  "Football Federation of Bulgaria":                     "Bulgaria",
  // South America
  "Brazilian Football Confederation":                    "Brazil",
  "Argentine Football Association":                      "Argentina",
  "Colombian Football Federation":                       "Colombia",
  "Ecuadorian Football Federation":                      "Ecuador",
  "Paraguayan Football Association":                     "Paraguay",
  "Uruguayan Football Association":                      "Uruguay",
  "Chilean Football Federation":                         "Chile",
  "Peruvian Football Federation":                        "Peru",
  "Bolivian Football Federation":                        "Bolivia",
  "Football Federation of Venezuela":                    "Venezuela",
  // CONCACAF
  "United States Soccer Federation":                     "USA",
  "Canadian Soccer Association":                         "Canada",
  "Mexican Football Federation":                         "Mexico",
  "Haitian Football Federation":                         "Haiti",
  "Panama Football Federation":                          "Panama",
  "Jamaica Football Federation":                         "Jamaica",
  "Costa Rican Football Federation":                     "Costa Rica",
  "Football Federation of the Curaçao":                  "Curaçao",
  "Curaçao Football Federation":                         "Curaçao",
  "Trinidad and Tobago Football Association":            "Trinidad and Tobago",
  // AFC
  "Football Federation of Australia":                    "Australia",
  "Japan Football Association":                          "Japan",
  "Korea Football Association":                          "South Korea",
  "Football Federation of the Islamic Republic of Iran": "Iran",
  "Iraq Football Association":                           "Iraq",
  "Jordan Football Association":                         "Jordan",
  "Qatar Football Association":                          "Qatar",
  "Saudi Arabian Football Federation":                   "Saudi Arabia",
  "Football Association of Uzbekistan":                  "Uzbekistan",
  "China Football Association":                          "China",
  "Football Association of Thailand":                    "Thailand",
  "Football Federation of Tajikistan":                   "Tajikistan",
  "Football Association of Singapore":                   "Singapore",
  "Maldives Football Association":                       "Maldives",
  "Football Association of Malaysia":                    "Malaysia",
  "Football Association of Indonesia":                   "Indonesia",
  "Football Association of Vietnam":                     "Vietnam",
  "United Arab Emirates Football Association":           "UAE",
  "Kuwait Football Association":                         "Kuwait",
  "Bahrain Football Association":                        "Bahrain",
  "Palestinian Football Federation":                     "Palestine",
  "Oman Football Association":                           "Oman",
  // CAF
  "Ghana Football Association":                          "Ghana",
  "Senegal Football Federation":                         "Senegal",
  "Fédération Sénégalaise de Football":                  "Senegal",
  "Nigerian Football Federation":                        "Nigeria",
  "Egyptian Football Association":                       "Egypt",
  "Algerian Football Federation":                        "Algeria",
  "Royal Moroccan Football Federation":                  "Morocco",
  "Tunisian Football Federation":                        "Tunisia",
  "South African Football Association":                  "South Africa",
  "Football Association of the Democratic Republic of Congo": "Congo DR",
  "Fédération Congolaise de Football-Association":       "Congo DR",
  "Federation Ivoirienne de Football":                   "Ivory Coast",
  "Fédération Ivoirienne de Football":                   "Ivory Coast",
  "Confederation of African Football":                   "Africa",
  "Football Federation of Cape Verde":                   "Cape Verde",
  "Football Federation of Angola":                       "Angola",
  "Football Federation of Cameroon":                     "Cameroon",
  "Ethiopian Football Federation":                       "Ethiopia",
  "Football Federation of Kenya":                        "Kenya",
  "Football Federation of Tanzania":                     "Tanzania",
  "Football Federation of Zimbabwe":                     "Zimbabwe",
  "Football Federation of Zambia":                       "Zambia",
  "Football Federation of Uganda":                       "Uganda",
  "Football Federation of Rwanda":                       "Rwanda",
  "Football Federation of Mozambique":                   "Mozambique",
  // OFC
  "New Zealand Football":                                "New Zealand",
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Flag URL country slug  →  country name (fallback)
//    Extracts from patterns like "Flag_of_the_Netherlands.svg"
// ─────────────────────────────────────────────────────────────────────────────
function countryFromFlagUrl(imgHtml) {
  const m = imgHtml.match(/Flag_of_([^./]+(?:_[^./]+)*)\.svg/i);
  if (!m) return null;
  return m[1].replace(/_/g, " ")
    .replace(/^the /i, "")
    .replace(/^The /i, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Comprehensive club → city + avg season temp (°C) lookup
//    Season = Aug–May (N. hemisphere) or Feb–Nov (S. hemisphere)
//    Temperature = weighted match-day average for that window
// ─────────────────────────────────────────────────────────────────────────────
const CLUB_CITY_TEMP = {
  // ── ENGLAND – Premier League ─────────────────────────────────────────────
  "Arsenal":                    { city: "London",        country: "England",      temp: 12 },
  "Chelsea":                    { city: "London",        country: "England",      temp: 12 },
  "Tottenham Hotspur":          { city: "London",        country: "England",      temp: 12 },
  "Tottenham":                  { city: "London",        country: "England",      temp: 12 },
  "West Ham United":            { city: "London",        country: "England",      temp: 12 },
  "Crystal Palace":             { city: "London",        country: "England",      temp: 12 },
  "Brentford":                  { city: "London",        country: "England",      temp: 12 },
  "Fulham":                     { city: "London",        country: "England",      temp: 12 },
  "Manchester City":            { city: "Manchester",    country: "England",      temp: 10 },
  "Manchester United":          { city: "Manchester",    country: "England",      temp: 10 },
  "Liverpool":                  { city: "Liverpool",     country: "England",      temp: 11 },
  "Everton":                    { city: "Liverpool",     country: "England",      temp: 11 },
  "Newcastle United":           { city: "Newcastle",     country: "England",      temp:  9 },
  "Aston Villa":                { city: "Birmingham",    country: "England",      temp: 10 },
  "Wolverhampton Wanderers":    { city: "Wolverhampton", country: "England",      temp: 10 },
  "Wolves":                     { city: "Wolverhampton", country: "England",      temp: 10 },
  "Brighton & Hove Albion":     { city: "Brighton",      country: "England",      temp: 12 },
  "Brighton":                   { city: "Brighton",      country: "England",      temp: 12 },
  "Nottingham Forest":          { city: "Nottingham",    country: "England",      temp: 11 },
  "Leicester City":             { city: "Leicester",     country: "England",      temp: 10 },
  "Ipswich Town":               { city: "Ipswich",       country: "England",      temp: 11 },
  "Southampton":                { city: "Southampton",   country: "England",      temp: 12 },
  "Bournemouth":                { city: "Bournemouth",   country: "England",      temp: 12 },
  "AFC Bournemouth":            { city: "Bournemouth",   country: "England",      temp: 12 },
  "Sheffield United":           { city: "Sheffield",     country: "England",      temp: 10 },
  "Leeds United":               { city: "Leeds",         country: "England",      temp: 10 },
  "Burnley":                    { city: "Burnley",       country: "England",      temp: 10 },
  "Middlesbrough":              { city: "Middlesbrough", country: "England",      temp:  9 },
  "Sunderland":                 { city: "Sunderland",    country: "England",      temp:  9 },
  "Luton Town":                 { city: "Luton",         country: "England",      temp: 11 },
  // ── GERMANY – Bundesliga ────────────────────────────────────────────────
  "Bayern Munich":              { city: "Munich",        country: "Germany",      temp:  9 },
  "FC Bayern Munich":           { city: "Munich",        country: "Germany",      temp:  9 },
  "Borussia Dortmund":          { city: "Dortmund",      country: "Germany",      temp: 10 },
  "Bayer Leverkusen":           { city: "Leverkusen",    country: "Germany",      temp: 11 },
  "RB Leipzig":                 { city: "Leipzig",       country: "Germany",      temp: 10 },
  "Eintracht Frankfurt":        { city: "Frankfurt",     country: "Germany",      temp: 11 },
  "VfB Stuttgart":              { city: "Stuttgart",     country: "Germany",      temp: 11 },
  "Stuttgart":                  { city: "Stuttgart",     country: "Germany",      temp: 11 },
  "Borussia Mönchengladbach":   { city: "Mönchengladbach", country: "Germany",    temp: 11 },
  "SC Freiburg":                { city: "Freiburg",      country: "Germany",      temp: 11 },
  "TSG 1899 Hoffenheim":        { city: "Sinsheim",      country: "Germany",      temp: 11 },
  "Hoffenheim":                 { city: "Sinsheim",      country: "Germany",      temp: 11 },
  "VfL Wolfsburg":              { city: "Wolfsburg",     country: "Germany",      temp: 10 },
  "Wolfsburg":                  { city: "Wolfsburg",     country: "Germany",      temp: 10 },
  "FC Augsburg":                { city: "Augsburg",      country: "Germany",      temp:  9 },
  "Augsburg":                   { city: "Augsburg",      country: "Germany",      temp:  9 },
  "1. FSV Mainz 05":            { city: "Mainz",         country: "Germany",      temp: 11 },
  "Mainz 05":                   { city: "Mainz",         country: "Germany",      temp: 11 },
  "Mainz":                      { city: "Mainz",         country: "Germany",      temp: 11 },
  "Union Berlin":               { city: "Berlin",        country: "Germany",      temp: 10 },
  "1. FC Union Berlin":         { city: "Berlin",        country: "Germany",      temp: 10 },
  "Hertha BSC":                 { city: "Berlin",        country: "Germany",      temp: 10 },
  "Werder Bremen":              { city: "Bremen",        country: "Germany",      temp: 10 },
  "SV Werder Bremen":           { city: "Bremen",        country: "Germany",      temp: 10 },
  "FC Köln":                    { city: "Cologne",       country: "Germany",      temp: 11 },
  "FC Heidenheim":              { city: "Heidenheim",    country: "Germany",      temp: 10 },
  "Holstein Kiel":              { city: "Kiel",          country: "Germany",      temp:  9 },
  "St. Pauli":                  { city: "Hamburg",       country: "Germany",      temp: 10 },
  "FC St. Pauli":               { city: "Hamburg",       country: "Germany",      temp: 10 },
  "Hamburger SV":               { city: "Hamburg",       country: "Germany",      temp: 10 },
  // ── SPAIN – La Liga ─────────────────────────────────────────────────────
  "Real Madrid":                { city: "Madrid",        country: "Spain",        temp: 14 },
  "Barcelona":                  { city: "Barcelona",     country: "Spain",        temp: 16 },
  "FC Barcelona":               { city: "Barcelona",     country: "Spain",        temp: 16 },
  "Atlético Madrid":            { city: "Madrid",        country: "Spain",        temp: 14 },
  "Atletico Madrid":            { city: "Madrid",        country: "Spain",        temp: 14 },
  "Sevilla":                    { city: "Sevilla",       country: "Spain",        temp: 18 },
  "Sevilla FC":                 { city: "Sevilla",       country: "Spain",        temp: 18 },
  "Valencia":                   { city: "Valencia",      country: "Spain",        temp: 17 },
  "Valencia CF":                { city: "Valencia",      country: "Spain",        temp: 17 },
  "Villarreal":                 { city: "Villarreal",    country: "Spain",        temp: 17 },
  "Athletic Bilbao":            { city: "Bilbao",        country: "Spain",        temp: 14 },
  "Athletic Club":              { city: "Bilbao",        country: "Spain",        temp: 14 },
  "Real Sociedad":              { city: "San Sebastián", country: "Spain",        temp: 13 },
  "Real Betis":                 { city: "Sevilla",       country: "Spain",        temp: 18 },
  "Osasuna":                    { city: "Pamplona",      country: "Spain",        temp: 13 },
  "Celta Vigo":                 { city: "Vigo",          country: "Spain",        temp: 14 },
  "Celta de Vigo":              { city: "Vigo",          country: "Spain",        temp: 14 },
  "Getafe":                     { city: "Madrid",        country: "Spain",        temp: 14 },
  "Getafe CF":                  { city: "Madrid",        country: "Spain",        temp: 14 },
  "Rayo Vallecano":             { city: "Madrid",        country: "Spain",        temp: 14 },
  "Girona":                     { city: "Girona",        country: "Spain",        temp: 16 },
  "Girona FC":                  { city: "Girona",        country: "Spain",        temp: 16 },
  "Deportivo Alavés":           { city: "Vitoria",       country: "Spain",        temp: 13 },
  "Las Palmas":                 { city: "Las Palmas",    country: "Spain",        temp: 21 },
  "Mallorca":                   { city: "Palma",         country: "Spain",        temp: 18 },
  "Leganés":                    { city: "Madrid",        country: "Spain",        temp: 14 },
  "Valladolid":                 { city: "Valladolid",    country: "Spain",        temp: 13 },
  "Espanyol":                   { city: "Barcelona",     country: "Spain",        temp: 16 },
  "RCD Espanyol":               { city: "Barcelona",     country: "Spain",        temp: 16 },
  // ── FRANCE – Ligue 1 ────────────────────────────────────────────────────
  "Paris Saint-Germain":        { city: "Paris",         country: "France",       temp: 12 },
  "PSG":                        { city: "Paris",         country: "France",       temp: 12 },
  "Monaco":                     { city: "Monaco",        country: "Monaco",       temp: 16 },
  "AS Monaco":                  { city: "Monaco",        country: "Monaco",       temp: 16 },
  "Olympique de Marseille":     { city: "Marseille",     country: "France",       temp: 16 },
  "Marseille":                  { city: "Marseille",     country: "France",       temp: 16 },
  "Olympique Lyonnais":         { city: "Lyon",          country: "France",       temp: 13 },
  "Lyon":                       { city: "Lyon",          country: "France",       temp: 13 },
  "Lens":                       { city: "Lens",          country: "France",       temp: 11 },
  "RC Lens":                    { city: "Lens",          country: "France",       temp: 11 },
  "Stade Rennais":              { city: "Rennes",        country: "France",       temp: 12 },
  "Rennes":                     { city: "Rennes",        country: "France",       temp: 12 },
  "OGC Nice":                   { city: "Nice",          country: "France",       temp: 16 },
  "Nice":                       { city: "Nice",          country: "France",       temp: 16 },
  "Nantes":                     { city: "Nantes",        country: "France",       temp: 13 },
  "FC Nantes":                  { city: "Nantes",        country: "France",       temp: 13 },
  "Toulouse":                   { city: "Toulouse",      country: "France",       temp: 14 },
  "Toulouse FC":                { city: "Toulouse",      country: "France",       temp: 14 },
  "Stade de Reims":             { city: "Reims",         country: "France",       temp: 11 },
  "Reims":                      { city: "Reims",         country: "France",       temp: 11 },
  "Stade Brestois":             { city: "Brest",         country: "France",       temp: 13 },
  "Brest":                      { city: "Brest",         country: "France",       temp: 13 },
  "Montpellier":                { city: "Montpellier",   country: "France",       temp: 16 },
  "MHSC":                       { city: "Montpellier",   country: "France",       temp: 16 },
  "Strasbourg":                 { city: "Strasbourg",    country: "France",       temp: 11 },
  "RC Strasbourg":              { city: "Strasbourg",    country: "France",       temp: 11 },
  "Angers":                     { city: "Angers",        country: "France",       temp: 13 },
  "SCO Angers":                 { city: "Angers",        country: "France",       temp: 13 },
  "Le Havre":                   { city: "Le Havre",      country: "France",       temp: 12 },
  "AC Le Havre":                { city: "Le Havre",      country: "France",       temp: 12 },
  "Auxerre":                    { city: "Auxerre",       country: "France",       temp: 11 },
  "AJ Auxerre":                 { city: "Auxerre",       country: "France",       temp: 11 },
  "Saint-Étienne":              { city: "Saint-Étienne", country: "France",       temp: 12 },
  "AS Saint-Étienne":           { city: "Saint-Étienne", country: "France",       temp: 12 },
  "Lille":                      { city: "Lille",         country: "France",       temp: 11 },
  "LOSC Lille":                 { city: "Lille",         country: "France",       temp: 11 },
  // ── ITALY – Serie A ─────────────────────────────────────────────────────
  "Inter Milan":                { city: "Milan",         country: "Italy",        temp: 13 },
  "Internazionale":             { city: "Milan",         country: "Italy",        temp: 13 },
  "AC Milan":                   { city: "Milan",         country: "Italy",        temp: 13 },
  "Milan":                      { city: "Milan",         country: "Italy",        temp: 13 },
  "Juventus":                   { city: "Turin",         country: "Italy",        temp: 12 },
  "Napoli":                     { city: "Naples",        country: "Italy",        temp: 17 },
  "SSC Napoli":                 { city: "Naples",        country: "Italy",        temp: 17 },
  "AS Roma":                    { city: "Rome",          country: "Italy",        temp: 16 },
  "Roma":                       { city: "Rome",          country: "Italy",        temp: 16 },
  "Lazio":                      { city: "Rome",          country: "Italy",        temp: 16 },
  "SS Lazio":                   { city: "Rome",          country: "Italy",        temp: 16 },
  "Fiorentina":                 { city: "Florence",      country: "Italy",        temp: 14 },
  "ACF Fiorentina":             { city: "Florence",      country: "Italy",        temp: 14 },
  "Atalanta":                   { city: "Bergamo",       country: "Italy",        temp: 12 },
  "Atalanta BC":                { city: "Bergamo",       country: "Italy",        temp: 12 },
  "Torino":                     { city: "Turin",         country: "Italy",        temp: 12 },
  "Torino FC":                  { city: "Turin",         country: "Italy",        temp: 12 },
  "Bologna":                    { city: "Bologna",       country: "Italy",        temp: 13 },
  "Bologna FC":                 { city: "Bologna",       country: "Italy",        temp: 13 },
  "Verona":                     { city: "Verona",        country: "Italy",        temp: 13 },
  "Hellas Verona":              { city: "Verona",        country: "Italy",        temp: 13 },
  "Genoa":                      { city: "Genoa",         country: "Italy",        temp: 15 },
  "Genoa CFC":                  { city: "Genoa",         country: "Italy",        temp: 15 },
  "Cagliari":                   { city: "Cagliari",      country: "Italy",        temp: 17 },
  "Cagliari Calcio":            { city: "Cagliari",      country: "Italy",        temp: 17 },
  "Udinese":                    { city: "Udine",         country: "Italy",        temp: 13 },
  "Como":                       { city: "Como",          country: "Italy",        temp: 13 },
  "Empoli":                     { city: "Empoli",        country: "Italy",        temp: 14 },
  "Venezia":                    { city: "Venice",        country: "Italy",        temp: 13 },
  "Monza":                      { city: "Monza",         country: "Italy",        temp: 13 },
  "Parma":                      { city: "Parma",         country: "Italy",        temp: 13 },
  "Lecce":                      { city: "Lecce",         country: "Italy",        temp: 17 },
  "US Lecce":                   { city: "Lecce",         country: "Italy",        temp: 17 },
  // ── NETHERLANDS – Eredivisie ────────────────────────────────────────────
  "Ajax":                       { city: "Amsterdam",     country: "Netherlands",  temp: 10 },
  "PSV Eindhoven":              { city: "Eindhoven",     country: "Netherlands",  temp: 11 },
  "PSV":                        { city: "Eindhoven",     country: "Netherlands",  temp: 11 },
  "Feyenoord":                  { city: "Rotterdam",     country: "Netherlands",  temp: 10 },
  "AZ Alkmaar":                 { city: "Alkmaar",       country: "Netherlands",  temp: 10 },
  "AZ":                         { city: "Alkmaar",       country: "Netherlands",  temp: 10 },
  "FC Twente":                  { city: "Enschede",      country: "Netherlands",  temp: 10 },
  "Twente":                     { city: "Enschede",      country: "Netherlands",  temp: 10 },
  "FC Utrecht":                 { city: "Utrecht",       country: "Netherlands",  temp: 10 },
  "Utrecht":                    { city: "Utrecht",       country: "Netherlands",  temp: 10 },
  "NEC Nijmegen":               { city: "Nijmegen",      country: "Netherlands",  temp: 11 },
  "NEC":                        { city: "Nijmegen",      country: "Netherlands",  temp: 11 },
  "Sparta Rotterdam":           { city: "Rotterdam",     country: "Netherlands",  temp: 10 },
  "Go Ahead Eagles":            { city: "Deventer",      country: "Netherlands",  temp: 10 },
  // ── PORTUGAL – Primeira Liga ────────────────────────────────────────────
  "Benfica":                    { city: "Lisbon",        country: "Portugal",     temp: 16 },
  "SL Benfica":                 { city: "Lisbon",        country: "Portugal",     temp: 16 },
  "Porto":                      { city: "Porto",         country: "Portugal",     temp: 15 },
  "FC Porto":                   { city: "Porto",         country: "Portugal",     temp: 15 },
  "Sporting CP":                { city: "Lisbon",        country: "Portugal",     temp: 16 },
  "Sporting":                   { city: "Lisbon",        country: "Portugal",     temp: 16 },
  "Braga":                      { city: "Braga",         country: "Portugal",     temp: 14 },
  "SC Braga":                   { city: "Braga",         country: "Portugal",     temp: 14 },
  "Vitória de Guimarães":       { city: "Guimarães",     country: "Portugal",     temp: 14 },
  "Vitória Guimarães":          { city: "Guimarães",     country: "Portugal",     temp: 14 },
  "Estoril":                    { city: "Estoril",       country: "Portugal",     temp: 16 },
  "Gil Vicente":                { city: "Barcelos",      country: "Portugal",     temp: 14 },
  "Casa Pia":                   { city: "Lisbon",        country: "Portugal",     temp: 16 },
  // ── BELGIUM – Pro League ────────────────────────────────────────────────
  "Club Brugge":                { city: "Bruges",        country: "Belgium",      temp: 11 },
  "Anderlecht":                 { city: "Brussels",      country: "Belgium",      temp: 11 },
  "RSC Anderlecht":             { city: "Brussels",      country: "Belgium",      temp: 11 },
  "Gent":                       { city: "Ghent",         country: "Belgium",      temp: 11 },
  "KAA Gent":                   { city: "Ghent",         country: "Belgium",      temp: 11 },
  "Royal Antwerp":              { city: "Antwerp",       country: "Belgium",      temp: 11 },
  "Antwerp":                    { city: "Antwerp",       country: "Belgium",      temp: 11 },
  "Union Saint-Gilloise":       { city: "Brussels",      country: "Belgium",      temp: 11 },
  "Standard Liège":             { city: "Liège",         country: "Belgium",      temp: 11 },
  "Cercle Brugge":              { city: "Bruges",        country: "Belgium",      temp: 11 },
  "Genk":                       { city: "Genk",          country: "Belgium",      temp: 11 },
  "KRC Genk":                   { city: "Genk",          country: "Belgium",      temp: 11 },
  "Westerlo":                   { city: "Westerlo",      country: "Belgium",      temp: 11 },
  // ── AUSTRIA ─────────────────────────────────────────────────────────────
  "Red Bull Salzburg":          { city: "Salzburg",      country: "Austria",      temp:  9 },
  "FC Red Bull Salzburg":       { city: "Salzburg",      country: "Austria",      temp:  9 },
  "Salzburg":                   { city: "Salzburg",      country: "Austria",      temp:  9 },
  "Sturm Graz":                 { city: "Graz",          country: "Austria",      temp: 11 },
  "SK Sturm Graz":              { city: "Graz",          country: "Austria",      temp: 11 },
  "Rapid Wien":                 { city: "Vienna",        country: "Austria",      temp: 11 },
  "SK Rapid Wien":              { city: "Vienna",        country: "Austria",      temp: 11 },
  "LASK":                       { city: "Linz",          country: "Austria",      temp: 11 },
  "Austria Wien":               { city: "Vienna",        country: "Austria",      temp: 11 },
  "FK Austria Wien":            { city: "Vienna",        country: "Austria",      temp: 11 },
  // ── SWITZERLAND ─────────────────────────────────────────────────────────
  "FC Basel":                   { city: "Basel",         country: "Switzerland",  temp: 11 },
  "Basel":                      { city: "Basel",         country: "Switzerland",  temp: 11 },
  "Young Boys":                 { city: "Bern",          country: "Switzerland",  temp: 10 },
  "BSC Young Boys":             { city: "Bern",          country: "Switzerland",  temp: 10 },
  "FC Zürich":                  { city: "Zürich",        country: "Switzerland",  temp: 10 },
  "Zürich":                     { city: "Zürich",        country: "Switzerland",  temp: 10 },
  "Servette":                   { city: "Geneva",        country: "Switzerland",  temp: 11 },
  "Servette FC":                { city: "Geneva",        country: "Switzerland",  temp: 11 },
  "Lausanne-Sport":             { city: "Lausanne",      country: "Switzerland",  temp: 11 },
  "FC Lugano":                  { city: "Lugano",        country: "Switzerland",  temp: 13 },
  "FC Luzern":                  { city: "Lucerne",       country: "Switzerland",  temp: 11 },
  "Grasshopper":                { city: "Zürich",        country: "Switzerland",  temp: 10 },
  "Grasshopper Club Zürich":    { city: "Zürich",        country: "Switzerland",  temp: 10 },
  "St. Gallen":                 { city: "St. Gallen",    country: "Switzerland",  temp: 10 },
  "FC St. Gallen":              { city: "St. Gallen",    country: "Switzerland",  temp: 10 },
  // ── TURKEY – Süper Lig ──────────────────────────────────────────────────
  "Galatasaray":                { city: "Istanbul",      country: "Turkey",       temp: 15 },
  "Fenerbahçe":                 { city: "Istanbul",      country: "Turkey",       temp: 15 },
  "Fenerbahce":                 { city: "Istanbul",      country: "Turkey",       temp: 15 },
  "Beşiktaş":                   { city: "Istanbul",      country: "Turkey",       temp: 15 },
  "Besiktas":                   { city: "Istanbul",      country: "Turkey",       temp: 15 },
  "Trabzonspor":                { city: "Trabzon",       country: "Turkey",       temp: 13 },
  "Başakşehir":                 { city: "Istanbul",      country: "Turkey",       temp: 15 },
  "Istanbul Başakşehir":        { city: "Istanbul",      country: "Turkey",       temp: 15 },
  "Konyaspor":                  { city: "Konya",         country: "Turkey",       temp: 14 },
  "Sivasspor":                  { city: "Sivas",         country: "Turkey",       temp: 11 },
  "Alanyaspor":                 { city: "Alanya",        country: "Turkey",       temp: 20 },
  "Gaziantep FK":               { city: "Gaziantep",     country: "Turkey",       temp: 17 },
  "Antalyaspor":                { city: "Antalya",       country: "Turkey",       temp: 20 },
  "Kasımpaşa":                  { city: "Istanbul",      country: "Turkey",       temp: 15 },
  "Hatayspor":                  { city: "Hatay",         country: "Turkey",       temp: 18 },
  "Kayserispor":                { city: "Kayseri",       country: "Turkey",       temp: 13 },
  "Ankaragücü":                 { city: "Ankara",        country: "Turkey",       temp: 13 },
  "MKE Ankaragücü":             { city: "Ankara",        country: "Turkey",       temp: 13 },
  "Samsunspor":                 { city: "Samsun",        country: "Turkey",       temp: 13 },
  // ── SCOTLAND ────────────────────────────────────────────────────────────
  "Celtic":                     { city: "Glasgow",       country: "Scotland",     temp: 10 },
  "Rangers":                    { city: "Glasgow",       country: "Scotland",     temp: 10 },
  "Hearts":                     { city: "Edinburgh",     country: "Scotland",     temp:  9 },
  "Heart of Midlothian":        { city: "Edinburgh",     country: "Scotland",     temp:  9 },
  "Hibernian":                  { city: "Edinburgh",     country: "Scotland",     temp:  9 },
  "Aberdeen":                   { city: "Aberdeen",      country: "Scotland",     temp:  8 },
  "Kilmarnock":                 { city: "Kilmarnock",    country: "Scotland",     temp: 10 },
  "St Mirren":                  { city: "Paisley",       country: "Scotland",     temp: 10 },
  // ── CZECH REPUBLIC ──────────────────────────────────────────────────────
  "Slavia Prague":              { city: "Prague",        country: "Czech Republic", temp: 10 },
  "SK Slavia Prague":           { city: "Prague",        country: "Czech Republic", temp: 10 },
  "Sparta Prague":              { city: "Prague",        country: "Czech Republic", temp: 10 },
  "AC Sparta Prague":           { city: "Prague",        country: "Czech Republic", temp: 10 },
  "Viktoria Plzeň":             { city: "Pilsen",        country: "Czech Republic", temp: 10 },
  "Viktoria Plzen":             { city: "Pilsen",        country: "Czech Republic", temp: 10 },
  // ── CROATIA ─────────────────────────────────────────────────────────────
  "Dinamo Zagreb":              { city: "Zagreb",        country: "Croatia",      temp: 12 },
  "GNK Dinamo Zagreb":          { city: "Zagreb",        country: "Croatia",      temp: 12 },
  "Hajduk Split":               { city: "Split",         country: "Croatia",      temp: 15 },
  // ── NORWAY ──────────────────────────────────────────────────────────────
  "Bodø/Glimt":                 { city: "Bodø",          country: "Norway",       temp:  6 },
  "Rosenborg":                  { city: "Trondheim",     country: "Norway",       temp:  7 },
  "Brann":                      { city: "Bergen",        country: "Norway",       temp:  9 },
  "SK Brann":                   { city: "Bergen",        country: "Norway",       temp:  9 },
  "Molde":                      { city: "Molde",         country: "Norway",       temp:  8 },
  "Molde FK":                   { city: "Molde",         country: "Norway",       temp:  8 },
  // ── SWEDEN ──────────────────────────────────────────────────────────────
  "Malmö FF":                   { city: "Malmö",         country: "Sweden",       temp: 10 },
  "Malmo FF":                   { city: "Malmö",         country: "Sweden",       temp: 10 },
  "Djurgårdens IF":             { city: "Stockholm",     country: "Sweden",       temp:  8 },
  "Djurgarden":                 { city: "Stockholm",     country: "Sweden",       temp:  8 },
  "IFK Göteborg":               { city: "Gothenburg",    country: "Sweden",       temp:  9 },
  "Hammarby IF":                { city: "Stockholm",     country: "Sweden",       temp:  8 },
  "Hammarby":                   { city: "Stockholm",     country: "Sweden",       temp:  8 },
  "Häcken":                     { city: "Gothenburg",    country: "Sweden",       temp:  9 },
  // ── DENMARK ─────────────────────────────────────────────────────────────
  "FC Copenhagen":              { city: "Copenhagen",    country: "Denmark",      temp:  9 },
  "Brøndby IF":                 { city: "Brøndby",       country: "Denmark",      temp:  9 },
  "FC Midtjylland":             { city: "Herning",       country: "Denmark",      temp:  9 },
  "Midtjylland":                { city: "Herning",       country: "Denmark",      temp:  9 },
  // ── SAUDI ARABIA ────────────────────────────────────────────────────────
  "Al-Hilal":                   { city: "Riyadh",        country: "Saudi Arabia", temp: 26 },
  "Al Hilal":                   { city: "Riyadh",        country: "Saudi Arabia", temp: 26 },
  "Al-Nassr":                   { city: "Riyadh",        country: "Saudi Arabia", temp: 26 },
  "Al Nassr":                   { city: "Riyadh",        country: "Saudi Arabia", temp: 26 },
  "Al-Ahli":                    { city: "Jeddah",        country: "Saudi Arabia", temp: 29 },
  "Al Ahli":                    { city: "Jeddah",        country: "Saudi Arabia", temp: 29 },
  "Al-Ittihad":                 { city: "Jeddah",        country: "Saudi Arabia", temp: 29 },
  "Al Ittihad":                 { city: "Jeddah",        country: "Saudi Arabia", temp: 29 },
  "Al-Qadsiah":                 { city: "Al-Khobar",     country: "Saudi Arabia", temp: 28 },
  "Al-Ettifaq":                 { city: "Dammam",        country: "Saudi Arabia", temp: 28 },
  "Al-Shabab":                  { city: "Riyadh",        country: "Saudi Arabia", temp: 26 },
  "Al-Fayha":                   { city: "Al-Majma'ah",   country: "Saudi Arabia", temp: 26 },
  "Al-Qadisiyah":               { city: "Al-Khobar",     country: "Saudi Arabia", temp: 28 },
  "Al-Taawoun":                 { city: "Buraidah",      country: "Saudi Arabia", temp: 24 },
  "Al-Riyadh":                  { city: "Riyadh",        country: "Saudi Arabia", temp: 26 },
  "Al-Wehda":                   { city: "Mecca",         country: "Saudi Arabia", temp: 30 },
  "Al-Raed":                    { city: "Buraidah",      country: "Saudi Arabia", temp: 24 },
  // ── BRAZIL ──────────────────────────────────────────────────────────────
  "Flamengo":                   { city: "Rio de Janeiro", country: "Brazil",      temp: 24 },
  "CR Vasco da Gama":           { city: "Rio de Janeiro", country: "Brazil",      temp: 24 },
  "Vasco da Gama":              { city: "Rio de Janeiro", country: "Brazil",      temp: 24 },
  "Fluminense":                 { city: "Rio de Janeiro", country: "Brazil",      temp: 24 },
  "Botafogo":                   { city: "Rio de Janeiro", country: "Brazil",      temp: 24 },
  "Palmeiras":                  { city: "São Paulo",     country: "Brazil",       temp: 20 },
  "São Paulo FC":               { city: "São Paulo",     country: "Brazil",       temp: 20 },
  "São Paulo":                  { city: "São Paulo",     country: "Brazil",       temp: 20 },
  "Corinthians":                { city: "São Paulo",     country: "Brazil",       temp: 20 },
  "Santos":                     { city: "Santos",        country: "Brazil",       temp: 21 },
  "Atletico MG":                { city: "Belo Horizonte", country: "Brazil",      temp: 21 },
  "Atlético Mineiro":           { city: "Belo Horizonte", country: "Brazil",      temp: 21 },
  "Cruzeiro":                   { city: "Belo Horizonte", country: "Brazil",      temp: 21 },
  "Internacional":              { city: "Porto Alegre",  country: "Brazil",       temp: 19 },
  "SC Internacional":           { city: "Porto Alegre",  country: "Brazil",       temp: 19 },
  "Grêmio":                     { city: "Porto Alegre",  country: "Brazil",       temp: 19 },
  "Bahia":                      { city: "Salvador",      country: "Brazil",       temp: 26 },
  "EC Bahia":                   { city: "Salvador",      country: "Brazil",       temp: 26 },
  "Fortaleza":                  { city: "Fortaleza",     country: "Brazil",       temp: 28 },
  "Fortaleza EC":               { city: "Fortaleza",     country: "Brazil",       temp: 28 },
  "Sport Recife":               { city: "Recife",        country: "Brazil",       temp: 27 },
  "RB Bragantino":              { city: "Bragança Paulista", country: "Brazil",   temp: 20 },
  "Red Bull Bragantino":        { city: "Bragança Paulista", country: "Brazil",   temp: 20 },
  "Athletico Paranaense":       { city: "Curitiba",      country: "Brazil",       temp: 18 },
  "Atlético Paranaense":        { city: "Curitiba",      country: "Brazil",       temp: 18 },
  "Coritiba":                   { city: "Curitiba",      country: "Brazil",       temp: 18 },
  "Ceará":                      { city: "Fortaleza",     country: "Brazil",       temp: 28 },
  "Criciúma":                   { city: "Criciúma",      country: "Brazil",       temp: 19 },
  "Juventude":                  { city: "Caxias do Sul", country: "Brazil",       temp: 18 },
  // ── ARGENTINA ───────────────────────────────────────────────────────────
  "River Plate":                { city: "Buenos Aires",  country: "Argentina",    temp: 17 },
  "Boca Juniors":               { city: "Buenos Aires",  country: "Argentina",    temp: 17 },
  "Racing Club":                { city: "Avellaneda",    country: "Argentina",    temp: 17 },
  "Independiente":              { city: "Avellaneda",    country: "Argentina",    temp: 17 },
  "San Lorenzo":                { city: "Buenos Aires",  country: "Argentina",    temp: 17 },
  "Belgrano":                   { city: "Córdoba",       country: "Argentina",    temp: 17 },
  "Estudiantes":                { city: "La Plata",      country: "Argentina",    temp: 17 },
  "Talleres":                   { city: "Córdoba",       country: "Argentina",    temp: 17 },
  "Huracán":                    { city: "Buenos Aires",  country: "Argentina",    temp: 17 },
  "Lanús":                      { city: "Lanús",         country: "Argentina",    temp: 17 },
  "Vélez Sársfield":            { city: "Buenos Aires",  country: "Argentina",    temp: 17 },
  "Velez Sarsfield":            { city: "Buenos Aires",  country: "Argentina",    temp: 17 },
  "Tigre":                      { city: "Buenos Aires",  country: "Argentina",    temp: 17 },
  "Rosario Central":            { city: "Rosario",       country: "Argentina",    temp: 18 },
  "Newell's Old Boys":          { city: "Rosario",       country: "Argentina",    temp: 18 },
  "Godoy Cruz":                 { city: "Mendoza",       country: "Argentina",    temp: 16 },
  "Atlético Tucumán":           { city: "Tucumán",       country: "Argentina",    temp: 20 },
  "San Martín de San Juan":     { city: "San Juan",      country: "Argentina",    temp: 18 },
  // ── COLOMBIA ────────────────────────────────────────────────────────────
  "Millonarios":                { city: "Bogotá",        country: "Colombia",     temp: 14 },
  "Atlético Nacional":          { city: "Medellín",      country: "Colombia",     temp: 22 },
  "Deportivo Cali":             { city: "Cali",          country: "Colombia",     temp: 24 },
  "Santa Fe":                   { city: "Bogotá",        country: "Colombia",     temp: 14 },
  "Junior":                     { city: "Barranquilla",  country: "Colombia",     temp: 30 },
  "Deportes Tolima":            { city: "Ibagué",        country: "Colombia",     temp: 22 },
  "Once Caldas":                { city: "Manizales",     country: "Colombia",     temp: 17 },
  "Envigado":                   { city: "Envigado",      country: "Colombia",     temp: 22 },
  // ── ECUADOR ─────────────────────────────────────────────────────────────
  "LDU Quito":                  { city: "Quito",         country: "Ecuador",      temp: 14 },
  "Liga de Quito":              { city: "Quito",         country: "Ecuador",      temp: 14 },
  "Barcelona SC":               { city: "Guayaquil",     country: "Ecuador",      temp: 27 },
  "Emelec":                     { city: "Guayaquil",     country: "Ecuador",      temp: 27 },
  "Independiente del Valle":    { city: "Sangolquí",     country: "Ecuador",      temp: 16 },
  "El Nacional":                { city: "Quito",         country: "Ecuador",      temp: 14 },
  "Aucas":                      { city: "Quito",         country: "Ecuador",      temp: 14 },
  "Mushuc Runa":                { city: "Ambato",        country: "Ecuador",      temp: 16 },
  // ── MEXICO – Liga MX ────────────────────────────────────────────────────
  "Club América":               { city: "Mexico City",   country: "Mexico",       temp: 16 },
  "América":                    { city: "Mexico City",   country: "Mexico",       temp: 16 },
  "Chivas":                     { city: "Guadalajara",   country: "Mexico",       temp: 20 },
  "Chivas de Guadalajara":      { city: "Guadalajara",   country: "Mexico",       temp: 20 },
  "Guadalajara":                { city: "Guadalajara",   country: "Mexico",       temp: 20 },
  "Cruz Azul":                  { city: "Mexico City",   country: "Mexico",       temp: 16 },
  "UNAM Pumas":                 { city: "Mexico City",   country: "Mexico",       temp: 16 },
  "Pumas UNAM":                 { city: "Mexico City",   country: "Mexico",       temp: 16 },
  "Tigres UANL":                { city: "Monterrey",     country: "Mexico",       temp: 24 },
  "Tigres":                     { city: "Monterrey",     country: "Mexico",       temp: 24 },
  "Monterrey":                  { city: "Monterrey",     country: "Mexico",       temp: 24 },
  "CF Monterrey":               { city: "Monterrey",     country: "Mexico",       temp: 24 },
  "Toluca":                     { city: "Toluca",        country: "Mexico",       temp: 13 },
  "Deportivo Toluca":           { city: "Toluca",        country: "Mexico",       temp: 13 },
  "Santos Laguna":              { city: "Torreón",       country: "Mexico",       temp: 22 },
  "Club Santos Laguna":         { city: "Torreón",       country: "Mexico",       temp: 22 },
  "Pachuca":                    { city: "Pachuca",       country: "Mexico",       temp: 17 },
  "CF Pachuca":                 { city: "Pachuca",       country: "Mexico",       temp: 17 },
  "Club Atlas":                 { city: "Guadalajara",   country: "Mexico",       temp: 20 },
  "Atlas":                      { city: "Guadalajara",   country: "Mexico",       temp: 20 },
  "Necaxa":                     { city: "Aguascalientes", country: "Mexico",      temp: 20 },
  "Club Necaxa":                { city: "Aguascalientes", country: "Mexico",      temp: 20 },
  "Querétaro":                  { city: "Querétaro",     country: "Mexico",       temp: 19 },
  "FC Juárez":                  { city: "Ciudad Juárez", country: "Mexico",       temp: 19 },
  "Tijuana":                    { city: "Tijuana",       country: "Mexico",       temp: 17 },
  "Xolos de Tijuana":           { city: "Tijuana",       country: "Mexico",       temp: 17 },
  "Club Puebla":                { city: "Puebla",        country: "Mexico",       temp: 17 },
  "Puebla":                     { city: "Puebla",        country: "Mexico",       temp: 17 },
  "Mazatlán":                   { city: "Mazatlán",      country: "Mexico",       temp: 24 },
  "San Luis":                   { city: "San Luis Potosí", country: "Mexico",     temp: 20 },
  "León":                       { city: "León",          country: "Mexico",       temp: 19 },
  "Club León":                  { city: "León",          country: "Mexico",       temp: 19 },
  // ── MLS ─────────────────────────────────────────────────────────────────
  "Inter Miami CF":             { city: "Miami",         country: "USA",          temp: 25 },
  "Inter Miami":                { city: "Miami",         country: "USA",          temp: 25 },
  "LA Galaxy":                  { city: "Los Angeles",   country: "USA",          temp: 18 },
  "LAFC":                       { city: "Los Angeles",   country: "USA",          temp: 18 },
  "Los Angeles FC":             { city: "Los Angeles",   country: "USA",          temp: 18 },
  "New England Revolution":     { city: "Boston",        country: "USA",          temp: 12 },
  "New York City FC":           { city: "New York",      country: "USA",          temp: 14 },
  "NYCFC":                      { city: "New York",      country: "USA",          temp: 14 },
  "New York Red Bulls":         { city: "New York",      country: "USA",          temp: 14 },
  "Seattle Sounders":           { city: "Seattle",       country: "USA",          temp: 12 },
  "Seattle Sounders FC":        { city: "Seattle",       country: "USA",          temp: 12 },
  "Portland Timbers":           { city: "Portland",      country: "USA",          temp: 12 },
  "Atlanta United":             { city: "Atlanta",       country: "USA",          temp: 18 },
  "Atlanta United FC":          { city: "Atlanta",       country: "USA",          temp: 18 },
  "Minnesota United":           { city: "Minneapolis",   country: "USA",          temp:  8 },
  "Nashville SC":               { city: "Nashville",     country: "USA",          temp: 16 },
  "Chicago Fire":               { city: "Chicago",       country: "USA",          temp: 12 },
  "Chicago Fire FC":            { city: "Chicago",       country: "USA",          temp: 12 },
  "Philadelphia Union":         { city: "Philadelphia",  country: "USA",          temp: 14 },
  "DC United":                  { city: "Washington DC", country: "USA",          temp: 14 },
  "Sporting Kansas City":       { city: "Kansas City",   country: "USA",          temp: 16 },
  "Houston Dynamo":             { city: "Houston",       country: "USA",          temp: 22 },
  "Houston Dynamo FC":          { city: "Houston",       country: "USA",          temp: 22 },
  "Columbus Crew":              { city: "Columbus",      country: "USA",          temp: 13 },
  "FC Dallas":                  { city: "Dallas",        country: "USA",          temp: 20 },
  "Orlando City":               { city: "Orlando",       country: "USA",          temp: 24 },
  "Orlando City SC":            { city: "Orlando",       country: "USA",          temp: 24 },
  "Charlotte FC":               { city: "Charlotte",     country: "USA",          temp: 16 },
  "St. Louis City SC":          { city: "St. Louis",     country: "USA",          temp: 14 },
  "St. Louis City":             { city: "St. Louis",     country: "USA",          temp: 14 },
  "Austin FC":                  { city: "Austin",        country: "USA",          temp: 20 },
  "San Jose Earthquakes":       { city: "San Jose",      country: "USA",          temp: 15 },
  "Colorado Rapids":            { city: "Denver",        country: "USA",          temp: 12 },
  "Real Salt Lake":             { city: "Salt Lake City", country: "USA",         temp: 12 },
  "San Diego FC":               { city: "San Diego",     country: "USA",          temp: 18 },
  // ── MLS CANADA ──────────────────────────────────────────────────────────
  "Toronto FC":                 { city: "Toronto",       country: "Canada",       temp: 11 },
  "CF Montréal":                { city: "Montreal",      country: "Canada",       temp:  9 },
  "CF Montreal":                { city: "Montreal",      country: "Canada",       temp:  9 },
  "Vancouver Whitecaps":        { city: "Vancouver",     country: "Canada",       temp: 11 },
  "Vancouver Whitecaps FC":     { city: "Vancouver",     country: "Canada",       temp: 11 },
  // ── CPL CANADA ──────────────────────────────────────────────────────────
  "Cavalry FC":                 { city: "Calgary",       country: "Canada",       temp:  8 },
  "Forge FC":                   { city: "Hamilton",      country: "Canada",       temp: 10 },
  "HFX Wanderers":              { city: "Halifax",       country: "Canada",       temp:  9 },
  "Pacific FC":                 { city: "Victoria",      country: "Canada",       temp: 12 },
  "Valour FC":                  { city: "Winnipeg",      country: "Canada",       temp:  7 },
  "York United":                { city: "Toronto",       country: "Canada",       temp: 11 },
  "Atlético Ottawa":            { city: "Ottawa",        country: "Canada",       temp:  9 },
  // ── JAPAN – J1 League ───────────────────────────────────────────────────
  "Vissel Kobe":                { city: "Kobe",          country: "Japan",        temp: 17 },
  "Gamba Osaka":                { city: "Osaka",         country: "Japan",        temp: 17 },
  "Cerezo Osaka":               { city: "Osaka",         country: "Japan",        temp: 17 },
  "Kawasaki Frontale":          { city: "Kawasaki",      country: "Japan",        temp: 16 },
  "Yokohama F. Marinos":        { city: "Yokohama",      country: "Japan",        temp: 16 },
  "Yokohama F.Marinos":         { city: "Yokohama",      country: "Japan",        temp: 16 },
  "Urawa Red Diamonds":         { city: "Saitama",       country: "Japan",        temp: 15 },
  "Kashima Antlers":            { city: "Kashima",       country: "Japan",        temp: 16 },
  "Nagoya Grampus":             { city: "Nagoya",        country: "Japan",        temp: 16 },
  "FC Tokyo":                   { city: "Tokyo",         country: "Japan",        temp: 16 },
  "Kashiwa Reysol":             { city: "Kashiwa",       country: "Japan",        temp: 16 },
  "Sanfrecce Hiroshima":        { city: "Hiroshima",     country: "Japan",        temp: 16 },
  "Sagan Tosu":                 { city: "Tosu",          country: "Japan",        temp: 17 },
  "Jubilo Iwata":               { city: "Iwata",         country: "Japan",        temp: 17 },
  "Shimizu S-Pulse":            { city: "Shizuoka",      country: "Japan",        temp: 17 },
  "Albirex Niigata":            { city: "Niigata",       country: "Japan",        temp: 14 },
  "Consadole Sapporo":          { city: "Sapporo",       country: "Japan",        temp: 10 },
  // ── SOUTH KOREA – K League ──────────────────────────────────────────────
  "Jeonbuk Hyundai Motors":     { city: "Jeonju",        country: "South Korea",  temp: 13 },
  "Jeonbuk Hyundai":            { city: "Jeonju",        country: "South Korea",  temp: 13 },
  "Ulsan HD":                   { city: "Ulsan",         country: "South Korea",  temp: 14 },
  "Ulsan Hyundai":              { city: "Ulsan",         country: "South Korea",  temp: 14 },
  "Seongnam FC":                { city: "Seongnam",      country: "South Korea",  temp: 13 },
  "Seoul E-Land":               { city: "Seoul",         country: "South Korea",  temp: 13 },
  "FC Seoul":                   { city: "Seoul",         country: "South Korea",  temp: 13 },
  "Suwon Samsung Bluewings":    { city: "Suwon",         country: "South Korea",  temp: 13 },
  "Incheon United":             { city: "Incheon",       country: "South Korea",  temp: 13 },
  "Gimcheon Sangmu":            { city: "Gimcheon",      country: "South Korea",  temp: 13 },
  "Pohang Steelers":            { city: "Pohang",        country: "South Korea",  temp: 14 },
  "Gangwon FC":                 { city: "Gangwon",       country: "South Korea",  temp: 11 },
  // ── AUSTRALIA – A-League ────────────────────────────────────────────────
  "Sydney FC":                  { city: "Sydney",        country: "Australia",    temp: 18 },
  "Melbourne City":             { city: "Melbourne",     country: "Australia",    temp: 16 },
  "Melbourne City FC":          { city: "Melbourne",     country: "Australia",    temp: 16 },
  "Melbourne Victory":          { city: "Melbourne",     country: "Australia",    temp: 16 },
  "Western Sydney Wanderers":   { city: "Sydney",        country: "Australia",    temp: 18 },
  "Brisbane Roar":              { city: "Brisbane",      country: "Australia",    temp: 22 },
  "Central Coast Mariners":     { city: "Gosford",       country: "Australia",    temp: 18 },
  "Perth Glory":                { city: "Perth",         country: "Australia",    temp: 18 },
  "Wellington Phoenix":         { city: "Wellington",    country: "New Zealand",  temp: 13 },
  "Auckland FC":                { city: "Auckland",      country: "New Zealand",  temp: 16 },
  "Western United":             { city: "Melbourne",     country: "Australia",    temp: 16 },
  "Macarthur FC":               { city: "Sydney",        country: "Australia",    temp: 18 },
  // ── IRAN – Persian Gulf Pro League ──────────────────────────────────────
  "Persepolis":                 { city: "Tehran",        country: "Iran",         temp: 16 },
  "Esteghlal":                  { city: "Tehran",        country: "Iran",         temp: 16 },
  "Sepahan":                    { city: "Isfahan",       country: "Iran",         temp: 17 },
  "Tractor Sazi":               { city: "Tabriz",        country: "Iran",         temp: 13 },
  "Zob Ahan":                   { city: "Isfahan",       country: "Iran",         temp: 17 },
  "Foolad":                     { city: "Ahvaz",         country: "Iran",         temp: 29 },
  "Aluminium Arak":             { city: "Arak",          country: "Iran",         temp: 16 },
  "Naft Tehran":                { city: "Tehran",        country: "Iran",         temp: 16 },
  "Gol Gohar":                  { city: "Sirjan",        country: "Iran",         temp: 22 },
  "Nassaji":                    { city: "Qaem Shahr",    country: "Iran",         temp: 17 },
  // ── IRAQ ────────────────────────────────────────────────────────────────
  "Al-Shorta SC":               { city: "Baghdad",       country: "Iraq",         temp: 26 },
  "Al-Shorta":                  { city: "Baghdad",       country: "Iraq",         temp: 26 },
  "Al-Quwa Al-Jawiya":          { city: "Baghdad",       country: "Iraq",         temp: 26 },
  "Erbil SC":                   { city: "Erbil",         country: "Iraq",         temp: 22 },
  "Al-Zawra'a":                 { city: "Baghdad",       country: "Iraq",         temp: 26 },
  "Al-Zawraa":                  { city: "Baghdad",       country: "Iraq",         temp: 26 },
  "Duhok":                      { city: "Duhok",         country: "Iraq",         temp: 20 },
  "Zakho":                      { city: "Zakho",         country: "Iraq",         temp: 20 },
  "Al-Minaa":                   { city: "Basra",         country: "Iraq",         temp: 29 },
  "Naft Al-Wasat":              { city: "Baghdad",       country: "Iraq",         temp: 26 },
  // ── JORDAN ──────────────────────────────────────────────────────────────
  "Al-Faisaly":                 { city: "Amman",         country: "Jordan",       temp: 17 },
  "Al-Wehdat":                  { city: "Amman",         country: "Jordan",       temp: 17 },
  "Al Ahli Amman":              { city: "Amman",         country: "Jordan",       temp: 17 },
  "Al-Ramtha":                  { city: "Ramtha",        country: "Jordan",       temp: 17 },
  // ── QATAR ───────────────────────────────────────────────────────────────
  "Al-Sadd":                    { city: "Doha",          country: "Qatar",        temp: 30 },
  "Al Sadd":                    { city: "Doha",          country: "Qatar",        temp: 30 },
  "Al-Duhail":                  { city: "Doha",          country: "Qatar",        temp: 30 },
  "Al Duhail":                  { city: "Doha",          country: "Qatar",        temp: 30 },
  "Al-Rayyan":                  { city: "Al-Rayyan",     country: "Qatar",        temp: 30 },
  "Al Rayyan":                  { city: "Al-Rayyan",     country: "Qatar",        temp: 30 },
  "Al-Wakrah":                  { city: "Al-Wakrah",     country: "Qatar",        temp: 30 },
  "Al Wakrah":                  { city: "Al-Wakrah",     country: "Qatar",        temp: 30 },
  "Al-Gharafa":                 { city: "Doha",          country: "Qatar",        temp: 30 },
  "Muaither SC":                { city: "Doha",          country: "Qatar",        temp: 30 },
  // ── UZBEKISTAN ──────────────────────────────────────────────────────────
  "Lokomotiv Tashkent":         { city: "Tashkent",      country: "Uzbekistan",   temp: 16 },
  "Pakhtakor":                  { city: "Tashkent",      country: "Uzbekistan",   temp: 16 },
  "Bunyodkor":                  { city: "Tashkent",      country: "Uzbekistan",   temp: 16 },
  "Nasaf":                      { city: "Karshi",        country: "Uzbekistan",   temp: 18 },
  "PFC Navbahor":               { city: "Namangan",      country: "Uzbekistan",   temp: 16 },
  "Navbahor":                   { city: "Namangan",      country: "Uzbekistan",   temp: 16 },
  "FK Andijan":                 { city: "Andijan",       country: "Uzbekistan",   temp: 16 },
  // ── EGYPT ───────────────────────────────────────────────────────────────
  "Al Ahly":                    { city: "Cairo",         country: "Egypt",        temp: 22 },
  "Al-Ahly":                    { city: "Cairo",         country: "Egypt",        temp: 22 },
  "Zamalek":                    { city: "Cairo",         country: "Egypt",        temp: 22 },
  "Pyramids FC":                { city: "Cairo",         country: "Egypt",        temp: 22 },
  "Ismaily":                    { city: "Ismailia",      country: "Egypt",        temp: 23 },
  "El Gouna":                   { city: "El Gouna",      country: "Egypt",        temp: 26 },
  // ── ALGERIA ─────────────────────────────────────────────────────────────
  "MC Alger":                   { city: "Algiers",       country: "Algeria",      temp: 17 },
  "MC Oran":                    { city: "Oran",          country: "Algeria",      temp: 18 },
  "USM Alger":                  { city: "Algiers",       country: "Algeria",      temp: 17 },
  "CR Belouizdad":              { city: "Algiers",       country: "Algeria",      temp: 17 },
  "JS Kabylie":                 { city: "Tizi Ouzou",    country: "Algeria",      temp: 16 },
  // ── MOROCCO ─────────────────────────────────────────────────────────────
  "Wydad Casablanca":           { city: "Casablanca",    country: "Morocco",      temp: 18 },
  "Raja Casablanca":            { city: "Casablanca",    country: "Morocco",      temp: 18 },
  "FAR Rabat":                  { city: "Rabat",         country: "Morocco",      temp: 17 },
  "Moghreb Tetouan":            { city: "Tetouan",       country: "Morocco",      temp: 17 },
  // ── TUNISIA ─────────────────────────────────────────────────────────────
  "Espérance Sportive de Tunis": { city: "Tunis",        country: "Tunisia",      temp: 17 },
  "Espérance Tunis":            { city: "Tunis",         country: "Tunisia",      temp: 17 },
  "Club Africain":              { city: "Tunis",         country: "Tunisia",      temp: 17 },
  "CS Sfaxien":                 { city: "Sfax",          country: "Tunisia",      temp: 18 },
  // ── GHANA ───────────────────────────────────────────────────────────────
  "Hearts of Oak":              { city: "Accra",         country: "Ghana",        temp: 28 },
  "Asante Kotoko":              { city: "Kumasi",        country: "Ghana",        temp: 27 },
  // ── SENEGAL ─────────────────────────────────────────────────────────────
  "Generation Foot":            { city: "Dakar",         country: "Senegal",      temp: 26 },
  "Teungueth FC":               { city: "Thiès",         country: "Senegal",      temp: 27 },
  "Jaraaf":                     { city: "Dakar",         country: "Senegal",      temp: 26 },
  // ── SOUTH AFRICA – PSL ──────────────────────────────────────────────────
  "Orlando Pirates":            { city: "Johannesburg",  country: "South Africa", temp: 16 },
  "Kaizer Chiefs":              { city: "Johannesburg",  country: "South Africa", temp: 16 },
  "Mamelodi Sundowns":          { city: "Pretoria",      country: "South Africa", temp: 16 },
  "Bafana Bafana":              { city: "Johannesburg",  country: "South Africa", temp: 16 },
  "Cape Town City":             { city: "Cape Town",     country: "South Africa", temp: 17 },
  "SuperSport United":          { city: "Pretoria",      country: "South Africa", temp: 16 },
  "AmaZulu FC":                 { city: "Durban",        country: "South Africa", temp: 22 },
  "Swallows FC":                { city: "Johannesburg",  country: "South Africa", temp: 16 },
  // ── DR CONGO ────────────────────────────────────────────────────────────
  "AS Vita Club":               { city: "Kinshasa",      country: "Congo DR",     temp: 27 },
  "DC Motema Pembe":            { city: "Kinshasa",      country: "Congo DR",     temp: 27 },
  "TP Mazembe":                 { city: "Lubumbashi",    country: "Congo DR",     temp: 23 },
  "Tout Puissant Mazembe":      { city: "Lubumbashi",    country: "Congo DR",     temp: 23 },
  "AS Dauphin Noir":            { city: "Lubumbashi",    country: "Congo DR",     temp: 23 },
  // ── PARAGUAY ────────────────────────────────────────────────────────────
  "Olimpia":                    { city: "Asunción",      country: "Paraguay",     temp: 27 },
  "Cerro Porteño":              { city: "Asunción",      country: "Paraguay",     temp: 27 },
  "Libertad":                   { city: "Asunción",      country: "Paraguay",     temp: 27 },
  "Club Nacional":              { city: "Asunción",      country: "Paraguay",     temp: 27 },
  "Guaraní":                    { city: "Asunción",      country: "Paraguay",     temp: 27 },
  "Sportivo Luqueño":           { city: "Luque",         country: "Paraguay",     temp: 27 },
  // ── URUGUAY ─────────────────────────────────────────────────────────────
  "Nacional":                   { city: "Montevideo",    country: "Uruguay",      temp: 16 },
  "Peñarol":                    { city: "Montevideo",    country: "Uruguay",      temp: 16 },
  "Defensor Sporting":          { city: "Montevideo",    country: "Uruguay",      temp: 16 },
  "Cerro":                      { city: "Montevideo",    country: "Uruguay",      temp: 16 },
  // ── HAITI ───────────────────────────────────────────────────────────────
  "Racing Club Haïtien":        { city: "Port-au-Prince", country: "Haiti",       temp: 29 },
  "Don Bosco FC":               { city: "Port-au-Prince", country: "Haiti",       temp: 29 },
  "AS Capoise":                 { city: "Cap-Haïtien",   country: "Haiti",        temp: 28 },
  // ── PANAMA ──────────────────────────────────────────────────────────────
  "Tauro FC":                   { city: "Panama City",   country: "Panama",       temp: 28 },
  "Deportivo Árabe Unido":      { city: "Colón",         country: "Panama",       temp: 28 },
  "FC Plaza Amador":            { city: "Panama City",   country: "Panama",       temp: 28 },
  "Chorrillo FC":               { city: "Panama City",   country: "Panama",       temp: 28 },
  // ── CAPE VERDE ──────────────────────────────────────────────────────────
  "Sporting da Praia":          { city: "Praia",         country: "Cape Verde",   temp: 24 },
  "Académica do Aeroporto":     { city: "Praia",         country: "Cape Verde",   temp: 24 },
  // ── CURAÇAO ─────────────────────────────────────────────────────────────
  "SV Robinhood":               { city: "Willemstad",    country: "Curaçao",      temp: 28 },
  "SV Scherpenheuvel":          { city: "Willemstad",    country: "Curaçao",      temp: 28 },
  // ── NEW ZEALAND ─────────────────────────────────────────────────────────
  "Auckland City FC":           { city: "Auckland",      country: "New Zealand",  temp: 16 },
  "Waitakere United":           { city: "Auckland",      country: "New Zealand",  temp: 16 },
  "Team Wellington":            { city: "Wellington",    country: "New Zealand",  temp: 13 },
  "Hamilton Wanderers":         { city: "Hamilton",      country: "New Zealand",  temp: 15 },
  "Chatham Cup":                { city: "Wellington",    country: "New Zealand",  temp: 13 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Country-level average season temperature fallback
//    Used when specific club is not found in CLUB_CITY_TEMP
// ─────────────────────────────────────────────────────────────────────────────
const COUNTRY_DEFAULT_TEMP = {
  "England": 11, "Germany": 10, "Spain": 15, "France": 13, "Italy": 14,
  "Netherlands": 10, "Portugal": 15, "Belgium": 11, "Austria": 11,
  "Switzerland": 10, "Turkey": 15, "Scotland": 9, "Czech Republic": 10,
  "Croatia": 13, "Serbia": 12, "Norway": 7, "Sweden": 9, "Denmark": 9,
  "Poland": 10, "Ukraine": 12, "Russia": 9, "Hungary": 12, "Romania": 12,
  "Greece": 17, "Bosnia": 12, "Slovakia": 11, "Ireland": 10, "Wales": 10,
  "Saudi Arabia": 27, "Qatar": 30, "Iran": 17, "Iraq": 26, "Jordan": 17,
  "UAE": 28, "Kuwait": 28, "Oman": 26, "Bahrain": 27,
  "Japan": 16, "South Korea": 13, "Australia": 18, "China": 14,
  "Uzbekistan": 16, "Kazakhstan": 11, "Indonesia": 28,
  "Brazil": 23, "Argentina": 17, "Colombia": 20, "Ecuador": 18,
  "Paraguay": 27, "Uruguay": 16, "Chile": 15, "Peru": 18, "Bolivia": 16,
  "Mexico": 20, "USA": 15, "Canada": 10,
  "Ghana": 28, "Senegal": 26, "Nigeria": 28, "Egypt": 22,
  "Algeria": 17, "Morocco": 17, "Tunisia": 17, "South Africa": 17,
  "Congo DR": 26, "Ivory Coast": 27, "Cape Verde": 24, "Haiti": 29,
  "Panama": 28, "Costa Rica": 24, "Jamaica": 28,
  "New Zealand": 14, "Curaçao": 28,
  "Africa": 26, "Asia": 20, "Americas": 20,
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Climate tier from temperature
// ─────────────────────────────────────────────────────────────────────────────
function tempToTier(t) {
  if (t <= 9)  return 1;
  if (t <= 14) return 2;
  if (t <= 19) return 3;
  if (t <= 24) return 4;
  return 5;
}
const TIER_LABELS = ["", "Cold", "Temperate", "Warm", "Hot/Dry", "Hot/Humid"];

// ─────────────────────────────────────────────────────────────────────────────
// 7. Federation alt-text → country name
// ─────────────────────────────────────────────────────────────────────────────
function federationToCountry(altText) {
  if (!altText) return null;
  if (FEDERATION_ALT_TO_COUNTRY[altText]) return FEDERATION_ALT_TO_COUNTRY[altText];
  // Try partial match
  for (const [key, val] of Object.entries(FEDERATION_ALT_TO_COUNTRY)) {
    if (altText.includes(key) || key.includes(altText)) return val;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Lookup city/temp for a club
// ─────────────────────────────────────────────────────────────────────────────
function resolveClub(clubName, clubCountry) {
  if (CLUB_CITY_TEMP[clubName]) return CLUB_CITY_TEMP[clubName];
  // Fuzzy: strip "FC ", "AS ", "AC ", "SC ", "CF " prefixes and try again
  const stripped = clubName.replace(/^(FC |AS |AC |SC |CF |SK |FK |SS |AO |CS |AD |SD |GD |NK |ŠK |PFC |AFC )/i, "").trim();
  if (CLUB_CITY_TEMP[stripped]) return CLUB_CITY_TEMP[stripped];
  // Fallback: country default
  const tempFromCountry = clubCountry ? COUNTRY_DEFAULT_TEMP[clubCountry] : null;
  return {
    city: clubCountry || "Unknown",
    country: clubCountry || "Unknown",
    temp: tempFromCountry ?? 15,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. HTML parsing helpers
// ─────────────────────────────────────────────────────────────────────────────
function stripHtml(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#[0-9]+;/g, "").replace(/&[a-z]+;/g, "").trim();
}

function extractPosition(cellHtml) {
  const m = cellHtml.match(/>(GK|DF|MF|FW)</);
  return m ? m[1] : "";
}

function extractPlayerName(thHtml) {
  // <th data-sort-value="..."><a href="...">Name</a></th>
  const m = thHtml.match(/<a href="\/wiki\/[^"]*"[^>]*>([^<]+)<\/a>/);
  return m ? m[1].trim() : "";
}

function extractClubAndCountry(tdHtml) {
  // Alt text of flag image → federation → country
  const altMatch = tdHtml.match(/alt="([^"]+)"/);
  const altText = altMatch ? altMatch[1] : "";
  let clubCountry = federationToCountry(altText);
  // Fallback: try to extract from flag URL
  if (!clubCountry) {
    clubCountry = countryFromFlagUrl(tdHtml);
  }
  // Club name: last <a> link with visible text (not the flag link which wraps <img>)
  const allLinks = [...tdHtml.matchAll(/<a [^>]*>([^<]*)<\/a>/g)];
  const textLinks = allLinks.filter(m => m[1].trim().length > 1);
  const clubName = textLinks.length ? textLinks[textLinks.length - 1][1].trim() : stripHtml(tdHtml);
  return { clubName, clubCountry };
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. Parse squad table rows from HTML
// ─────────────────────────────────────────────────────────────────────────────
function parseSquadRows(html) {
  const players = [];
  const rowPattern = /<tr class="nat-fs-player">([\s\S]*?)<\/tr>/gi;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[1];
    // Extract <td> and <th> cells in order
    const cells = [];
    const cellPattern = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
    for (const cellMatch of rowHtml.matchAll(cellPattern)) {
      cells.push(cellMatch[2]);
    }
    if (cells.length < 5) continue;
    // Identify cells by content patterns:
    // cells[0] = number (td)
    // cells[1] = position (td with GK/DF/MF/FW)
    // cells[2] = player name (th with data-sort-value)
    // cells[3] = DOB
    // cells[4] = caps
    // cells[5] = goals (optional)
    // last cell = club (has flagicon class)
    let posCellIdx = -1, nameCellIdx = -1, clubCellIdx = -1;
    for (let i = 0; i < cells.length; i++) {
      if (/>(GK|DF|MF|FW)</.test(cells[i])) posCellIdx = i;
      if (/data-sort-value/i.test(rowHtml) && cells[i].includes("<a href=\"/wiki/")) {
        // The name cell is a <th> - let's check via rowHtml
      }
      if (cells[i].includes("flagicon")) clubCellIdx = i;
    }
    // Player name from <th> in rowHtml
    const thMatch = rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    const playerName = thMatch ? extractPlayerName(thMatch[1]) : "";
    const position = posCellIdx >= 0 ? extractPosition(cells[posCellIdx]) : "";
    const { clubName, clubCountry } = clubCellIdx >= 0
      ? extractClubAndCountry(cells[clubCellIdx])
      : { clubName: "", clubCountry: "" };
    if (playerName) {
      players.push({ name: playerName, position, clubName, clubCountry });
    }
  }
  return players;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Fetch one team's section HTML from Wikipedia (with retry + backoff)
// ─────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchTeamSection(sectionIndex) {
  const url = `${WIKIPEDIA_API}?action=parse&page=2026_FIFA_World_Cup_squads&prop=text&section=${sectionIndex}&format=json&origin=*`;
  // Retry delays for 429 responses: 10s, 25s, 60s
  const RETRY_DELAYS = [10000, 25000, 60000];
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1];
      process.stdout.write(` [429→wait ${delay / 1000}s]`);
      await sleep(delay);
    }
    const res = await fetch(url);
    if (res.status === 429) { lastErr = new Error(`HTTP 429 section ${sectionIndex}`); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} for section ${sectionIndex}`);
    const data = await res.json();
    return data.parse.text["*"] || "";
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Main build function  (resume-safe: loads existing output first)
// ─────────────────────────────────────────────────────────────────────────────
async function build() {
  // ── Load any already-fetched profiles so we can resume ───────────────────
  let allProfiles = {};
  if (fs.existsSync(OUT_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
      if (existing.players) allProfiles = existing.players;
      const cached = Object.keys(allProfiles).length;
      if (cached) console.log(`Resuming: ${cached} teams already in output file.\n`);
    } catch (_) { /* corrupt file – start fresh */ }
  }

  console.log("Fetching Wikipedia section list...");
  const sectionsRes = await fetch(`${WIKIPEDIA_API}?action=parse&page=2026_FIFA_World_Cup_squads&prop=sections&format=json&origin=*`);
  const sectionsData = await sectionsRes.json();
  const sections = sectionsData.parse.sections;
  // Level-2 sections = individual teams; skip stat/appendix sections
  const SKIP_TITLES = new Set(["Age", "Player representation by club",
    "Player representation by league system", "Player representation by club confederation",
    "Average age of squads", "Coach representation by country"]);
  const teamSections = sections.filter(s => s.toclevel === 2 && !SKIP_TITLES.has(s.line));
  console.log(`Found ${teamSections.length} team sections.\n`);

  let totalMissed = 0;

  for (const section of teamSections) {
    const wikiTeam = section.line;
    const fixtureTeam = WIKI_TO_FIXTURE_TEAM[wikiTeam] || wikiTeam;

    // Skip teams already fetched in a previous run
    if (allProfiles[fixtureTeam]) {
      console.log(`  ${fixtureTeam.padEnd(32)} ✓ already cached (${allProfiles[fixtureTeam].length} players)`);
      continue;
    }

    process.stdout.write(`  ${fixtureTeam.padEnd(32)} section ${String(section.index).padStart(2)} → `);

    let html = "";
    try {
      html = await fetchTeamSection(section.index);
    } catch (e) {
      console.log(`ERROR: ${e.message} — skipping`);
      continue;
    }

    const rawPlayers = parseSquadRows(html);
    const playerProfiles = rawPlayers.map(p => {
      const resolved = resolveClub(p.clubName, p.clubCountry);
      const tier = tempToTier(resolved.temp);
      return {
        name: p.name,
        position: p.position || "?",
        club: p.clubName,
        clubCity: resolved.city,
        clubCountry: resolved.country,
        avgSeasonTemp_C: resolved.temp,
        climateTier: tier,
        climateTierLabel: TIER_LABELS[tier],
        nationalTeam: fixtureTeam,
      };
    });

    const missed = playerProfiles.filter(p => !CLUB_CITY_TEMP[p.club]).length;
    console.log(`${playerProfiles.length} players  (${missed} via country fallback)`);
    totalMissed += missed;
    allProfiles[fixtureTeam] = playerProfiles;

    // Save after every team so progress is never lost
    saveOutput(allProfiles);

    await sleep(2500); // 2.5s between requests (~24/min) — Wikipedia allows ~200/min for anon
  }

  // ── Final totals ──────────────────────────────────────────────────────────
  const totalPlayers = Object.values(allProfiles).reduce((s, a) => s + a.length, 0);
  saveOutput(allProfiles, totalPlayers, totalMissed);
  console.log(`\n✅  Written → ${OUT_PATH}`);
  console.log(`    Teams: ${Object.keys(allProfiles).length}  |  Players: ${totalPlayers}  |  Clubs via fallback: ${totalMissed}\n`);

  // Print sample: top 5 hottest and coldest individual players
  const flat = Object.values(allProfiles).flat();
  flat.sort((a, b) => b.avgSeasonTemp_C - a.avgSeasonTemp_C);
  console.log("Top 5 hottest-climate players:");
  flat.slice(0, 5).forEach(p => console.log(`  ${p.name.padEnd(28)} ${p.club.padEnd(28)} ${p.clubCity}, ${p.clubCountry}  ${p.avgSeasonTemp_C}°C`));
  console.log("\nTop 5 coldest-climate players:");
  flat.slice(-5).reverse().forEach(p => console.log(`  ${p.name.padEnd(28)} ${p.club.padEnd(28)} ${p.clubCity}, ${p.clubCountry}  ${p.avgSeasonTemp_C}°C`));
}

function saveOutput(allProfiles, totalPlayers, totalMissed) {
  const tp = totalPlayers ?? Object.values(allProfiles).reduce((s, a) => s + a.length, 0);
  const output = {
    _meta: {
      description: "Individual player climate profiles for all 48 WC 2026 squads.",
      generatedAt: new Date().toISOString(),
      generatedBy: "scripts/buildPlayerClimateProfiles.js",
      source: "Wikipedia: 2026 FIFA World Cup squads",
      totalPlayers: tp,
      totalTeams: Object.keys(allProfiles).length,
      clubsViaFallback: totalMissed ?? "partial run",
      climateTierScale: {
        "1 – Cold":       "≤9 °C avg season temp (Scotland, Scandinavia, northern Canada)",
        "2 – Temperate":  "10–14 °C (England, Germany, Netherlands, Belgium, MLS North)",
        "3 – Warm":       "15–19 °C (France, Italy, Portugal, Spain, South America, Japan/Korea)",
        "4 – Hot/Dry":    "20–24 °C (Turkey, Mexico, southern MLS, South Africa, Australia North)",
        "5 – Hot/Humid":  "≥25 °C (Brazil, Saudi Arabia, Egypt, West Africa, Iraq, Qatar, Panama)",
      },
      notes: [
        "avgSeasonTemp_C is the average match-day temperature during the playing season (Aug–May N. hemisphere).",
        "Clubs not found in the specific lookup are resolved to the country's average temperature.",
        "climateTier is used by weatherService.js as an input to the heat adjustment formula.",
      ],
    },
    players: allProfiles,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
}


build().catch(e => { console.error("Fatal:", e); process.exit(1); });
