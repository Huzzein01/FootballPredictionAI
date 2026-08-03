"use strict";

const SPORT = document.body.dataset.sport;
const FEATURES = ["Teams Profile", "Futures", "Player Profiles", "Tables", "Fixtures", "Model Training"];
const CONTENT = {
  baseball: { name: "Baseball", league: "MLB", icon: "⚾", season: "2026", historicalSeason: "2025", description: "Pitcher-aware baseball analysis, organized separately from football and basketball." },
  basketball: { name: "Basketball", league: "NBA", icon: "🏀", season: "2026", historicalSeason: "2025", description: "Availability, rest, pace, and matchup analysis organized for NBA fixtures." },
};
const data = CONTENT[SPORT];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const state = { feature: "Teams Profile", current: null, historical: null, monitoring: null };

document.title = `Sportsbooks Analyst — ${data.name}`;
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
function scheduleRows(dataset) {
  const games = (dataset?.games || []).slice().sort((a, b) => `${a.date}${a.kickoffUtc}`.localeCompare(`${b.date}${b.kickoffUtc}`));
  if (!games.length) return message("Schedule not published yet", `${data.league} has not returned fixtures for this season. We will retain the last completed season for training until the calendar becomes available.`);
  return `<article class="card wide"><h2>${data.league} fixtures · ${escapeHtml(dataset.season)}</h2><p class="source">${escapeHtml(dataset.source?.name || "Public schedule source")} · updated ${new Date(dataset.fetchedAt).toLocaleDateString()}</p><div class="fixture-list">${games.slice(0, 32).map((game) => `<div><span>${escapeHtml(game.date)}</span><b>${escapeHtml(game.awayTeam)} @ ${escapeHtml(game.homeTeam)}</b><em>${game.completed ? `${game.awayScore}–${game.homeScore}` : escapeHtml(game.status)}</em></div>`).join("")}</div></article>`;
}
function renderFeature() {
  const host = document.querySelector("#cards");
  const current = state.current;
  const history = state.historical;
  const summary = current?.summary || {};
  const historicalSummary = history?.summary || {};
  if (state.feature === "Fixtures") {
    host.innerHTML = scheduleRows(current);
  } else if (state.feature === "Model Training") {
    if (SPORT === "baseball") { const monitor = state.monitoring || {}; host.innerHTML = `<article class="card wide"><span class="tag">Pregame safeguards active</span><h2>MLB model readiness</h2><div class="stats">${stat("Recorded predictions", monitor.recordedPredictions ?? "—")}${stat("Settled predictions", monitor.settledPredictions ?? "—")}${stat("Latest snapshot", monitor.latestSnapshotAt ? new Date(monitor.latestSnapshotAt).toLocaleString() : "Unavailable")}</div><p>Predictions are unavailable until every timestamped pregame feature is known. Outputs are model projections, not guaranteed bets or financial advice.</p></article>`; return; }
    host.innerHTML = `<article class="card wide"><span class="tag">Historical baseline ready</span><h2>Chronological training intake</h2><div class="stats">${stat("Completed historical games", historicalSummary.completedGames ?? "—")}${stat("Teams represented", historicalSummary.teams ?? "—")}${stat("Current schedule games", summary.games ?? "—")}</div><p>Only completed games from ${data.historicalSeason} are eligible for initial training. Future fixtures remain prediction targets, never training labels.</p></article>${message("Next feature set", SPORT === "baseball" ? "Add probable starters, bullpen usage, park factors, lineups, and pre-game odds before training a baseball model." : "Add injuries, starters, rest days, pace, efficiency ratings, and pre-game odds before training a basketball model.")}`;
  } else if (state.feature === "Teams Profile") {
    host.innerHTML = `<article class="card wide"><h2>${data.league} team workspace</h2><div class="stats">${stat("Teams found", summary.teams ?? "—")}${stat("Scheduled games", summary.scheduledGames ?? "—")}${stat("Completed games", historicalSummary.completedGames ?? "—")}</div><p>Team profiles will use the imported schedule and prior-season results as their baseline. Each sport remains isolated to prevent cross-sport model leakage.</p></article>`;
  } else if (state.feature === "Tables") {
    host.innerHTML = message(`${data.league} tables`, `${summary.teams ?? "No"} teams and ${summary.games ?? "no"} games are available from the current schedule feed. Standings calculations will activate when a season has completed results.`);
  } else if (state.feature === "Player Profiles") {
    host.innerHTML = message("Player profiles", SPORT === "baseball" ? "Pitcher, batter, bullpen, and lineup profiles will be linked after the schedule baseline has been validated." : "Starter availability, minutes, lineup, and injury profiles will be linked after the schedule baseline has been validated.");
  } else {
    host.innerHTML = message("Futures", `Futures will combine ${data.league} season outlooks, schedule strength, team profiles, and market context once the sport-specific model has been trained.`);
  }
}
async function loadData() {
  const status = document.querySelector("#dataStatus");
  status.textContent = "Importing public schedules and completed historical results…";
  try {
    const [current, historical, monitoring] = await Promise.all([
      api(`/api/sports/${SPORT}/season?season=${encodeURIComponent(data.season)}&refresh=1`),
      api(`/api/sports/${SPORT}/season?season=${encodeURIComponent(data.historicalSeason)}&refresh=1`),
      SPORT === "baseball" ? api("/api/baseball/monitoring") : Promise.resolve(null),
    ]);
    state.current = current;
    state.historical = historical;
    state.monitoring = monitoring;
    status.textContent = `${data.league}: ${current.summary.games} current-season games · ${historical.summary.completedGames} completed historical games imported`;
  } catch (error) {
    status.textContent = `Schedule import is unavailable right now: ${error.message}`;
  }
  renderFeature();
}

featureNav();
renderFeature();
loadData();
