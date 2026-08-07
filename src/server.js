const fs = require("fs");
const http = require("http");
const path = require("path");
const { buildParlay, fbrefStatus } = require("./parlayService");
const { fixturePredictionBoard, predictMatch, teamsByLeague } = require("./predictionService");
const { addPrediction, addPredictionsIfMissing, deletePrediction, listPredictions, summary, updateResult } = require("./backtestStore");
const { readTrainingStatus, scheduleRetrain } = require("./continuousTraining");
const { PLAYER_PROFILES, addPlayerStatEntry, listPlayerProfiles, updatePlayerStatEntry } = require("./playerProfileStore");
const { addTeamStatEntry, listTeamProfiles, updateTeamStatEntry } = require("./teamProfileStore");
const { internationalFixturePredictions, internationalGroupTables, internationalStatus, readFixtureData, normalizeIntlTeam } = require("./internationalData");
const { projectTournament } = require("./tournamentProjection");
const { projectClubBracket } = require("./clubBracketProjection");
const { archivedLeagueTables, refreshLiveLeagueContext } = require("./leagueTableService");
const { futuresPredictions, futuresKnockoutBracket } = require("./futuresService");
const { resetPlayerStatsCache } = require("./playerStats");
const { loadMatches, normalizeTeamName } = require("./footballData");
const { refreshMissingOdds } = require("./oddsRepairService");
const { readResultsSnapshot, readFixturesSnapshot, refreshEspnFixtures, refreshEspnResults, enrichPredictionsWithLiveStatus, refreshInternationalFriendlyResults, readFriendlyResultsSnapshot } = require("./espnFixtureService");
const { refreshWorldCupResults, syncWorldCupPlayerStats, readWorldCupResults } = require("./worldCupSync");
const { syncClubPlayerStats } = require("./clubPlayerStatsSync");
const { listTeamResults, getTeamResults } = require("./teamResultsStore");
const { listTeamTraining, getTeamTraining, appendTeamNote, updateTeamTrainingProfiles } = require("./teamTrainingStore");
const { refreshTheOddsApi, lookupMatchOdds, refreshBaseballOddsApi } = require("./oddsApiService");
const { runFixtureBridge, bridgeState } = require("./espnFixtureBridge");
const { apiFootballStatus } = require("./liveData");
const { readOrRefreshSportSeason } = require("./multiSportDataService");
const { resolveClubCrest, fallbackSvg } = require("./clubCrestService");
const { refreshApiFootballPlayerStats } = require("./apiFootballPlayerStats");
const { readJsonWithFallback, repoDataPath } = require("./runtimePaths");
const { hydrateKnownStoresOnce, persistKnownStores, storageStatus } = require("./supabaseJsonStore");
const parlayBacktests = require("./parlayBacktestStore");
const { projectDomesticCup, CUP_CONFIG } = require("./domesticCupProjection");
const { chooseFootballContext, clubSeasonFor } = require("./footballContext");
const { createPrediction: createBaseballPrediction, settlePrediction: settleBaseballPrediction, monitoring: baseballMonitoring } = require("./baseballModel/productionService");
const { forecastBoard: baseballForecastBoard } = require("./baseballModel/forecastService");
const { ingestSchedulePayload } = require("./baseballModel/featureStore");
const { collectPregameFeatures } = require("./baseballModel/pregameCollectors");
const { buildForecastBoard: americanFootballForecastBoard } = require("./americanFootballModel/forecastService");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(process.cwd(), "public");
const PLAYED_RESULTS_PATH = repoDataPath("played_results.json");
const FOCUSED_CLUB_TEAMS = new Set([
  "Man United",
  "Man City",
  "Chelsea",
  "Arsenal",
  "Tottenham",
  "Liverpool",
  "Paris SG",
  "Ath Madrid",
  "Real Madrid",
  "Barcelona",
  "Bayern Munich",
  "Inter Milan",
]);

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function parseFixtureCsv(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("date,"))
    .map((line) => {
      const [date, league, homeTeam, awayTeam, homeOdds, drawOdds, awayOdds] = line.split(",").map((part) => part.trim());
      return { date, league, homeTeam, awayTeam, homeOdds, drawOdds, awayOdds, season: "2025-26" };
    })
    .filter((fixture) => fixture.league && fixture.homeTeam && fixture.awayTeam);
}

function contentType(file) {
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".js")) return "text/javascript";
  if (file.endsWith(".html")) return "text/html";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function actualResultCode(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return "H";
  if (awayGoals > homeGoals) return "A";
  return "D";
}

function loadVerifiedPlayedResults() {
  const data = readJsonWithFallback(PLAYED_RESULTS_PATH, null, { results: [] });
  return Array.isArray(data.results) ? data.results : [];
}

function publicAuthConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const hostedMode = isHostedPublicMode();
  const hideModelStats = hostedMode || process.env.HIDE_MODEL_STATS === "1";
  // Sign-in/login has been removed. The gate is permanently disabled regardless
  // of any AUTH_GATE_ENABLED / REQUIRE_AUTH environment variables so the app is
  // always open. Supabase config is still reported for the KV JSON store, but it
  // never forces an auth wall.
  const requireSignIn = false;
  return {
    enabled: false,
    hostedMode,
    hideModelStats,
    requireSignIn,
    url: supabaseUrl,
    anonKey,
  };
}

function isHostedPublicMode() {
  return Boolean(process.env.VERCEL || process.env.HOSTED_PUBLIC_MODE === "1");
}

function isHostedPrivateApiPath(req, pathname) {
  if (!isHostedPublicMode()) return false;
  if (pathname === "/api/training-status") return true;
  if (pathname === "/api/backtests") return true;
  // NOTE: /api/played-fixtures is intentionally NOT blocked — it serves live
  // ESPN match results to all users on the hosted version.
  if (pathname === "/api/fbref/status") return true;
  if (pathname === "/api/player-profiles") return true;
  if (pathname === "/api/team-profiles") return true;
  if (pathname === "/api/parlay-backtests") return true;
  if (pathname === "/api/fixtures/espn-results-refresh") return true;
  if (pathname === "/api/fixture-predictions/backtest") return true;
  if (pathname === "/api/parlay/backtest") return true;
  if (pathname === "/api/fixtures/bulk") return true;
  if (/^\/api\/player-profiles\/[^/]+\/stats/.test(pathname)) return true;
  if (/^\/api\/team-profiles\/[^/]+\/stats/.test(pathname)) return true;
  return false;
}

const LIVE_FIXTURE_REFRESH_TTL_MS = 5 * 60 * 1000;
let liveFixtureRefreshPromise = null;
let liveFixtureRefreshStartedAt = 0;
let liveFixtureRefreshCompletedAt = 0;

function triggerLiveFixtureRefresh(reason = "background", { force = false } = {}) {
  const now = Date.now();
  if (liveFixtureRefreshPromise) {
    return { running: true, reason, startedAt: new Date(liveFixtureRefreshStartedAt).toISOString() };
  }
  if (!force && liveFixtureRefreshCompletedAt && now - liveFixtureRefreshCompletedAt < LIVE_FIXTURE_REFRESH_TTL_MS) {
    return { running: false, cached: true, reason, refreshedAt: new Date(liveFixtureRefreshCompletedAt).toISOString() };
  }

  liveFixtureRefreshStartedAt = now;
  liveFixtureRefreshPromise = new Promise((resolve) => {
    setTimeout(() => {
      (async () => {
        const resultSnapshot = await refreshEspnResults({ daysBack: 21, daysForward: 1 });
        if (resultSnapshot.settled > 0) {
          await refreshLiveLeagueContext();
          scheduleRetrain(`espn-auto-fixture-results:${reason}`);
        }
        // World Cup live sync: results → auto-settled tracked predictions →
        // training summary rebuild → retrain; then live player stat sync.
        try {
          await refreshWorldCupResults();
          await syncWorldCupPlayerStats();
          await refreshInternationalFriendlyResults();
        } catch (error) {
          console.warn("World Cup sync failed:", error.message);
        }
        await refreshEspnFixtures({ daysBack: 14, daysForward: 180 });
        // Merge newly-published WC knockout fixtures from ESPN into the fixture file.
        try { await runFixtureBridge(); } catch (e) { console.warn("Fixture bridge error:", e.message); }
        await refreshTheOddsApi({ includeClub: true, includeInternational: true, daysForward: 420 });
        await refreshMissingOdds();
        await refreshLiveLeagueContext();
        await persistKnownStores(["backtests", "liveEspnFixtures", "liveEspnResults", "liveOdds", "liveLeagueContext"]);
        liveFixtureRefreshCompletedAt = Date.now();
      })()
        .catch((error) => {
          console.warn(`Live fixture refresh failed (${reason}):`, error.message);
          liveFixtureRefreshCompletedAt = Date.now();
        })
        .finally(() => {
          liveFixtureRefreshPromise = null;
          resolve();
        });
    }, 0);
  });

  return { running: true, reason, startedAt: new Date(liveFixtureRefreshStartedAt).toISOString() };
}

function verifiedPlayedResultMap() {
  return new Map(loadVerifiedPlayedResults().map((result) => [parlayBacktests.fixtureSignatureFromFixture(result), result]));
}

function storedPredictionMap() {
  const entries = listPredictions()
    .filter((prediction) => prediction.source === "fixture-board")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const map = new Map();
  for (const prediction of entries) {
    const key = parlayBacktests.fixtureSignatureFromFixture(prediction);
    if (!map.has(key) || prediction.status === "SETTLED") map.set(key, prediction);
  }
  return map;
}

function settledPredictionMap() {
  return new Map(
    listPredictions()
      .filter((prediction) => prediction.status === "SETTLED")
      .map((prediction) => [parlayBacktests.fixtureSignatureFromFixture(prediction), prediction])
  );
}

// A World Cup fixture leaves the "upcoming" predictions board once it is
// either PLAYED (settled tracked prediction or completed ESPN result) or
// LIVE (in progress). Played matches live on the Results page; live matches
// live in the Live Now section. Only true upcoming fixtures stay on the
// Predictions board / International Fixtures page / parlays.
function hideFromUpcomingPredicate() {
  const exactKey = (h, a, d) => `${normalizeIntlTeam(h)}|${normalizeIntlTeam(a)}|${d}`.toLowerCase();
  const pairKey = (h, a) => `${normalizeIntlTeam(h)}|${normalizeIntlTeam(a)}`.toLowerCase();
  const exact = new Set();
  const pairs = new Set();
  for (const p of listPredictions()) {
    if (p.source === "international-fixture-board" && p.status === "SETTLED") {
      exact.add(exactKey(p.homeTeam, p.awayTeam, p.date));
      pairs.add(pairKey(p.homeTeam, p.awayTeam));
    }
  }
  try {
    for (const r of readWorldCupResults().results || []) {
      // Hide both finished matches and ones currently in progress.
      if (r.completed || r.statusState === "in") pairs.add(pairKey(r.homeTeam, r.awayTeam));
    }
  } catch (_) { /* results snapshot optional */ }
  return (fx) => exact.has(exactKey(fx.homeTeam, fx.awayTeam, fx.date)) || pairs.has(pairKey(fx.homeTeam, fx.awayTeam));
}

function remainingFixturePredictions(season = "2025-26") {
  const playedKeys = parlayBacktests.playedFixtureKeys();
  const verifiedResults = verifiedPlayedResultMap();
  const settledPredictions = settledPredictionMap();
  return fixturePredictionBoard({ season }).filter((prediction) => {
    const key = parlayBacktests.fixtureSignatureFromFixture(prediction);
    return !playedKeys.has(key) && !verifiedResults.has(key) && !settledPredictions.has(key);
  });
}

function playedFixturePredictions() {
  const summaries = new Map(parlayBacktests.playedFixtureSummaries().map((summaryItem) => [summaryItem.key, summaryItem]));
  const verifiedResults = verifiedPlayedResultMap();
  const storedPredictions = storedPredictionMap();
  const settledPredictions = settledPredictionMap();
  return fixturePredictionBoard()
    .map((prediction) => {
      const key = parlayBacktests.fixtureSignatureFromFixture(prediction);
      const originalPrediction = settledPredictions.get(key) || storedPredictions.get(key) || prediction;
      const parlaySummary = summaries.get(key) || null;
      const verified = verifiedResults.get(key) || null;
      const settled = settledPredictions.get(key) || null;
      if (!parlaySummary && !verified && !settled) return { prediction, played: null };
      const homeGoals = verified ? Number(verified.homeGoals) : settled ? Number(settled.homeGoals) : null;
      const awayGoals = verified ? Number(verified.awayGoals) : settled ? Number(settled.awayGoals) : null;
      const actualResult = verified ? actualResultCode(homeGoals, awayGoals) : settled ? settled.actualResult : null;
      const modelCorrect = verified
        ? originalPrediction.prediction === actualResult
        : settled
        ? settled.correct
        : parlaySummary.modelCorrect;
      const exactScoreCorrect = verified
        ? String(originalPrediction.projectedScore || "").trim() === `${homeGoals}-${awayGoals}`
        : settled
        ? settled.scoreCorrect
        : null;
      return {
        prediction: originalPrediction,
        played: {
          ...(parlaySummary || {
            key,
            date: originalPrediction.date,
            fixture: `${originalPrediction.homeTeam} vs ${originalPrediction.awayTeam}`,
            league: originalPrediction.league,
            hits: 0,
            misses: 0,
            voids: 0,
            settledLegs: 0,
            picks: [],
            markets: [],
          }),
          actualResult,
          actualScore: verified ? `${homeGoals}-${awayGoals}` : "",
          homeGoals,
          awayGoals,
          modelCorrect,
          exactScoreCorrect,
          originalCreatedAt: originalPrediction.createdAt || "",
          sourceName: verified?.sourceName || (settled ? "Fixture backtest ledger" : ""),
          sourceUrl: verified?.sourceUrl || "",
          statusLabel: verified
            ? modelCorrect
              ? exactScoreCorrect
                ? "Pick and score correct"
                : "Pick correct, score missed"
              : "Pick missed"
            : settled
            ? modelCorrect
              ? exactScoreCorrect
                ? "Pick and score correct"
                : "Pick correct, score missed"
              : "Pick missed"
            : parlaySummary.statusLabel,
        },
      };
    })
    .filter((item) => item.played)
    .map((item) => ({ ...item.prediction, played: item.played }));
}

function historicalPlayedFixtures(season = "2025-26") {
  return loadMatches()
    .filter((row) => row.Season === season)
    .filter((row) => row.FTHG !== "" && row.FTAG !== "")
    .filter((row) => FOCUSED_CLUB_TEAMS.has(normalizeTeamName(row.HomeTeam)) || FOCUSED_CLUB_TEAMS.has(normalizeTeamName(row.AwayTeam)))
    .map((row) => {
      const homeTeam = normalizeTeamName(row.HomeTeam);
      const awayTeam = normalizeTeamName(row.AwayTeam);
      const homeGoals = Number(row.FTHG);
      const awayGoals = Number(row.FTAG);
      const actualResult = actualResultCode(homeGoals, awayGoals);
      return {
        league: row.League,
        season: row.Season,
        date: row.DateISO,
        homeTeam,
        awayTeam,
        prediction: actualResult,
        confidence: 100,
        projectedScore: "",
        probabilities: { homeWinPct: 0, drawPct: 0, awayWinPct: 0 },
        played: {
          key: `${row.DateISO}|${homeTeam}|${awayTeam}`.toLowerCase(),
          date: row.DateISO,
          fixture: `${homeTeam} vs ${awayTeam}`,
          league: row.League,
          hits: 0,
          misses: 0,
          voids: 0,
          settledLegs: 0,
          picks: [],
          markets: [],
          actualResult,
          actualScore: `${homeGoals}-${awayGoals}`,
          homeGoals,
          awayGoals,
          modelCorrect: null,
          exactScoreCorrect: null,
          sourceName: "Imported historical match CSV",
          sourceUrl: "",
          statusLabel: "Historical result",
        },
      };
    })
    .sort((a, b) => `${b.date} ${b.homeTeam}`.localeCompare(`${a.date} ${a.homeTeam}`));
}

function seasonDateRange(season = "2025-26") {
  const match = String(season).match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  let endYear = Math.floor(startYear / 100) * 100 + Number(match[2]);
  if (endYear < startYear) endYear += 100;
  return {
    start: `${startYear}-07-01`,
    end: `${endYear}-06-30`,
  };
}

function dateInSeason(date, season = "2025-26") {
  const range = seasonDateRange(season);
  if (!range || !date) return false;
  return date >= range.start && date <= range.end;
}

function playedPredictionKey(prediction) {
  return parlayBacktests.fixtureSignatureFromFixture({
    date: prediction.date,
    homeTeam: normalizeTeamName(prediction.homeTeam),
    awayTeam: normalizeTeamName(prediction.awayTeam),
  });
}

function sourcePlayedResultCard(result, { modelPrediction = null, statusLabel = "API result" } = {}) {
  const homeTeam = normalizeTeamName(result.homeTeam);
  const awayTeam = normalizeTeamName(result.awayTeam);
  const homeGoals = Number(result.homeGoals);
  const awayGoals = Number(result.awayGoals);
  const actualResult = actualResultCode(homeGoals, awayGoals);
  const prediction = modelPrediction || {
    league: result.league,
    season: "2025-26",
    date: result.date,
    homeTeam,
    awayTeam,
    prediction: actualResult,
    confidence: 100,
    projectedScore: "",
    probabilities: { homeWinPct: 0, drawPct: 0, awayWinPct: 0 },
  };
  const modelCorrect = modelPrediction?.prediction ? modelPrediction.prediction === actualResult : null;
  const exactScoreCorrect = modelPrediction?.projectedScore ? String(modelPrediction.projectedScore).trim() === `${homeGoals}-${awayGoals}` : null;
  return {
    ...prediction,
    league: result.league || prediction.league,
    season: prediction.season || "2025-26",
    date: result.date || prediction.date,
    homeTeam,
    awayTeam,
    played: {
      key: playedPredictionKey({ date: result.date, homeTeam, awayTeam }),
      date: result.date,
      fixture: `${homeTeam} vs ${awayTeam}`,
      league: result.league || prediction.league,
      hits: 0,
      misses: 0,
      voids: 0,
      settledLegs: 0,
      picks: [],
      markets: [],
      actualResult,
      actualScore: `${homeGoals}-${awayGoals}`,
      homeGoals,
      awayGoals,
      modelCorrect,
      exactScoreCorrect,
      sourceName: result.sourceName || "Fixture result API",
      sourceUrl: result.sourceUrl || "",
      statusLabel,
    },
  };
}

function apiPlayedFixtures(season = "2025-26") {
  const snapshot = readResultsSnapshot();
  const results = Array.isArray(snapshot?.results) ? snapshot.results : [];
  if (!results.length) return [];
  const storedPredictions = storedPredictionMap();
  const boardPredictions = new Map(fixturePredictionBoard().map((prediction) => [playedPredictionKey(prediction), prediction]));

  return results
    .filter((result) => dateInSeason(result.date, season))
    .filter((result) => result.league && result.homeTeam && result.awayTeam)
    .filter((result) => Number.isFinite(Number(result.homeGoals)) && Number.isFinite(Number(result.awayGoals)))
    .map((result) => {
      const homeTeam = normalizeTeamName(result.homeTeam);
      const awayTeam = normalizeTeamName(result.awayTeam);
      const key = playedPredictionKey({ date: result.date, homeTeam, awayTeam });
      const modelPrediction = storedPredictions.get(key) || boardPredictions.get(key) || null;
      const homeGoals = Number(result.homeGoals);
      const awayGoals = Number(result.awayGoals);
      const actualResult = actualResultCode(homeGoals, awayGoals);
      const modelCorrect = modelPrediction?.prediction ? modelPrediction.prediction === actualResult : null;
      const statusLabel = modelPrediction
        ? modelCorrect
          ? String(modelPrediction.projectedScore || "").trim() === `${homeGoals}-${awayGoals}`
            ? "Pick and score correct"
            : "Pick correct, score missed"
          : "Pick missed"
        : "API result";
      return sourcePlayedResultCard({ ...result, homeTeam, awayTeam }, { modelPrediction, statusLabel });
    });
}

function mergePlayedFixtureSources(...sources) {
  const byKey = new Map();
  for (const source of sources) {
    for (const prediction of source || []) {
      const key = playedPredictionKey(prediction);
      if (!key || byKey.has(key)) continue;
      byKey.set(key, prediction);
    }
  }
  return [...byKey.values()].sort((a, b) => `${b.date} ${b.league} ${b.homeTeam}`.localeCompare(`${a.date} ${a.league} ${a.homeTeam}`));
}

function shouldRefreshApiFootballPlayerSeason(season = "2025-26", forceLive = false) {
  if (forceLive) return true;
  if (!/^\d{4}-\d{2}$/.test(String(season))) return false;
  if (season === "2025-26") return false;
  if (season === "2026-27") return false;
  return true;
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/club-crest") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const crest = await resolveClubCrest(url.searchParams.get("team") || "");
    if (crest) { res.writeHead(302, { Location: crest, "Cache-Control": "public, max-age=604800" }); return res.end(); }
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" });
    return res.end(fallbackSvg(url.searchParams.get("team")));
  }
  // Read-only, cache-only summary for the hero. It deliberately avoids any
  // upstream refresh so a slow provider can never hold the dashboard chrome
  // in a loading state; the regular fixture endpoints own refresh work.
  if (req.method === "GET" && pathname === "/api/football/pulse") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const context = url.searchParams.get("context") === "international" ? "international" : "club";
    const season = url.searchParams.get("season") || "2025-26";
    const hideFromUpcoming = context === "international" ? hideFromUpcomingPredicate() : null;
    const predictions = context === "international"
      ? internationalFixturePredictions().filter((prediction) => !hideFromUpcoming(prediction))
      : enrichPredictionsWithLiveStatus(remainingFixturePredictions(season));
    return sendJson(res, 200, {
      context,
      season,
      cachedAt: new Date().toISOString(),
      predictions,
      summary: {
        total: predictions.length,
        withOdds: predictions.filter((prediction) => prediction.hasOdds).length,
        modelOnly: predictions.filter((prediction) => !prediction.hasOdds).length,
      },
    });
  }
  await hydrateKnownStoresOnce();

  if (isHostedPrivateApiPath(req, pathname)) {
    return sendJson(res, 403, { error: "This internal training and model-accuracy endpoint is hidden on the hosted tester version." });
  }

  if (req.method === "GET" && pathname === "/api/storage/status") {
    return sendJson(res, 200, await storageStatus());
  }

  if (req.method === "GET" && pathname === "/api/auth/config") {
    return sendJson(res, 200, publicAuthConfig());
  }

  if (req.method === "GET" && pathname === "/api/meta") {
    const model = JSON.parse(fs.readFileSync(path.join(process.cwd(), "model", "football_match_model.json"), "utf8"));
    if (publicAuthConfig().hideModelStats) {
      return sendJson(res, 200, {
        teamsByLeague: teamsByLeague(),
        metrics: null,
        hyperparameters: null,
        trainedAt: model.trainedAt,
        feedbackRows: 0,
        trainingStatus: { status: "Hidden on hosted tester version" },
      });
    }
    return sendJson(res, 200, { teamsByLeague: teamsByLeague(), metrics: model.metrics, hyperparameters: model.hyperparameters, trainedAt: model.trainedAt, feedbackRows: model.feedbackRows || 0, trainingStatus: readTrainingStatus() });
  }
  if (req.method === "GET" && pathname === "/api/baseball/monitoring") return sendJson(res, 200, baseballMonitoring());
  if (req.method === "POST" && pathname === "/api/baseball/jobs/schedule") {
    const { date = new Date().toISOString().slice(0, 10) } = await readBody(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendJson(res, 400, { error: "date must be YYYY-MM-DD" });
    const sourceUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=venue,probablePitcher`;
    const response = await fetch(sourceUrl); if (!response.ok) return sendJson(res, 502, { error: `MLB schedule request failed: ${response.status}` });
    return sendJson(res, 201, ingestSchedulePayload({ payload: await response.json(), sourceUrl }));
  }
  if (req.method === "POST" && pathname === "/api/baseball/jobs/collect-pregame") {
    const { normalizedSchedule, capturedAt } = await readBody(req);
    if (!normalizedSchedule?.games) return sendJson(res, 400, { error: "normalizedSchedule.games is required" });
    return sendJson(res, 201, await collectPregameFeatures({ normalizedSchedule, capturedAt }));
  }
  if (req.method === "POST" && pathname === "/api/baseball/predictions") {
    const body = await readBody(req); const model = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "baseball_model.json"), "utf8"));
    const result = createBaseballPrediction({ snapshot: body.snapshot, model, odds: body.odds, calibration: body.calibration, backtestBet: body.backtestBet }); return sendJson(res, result.status, result);
  }
  const baseballSettlement = pathname.match(/^\/api\/baseball\/predictions\/(.+)\/settlement$/);
  if (req.method === "POST" && baseballSettlement) return sendJson(res, 200, settleBaseballPrediction(decodeURIComponent(baseballSettlement[1]), await readBody(req)));

  const multiSportMatch = pathname.match(/^\/api\/sports\/(baseball|basketball|american-football)\/season$/);
  if (req.method === "GET" && multiSportMatch) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sport = multiSportMatch[1];
    const season = url.searchParams.get("season") || (sport === "baseball" ? String(new Date().getUTCFullYear()) : "2025");
    const refresh = url.searchParams.get("refresh") === "1";
    try {
      return sendJson(res, 200, await readOrRefreshSportSeason(sport, season, { refresh }));
    } catch (error) {
      return sendJson(res, 502, { error: error.message, sport, season });
    }
  }

  if (req.method === "GET" && pathname === "/api/american-football/status") {
    return sendJson(res, 200, americanFootballForecastBoard());
  }

  if (req.method === "GET" && pathname === "/api/sports/baseball/predictions") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const season = url.searchParams.get("season") || String(new Date().getUTCFullYear());
    const refresh = url.searchParams.get("refresh") === "1";
    const refreshOdds = url.searchParams.get("refreshOdds") === "1";
    const limit = Math.max(0, Number(url.searchParams.get("limit") || 30));
    const marketWeight = Math.max(0, Math.min(1, Number(url.searchParams.get("marketWeight") || 0.2)));
    const oddsDays = Math.max(1, Math.min(60, Number(url.searchParams.get("oddsDays") || 14)));
    try {
      const currentSeason = await readOrRefreshSportSeason("baseball", season, { refresh });
      const odds = await refreshBaseballOddsApi({ force: refreshOdds, daysForward: oddsDays });
      const board = baseballForecastBoard(currentSeason, { oddsEvents: odds.events || [], limit, marketWeight });
      return sendJson(res, 200, { ...board, odds: { ...odds, events: undefined } });
    } catch (error) {
      return sendJson(res, 502, { error: error.message, sport: "baseball", season });
    }
  }

  if (req.method === "GET" && pathname === "/api/training-status") {
    return sendJson(res, 200, readTrainingStatus());
  }

  if (req.method === "GET" && pathname === "/api/fixture-bridge/status") {
    return sendJson(res, 200, bridgeState());
  }

  if (req.method === "POST" && pathname === "/api/fixture-bridge/sync") {
    const result = await runFixtureBridge({ force: true });
    return sendJson(res, 200, result);
  }

  if (req.method === "POST" && pathname === "/api/predict") {
    const body = await readBody(req);
    const prediction = predictMatch(body);
    const saved = body.save ? addPrediction(prediction, "manual") : null;
    return sendJson(res, 200, { prediction, saved, summary: summary() });
  }

  if (req.method === "POST" && pathname === "/api/odds/lookup") {
    const body = await readBody(req);
    const result = await lookupMatchOdds({
      homeTeam: String(body.homeTeam || ""),
      awayTeam: String(body.awayTeam || ""),
      context: body.context === "international" ? "international" : "club",
      league: String(body.league || ""),
    });
    return sendJson(res, 200, result);
  }

  if (req.method === "GET" && pathname === "/api/backtests") {
    const resultSnapshot = await refreshEspnResults();
    if (resultSnapshot.settled > 0) {
      await refreshLiveLeagueContext();
      scheduleRetrain("espn-auto-fixture-results");
    }
    await persistKnownStores(["backtests", "liveEspnResults", "liveLeagueContext"]);
    return sendJson(res, 200, { predictions: listPredictions(), summary: summary() });
  }

  if (req.method === "GET" && pathname === "/api/fixture-predictions") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const season = url.searchParams.get("season") || "2025-26";
    const liveRefresh = season === "2025-26"
      ? triggerLiveFixtureRefresh("fixture-predictions")
      : { running: false, season, message: "Use the season fixture refresh to update this schedule." };
    const predictions = enrichPredictionsWithLiveStatus(remainingFixturePredictions(season));
    const playedCount = season === "2025-26" ? playedFixturePredictions().length : 0;
    return sendJson(res, 200, {
      predictions,
      liveRefresh,
      summary: {
        total: predictions.length,
        played: playedCount,
        withOdds: predictions.filter((prediction) => prediction.hasOdds).length,
        modelOnly: predictions.filter((prediction) => !prediction.hasOdds).length,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/football/context") {
    const now = new Date();
    const clubSeason = clubSeasonFor(now);
    // The context switch must render immediately. Fixture collectors refresh
    // this cache independently; never hold the UI on a network request here.
    const friendlySnapshot = readFriendlyResultsSnapshot() || {};
    const internationalFixtures = [
      ...(readFixtureData().fixtures || []),
      ...(friendlySnapshot?.fixtures || []),
    ];
    const decision = chooseFootballContext({
      now,
      clubFixtures: readFixturesSnapshot()?.fixtures || [],
      internationalFixtures,
    });
    return sendJson(res, 200, {
      ...decision,
      evaluatedAt: now.toISOString(),
      clubSeason,
      fixture: decision.fixture ? {
        date: decision.fixture.date || "",
        kickoffUtc: decision.fixture.kickoffUtc || "",
        league: decision.fixture.league || "",
        homeTeam: decision.fixture.homeTeam || "",
        awayTeam: decision.fixture.awayTeam || "",
      } : null,
    });
  }

  if (req.method === "GET" && pathname === "/api/played-fixtures") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const season = url.searchParams.get("season") || "2025-26";
    const context = url.searchParams.get("context") === "international" ? "international" : "club";
    if (context === "international") {
      // Auto-sync World Cup results from ESPN (TTL-cached), which also
      // auto-creates and settles tracked predictions for finished matches.
      let wcSnapshot = null;
      try {
        wcSnapshot = await refreshWorldCupResults();
        await syncWorldCupPlayerStats();
      } catch (_) {
        wcSnapshot = readWorldCupResults();
      }
      // Matchday lookup so settled result cards can be grouped/filtered.
      const intlBoard = internationalFixturePredictions();
      const mdByKey = new Map(
        intlBoard.map((b) => [`${b.homeTeam}|${b.awayTeam}|${b.date}`.toLowerCase(), { matchday: b.matchday, matchdayLabel: b.matchdayLabel }])
      );
      const settledIntl = listPredictions()
        .filter((p) => p.source === "international-fixture-board" && p.status === "SETTLED")
        .map((p) => ({
          id: p.id,
          date: p.date,
          league: p.league,
          matchday: mdByKey.get(`${p.homeTeam}|${p.awayTeam}|${p.date}`.toLowerCase())?.matchday || null,
          matchdayLabel: mdByKey.get(`${p.homeTeam}|${p.awayTeam}|${p.date}`.toLowerCase())?.matchdayLabel || "",
          homeTeam: p.homeTeam,
          awayTeam: p.awayTeam,
          homeFlagUrl: p.homeFlagUrl || "",
          awayFlagUrl: p.awayFlagUrl || "",
          prediction: p.prediction,
          confidence: p.confidence,
          projectedScore: p.projectedScore,
          played: {
            homeGoals: Number(p.homeGoals),
            awayGoals: Number(p.awayGoals),
            actualResult: p.actualResult,
            modelCorrect: p.correct === true ? true : p.correct === false ? false : null,
            exactScoreCorrect: p.scoreCorrect === true,
            statusLabel: "Auto-settled from ESPN World Cup scoreboard",
            sourceName: p.resultSourceName || "ESPN public scoreboard",
            sourceUrl: p.resultSourceUrl || "",
          },
        }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const correct = settledIntl.filter((p) => p.played.modelCorrect === true).length;
      const wrong = settledIntl.filter((p) => p.played.modelCorrect === false).length;
      const voided = settledIntl.filter((p) => p.played.modelCorrect === null).length;
      const exactScores = settledIntl.filter((p) => p.played.exactScoreCorrect).length;
      return sendJson(res, 200, {
        predictions: settledIntl,
        apiSync: wcSnapshot
          ? {
              source: wcSnapshot.source || "ESPN World Cup scoreboard",
              updatedAt: wcSnapshot.updatedAt || "",
              cached: Boolean(wcSnapshot.cached),
              fetched: wcSnapshot.fetched || 0,
              settled: wcSnapshot.settled || 0,
              errors: wcSnapshot.error ? [{ league: "FIFA World Cup", message: wcSnapshot.error }] : [],
            }
          : null,
        summary: { total: settledIntl.length, correct, wrong, voided, exactScores },
      });
    }

    // On the hosted version, always do a fresh ESPN results fetch so users see
    // up-to-date scores (ESPN API returns completed matches from the last 14 days).
    let espnSnapshot = null;
    try {
      espnSnapshot = await refreshEspnResults({ daysBack: 21, daysForward: 1 });
    } catch (_) {
      espnSnapshot = readResultsSnapshot();
    }

    // Build the predictions list: merge ESPN results with any locally stored predictions
    let predictions = mergePlayedFixtureSources(
      season === "2025-26" ? playedFixturePredictions() : [],
      apiPlayedFixtures(season),
      historicalPlayedFixtures(season)
    );

    // If we still have no predictions, build simple result cards directly from the ESPN snapshot
    if (!predictions.length && espnSnapshot?.results?.length) {
      predictions = (espnSnapshot.results || [])
        .filter((r) => r.completed && r.homeTeam && r.awayTeam && Number.isFinite(Number(r.homeGoals)) && Number.isFinite(Number(r.awayGoals)))
        .map((r) => ({
          id: r.espnEventId || `${r.date}-${r.homeTeam}-${r.awayTeam}`,
          date: r.date || "",
          league: r.league || "",
          homeTeam: normalizeTeamName(r.homeTeam),
          awayTeam: normalizeTeamName(r.awayTeam),
          prediction: null,
          played: {
            homeGoals: Number(r.homeGoals),
            awayGoals: Number(r.awayGoals),
            modelCorrect: null,
            exactScoreCorrect: null,
            statusLabel: "ESPN result",
            sourceName: r.sourceName || "ESPN public scoreboard",
            sourceUrl: r.sourceUrl || "",
          },
        }));
    }

    const correct = predictions.filter((p) => p.played?.modelCorrect === true).length;
    const wrong = predictions.filter((p) => p.played?.modelCorrect === false).length;
    const voided = predictions.filter((p) => p.played?.modelCorrect === null).length;
    const exactScores = predictions.filter((p) => p.played?.exactScoreCorrect === true).length;
    return sendJson(res, 200, {
      predictions,
      apiSync: espnSnapshot
        ? {
            source: espnSnapshot.source || "ESPN public scoreboard",
            updatedAt: espnSnapshot.updatedAt,
            cached: Boolean(espnSnapshot.cached),
            fetched: espnSnapshot.fetched || 0,
            settled: espnSnapshot.settled || 0,
            errors: espnSnapshot.errors || [],
          }
        : null,
      summary: { total: predictions.length, correct, wrong, voided, exactScores },
    });
  }

  if (req.method === "GET" && pathname === "/api/fbref/status") {
    return sendJson(res, 200, fbrefStatus());
  }

  if (req.method === "POST" && pathname === "/api/fixtures/espn-refresh") {
    const body = await readBody(req);
    const season = /^\d{4}-\d{2}$/.test(String(body.season || "")) ? body.season : "2025-26";
    const [startYear] = season.split("-").map(Number);
    const dateWindow = `${startYear}0701-${startYear + 1}0630`;
    const snapshot = await refreshEspnFixtures({ dateWindow, season });
    await persistKnownStores(["liveEspnFixtures"]);
    return sendJson(res, 200, snapshot);
  }

  if (req.method === "POST" && pathname === "/api/fixtures/espn-results-refresh") {
    const snapshot = await refreshEspnResults({ daysBack: 60, daysForward: 1, force: true });
    if (snapshot.settled > 0) {
      await refreshLiveLeagueContext();
      scheduleRetrain("espn-auto-fixture-results");
    }
    await persistKnownStores(["backtests", "liveEspnResults", "liveLeagueContext"]);
    return sendJson(res, 200, { ...snapshot, summary: summary() });
  }

  if (req.method === "POST" && pathname === "/api/odds/refresh") {
    const snapshot = await refreshTheOddsApi({ force: true, includeClub: true, includeInternational: true, daysForward: 420 });
    await persistKnownStores(["liveOdds"]);
    return sendJson(res, 200, snapshot);
  }

  // ── Per-team ESPN results & continuous training corpus ─────────────────────
  if (req.method === "GET" && pathname === "/api/teams/results") {
    return sendJson(res, 200, listTeamResults());
  }
  if (req.method === "GET" && pathname === "/api/teams/training") {
    return sendJson(res, 200, listTeamTraining());
  }
  if (req.method === "POST" && pathname === "/api/teams/train") {
    const summaryOut = updateTeamTrainingProfiles({ reason: "manual-api-trigger" });
    scheduleRetrain("team-training-refresh");
    return sendJson(res, 200, { ...summaryOut, trainingStatus: readTrainingStatus() });
  }
  const teamResultsMatch = pathname.match(/^\/api\/teams\/([^/]+)\/results$/);
  if (req.method === "GET" && teamResultsMatch) {
    const record = getTeamResults(decodeURIComponent(teamResultsMatch[1]));
    if (!record) return sendJson(res, 404, { error: "No results stored for this team yet" });
    return sendJson(res, 200, record);
  }
  const teamNoteMatch = pathname.match(/^\/api\/teams\/([^/]+)\/note$/);
  if (req.method === "POST" && teamNoteMatch) {
    const profile = appendTeamNote(decodeURIComponent(teamNoteMatch[1]), await readBody(req));
    if (!profile) return sendJson(res, 404, { error: "Team not found or note text missing" });
    return sendJson(res, 200, profile);
  }
  const teamTrainingMatch = pathname.match(/^\/api\/teams\/([^/]+)$/);
  if (req.method === "GET" && teamTrainingMatch) {
    const profile = getTeamTraining(decodeURIComponent(teamTrainingMatch[1]));
    if (!profile) return sendJson(res, 404, { error: "No training profile for this team yet" });
    return sendJson(res, 200, profile);
  }

  if (req.method === "GET" && pathname === "/api/live/api-football/status") {
    return sendJson(res, 200, await apiFootballStatus());
  }

  if (req.method === "GET" && pathname === "/api/league-tables") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return sendJson(res, 200, await archivedLeagueTables(url.searchParams.get("season") || "2025-26"));
  }

  if (req.method === "GET" && pathname === "/api/futures") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const context = url.searchParams.get("context") || "club";
    const season  = url.searchParams.get("season") || "";
    const league  = url.searchParams.get("league") || "All";

    // ── Cache-first (everywhere) ─────────────────────────────────────────────
    // The prebuilt JSON (regenerated by the cloud trainer + prebuildBrackets)
    // keeps futures instant — locally too, where live computation is ~5s and
    // would otherwise bog the single-threaded server under UI polling.
    {
      const safeSeason = (season || "2025-26").replace(/[^a-zA-Z0-9-]/g, "");
      const safeLeague = league.replace(/[^a-zA-Z0-9]/g, "-");
      const cacheKey  = context === "international"
        ? "international__2026-World-Cup"
        : `club__${safeSeason}__${safeLeague}`;
      const cachePath = path.join(process.cwd(), "data", "cached", "futures", `${cacheKey}.json`);
      if (fs.existsSync(cachePath)) {
        try {
          return sendJson(res, 200, JSON.parse(fs.readFileSync(cachePath, "utf8")));
        } catch (_) { /* fall through to live */ }
      }
    }

    return sendJson(
      res, 200,
      await futuresPredictions({ context, season, league })
    );
  }

  // ── Domestic cup bracket projection ────────────────────────────────────
  const cupBracketMatch = pathname.match(/^\/api\/cup-bracket\/([\w-]+)$/);
  if (req.method === "GET" && cupBracketMatch) {
    const cupId = cupBracketMatch[1];
    if (!CUP_CONFIG[cupId]) return sendJson(res, 404, { error: `Unknown cup: ${cupId}` });

    // Try pre-built cache first
    const cupCachePath = path.join(process.cwd(), "data", "cached", "cups", `${cupId}.json`);
    if (fs.existsSync(cupCachePath)) {
      try {
        return sendJson(res, 200, JSON.parse(fs.readFileSync(cupCachePath, "utf8")));
      } catch (_) { /* fall through */ }
    }
    try {
      return sendJson(res, 200, projectDomesticCup(cupId));
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (req.method === "GET" && pathname === "/api/player-profiles") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const season = url.searchParams.get("season") || "2025-26";
    const forceLive = url.searchParams.get("forceLive") === "1";
    let liveRefresh = null;
    try {
      if (shouldRefreshApiFootballPlayerSeason(season, forceLive)) {
        liveRefresh = await refreshApiFootballPlayerStats({ profiles: PLAYER_PROFILES, season, force: forceLive });
        if (liveRefresh.changed) {
          resetPlayerStatsCache();
          scheduleRetrain("api-football-player-profile-refresh");
          await persistKnownStores(["apiFootballPlayerStats"]);
        }
      } else {
        liveRefresh = {
          provider: "API-Football",
          season,
          status: season === "2025-26" ? "CURRENT_SEASON_SKIPPED" : "UNAVAILABLE_SEASON",
          changed: false,
          cached: true,
          rowCount: 0,
          updatedProfiles: 0,
        };
      }
    } catch (error) {
      liveRefresh = {
        provider: "API-Football",
        season,
        status: "FAILED",
        error: error.message,
        changed: false,
      };
    }
    return sendJson(res, 200, { ...listPlayerProfiles({ season }), liveRefresh });
  }

  if (req.method === "GET" && pathname === "/api/team-profiles") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const season = url.searchParams.get("season") || "2025-26";
    const context = url.searchParams.get("context") === "international" ? "international" : "club";
    const tableData = context === "international" ? null : await archivedLeagueTables(season);
    return sendJson(res, 200, listTeamProfiles(season, tableData, context));
  }

  if (req.method === "GET" && pathname === "/api/international/status") {
    return sendJson(res, 200, internationalStatus());
  }

  if (req.method === "GET" && pathname === "/api/international/fixtures") {
    // Reflect settled results first so played matches drop off immediately.
    try { await refreshWorldCupResults(); } catch (_) { /* use stored */ }
    const fixtureData = readFixtureData();
    const isHidden = hideFromUpcomingPredicate();
    const upcoming = (fixtureData.fixtures || []).filter((f) => !isHidden(f));
    return sendJson(res, 200, {
      ...fixtureData,
      fixtures: upcoming,
      fixtureCount: upcoming.length,
      playedCount: (fixtureData.fixtures || []).length - upcoming.length,
    });
  }

  if (req.method === "GET" && pathname === "/api/international/fixture-predictions") {
    await Promise.all([
      refreshTheOddsApi({ includeClub: false, includeInternational: true, daysForward: 420 }),
      refreshInternationalFriendlyResults(),
      refreshWorldCupResults().catch(() => null),
    ]);
    // Hide played (Results) and live (Live Now) matches — keep only upcoming.
    const isHidden = hideFromUpcomingPredicate();
    const allPredictions = internationalFixturePredictions();
    const predictions = allPredictions.filter((prediction) => !isHidden(prediction));
    return sendJson(res, 200, {
      predictions,
      summary: {
        total: predictions.length,
        played: allPredictions.length - predictions.length,
        withOdds: predictions.filter((prediction) => prediction.hasOdds).length,
        modelOnly: predictions.filter((prediction) => !prediction.hasOdds).length,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/international/live") {
    // Currently in-progress World Cup matches with live score + clock, joined
    // to the model's pre-match pick so users see prediction vs live state.
    // Uses the TTL-cached refresh (NOT force) so frequent polling — the goal
    // watcher every 20s + the Live view every 30s — can't stack heavy ESPN
    // fetches and block the single-threaded server. The background loop and
    // the 2-min TTL keep scores fresh.
    let snap = null;
    try { snap = await refreshWorldCupResults(); } catch (_) { snap = readWorldCupResults(); }
    const liveRaw = (snap?.results || []).filter((r) => r.statusState === "in");
    const board = internationalFixturePredictions();
    const byPair = new Map(
      board.map((b) => [`${normalizeIntlTeam(b.homeTeam)}|${normalizeIntlTeam(b.awayTeam)}`.toLowerCase(), b])
    );
    const matches = liveRaw.map((r) => {
      const pred = byPair.get(`${normalizeIntlTeam(r.homeTeam)}|${normalizeIntlTeam(r.awayTeam)}`.toLowerCase()) || null;
      const homeGoals = Number(r.homeGoals);
      const awayGoals = Number(r.awayGoals);
      const leader = !Number.isFinite(homeGoals) || homeGoals === awayGoals ? "D" : homeGoals > awayGoals ? "H" : "A";
      return {
        homeTeam: pred?.homeTeam || r.homeTeam,
        awayTeam: pred?.awayTeam || r.awayTeam,
        homeFlagUrl: pred?.homeFlagUrl || "",
        awayFlagUrl: pred?.awayFlagUrl || "",
        homeGoals: Number.isFinite(homeGoals) ? homeGoals : null,
        awayGoals: Number.isFinite(awayGoals) ? awayGoals : null,
        clock: r.statusDetail || r.statusName || "Live",
        group: pred?.group || pred?.league || "",
        matchday: pred?.matchday || null,
        matchdayLabel: pred?.matchdayLabel || "",
        prediction: pred?.prediction || null,
        confidence: pred?.confidence ?? null,
        projectedScore: pred?.projectedScore || "",
        // Is the model's pick currently ahead on the live scoreline?
        pickTrackingLive: pred?.prediction ? pred.prediction === leader : null,
        sourceUrl: r.sourceUrl || "",
      };
    });
    return sendJson(res, 200, {
      updatedAt: snap?.updatedAt || new Date().toISOString(),
      count: matches.length,
      matches,
    });
  }

  if (req.method === "GET" && pathname === "/api/international/group-tables") {
    // Standings are derived from auto-settled World Cup results — sync first
    // (TTL-cached) so the tables update as soon as matches finish.
    try {
      await refreshWorldCupResults();
    } catch (_) { /* fall back to stored results */ }
    const wcSnapshot = readWorldCupResults();
    return sendJson(res, 200, {
      groups: internationalGroupTables(),
      source: readFixtureData().source || null,
      apiSync: {
        source: wcSnapshot?.source || "ESPN World Cup scoreboard",
        updatedAt: wcSnapshot?.updatedAt || "",
        completedMatches: wcSnapshot?.completedCount || 0,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/international/training-accuracy") {
    const { readAccuracyHistory, liveWorldCupAccuracy, TARGET_ACCURACY } = require("./autoTune");
    const store = readAccuracyHistory();
    return sendJson(res, 200, {
      target: TARGET_ACCURACY,
      live: liveWorldCupAccuracy(),
      latest: store.latest || null,
      history: (store.history || []).slice(-40),
      tuning: require("./modelTuning").getTuning(),
    });
  }

  if (req.method === "POST" && pathname === "/api/international/tune") {
    const snapshot = require("./autoTune").runAutoTune({ reason: "manual-trigger" });
    return sendJson(res, 200, snapshot);
  }

  if (req.method === "GET" && pathname === "/api/international/daily-slip") {
    const { readCapitalLedger, generateDailySlip, gradeDailySlips } = require("./dailyParlay");
    gradeDailySlips();
    const ledger = generateDailySlip();
    return sendJson(res, 200, {
      bankroll: ledger.bankroll,
      startingBankroll: ledger.startingBankroll,
      currency: ledger.currency,
      today: ledger.today || null,
      note: ledger.note || "",
      slips: (ledger.slips || []).slice(0, 30),
    });
  }

  if (req.method === "POST" && pathname === "/api/international/wc-sync") {
    const snapshot = await refreshWorldCupResults({ force: true });
    const playerStats = await syncWorldCupPlayerStats();
    return sendJson(res, 200, {
      updatedAt: snapshot.updatedAt,
      fetched: snapshot.fetched,
      completed: snapshot.completedCount,
      settled: snapshot.settled,
      settledPredictions: snapshot.settledPredictions,
      playerStatEvents: playerStats.newEvents || 0,
      error: snapshot.error || null,
    });
  }

  if (req.method === "POST" && pathname === "/api/international/refresh-friendlies") {
    const snapshot = await refreshInternationalFriendlyResults({ force: true });
    return sendJson(res, 200, {
      fetched: snapshot.fetched,
      updatedAt: snapshot.updatedAt,
      error: snapshot.error || null,
      sample: (snapshot.results || []).slice(0, 5),
    });
  }

  if (req.method === "GET" && pathname === "/api/international/friendly-results") {
    return sendJson(res, 200, readFriendlyResultsSnapshot() || { results: [], fetched: 0 });
  }

  if (req.method === "GET" && pathname === "/api/international/recent-champion") {
    const snapshot = readWorldCupResults() || {};
    const final = [...(snapshot.results || [])]
      .filter((match) => match.completed && Number.isFinite(Number(match.homeGoals)) && Number.isFinite(Number(match.awayGoals)))
      .sort((left, right) => String(right.date || "").localeCompare(String(left.date || "")))[0];
    if (!final || Number(final.homeGoals) === Number(final.awayGoals)) return sendJson(res, 200, { winner: null });
    const winner = Number(final.homeGoals) > Number(final.awayGoals) ? final.homeTeam : final.awayTeam;
    const year = String(final.date || "").slice(0, 4);
    return sendJson(res, 200, {
      winner,
      date: final.date,
      score: `${final.homeTeam} ${final.homeGoals}–${final.awayGoals} ${final.awayTeam}`,
      tournament: `${final.league || "International tournament"}${year ? ` ${year}` : ""}`,
      sourceName: final.sourceName || snapshot.source || "",
      sourceUrl: final.sourceUrl || snapshot.sourceUrl || "",
    });
  }

  if (req.method === "GET" && pathname === "/api/international/bracket") {
    // Try pre-built cache first (generated at build time for Vercel)
    const cachedPath = path.join(process.cwd(), "data", "cached", "brackets", "international.json");
    if (fs.existsSync(cachedPath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachedPath, "utf8"));
        return sendJson(res, 200, cached);
      } catch (_) { /* fall through to live computation */ }
    }
    try {
      const bracket = projectTournament();
      return sendJson(res, 200, bracket);
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  // ── Club competition knockout brackets ──────────────────────────────────
  // This shows the real, already-completed/in-progress season's bracket
  // (parsed from actual UEFA result files) — historical/current context,
  // not a coming-season prediction.
  const clubBracketMatch = pathname.match(/^\/api\/bracket\/(champions-league|europa-league|conference-league)$/);
  if (req.method === "GET" && clubBracketMatch) {
    const compId = clubBracketMatch[1];
    // Try pre-built cache first (generated at build time for Vercel)
    const cachedPath = path.join(process.cwd(), "data", "cached", "brackets", `${compId}.json`);
    if (fs.existsSync(cachedPath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachedPath, "utf8"));
        return sendJson(res, 200, cached);
      } catch (_) { /* fall through to live computation */ }
    }
    try {
      const bracket = projectClubBracket(compId);
      return sendJson(res, 200, bracket);
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  // ── Club competition FUTURES bracket ────────────────────────────────────
  // A genuine 2026-27 projection simulated from the current rating pool —
  // no draw or fixtures exist yet for next season, unlike /api/bracket above.
  const futuresBracketMatch = pathname.match(/^\/api\/futures-bracket\/(champions-league|europa-league|conference-league)$/);
  if (req.method === "GET" && futuresBracketMatch) {
    const compId = futuresBracketMatch[1];
    // Building this from scratch recomputes 2020-21..2025-26 trends for all
    // five leagues (including live second-tier ESPN lookups) — cache-first,
    // same pattern as /api/bracket and /api/cup-bracket, so it's instant.
    const cachedPath = path.join(process.cwd(), "data", "cached", "futures-bracket", `${compId}.json`);
    if (fs.existsSync(cachedPath)) {
      try {
        return sendJson(res, 200, JSON.parse(fs.readFileSync(cachedPath, "utf8")));
      } catch (_) { /* fall through to live computation */ }
    }
    const compLabel = { "champions-league": "Champions League", "europa-league": "Europa League", "conference-league": "Conference League" }[compId];
    try {
      return sendJson(res, 200, await futuresKnockoutBracket(compLabel));
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  const playerStatsMatch = pathname.match(/^\/api\/player-profiles\/([^/]+)\/stats$/);
  if (req.method === "POST" && playerStatsMatch) {
    const entry = addPlayerStatEntry(playerStatsMatch[1], await readBody(req));
    if (!entry) return sendJson(res, 404, { error: "Player profile not found" });
    resetPlayerStatsCache();
    scheduleRetrain("manual-player-profile-stats");
    await persistKnownStores(["playerProfiles"]);
    return sendJson(res, 200, { entry, profiles: listPlayerProfiles(), trainingStatus: readTrainingStatus() });
  }

  const playerStatsEditMatch = pathname.match(/^\/api\/player-profiles\/([^/]+)\/stats\/([^/]+)$/);
  if (req.method === "PUT" && playerStatsEditMatch) {
    const entry = updatePlayerStatEntry(playerStatsEditMatch[1], playerStatsEditMatch[2], await readBody(req));
    if (!entry) return sendJson(res, 404, { error: "Player stat entry not found" });
    resetPlayerStatsCache();
    scheduleRetrain("manual-player-profile-stats-edited");
    await persistKnownStores(["playerProfiles"]);
    return sendJson(res, 200, { entry, profiles: listPlayerProfiles(), trainingStatus: readTrainingStatus() });
  }

  const teamStatsMatch = pathname.match(/^\/api\/team-profiles\/([^/]+)\/stats$/);
  if (req.method === "POST" && teamStatsMatch) {
    const entry = addTeamStatEntry(teamStatsMatch[1], await readBody(req));
    if (!entry) return sendJson(res, 404, { error: "Team profile not found" });
    scheduleRetrain("manual-team-profile-stats");
    const tableData = entry.context === "international" ? null : await archivedLeagueTables(entry.season);
    await persistKnownStores(["teamProfiles"]);
    return sendJson(res, 200, { entry, profiles: listTeamProfiles(entry.season, tableData, entry.context || "club"), trainingStatus: readTrainingStatus() });
  }

  const teamStatsEditMatch = pathname.match(/^\/api\/team-profiles\/([^/]+)\/stats\/([^/]+)$/);
  if (req.method === "PUT" && teamStatsEditMatch) {
    const entry = updateTeamStatEntry(teamStatsEditMatch[1], teamStatsEditMatch[2], await readBody(req));
    if (!entry) return sendJson(res, 404, { error: "Team stat entry not found" });
    scheduleRetrain("manual-team-profile-stats-edited");
    const tableData = entry.context === "international" ? null : await archivedLeagueTables(entry.season);
    await persistKnownStores(["teamProfiles"]);
    return sendJson(res, 200, { entry, profiles: listTeamProfiles(entry.season, tableData, entry.context || "club"), trainingStatus: readTrainingStatus() });
  }

  if (req.method === "GET" && pathname === "/api/parlay") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const context = url.searchParams.get("context") === "international" ? "international" : "club";
    if (context !== "international") {
      await refreshTheOddsApi({ includeClub: true, includeInternational: false });
      await refreshMissingOdds();
      await refreshLiveLeagueContext();
    } else {
      await refreshTheOddsApi({ includeClub: false, includeInternational: true, daysForward: 420 });
    }
    return sendJson(res, 200, buildParlay({
      context,
      league: url.searchParams.get("league") || "All",
      legs: url.searchParams.get("legs") || 10,
      tickets: url.searchParams.get("tickets") || 3,
      type: url.searchParams.get("type") || "mixed",
      riskMode: url.searchParams.get("riskMode") || "safe",
      generationMode: url.searchParams.get("generationMode") || "multi",
      date: url.searchParams.get("date") || "",
      refreshSeed: url.searchParams.get("refreshSeed") || 0,
    }));
  }

  if (req.method === "GET" && pathname === "/api/parlay-backtests") {
    return sendJson(res, 200, { parlays: parlayBacktests.listParlays(), summary: parlayBacktests.summary() });
  }

  if (req.method === "POST" && pathname === "/api/parlay/backtest") {
    const body = await readBody(req);
    const saved = parlayBacktests.saveParlaysIfMissing(body.parlays || [], "multi-parlay-board");
    await persistKnownStores(["parlayBacktests"]);
    return sendJson(res, 200, { saved, summary: parlayBacktests.summary() });
  }

  if (req.method === "POST" && pathname === "/api/fixture-predictions/backtest") {
    const body = await readBody(req);
    const league = body.league || "All";
    const date = String(body.date || "").trim();
    const predictionSource = body.context === "international" ? internationalFixturePredictions() : remainingFixturePredictions();
    const predictions = predictionSource.filter((prediction) => {
      const leagueMatches = league === "All" || prediction.league === league;
      const dateMatches = !date || prediction.date === date;
      return leagueMatches && dateMatches;
    });
    const saved = addPredictionsIfMissing(predictions, body.context === "international" ? "international-fixture-board" : "fixture-board");
    await persistKnownStores(["backtests"]);
    return sendJson(res, 200, { saved, summary: summary() });
  }

  if (req.method === "POST" && pathname === "/api/fixtures/bulk") {
    const body = await readBody(req);
    const fixtures = parseFixtureCsv(body.csv);
    const saved = fixtures.map((fixture) => addPrediction(predictMatch(fixture), "fixture-import"));
    await persistKnownStores(["backtests"]);
    return sendJson(res, 200, { saved, summary: summary() });
  }

  const resultMatch = pathname.match(/^\/api\/backtests\/([^/]+)\/result$/);
  if (req.method === "PATCH" && resultMatch) {
    const updated = updateResult(resultMatch[1], await readBody(req));
    if (!updated) return sendJson(res, 404, { error: "Prediction not found" });
    await refreshLiveLeagueContext();
    scheduleRetrain("match-backtest-result");
    await persistKnownStores(["backtests", "liveLeagueContext"]);
    return sendJson(res, 200, { updated, summary: summary() });
  }

  const deleteMatch = pathname.match(/^\/api\/backtests\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const deleted = deletePrediction(deleteMatch[1]);
    await persistKnownStores(["backtests"]);
    return sendJson(res, 200, { deleted, summary: summary() });
  }

  const parlayLegMatch = pathname.match(/^\/api\/parlay-backtests\/([^/]+)\/legs\/([^/]+)$/);
  if (req.method === "PATCH" && parlayLegMatch) {
    const body = await readBody(req);
    const updated = parlayBacktests.updateLeg(parlayLegMatch[1], parlayLegMatch[2], body.status);
    if (!updated) return sendJson(res, 404, { error: "Parlay or leg not found" });
    if (["HIT", "MISS"].includes(String(body.status || "").toUpperCase())) {
      scheduleRetrain(updated.newlyMissedParlays > 0 ? "parlay-missed-feedback" : "parlay-leg-feedback");
    }
    await persistKnownStores(["parlayBacktests"]);
    return sendJson(res, 200, { updated, summary: parlayBacktests.summary() });
  }

  return sendJson(res, 404, { error: "API route not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);

    // Sportsbooks Analyst is the primary product interface. Football opens in
    // that workspace by default; the former dashboard remains a deliberate
    // Classic UI option, never the default route.
    let requested = url.pathname === "/" ? "v2/index.html" : url.pathname.slice(1);
    if (url.pathname === "/v2" || url.pathname === "/v2/") requested = "v2/index.html";
    if (url.pathname === "/football" || url.pathname === "/football/") requested = "v2/index.html";
    if (url.pathname === "/classic" || url.pathname === "/classic/") requested = "index.html";
    if (url.pathname === "/baseball" || url.pathname === "/baseball/") requested = "baseball/index.html";
    if (url.pathname === "/basketball" || url.pathname === "/basketball/") requested = "basketball/index.html";
    if (url.pathname === "/american-football" || url.pathname === "/american-football/") requested = "american-football/index.html";
    const filePath = path.resolve(PUBLIC_DIR, requested);
    if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Prediction app running at http://localhost:${PORT}`);
});

// ── Continuous background sync ───────────────────────────────────────────
// Every 5 minutes (long-lived runtimes only — Vercel functions are
// request-scoped and use the on-request TTL triggers instead):
//   fixtures, results, odds, league context  → triggerLiveFixtureRefresh
//   World Cup results → auto-settled tracked predictions → retrain
//   live WC player stats and team training profiles
if (!process.env.VERCEL) {
  const SYNC_INTERVAL_MS = 5 * 60 * 1000;
  const backgroundSync = async () => {
    try {
      triggerLiveFixtureRefresh("background-interval");
      await refreshWorldCupResults();
      await syncWorldCupPlayerStats();
      try { await syncClubPlayerStats(); } catch (e) { console.warn("Club player stats sync error:", e.message); }
      // Bridge: catches newly-published fixtures (especially WC knockout round
      // match-ups) the moment ESPN publishes them.
      try { await runFixtureBridge(); } catch (e) { console.warn("Fixture bridge error:", e.message); }
      // 24/7 training: re-tune toward the 75% target, refresh the daily slip.
      try {
        require("./autoTune").runAutoTune({ reason: "background-interval" });
      } catch (error) {
        console.warn("Auto-tune error:", error.message);
      }
      try {
        const { gradeDailySlips, generateDailySlip } = require("./dailyParlay");
        gradeDailySlips();
        generateDailySlip();
      } catch (error) {
        console.warn("Daily slip error:", error.message);
      }
    } catch (error) {
      console.warn("Background sync error:", error.message);
    }
  };
  setTimeout(backgroundSync, 10_000).unref?.();
  const timer = setInterval(backgroundSync, SYNC_INTERVAL_MS);
  timer.unref?.();
  console.log("Continuous auto-sync + auto-tune enabled: ESPN fixture bridge (WC knockout + club near-term), results, WC settlement, WC + club player stats, model tuning, daily parlay slip (every 5 min).");
}
