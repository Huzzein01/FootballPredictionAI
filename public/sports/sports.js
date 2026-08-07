"use strict";

const SPORT = document.body.dataset.sport;
const FEATURES = ["Predictions", "Teams Profile", "Futures", "Player Profiles", "Tables", "Fixtures", "Model Training"];
const CONTENT = {
  baseball: { name: "Baseball", league: "MLB", icon: "MLB", season: "2026", historicalSeason: "2025", description: "Pitcher-aware baseball analysis, organized separately from football and basketball." },
  basketball: { name: "Basketball", league: "NBA", icon: "NBA", season: "2026", historicalSeason: "2025", description: "Availability, rest, pace, and matchup analysis organized for NBA fixtures." },
  "american-football": { name: "American Football", league: "NFL", icon: "NFL", season: "2025", historicalSeason: "2024", description: "Skeletal structure for a future NFL model — schedule import is live; features and training are not built yet." },
};
const data = CONTENT[SPORT];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const state = { feature: SPORT === "baseball" ? "Predictions" : "Teams Profile", current: null, historical: null, monitoring: null, baseballPredictions: null };

document.title = `Sportsbooks Analyst - ${data.name}`;
const sharedMark = "/brand/prediction-weave.svg";
const favicon = document.querySelector('link[rel~="icon"]') || document.head.appendChild(document.createElement("link"));
favicon.rel = "icon"; favicon.type = "image/svg+xml"; favicon.href = sharedMark;
const brand = document.querySelector(".product-bar .brand");
if (brand) {
  brand.innerHTML = `<img src="${sharedMark}" alt="" style="width:30px;height:34px;object-fit:contain;flex:0 0 auto">Sportsbooks Analyst`;
  brand.setAttribute("role", "link"); brand.tabIndex = 0; brand.style.cursor = "pointer";
  const openSportHome = () => { window.location.href = "/home/"; };
  brand.addEventListener("click", openSportHome);
  brand.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openSportHome(); } });
}
document.querySelector("#sportTitle").textContent = `${data.icon} ${data.name}`;
document.querySelector("#sportSubtitle").textContent = data.description;
document.querySelector("#leagueLabel").textContent = `${data.league} data workspace`;

function api(path) { return fetch(path).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`); return body; }); }
function featureNav() {
  const nav = document.querySelector("#featureNav");
  nav.innerHTML = FEATURES.map((feature) => `<button class="feature-tab${feature === state.feature ? " active" : ""}" data-feature="${feature}">${feature}</button>`).join("");
  nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.feature = button.dataset.feature; featureNav(); renderFeature(); }));
}
function stat(label, value) { return `<div class="stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`; }
function message(title, text) { return `<article class="card wide"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></article>`; }
function runs(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed.toFixed(2) : "-"; }
function compactPct(value) { const parsed = Number(value); return Number.isFinite(parsed) ? `${Math.round(parsed * 1000) / 10}%` : "-"; }
function teamNameForPick(game) { return game.pick?.side === "away" ? game.awayTeam : game.homeTeam; }
function forecastConfidence(probability) {
  const parsed = Number(probability);
  if (!Number.isFinite(parsed)) return "model watch";
  const edge = Math.abs(parsed - 0.5);
  if (edge >= 0.12) return "strong lean";
  if (edge >= 0.07) return "lean";
  return "close game";
}
function leaderRows(items, label) {
  if (!items?.length) return "";
  return items.slice(0, 5).map((item) => {
    if (item.team) return `<div><span>${escapeHtml(item.team)}</span><b>${runs(item.projectedRunsForPerGame)}</b><em>${escapeHtml(label)}</em></div>`;
    return `<div><span>${escapeHtml(item.awayTeam)} @ ${escapeHtml(item.homeTeam)}</span><b>${runs(item.prediction?.expectedRuns?.total)}</b><em>${escapeHtml(item.date || "")}</em></div>`;
  }).join("");
}
function scheduleRows(dataset) {
  const games = (dataset?.games || []).slice().sort((a, b) => `${a.date}${a.kickoffUtc}`.localeCompare(`${b.date}${b.kickoffUtc}`));
  if (!games.length) return message("Schedule not published yet", `${data.league} has not returned fixtures for this season. We will retain the last completed season for training until the calendar becomes available.`);
  return `<article class="card wide"><h2>${data.league} fixtures - ${escapeHtml(dataset.season)}</h2><p class="source">${escapeHtml(dataset.source?.name || "Public schedule source")} - updated ${new Date(dataset.fetchedAt).toLocaleDateString()}</p><div class="fixture-list">${games.slice(0, 32).map((game) => `<div><span>${escapeHtml(game.date)}</span><b>${escapeHtml(game.awayTeam)} @ ${escapeHtml(game.homeTeam)}</b><em>${game.completed ? `${game.awayScore}-${game.homeScore}` : escapeHtml(game.status)}</em></div>`).join("")}</div></article>`;
}
function renderBaseballPredictions() {
  const board = state.baseballPredictions;
  if (!board?.predictions?.length) return message("Prediction unavailable", "The trained baseball model is present, but the public schedule did not return upcoming MLB fixtures yet.");
  const summary = board.summary || {};
  const leaders = board.leaders || {};
  const games = board.predictions || [];
  const displayCount = `${games.length}${summary.totalPredictions && summary.totalPredictions !== games.length ? ` of ${summary.totalPredictions}` : ""}`;
  const oddsText = `${summary.gamesWithOdds ?? 0} games with odds | ${escapeHtml(board.odds?.provider || "No odds provider")} | market blend ${compactPct(summary.marketWeight)}`;
  const summaryCard = `<article class="card wide"><span class="tag">${escapeHtml(board.model?.selectedVariant || "trained model")}</span><h2>Upcoming MLB forecasts</h2><div class="stats">${stat("Displayed forecasts", displayCount)}${stat("Odds matched", summary.gamesWithOdds ?? 0)}${stat("Avg total", runs(summary.averageProjectedTotalRuns))}${stat("Final home avg", compactPct(summary.averageHomeWinProbability))}</div><p>The model projects runs and win probability from trained baseball history. When bookmaker odds are available, the final pick blends 80% model probability with 20% market probability. ${oddsText}.</p></article>`;
  const forecastCards = games.map((game) => {
    const market = game.prediction.probabilities.marketHomeWin == null ? "market n/a" : `market ${compactPct(game.prediction.probabilities.marketHomeWin)} home`;
    const odds = game.prediction.odds ? ` | odds H ${game.prediction.odds.homeOdds} / A ${game.prediction.odds.awayOdds}` : "";
    return `<article class="forecast-card"><span class="tag">${escapeHtml(game.date)} | ${game.oddsAvailable ? "odds live" : "model only"}</span><h2>${escapeHtml(game.awayTeam)} @ ${escapeHtml(game.homeTeam)}</h2><div class="forecast-score"><b>${runs(game.prediction.expectedRuns.away)}</b><span>-</span><b>${runs(game.prediction.expectedRuns.home)}</b></div><div class="stats">${stat("Pick", teamNameForPick(game))}${stat("Final win", compactPct(game.pick?.probability))}${stat("Read", forecastConfidence(game.pick?.probability))}</div><p>Model: ${compactPct(game.prediction.probabilities.modelHomeWin)} home | ${market} | final ${compactPct(game.prediction.probabilities.homeWin)} home${odds}.</p></article>`;
  }).join("");
  const leaderContent = `${leaderRows(leaders.highestTotals, "projected total")}${leaderRows(leaders.projectedOffenses, "runs per game")}`;
  const leadersCard = `<article class="card wide"><span class="tag">Supporting context</span><h2>Run environment and leaders</h2><div class="fixture-list">${leaderContent || "<div><span>Pending</span><b>-</b><em>leaders</em></div>"}</div><p>League run environment: ${runs(summary.leagueRunsPerTeamGame)} runs per team game from completed historical and current-season results.</p></article>`;
  return `${summaryCard}<section class="forecast-grid">${forecastCards}</section>${leadersCard}`;
}
function renderFeature() {
  const host = document.querySelector("#cards");
  const current = state.current;
  const history = state.historical;
  const summary = current?.summary || {};
  const historicalSummary = history?.summary || {};
  if (state.feature === "Predictions") {
    host.innerHTML = SPORT === "baseball" ? renderBaseballPredictions() : message("Predictions", "Basketball predictions will activate after the sport-specific model is trained.");
  } else if (state.feature === "Fixtures") {
    host.innerHTML = scheduleRows(current);
  } else if (state.feature === "Model Training") {
    if (SPORT === "baseball") {
      const monitor = state.monitoring || {};
      host.innerHTML = `<article class="card wide"><span class="tag">Pregame safeguards active</span><h2>MLB model readiness</h2><div class="stats">${stat("Recorded predictions", monitor.recordedPredictions ?? "-")}${stat("Settled predictions", monitor.settledPredictions ?? "-")}${stat("Latest snapshot", monitor.latestSnapshotAt ? new Date(monitor.latestSnapshotAt).toLocaleString() : "Unavailable")}</div><p>Predictions require timestamped pregame inputs. The public forecast board uses only schedule and pre-first-pitch context; outputs are model projections, not guaranteed bets or financial advice.</p></article>`;
      return;
    }
    host.innerHTML = `<article class="card wide"><span class="tag">Historical baseline ready</span><h2>Chronological training intake</h2><div class="stats">${stat("Completed historical games", historicalSummary.completedGames ?? "-")}${stat("Teams represented", historicalSummary.teams ?? "-")}${stat("Current schedule games", summary.games ?? "-")}</div><p>Only completed games from ${data.historicalSeason} are eligible for initial training. Future fixtures remain prediction targets, never training labels.</p></article>${message("Next feature set", "Add injuries, starters, rest days, pace, efficiency ratings, and pre-game odds before training a basketball model.")}`;
  } else if (state.feature === "Teams Profile") {
    host.innerHTML = `<article class="card wide"><h2>${data.league} team workspace</h2><div class="stats">${stat("Teams found", summary.teams ?? "-")}${stat("Scheduled games", summary.scheduledGames ?? "-")}${stat("Completed games", historicalSummary.completedGames ?? "-")}</div><p>Team profiles use the imported schedule and prior-season results as their baseline. Each sport remains isolated to prevent cross-sport model leakage.</p></article>`;
  } else if (state.feature === "Tables") {
    host.innerHTML = message(`${data.league} tables`, `${summary.teams ?? "No"} teams and ${summary.games ?? "no"} games are available from the current schedule feed. Standings calculations activate when a season has completed results.`);
  } else if (state.feature === "Player Profiles") {
    host.innerHTML = message("Player profiles", SPORT === "baseball" ? "Pitcher, batter, bullpen, and lineup profiles will be linked after the schedule baseline has been validated." : "Starter availability, minutes, lineup, and injury profiles will be linked after the schedule baseline has been validated.");
  } else {
    host.innerHTML = message("Futures", `Futures will combine ${data.league} season outlooks, schedule strength, team profiles, and market context once the sport-specific model has been trained.`);
  }
}
async function loadData() {
  const status = document.querySelector("#dataStatus");
  status.textContent = "Importing public schedules and completed historical results...";
  try {
    const requests = [
      api(`/api/sports/${SPORT}/season?season=${encodeURIComponent(data.season)}&refresh=1`),
      api(`/api/sports/${SPORT}/season?season=${encodeURIComponent(data.historicalSeason)}&refresh=1`),
      SPORT === "baseball" ? api("/api/baseball/monitoring") : Promise.resolve(null),
    ];
    if (SPORT === "baseball") requests.push(api(`/api/sports/baseball/predictions?season=${encodeURIComponent(data.season)}&refresh=1&limit=30&refreshOdds=1&oddsDays=14`));
    const [current, historical, monitoring, baseballPredictions] = await Promise.all(requests);
    state.current = current;
    state.historical = historical;
    state.monitoring = monitoring;
    state.baseballPredictions = baseballPredictions || null;
    status.textContent = SPORT === "baseball" && baseballPredictions
      ? `${data.league}: trained forecast model active - ${baseballPredictions.summary?.totalPredictions ?? baseballPredictions.summary?.predictions ?? 0} upcoming forecasts`
      : `${data.league}: ${current.summary.games} current-season games | ${historical.summary.completedGames} completed historical games imported`;
  } catch (error) {
    status.textContent = `Schedule import is unavailable right now: ${error.message}`;
  }
  renderFeature();
}

featureNav();
renderFeature();
loadData();
