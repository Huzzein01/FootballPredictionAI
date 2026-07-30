const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");
const { mutableDataPath, readJsonWithFallback, repoDataPath, writeFileIfWritable, writeJson } = require("./runtimePaths");
const { loadLocalEnv } = require("./localEnv");

loadLocalEnv();

const FIXTURE_PATH = repoDataPath("remaining_fixtures_2025_26_with_odds.csv");
const LIVE_ODDS_PATH = mutableDataPath("live_odds_snapshot.json");
const SEEDED_LIVE_ODDS_PATH = repoDataPath("live_odds_snapshot.json");
const WORLD_CUP_FIXTURES_PATH = repoDataPath("international", "world_cup_2026_fixtures.json");
const USER_AGENT = "FootballPredictionAI odds-api-refresh";

const CLUB_SPORT_KEYS = {
  EPL: "soccer_epl",
  "La Liga": "soccer_spain_la_liga",
  Bundesliga: "soccer_germany_bundesliga",
  "Ligue 1": "soccer_france_ligue_one",
  "Serie A": "soccer_italy_serie_a",
  "Serie B": "soccer_italy_serie_b",
  "La Liga 2": "soccer_spain_segunda_division",
  "Champions League": "soccer_uefa_champs_league",
  "Europa League": "soccer_uefa_europa_league",
  "Conference League": "soccer_uefa_europa_conference_league",
  Eredivisie: "soccer_netherlands_eredivisie",
  "Primeira Liga": "soccer_portugal_primeira_liga",
  "Scottish Premiership": "soccer_spl",
  "Turkish Super Lig": "soccer_turkey_super_league",
  "Belgian Pro League": "soccer_belgium_first_div",
  Eliteserien: "soccer_norway_eliteserien",
  Allsvenskan: "soccer_sweden_allsvenskan",
  Veikkausliiga: "soccer_finland_veikkausliiga",
  "League of Ireland": "soccer_league_of_ireland",
};

const INTERNATIONAL_SPORT_KEYS = {
  "2026 World Cup": "soccer_fifa_world_cup",
  "World Cup": "soccer_fifa_world_cup",
  "UEFA Euros": "soccer_uefa_european_championship",
  "African Cup of Nations": "soccer_africa_cup_of_nations",
  "Copa America": "soccer_conmebol_copa_america",
  "AFC Asian Cup": "soccer_afc_asian_cup",
  "CONCACAF Gold Cup": "soccer_concacaf_gold_cup",
};

let availableSportsCache = null;
let availableSportsCacheAt = 0;
const AVAILABLE_SPORTS_CACHE_MS = 6 * 60 * 60 * 1000;

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function readFixtureCsv() {
  if (!fs.existsSync(FIXTURE_PATH)) return { headers: [], rows: [] };
  const lines = fs.readFileSync(FIXTURE_PATH, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || "");
  const rows = lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
  return { headers, rows };
}

function writeFixtureCsv(headers, rows) {
  const finalHeaders = [...new Set([...headers, "date", "league", "homeTeam", "awayTeam", "homeOdds", "drawOdds", "awayOdds", "oddsSource", "oddsStatus", "oddsSourceUrl", "oddsSnapshotAt"])];
  const output = [finalHeaders.join(","), ...rows.map((row) => finalHeaders.map((header) => csvCell(row[header])).join(","))].join("\n") + "\n";
  writeFileIfWritable(FIXTURE_PATH, output);
}

function normalizeLooseTeamName(team) {
  const text = String(team || "").trim();
  const key = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const aliases = {
    "afc bournemouth": "Bournemouth",
    "atalanta bc": "Atalanta",
    "athletic bilbao": "Ath Bilbao",
    "athletic club": "Ath Bilbao",
    "atletico madrid": "Ath Madrid",
    "atl madrid": "Ath Madrid",
    "bayer leverkusen": "Leverkusen",
    "borussia dortmund": "Dortmund",
    "borussia monchengladbach": "M'gladbach",
    "brighton and hove albion": "Brighton",
    "ca osasuna": "Osasuna",
    "cologne": "FC Koln",
    "elche cf": "Elche",
    "fc cologne": "FC Koln",
    "inter": "Inter Milan",
    "internazionale": "Inter Milan",
    "manchester city": "Man City",
    "manchester united": "Man United",
    "newcastle": "Newcastle United",
    "newcastle united": "Newcastle United",
    "nottingham forest": "Nott'm Forest",
    "paris saint germain": "Paris SG",
    "psg": "Paris SG",
    "rayo vallecano": "Vallecano",
    "real betis": "Betis",
    "real sociedad": "Real Sociedad",
    "stade rennais": "Rennes",
    "ss lazio": "Lazio",
    "tottenham hotspur": "Tottenham",
    "west ham": "West Ham United",
    "west ham united": "West Ham United",
    "wolverhampton": "Wolves",
    "wolverhampton wanderers": "Wolves",
    "czech republic": "Czechia",
    "cote d ivoire": "Cote d'Ivoire",
    "curacao": "Curacao",
    "congo dr": "Congo DR",
    "dr congo": "Congo DR",
    "iran": "IR Iran",
    "south korea": "Korea Republic",
    "united states": "USA",
    "united states of america": "USA",
    "usa": "USA",
  };
  return normalizeTeamName(aliases[key] || text);
}

function fixtureMatchKey(league, homeTeam, awayTeam) {
  return [league, normalizeLooseTeamName(homeTeam), normalizeLooseTeamName(awayTeam)].join("|").toLowerCase();
}

function daysBetween(left, right) {
  const leftTime = Date.parse(left || "");
  const rightTime = Date.parse(right || "");
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Infinity;
  return Math.abs(leftTime - rightTime) / 86_400_000;
}

function oddsApiIso(date = new Date()) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function hasUsableOdds(row) {
  return [row.homeOdds, row.drawOdds, row.awayOdds].every((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 100;
  });
}

function eventSourceUrl(sportKey) {
  return `https://theoddsapi.com/quickstart.html#odds`;
}

function decimalPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price === 0) return null;
  // Current The Odds API responses can use American odds; legacy responses
  // already use decimal odds.
  if (price <= -100) return 1 + 100 / Math.abs(price);
  if (price >= 100) return 1 + price / 100;
  return price;
}

function average(values) {
  const nums = values.map(decimalPrice).filter((value) => Number.isFinite(value) && value > 0);
  if (!nums.length) return "";
  return (nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2);
}

function oddsFromEvent(event) {
  const homePrices = [];
  const drawPrices = [];
  const awayPrices = [];
  for (const bookmaker of event.bookmakers || event.books || []) {
    const h2h = (bookmaker.markets || [bookmaker]).find((market) => market.key === "h2h" || market.market === "h2h");
    if (!h2h) continue;
    for (const outcome of h2h.outcomes || []) {
      const outcomeName = normalizeLooseTeamName(outcome.name);
      if (outcomeName === normalizeLooseTeamName(event.home_team)) homePrices.push(outcome.price);
      if (outcomeName === normalizeLooseTeamName(event.away_team)) awayPrices.push(outcome.price);
      if (String(outcome.name || "").toLowerCase() === "draw") drawPrices.push(outcome.price);
    }
  }
  const odds = {
    homeOdds: average(homePrices),
    drawOdds: average(drawPrices),
    awayOdds: average(awayPrices),
  };
  return hasUsableOdds(odds) ? odds : null;
}

function oddsApiConfig(apiKey) {
  const currentProvider = /^toa_/i.test(apiKey) || process.env.ODDS_API_PROVIDER === "current";
  return currentProvider
    ? { currentProvider: true, baseUrl: process.env.ODDS_API_BASE_URL || "https://api.theoddsapi.com" }
    : { currentProvider: false, baseUrl: process.env.ODDS_API_BASE_URL || "https://api.the-odds-api.com/v4" };
}

async function fetchOddsEvents(sportKey, { daysForward = 120 } = {}) {
  const apiKey = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY || "";
  if (!apiKey) return { sportKey, skipped: true, reason: "Missing ODDS_API_KEY", events: [] };
  const config = oddsApiConfig(apiKey);
  const url = config.currentProvider
    ? new URL("/odds/", config.baseUrl)
    : new URL(`/sports/${sportKey}/odds/`, config.baseUrl);
  if (config.currentProvider) {
    url.searchParams.set("sport_key", sportKey);
  } else {
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", process.env.ODDS_API_REGIONS || "us");
    url.searchParams.set("markets", process.env.ODDS_API_MARKETS || "h2h");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");
    url.searchParams.set("commenceTimeFrom", oddsApiIso(new Date()));
  }
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + daysForward);
  if (!config.currentProvider) url.searchParams.set("commenceTimeTo", oddsApiIso(end));
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, ...(config.currentProvider ? { "x-api-key": apiKey } : {}) } });
  const remaining = response.headers.get("x-requests-remaining") || "";
  const used = response.headers.get("x-requests-used") || "";
  const last = response.headers.get("x-requests-last") || "";
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`The Odds API ${sportKey} failed ${response.status}: ${body.slice(0, 180)}`);
  }
  const payload = await response.json();
  return {
    sportKey,
    skipped: false,
    quota: { remaining, used, last },
    events: Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [],
  };
}

async function fetchAvailableSoccerSportKeys() {
  const apiKey = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY || "";
  if (!apiKey) return null;
  if (availableSportsCache && Date.now() - availableSportsCacheAt < AVAILABLE_SPORTS_CACHE_MS) return availableSportsCache;
  try {
    const config = oddsApiConfig(apiKey);
    const url = new URL("/sports/", config.baseUrl);
    if (!config.currentProvider) url.searchParams.set("apiKey", apiKey);
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT, ...(config.currentProvider ? { "x-api-key": apiKey } : {}) } });
    if (!response.ok) return null;
    const payload = await response.json();
    const sports = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    availableSportsCache = new Set(
      sports
        .filter((sport) => sport?.active !== false && String(sport?.key || "").startsWith("soccer_"))
        .map((sport) => sport.key)
    );
    availableSportsCacheAt = Date.now();
    return availableSportsCache;
  } catch {
    return null;
  }
}

function readLiveOddsSnapshot() {
  return readJsonWithFallback(LIVE_ODDS_PATH, SEEDED_LIVE_ODDS_PATH, null);
}

function readWorldCupFixtureData() {
  if (!fs.existsSync(WORLD_CUP_FIXTURES_PATH)) return { fixtures: [] };
  return JSON.parse(fs.readFileSync(WORLD_CUP_FIXTURES_PATH, "utf8").replace(/^\uFEFF/, ""));
}

function snapshotIsFresh(maxAgeMinutes = 30) {
  const snapshot = readLiveOddsSnapshot();
  if (!snapshot?.updatedAt) return false;
  const ageMs = Date.now() - Date.parse(snapshot.updatedAt);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < maxAgeMinutes * 60_000;
}

function indexedEventsBySport(fetchedSports) {
  const events = [];
  for (const sport of fetchedSports) {
    for (const event of sport.events || []) {
      const odds = oddsFromEvent(event);
      if (!odds) continue;
      events.push({
        sportKey: sport.sportKey,
        id: event.id || event.event_id || "",
        commenceTime: event.commence_time || event.start_time || "",
        homeTeam: normalizeLooseTeamName(event.home_team),
        awayTeam: normalizeLooseTeamName(event.away_team),
        rawHomeTeam: event.home_team || "",
        rawAwayTeam: event.away_team || "",
        odds,
        bookmakerCount: event.bookmakers?.length || event.books?.length || 0,
      });
    }
  }
  return events;
}

function updateClubFixtureOdds(events) {
  const { headers, rows } = readFixtureCsv();
  if (!headers.length || !rows.length) return { checked: 0, updated: 0 };
  const eventsByKey = new Map();
  for (const event of events) {
    const league = Object.entries(CLUB_SPORT_KEYS).find(([, sportKey]) => sportKey === event.sportKey)?.[0];
    if (!league) continue;
    const key = fixtureMatchKey(league, event.homeTeam, event.awayTeam);
    if (!eventsByKey.has(key)) eventsByKey.set(key, []);
    eventsByKey.get(key).push(event);
  }
  let checked = 0;
  let updated = 0;
  for (const row of rows) {
    const key = fixtureMatchKey(row.league, row.homeTeam, row.awayTeam);
    const candidates = eventsByKey.get(key) || [];
    const event = candidates.find((candidate) => daysBetween(candidate.commenceTime, row.kickoffUtc || row.date) <= 2) || candidates[0];
    if (!event) continue;
    checked += 1;
    row.homeOdds = event.odds.homeOdds;
    row.drawOdds = event.odds.drawOdds;
    row.awayOdds = event.odds.awayOdds;
    row.oddsSource = "The Odds API";
    row.oddsStatus = `Live bookmaker average (${event.bookmakerCount} books)`;
    row.oddsSourceUrl = eventSourceUrl(event.sportKey);
    row.oddsSnapshotAt = new Date().toISOString();
    updated += 1;
  }
  if (updated) writeFixtureCsv(headers, rows);
  return { checked, updated };
}

function internationalOddsFromEvents(events) {
  const fixtureData = readWorldCupFixtureData();
  const worldCupEvents = events.filter((event) => event.sportKey === INTERNATIONAL_SPORT_KEYS["2026 World Cup"]);
  return fixtureData.fixtures
    .map((fixture) => {
      const event = worldCupEvents.find(
        (candidate) =>
          normalizeLooseTeamName(candidate.homeTeam) === normalizeLooseTeamName(fixture.homeTeam) &&
          normalizeLooseTeamName(candidate.awayTeam) === normalizeLooseTeamName(fixture.awayTeam) &&
          daysBetween(candidate.commenceTime, fixture.kickoffUtc || fixture.date) <= 2
      );
      if (!event) return null;
      return {
        date: fixture.date,
        group: fixture.group,
        matchNumber: fixture.matchNumber,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        kickoffUtc: fixture.kickoffUtc,
        odds: event.odds,
        oddsSource: "The Odds API",
        oddsStatus: `Live bookmaker average (${event.bookmakerCount} books)`,
        oddsSourceUrl: eventSourceUrl(event.sportKey),
        oddsSnapshotAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

async function refreshTheOddsApi({ force = false, includeClub = true, includeInternational = true, daysForward = 120 } = {}) {
  const maxAgeMinutes = Number(process.env.ODDS_API_CACHE_MINUTES || 30);
  if (!force && snapshotIsFresh(maxAgeMinutes)) {
    const cached = readLiveOddsSnapshot();
    return { ...cached, cached: true };
  }
  const previousSnapshot = readLiveOddsSnapshot() || {};
  const requestedSportKeys = [
    ...(includeClub ? Object.values(CLUB_SPORT_KEYS) : []),
    ...(includeInternational ? [INTERNATIONAL_SPORT_KEYS["2026 World Cup"]] : []),
  ];
  const availableSports = await fetchAvailableSoccerSportKeys();
  const uniqueRequestedSportKeys = [...new Set(requestedSportKeys)];
  const uniqueSportKeys = availableSports
    ? uniqueRequestedSportKeys.filter((sportKey) => availableSports.has(sportKey))
    : uniqueRequestedSportKeys;
  const unavailableSports = availableSports
    ? uniqueRequestedSportKeys.filter((sportKey) => !availableSports.has(sportKey))
    : [];
  const fetchedSports = [];
  const errors = [];
  for (const sportKey of uniqueSportKeys) {
    try {
      fetchedSports.push(await fetchOddsEvents(sportKey, { daysForward }));
    } catch (error) {
      errors.push({ sportKey, message: error.message });
    }
  }
  const events = indexedEventsBySport(fetchedSports);
  const club = includeClub ? updateClubFixtureOdds(events) : previousSnapshot.club || { checked: 0, updated: 0 };
  const internationalOdds = includeInternational ? internationalOddsFromEvents(events) : [];
  const preservedSports = Array.isArray(previousSnapshot.requestedSports) ? previousSnapshot.requestedSports : [];
  const international = includeInternational
    ? { updated: internationalOdds.length, fixtures: internationalOdds }
    : previousSnapshot.international || { updated: 0, fixtures: [] };
  const snapshot = {
    updatedAt: new Date().toISOString(),
    provider: "The Odds API",
    enabled: Boolean(process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY),
    cached: false,
    requestedSports: [...new Set([...preservedSports, ...uniqueSportKeys])],
    unavailableSports,
    eventCount: events.length,
    club,
    international,
    quota: fetchedSports.map((sport) => ({ sportKey: sport.sportKey, quota: sport.quota || null, skipped: sport.skipped || false, reason: sport.reason || "" })),
    errors,
  };
  writeJson(LIVE_ODDS_PATH, snapshot);
  return snapshot;
}

// Look up one selected matchup without refreshing every configured football
// competition. This keeps the Single Predictor's odds check targeted and lets
// the UI explicitly fall back to user-entered market prices when no book has
// the matchup yet.
async function lookupMatchOdds({ homeTeam, awayTeam, context = "club", league = "" } = {}) {
  if (!homeTeam || !awayTeam) return { found: false, reason: "Choose both teams first." };
  const apiKey = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY || "";
  if (!apiKey) return { found: false, reason: "Odds data is not configured." };

  const sportKey = context === "international"
    ? INTERNATIONAL_SPORT_KEYS[league] || INTERNATIONAL_SPORT_KEYS["2026 World Cup"]
    : CLUB_SPORT_KEYS[league];
  if (!sportKey) return { found: false, reason: "No supported odds market is linked to this competition." };

  try {
    const fetched = await fetchOddsEvents(sportKey, { daysForward: 120 });
    const targetHome = normalizeLooseTeamName(homeTeam);
    const targetAway = normalizeLooseTeamName(awayTeam);
    const event = indexedEventsBySport([fetched]).find((candidate) =>
      candidate.homeTeam === targetHome && candidate.awayTeam === targetAway
    );
    if (!event) return { found: false, reason: "No public market is available for this matchup yet.", sportKey, quota: fetched.quota || null };
    return {
      found: true,
      odds: event.odds,
      provider: "The Odds API",
      sportKey,
      bookmakerCount: event.bookmakerCount,
      kickoffUtc: event.commenceTime,
      sourceUrl: eventSourceUrl(sportKey),
      quota: fetched.quota || null,
    };
  } catch (error) {
    return { found: false, reason: "Odds could not be retrieved right now.", error: error.message };
  }
}

function oddsForInternationalFixture(fixture) {
  const snapshot = readLiveOddsSnapshot();
  const matches = snapshot?.international?.fixtures || [];
  return matches.find(
    (candidate) =>
      String(candidate.date || "") === String(fixture.date || "") &&
      normalizeLooseTeamName(candidate.homeTeam) === normalizeLooseTeamName(fixture.homeTeam) &&
      normalizeLooseTeamName(candidate.awayTeam) === normalizeLooseTeamName(fixture.awayTeam)
  ) || null;
}

module.exports = {
  CLUB_SPORT_KEYS,
  INTERNATIONAL_SPORT_KEYS,
  LIVE_ODDS_PATH,
  oddsForInternationalFixture,
  lookupMatchOdds,
  refreshTheOddsApi,
};
