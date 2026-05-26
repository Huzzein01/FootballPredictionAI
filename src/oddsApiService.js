const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");
const { mutableDataPath, readJsonWithFallback, repoDataPath, writeFileIfWritable, writeJson } = require("./runtimePaths");

const FIXTURE_PATH = repoDataPath("remaining_fixtures_2025_26_with_odds.csv");
const LIVE_ODDS_PATH = mutableDataPath("live_odds_snapshot.json");
const SEEDED_LIVE_ODDS_PATH = repoDataPath("live_odds_snapshot.json");
const WORLD_CUP_FIXTURES_PATH = repoDataPath("international", "world_cup_2026_fixtures.json");
const ODDS_API_BASE_URL = "https://api.the-odds-api.com/v4";
const USER_AGENT = "FootballPredictionAI odds-api-refresh";

const CLUB_SPORT_KEYS = {
  EPL: "soccer_epl",
  "La Liga": "soccer_spain_la_liga",
  Bundesliga: "soccer_germany_bundesliga",
  "Ligue 1": "soccer_france_ligue_one",
  "Serie A": "soccer_italy_serie_a",
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
  return `https://the-odds-api.com/liveapi/guides/v4/#get-odds`;
}

function average(values) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  if (!nums.length) return "";
  return (nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2);
}

function oddsFromEvent(event) {
  const homePrices = [];
  const drawPrices = [];
  const awayPrices = [];
  for (const bookmaker of event.bookmakers || []) {
    const h2h = (bookmaker.markets || []).find((market) => market.key === "h2h");
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

async function fetchOddsEvents(sportKey, { daysForward = 120 } = {}) {
  const apiKey = process.env.ODDS_API_KEY || process.env.THE_ODDS_API_KEY || "";
  if (!apiKey) return { sportKey, skipped: true, reason: "Missing ODDS_API_KEY", events: [] };
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/odds/`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", process.env.ODDS_API_REGIONS || "us");
  url.searchParams.set("markets", process.env.ODDS_API_MARKETS || "h2h");
  url.searchParams.set("oddsFormat", "decimal");
  url.searchParams.set("dateFormat", "iso");
  url.searchParams.set("commenceTimeFrom", oddsApiIso(new Date()));
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + daysForward);
  url.searchParams.set("commenceTimeTo", oddsApiIso(end));
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  const remaining = response.headers.get("x-requests-remaining") || "";
  const used = response.headers.get("x-requests-used") || "";
  const last = response.headers.get("x-requests-last") || "";
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`The Odds API ${sportKey} failed ${response.status}: ${body.slice(0, 180)}`);
  }
  return {
    sportKey,
    skipped: false,
    quota: { remaining, used, last },
    events: await response.json(),
  };
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
        id: event.id || "",
        commenceTime: event.commence_time || "",
        homeTeam: normalizeLooseTeamName(event.home_team),
        awayTeam: normalizeLooseTeamName(event.away_team),
        rawHomeTeam: event.home_team || "",
        rawAwayTeam: event.away_team || "",
        odds,
        bookmakerCount: event.bookmakers?.length || 0,
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
  const sportKeys = [
    ...(includeClub ? Object.values(CLUB_SPORT_KEYS) : []),
    ...(includeInternational ? [INTERNATIONAL_SPORT_KEYS["2026 World Cup"]] : []),
  ];
  const uniqueSportKeys = [...new Set(sportKeys)];
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
    eventCount: events.length,
    club,
    international,
    quota: fetchedSports.map((sport) => ({ sportKey: sport.sportKey, quota: sport.quota || null, skipped: sport.skipped || false, reason: sport.reason || "" })),
    errors,
  };
  writeJson(LIVE_ODDS_PATH, snapshot);
  return snapshot;
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
  refreshTheOddsApi,
};
