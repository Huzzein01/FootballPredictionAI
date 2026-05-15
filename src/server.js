const fs = require("fs");
const http = require("http");
const path = require("path");
const { buildParlay, fbrefStatus } = require("./parlayService");
const { fixturePredictionBoard, predictMatch, teamsByLeague } = require("./predictionService");
const { addPrediction, addPredictionsIfMissing, deletePrediction, listPredictions, summary, updateResult } = require("./backtestStore");
const { readTrainingStatus, scheduleRetrain } = require("./continuousTraining");
const parlayBacktests = require("./parlayBacktestStore");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(process.cwd(), "public");
const PLAYED_RESULTS_PATH = path.join(process.cwd(), "data", "played_results.json");

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
  return "application/octet-stream";
}

function actualResultCode(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return "H";
  if (awayGoals > homeGoals) return "A";
  return "D";
}

function loadVerifiedPlayedResults() {
  if (!fs.existsSync(PLAYED_RESULTS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(PLAYED_RESULTS_PATH, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(data.results) ? data.results : [];
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

function remainingFixturePredictions() {
  const playedKeys = parlayBacktests.playedFixtureKeys();
  const verifiedResults = verifiedPlayedResultMap();
  return fixturePredictionBoard().filter((prediction) => {
    const key = parlayBacktests.fixtureSignatureFromFixture(prediction);
    return !playedKeys.has(key) && !verifiedResults.has(key);
  });
}

function playedFixturePredictions() {
  const summaries = new Map(parlayBacktests.playedFixtureSummaries().map((summaryItem) => [summaryItem.key, summaryItem]));
  const verifiedResults = verifiedPlayedResultMap();
  const storedPredictions = storedPredictionMap();
  return fixturePredictionBoard()
    .map((prediction) => {
      const key = parlayBacktests.fixtureSignatureFromFixture(prediction);
      const originalPrediction = storedPredictions.get(key) || prediction;
      const parlaySummary = summaries.get(key) || null;
      const verified = verifiedResults.get(key) || null;
      if (!parlaySummary && !verified) return { prediction, played: null };
      const homeGoals = verified ? Number(verified.homeGoals) : null;
      const awayGoals = verified ? Number(verified.awayGoals) : null;
      const actualResult = verified ? actualResultCode(homeGoals, awayGoals) : null;
      const modelCorrect = verified ? originalPrediction.prediction === actualResult : parlaySummary.modelCorrect;
      const exactScoreCorrect = verified ? String(originalPrediction.projectedScore || "").trim() === `${homeGoals}-${awayGoals}` : null;
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
          sourceName: verified?.sourceName || "",
          sourceUrl: verified?.sourceUrl || "",
          statusLabel: verified
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

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/meta") {
    const model = JSON.parse(fs.readFileSync(path.join(process.cwd(), "model", "football_match_model.json"), "utf8"));
    return sendJson(res, 200, { teamsByLeague: teamsByLeague(), metrics: model.metrics, hyperparameters: model.hyperparameters, trainedAt: model.trainedAt, feedbackRows: model.feedbackRows || 0, trainingStatus: readTrainingStatus() });
  }

  if (req.method === "GET" && pathname === "/api/training-status") {
    return sendJson(res, 200, readTrainingStatus());
  }

  if (req.method === "POST" && pathname === "/api/predict") {
    const body = await readBody(req);
    const prediction = predictMatch(body);
    const saved = body.save ? addPrediction(prediction, "manual") : null;
    return sendJson(res, 200, { prediction, saved, summary: summary() });
  }

  if (req.method === "GET" && pathname === "/api/backtests") {
    return sendJson(res, 200, { predictions: listPredictions(), summary: summary() });
  }

  if (req.method === "GET" && pathname === "/api/fixture-predictions") {
    const predictions = remainingFixturePredictions();
    const playedCount = playedFixturePredictions().length;
    return sendJson(res, 200, {
      predictions,
      summary: {
        total: predictions.length,
        played: playedCount,
        withOdds: predictions.filter((prediction) => prediction.hasOdds).length,
        modelOnly: predictions.filter((prediction) => !prediction.hasOdds).length,
      },
    });
  }

  if (req.method === "GET" && pathname === "/api/played-fixtures") {
    const predictions = playedFixturePredictions();
    const correct = predictions.filter((prediction) => prediction.played?.modelCorrect === true).length;
    const wrong = predictions.filter((prediction) => prediction.played?.modelCorrect === false).length;
    const voided = predictions.filter((prediction) => prediction.played?.modelCorrect === null).length;
    const exactScores = predictions.filter((prediction) => prediction.played?.exactScoreCorrect === true).length;
    return sendJson(res, 200, {
      predictions,
      summary: { total: predictions.length, correct, wrong, voided, exactScores },
    });
  }

  if (req.method === "GET" && pathname === "/api/fbref/status") {
    return sendJson(res, 200, fbrefStatus());
  }

  if (req.method === "GET" && pathname === "/api/parlay") {
    const url = new URL(req.url, `http://${req.headers.host}`);
    return sendJson(res, 200, buildParlay({
      league: url.searchParams.get("league") || "All",
      legs: url.searchParams.get("legs") || 10,
      tickets: url.searchParams.get("tickets") || 3,
      type: url.searchParams.get("type") || "mixed",
      refreshSeed: url.searchParams.get("refreshSeed") || 0,
    }));
  }

  if (req.method === "GET" && pathname === "/api/parlay-backtests") {
    return sendJson(res, 200, { parlays: parlayBacktests.listParlays(), summary: parlayBacktests.summary() });
  }

  if (req.method === "POST" && pathname === "/api/parlay/backtest") {
    const body = await readBody(req);
    const saved = parlayBacktests.saveParlaysIfMissing(body.parlays || [], "multi-parlay-board");
    return sendJson(res, 200, { saved, summary: parlayBacktests.summary() });
  }

  if (req.method === "POST" && pathname === "/api/fixture-predictions/backtest") {
    const saved = addPredictionsIfMissing(remainingFixturePredictions(), "fixture-board");
    return sendJson(res, 200, { saved, summary: summary() });
  }

  if (req.method === "POST" && pathname === "/api/fixtures/bulk") {
    const body = await readBody(req);
    const fixtures = parseFixtureCsv(body.csv);
    const saved = fixtures.map((fixture) => addPrediction(predictMatch(fixture), "fixture-import"));
    return sendJson(res, 200, { saved, summary: summary() });
  }

  const resultMatch = pathname.match(/^\/api\/backtests\/([^/]+)\/result$/);
  if (req.method === "PATCH" && resultMatch) {
    const updated = updateResult(resultMatch[1], await readBody(req));
    if (!updated) return sendJson(res, 404, { error: "Prediction not found" });
    scheduleRetrain("match-backtest-result");
    return sendJson(res, 200, { updated, summary: summary() });
  }

  const deleteMatch = pathname.match(/^\/api\/backtests\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    return sendJson(res, 200, { deleted: deletePrediction(deleteMatch[1]), summary: summary() });
  }

  const parlayLegMatch = pathname.match(/^\/api\/parlay-backtests\/([^/]+)\/legs\/([^/]+)$/);
  if (req.method === "PATCH" && parlayLegMatch) {
    const body = await readBody(req);
    const updated = parlayBacktests.updateLeg(parlayLegMatch[1], parlayLegMatch[2], body.status);
    if (!updated) return sendJson(res, 404, { error: "Parlay or leg not found" });
    if (updated.newlyMissedParlays > 0) {
      scheduleRetrain("parlay-missed-feedback");
    }
    return sendJson(res, 200, { updated, summary: parlayBacktests.summary() });
  }

  return sendJson(res, 404, { error: "API route not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url.pathname);

    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
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
