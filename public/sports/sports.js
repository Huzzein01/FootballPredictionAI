"use strict";

const SPORT = document.body.dataset.sport;
const FEATURES = ["Predictions", "Parlays", "Parlay Ledger", "Teams Profile", "Futures", "Player Profiles", "Tables", "Fixtures", "Model Training"];
const CONTENT = {
  baseball: { name: "Baseball", league: "MLB", icon: "MLB", season: "2026", historicalSeason: "2025", description: "Pitcher-aware baseball analysis, organized separately from football and basketball.", scoreLabel: "runs", scoreKey: "expectedRuns" },
  basketball: { name: "Basketball", league: "NBA", icon: "NBA", season: "2026", historicalSeason: "2025", description: "Availability, rest, pace, and matchup analysis organized for NBA fixtures.", scoreLabel: "points", scoreKey: "expectedPoints" },
  "american-football": { name: "American Football", league: "NFL", icon: "NFL", season: "2026", historicalSeason: "2025", description: "Results-only ratings model for NFL matchups — trained on completed games, live schedule, and market odds where available.", scoreLabel: "points", scoreKey: "expectedPoints" },
};
const data = CONTENT[SPORT];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const state = { feature: "Predictions", current: null, historical: null, monitoring: null, predictions: null, allPredictions: null, standingsSource: null, playerLeaders: null, riskMode: "balanced", builtParlays: [], parlayLedger: null, trackStatus: "" };
const RISK_MODES = {
  safe: { legsPerParlay: 2, minProbability: 0.6, label: "Safe · 2-leg" },
  balanced: { legsPerParlay: 3, minProbability: 0.55, label: "Balanced · 3-leg" },
  value: { legsPerParlay: 4, minProbability: 0.52, label: "Value · 4-leg" },
};

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
async function trackParlay(index) {
  const parlay = state.builtParlays[index];
  if (!parlay) return;
  state.trackStatus = "Tracking parlay...";
  renderFeature();
  try {
    const body = {
      parlays: [{
        riskMode: state.riskMode,
        combinedOdds: parlay.combinedOdds,
        combinedProbability: parlay.combinedProbability,
        legs: parlay.legs.map((leg) => ({ date: leg.date, matchup: leg.matchup, pick: leg.pick, probability: leg.probability, decimalOdds: leg.decimalOdds, oddsSource: leg.oddsSource })),
      }],
    };
    const response = await fetch(`/api/sports/${SPORT}/parlay/track`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    state.trackStatus = result.saved > 0 ? "Parlay tracked — see the Parlay Ledger tab." : "This parlay is already tracked.";
    state.parlayLedger = await api(`/api/sports/${SPORT}/parlay-ledger`).catch(() => state.parlayLedger);
  } catch (error) {
    state.trackStatus = `Could not track parlay: ${error.message}`;
  }
  renderFeature();
}
document.querySelector("#cards").addEventListener("click", (event) => {
  const trackButton = event.target.closest("[data-track-parlay]");
  if (trackButton) { trackParlay(Number(trackButton.dataset.trackParlay)); return; }
  const button = event.target.closest("[data-risk-mode]");
  if (!button) return;
  state.riskMode = button.dataset.riskMode;
  renderFeature();
});
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
function leaderRows(items, label, scoreKey) {
  if (!items?.length) return "";
  return items.slice(0, 5).map((item) => {
    if (item.team) return `<div><span>${escapeHtml(item.team)}</span><b>${runs(item.projectedRunsForPerGame ?? item.projectedPointsForPerGame)}</b><em>${escapeHtml(label)}</em></div>`;
    return `<div><span>${escapeHtml(item.awayTeam)} @ ${escapeHtml(item.homeTeam)}</span><b>${runs(item.prediction?.[scoreKey || "expectedRuns"]?.total)}</b><em>${escapeHtml(item.date || "")}</em></div>`;
  }).join("");
}
function scheduleRows(dataset) {
  const games = (dataset?.games || []).slice().sort((a, b) => `${a.date}${a.kickoffUtc}`.localeCompare(`${b.date}${b.kickoffUtc}`));
  if (!games.length) return message("Schedule not published yet", `${data.league} has not returned fixtures for this season. We will retain the last completed season for training until the calendar becomes available.`);
  return `<article class="card wide"><h2>${data.league} fixtures - ${escapeHtml(dataset.season)}</h2><p class="source">${escapeHtml(dataset.source?.name || "Public schedule source")} - updated ${new Date(dataset.fetchedAt).toLocaleDateString()}</p><div class="fixture-list">${games.slice(0, 32).map((game) => `<div><span>${escapeHtml(game.date)}</span><b>${escapeHtml(game.awayTeam)} @ ${escapeHtml(game.homeTeam)}</b><em>${game.completed ? `${game.awayScore}-${game.homeScore}` : escapeHtml(game.status)}</em></div>`).join("")}</div></article>`;
}
function renderScoreboardPredictions() {
  const board = state.predictions;
  if (!board?.predictions?.length) return message("Prediction unavailable", `The trained ${data.league} model is present, but the public schedule did not return upcoming fixtures yet.`);
  const summary = board.summary || {};
  const leaders = board.leaders || {};
  const games = board.predictions || [];
  const scoreKey = data.scoreKey;
  const perGameLabel = SPORT === "baseball" ? "runs per game" : "points per game";
  const envLabel = SPORT === "baseball" ? "runs per team game" : "points per team game";
  const envValue = SPORT === "baseball" ? summary.leagueRunsPerTeamGame : summary.leaguePointsPerTeamGame;
  const avgTotal = SPORT === "baseball" ? summary.averageProjectedTotalRuns : summary.averageProjectedTotalPoints;
  const displayCount = `${games.length}${summary.totalPredictions && summary.totalPredictions !== games.length ? ` of ${summary.totalPredictions}` : ""}`;
  const oddsText = `${summary.gamesWithOdds ?? 0} games with odds | ${escapeHtml(board.odds?.provider || "ESPN public odds")} | market blend ${compactPct(summary.marketWeight)}`;
  const summaryCard = `<article class="card wide"><span class="tag">${escapeHtml(board.model?.selectedVariant || "trained model")}</span><h2>Upcoming ${data.league} forecasts</h2><div class="stats">${stat("Displayed forecasts", displayCount)}${stat("Odds matched", summary.gamesWithOdds ?? 0)}${stat("Avg total", runs(avgTotal))}${stat("Final home avg", compactPct(summary.averageHomeWinProbability))}</div><p>The model projects ${data.scoreLabel} and win probability from trained ${data.league} history. When bookmaker odds are available, the final pick blends 80% model probability with 20% market probability. ${oddsText}.</p></article>`;
  const forecastCards = games.map((game) => {
    const market = game.prediction.probabilities.marketHomeWin == null ? "market n/a" : `market ${compactPct(game.prediction.probabilities.marketHomeWin)} home`;
    const odds = game.prediction.odds ? ` | odds H ${game.prediction.odds.homeOdds} / A ${game.prediction.odds.awayOdds}` : "";
    const score = game.prediction[scoreKey];
    return `<article class="forecast-card"><span class="tag">${escapeHtml(game.date)} | ${game.oddsAvailable ? "odds live" : "model only"}</span><h2>${escapeHtml(game.awayTeam)} @ ${escapeHtml(game.homeTeam)}</h2><div class="forecast-score"><b>${runs(score.away)}</b><span>-</span><b>${runs(score.home)}</b></div><div class="stats">${stat("Pick", teamNameForPick(game))}${stat("Final win", compactPct(game.pick?.probability))}${stat("Read", forecastConfidence(game.pick?.probability))}</div><p>Model: ${compactPct(game.prediction.probabilities.modelHomeWin)} home | ${market} | final ${compactPct(game.prediction.probabilities.homeWin)} home${odds}.</p></article>`;
  }).join("");
  const leaderContent = `${leaderRows(leaders.highestTotals, "projected total", scoreKey)}${leaderRows(leaders.projectedOffenses, perGameLabel)}`;
  const leadersCard = `<article class="card wide"><span class="tag">Supporting context</span><h2>Scoring environment and leaders</h2><div class="fixture-list">${leaderContent || "<div><span>Pending</span><b>-</b><em>leaders</em></div>"}</div><p>League scoring environment: ${runs(envValue)} ${envLabel} from completed historical and current-season results.</p></article>`;
  return `${summaryCard}<section class="forecast-grid">${forecastCards}</section>${leadersCard}`;
}
function ratingBadge(rating) {
  const parsed = Number(rating);
  if (!Number.isFinite(parsed)) return "-";
  return parsed.toFixed(1);
}
function standingsTable(standings, { withRatings = false } = {}) {
  if (!standings?.length) return message("Standings unavailable", `Standings build from completed ${data.league} results once the current season schedule has settled games.`);
  const rows = standings.map((row, index) => {
    const forPerGame = row.pointsForPerGame ?? row.runsForPerGame;
    const againstPerGame = row.pointsAgainstPerGame ?? row.runsAgainstPerGame;
    const diffPerGame = row.pointDiffPerGame ?? row.runDiffPerGame;
    return `<tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.team)}</td>
      <td>${row.wins}-${row.losses}</td>
      <td>${compactPct(row.winPct)}</td>
      <td>${runs(forPerGame)}</td>
      <td>${runs(againstPerGame)}</td>
      <td>${diffPerGame > 0 ? "+" : ""}${runs(diffPerGame)}</td>
      ${withRatings ? `<td>${ratingBadge(row.offenseRating)}</td><td>${ratingBadge(row.defenseRating)}</td>` : ""}
      <td>${escapeHtml(row.lastFive || "-")}</td>
    </tr>`;
  }).join("");
  return `<article class="card wide"><h2>${data.league} standings</h2><p class="source">Built from completed current-season results; ${data.scoreLabel} shown per game.</p><div class="fixture-list" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.9em">
    <thead><tr>
      <th style="text-align:left">#</th><th style="text-align:left">Team</th><th>Record</th><th>Win%</th><th>${escapeHtml(data.scoreLabel)} For</th><th>${escapeHtml(data.scoreLabel)} Against</th><th>Diff</th>
      ${withRatings ? `<th>Off rtg</th><th>Def rtg</th>` : ""}
      <th>Last 5</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div></article>`;
}
function futuresProjection(projections) {
  if (!projections?.length) return message("Futures unavailable", `Season-end projections require both completed results and a remaining schedule for ${data.league}.`);
  const rows = projections.map((row, index) => `<tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.team)}</td>
      <td>${escapeHtml(row.currentRecord)}</td>
      <td>${row.gamesRemaining}</td>
      <td>${runs(row.projectedWins)}-${runs(row.projectedLosses)}</td>
      <td>${compactPct(row.projectedWinPct)}</td>
    </tr>`).join("");
  return `<article class="card wide"><span class="tag">Model projection</span><h2>${data.league} season-end outlook</h2><p>Projected final record sums each team's actual wins so far with the model's win probability in every remaining scheduled game (not just the games shown under Predictions). This is a model output, not a guaranteed outcome or betting advice.</p><div class="fixture-list" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.9em">
    <thead><tr><th style="text-align:left">#</th><th style="text-align:left">Team</th><th>Current</th><th>Games left</th><th>Projected record</th><th>Projected win%</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div></article>`;
}
function leaderboardCard(category) {
  if (!category?.leaders?.length) return "";
  const rows = category.leaders.map((entry) => `<div><span>${escapeHtml(entry.player)} <em style="opacity:0.7">${escapeHtml(entry.team)}</em></span><b>${escapeHtml(entry.value)}</b></div>`).join("");
  return `<article class="card"><span class="tag">${escapeHtml(category.label)}</span><div class="fixture-list">${rows}</div></article>`;
}
function renderPlayerProfiles() {
  const board = state.playerLeaders;
  const sourceName = SPORT === "baseball" ? "MLB Stats API" : "ESPN public leaders API";
  const disclaimer = SPORT === "baseball"
    ? "no pitch-by-pitch or box-score ingestion pipeline exists yet to build individual player projections."
    : "no play-by-play or box-score ingestion pipeline exists yet to build individual player projections.";
  if (SPORT === "baseball") {
    if (!board?.hitting?.length && !board?.pitching?.length) {
      return message("Player leaders unavailable", "MLB player leaderboards did not load. This pulls directly from the MLB Stats API's public leaders endpoint.");
    }
    const intro = `<article class="card wide"><span class="tag">${escapeHtml(sourceName)}</span><h2>${escapeHtml(board.season)} season leaders</h2><p class="source">${escapeHtml(board.source?.name || sourceName)} - updated ${board.fetchedAt ? new Date(board.fetchedAt).toLocaleString() : "recently"}. These are league leaderboards, not per-player model ratings — ${disclaimer}</p></article>`;
    const hitting = (board.hitting || []).map(leaderboardCard).join("");
    const pitching = (board.pitching || []).map(leaderboardCard).join("");
    return `${intro}<h3 style="margin:1.2em 0 0.4em">Hitting</h3><section class="forecast-grid">${hitting}</section><h3 style="margin:1.2em 0 0.4em">Pitching</h3><section class="forecast-grid">${pitching}</section>`;
  }
  if (!board?.categories?.length) {
    return message("Player leaders unavailable", `${data.league} player leaderboards did not load. This pulls directly from ESPN's public leaders API.`);
  }
  const intro = `<article class="card wide"><span class="tag">${escapeHtml(sourceName)}</span><h2>${escapeHtml(board.season || data.league)} season leaders</h2><p class="source">${escapeHtml(board.source?.name || sourceName)} - updated ${board.fetchedAt ? new Date(board.fetchedAt).toLocaleString() : "recently"}. These are league leaderboards, not per-player model ratings — ${disclaimer}</p></article>`;
  const cards = (board.categories || []).map(leaderboardCard).join("");
  return `${intro}<section class="forecast-grid">${cards}</section>`;
}
function legDecimalOdds(game) {
  const odds = game.prediction?.odds;
  const side = game.pick?.side;
  const marketDecimal = side === "home" ? Number(odds?.homeOdds) : Number(odds?.awayOdds);
  if (Number.isFinite(marketDecimal) && marketDecimal > 1) return { decimal: marketDecimal, source: "market" };
  const probability = Math.max(0.01, Math.min(0.99, Number(game.pick?.probability) || 0.5));
  return { decimal: 1 / probability, source: "model" };
}
// Builds simple straight parlays from the same predictions already shown
// under Predictions — no separate backend call. Legs are picked purely by
// win probability (highest first) and grouped into non-overlapping chunks
// of legsPerParlay games; combined price multiplies each leg's real market
// decimal odds where available, or the model's own fair (no-vig) odds
// otherwise, with each leg labeled which one it used.
function buildParlays(predictions, modeKey) {
  const mode = RISK_MODES[modeKey] || RISK_MODES.balanced;
  const candidates = (predictions || [])
    .filter((game) => Number(game.pick?.probability) >= mode.minProbability)
    .sort((a, b) => b.pick.probability - a.pick.probability);
  const parlays = [];
  for (let i = 0; i + mode.legsPerParlay <= candidates.length && parlays.length < 5; i += mode.legsPerParlay) {
    const legs = candidates.slice(i, i + mode.legsPerParlay);
    let combinedProbability = 1, combinedOdds = 1, anyMarket = false;
    const legDetails = legs.map((game) => {
      const { decimal, source } = legDecimalOdds(game);
      combinedProbability *= game.pick.probability;
      combinedOdds *= decimal;
      if (source === "market") anyMarket = true;
      return { matchup: `${game.awayTeam} @ ${game.homeTeam}`, date: game.date, pick: game.pick.team, probability: game.pick.probability, decimalOdds: decimal, oddsSource: source };
    });
    parlays.push({ legs: legDetails, combinedProbability, combinedOdds, anyMarketOdds: anyMarket });
  }
  return parlays;
}
function renderParlays() {
  const predictions = state.allPredictions?.predictions || state.predictions?.predictions || [];
  const modeKey = RISK_MODES[state.riskMode] ? state.riskMode : "balanced";
  const modeButtons = Object.entries(RISK_MODES).map(([key, mode]) => `<button data-risk-mode="${key}" class="feature-tab${key === modeKey ? " active" : ""}" style="margin:0.3em 0.4em 0 0">${escapeHtml(mode.label)}</button>`).join("");
  const intro = `<article class="card wide"><span class="tag">Model-generated combos</span><h2>${data.league} parlay builder</h2><p>Legs are chosen from the current ${data.league} predictions by win probability. Combined odds multiply each leg's decimal price — a real market line when one is posted, otherwise the model's own fair (no-vig) odds, always labeled per leg. This is a model output, not a guaranteed outcome or betting advice; variance compounds quickly with each added leg.</p><div>${modeButtons}</div></article>`;
  const parlays = buildParlays(predictions, modeKey);
  state.builtParlays = parlays;
  const trackStatus = state.trackStatus ? `<p class="source">${escapeHtml(state.trackStatus)}</p>` : "";
  if (!parlays.length) {
    return `${intro}${trackStatus}${message("No parlays available", `Not enough ${data.league} picks currently clear the ${escapeHtml(RISK_MODES[modeKey].label)} confidence threshold to build a full parlay.`)}`;
  }
  const cards = parlays.map((parlay, index) => {
    const legRows = parlay.legs.map((leg) => `<div><span>${escapeHtml(leg.date)} ${escapeHtml(leg.matchup)}</span><b>${escapeHtml(leg.pick)}</b><em>${compactPct(leg.probability)} | ${leg.decimalOdds.toFixed(2)}x ${leg.oddsSource === "market" ? "(market)" : "(model)"}</em></div>`).join("");
    return `<article class="forecast-card"><span class="tag">Parlay ${index + 1} — ${parlay.legs.length} legs</span><div class="fixture-list">${legRows}</div><div class="stats">${stat("Combined odds", `${parlay.combinedOdds.toFixed(2)}x`)}${stat("Combined probability", compactPct(parlay.combinedProbability))}${stat("Odds basis", parlay.anyMarketOdds ? "mixed market" : "model-implied")}</div><button data-track-parlay="${index}" style="margin-top:0.6em">Track this parlay</button></article>`;
  }).join("");
  return `${intro}${trackStatus}<section class="forecast-grid">${cards}</section>`;
}
function parlayStatusBadge(status) {
  return { HIT: "hit", MISS: "missed", VOID: "void", PENDING: "pending" }[status] || "pending";
}
function renderParlayLedger() {
  const ledger = state.parlayLedger;
  const summary = ledger?.summary || {};
  const trackStatus = state.trackStatus ? `<p class="source">${escapeHtml(state.trackStatus)}</p>` : "";
  const summaryCard = `<article class="card wide"><span class="tag">Tracked tickets</span><h2>${data.league} parlay ledger</h2><div class="stats">${stat("Total tracked", summary.total ?? 0)}${stat("Pending", summary.pending ?? 0)}${stat("Hit", summary.wins ?? 0)}${stat("Missed", summary.losses ?? 0)}${stat("Ticket hit rate", compactPct(summary.ticketHitRate))}${stat("Leg hit rate", compactPct(summary.legHitRate))}</div><p>Tracked from the Parlays tab. Legs settle automatically once their game finishes — no manual grading needed. This is a record of what the model would have picked, not real money staked.</p></article>`;
  const tickets = ledger?.parlays || [];
  if (!tickets.length) return `${summaryCard}${trackStatus}${message("No parlays tracked yet", "Open the Parlays tab and click \"Track this parlay\" on any combo to add it here.")}`;
  const cards = tickets.map((ticket) => {
    const legRows = (ticket.legs || []).map((leg) => `<div><span>${escapeHtml(leg.date)} ${escapeHtml(leg.matchup)}</span><b>${escapeHtml(leg.pick)}</b><em>${leg.status}</em></div>`).join("");
    return `<article class="forecast-card"><span class="tag status-${parlayStatusBadge(ticket.status)}">${ticket.status}</span><h2>${ticket.legCount}-leg parlay</h2><div class="fixture-list">${legRows}</div><div class="stats">${stat("Combined odds", ticket.combinedOdds ? `${ticket.combinedOdds.toFixed(2)}x` : "-")}${stat("Combined probability", compactPct(ticket.combinedProbability))}${stat("Tracked", new Date(ticket.createdAt).toLocaleDateString())}</div></article>`;
  }).join("");
  return `${summaryCard}${trackStatus}<section class="forecast-grid">${cards}</section>`;
}
function renderFeature() {
  const host = document.querySelector("#cards");
  const current = state.current;
  const history = state.historical;
  const summary = current?.summary || {};
  const historicalSummary = history?.summary || {};
  if (state.feature === "Predictions") {
    host.innerHTML = renderScoreboardPredictions();
  } else if (state.feature === "Parlays") {
    host.innerHTML = renderParlays();
  } else if (state.feature === "Parlay Ledger") {
    host.innerHTML = renderParlayLedger();
  } else if (state.feature === "Fixtures") {
    host.innerHTML = scheduleRows(current);
  } else if (state.feature === "Model Training") {
    const board = state.predictions;
    if (SPORT === "baseball") {
      const monitor = state.monitoring || {};
      host.innerHTML = `<article class="card wide"><span class="tag">Pregame safeguards active</span><h2>MLB model readiness</h2><div class="stats">${stat("Recorded predictions", monitor.recordedPredictions ?? "-")}${stat("Settled predictions", monitor.settledPredictions ?? "-")}${stat("Latest snapshot", monitor.latestSnapshotAt ? new Date(monitor.latestSnapshotAt).toLocaleString() : "Unavailable")}</div><p>Predictions require timestamped pregame inputs. The public forecast board uses only schedule and pre-first-pitch context; outputs are model projections, not guaranteed bets or financial advice.</p></article>`;
      return;
    }
    const trainedAt = board?.model?.trainedAt ? new Date(board.model.trainedAt).toLocaleString() : "Not yet trained";
    const validation = board?.model?.validationMae;
    host.innerHTML = `<article class="card wide"><span class="tag">${board ? "Ridge regression trained" : "Awaiting training"}</span><h2>${data.league} model readiness</h2><div class="stats">${stat("Completed historical games", historicalSummary.completedGames ?? "-")}${stat("Teams represented", historicalSummary.teams ?? "-")}${stat("Trained at", trainedAt)}${stat("Validation MAE", validation ? `${runs(validation.home?.validationMae)} / ${runs(validation.away?.validationMae)}` : "-")}</div><p>The ${data.league} model is a ridge-regression score predictor trained on results-only offense/defense ratings reconstructed chronologically from completed games (run <code>scripts/train_${SPORT === "basketball" ? "basketball" : "american_football"}_model.js</code> to retrain from newly imported history). Predictions feed the shared Monte Carlo simulator used across every sport in this workspace.</p></article>`;
  } else if (state.feature === "Teams Profile") {
    const standingsBoard = state.standingsSource;
    const overview = `<article class="card wide"><h2>${data.league} team workspace</h2><div class="stats">${stat("Teams found", summary.teams ?? "-")}${stat("Scheduled games", summary.scheduledGames ?? "-")}${stat("Completed games", historicalSummary.completedGames ?? "-")}</div><p>Team profiles use the imported schedule and current-season results as their baseline. Each sport remains isolated to prevent cross-sport model leakage.</p></article>`;
    host.innerHTML = `${overview}${standingsTable(standingsBoard?.standings, { withRatings: true })}`;
  } else if (state.feature === "Tables") {
    host.innerHTML = standingsTable(state.standingsSource?.standings);
  } else if (state.feature === "Player Profiles") {
    host.innerHTML = renderPlayerProfiles();
  } else {
    host.innerHTML = futuresProjection(state.predictions?.projections?.length ? state.predictions.projections : state.standingsSource?.projections);
  }
}
async function loadData() {
  const status = document.querySelector("#dataStatus");
  status.textContent = "Importing public schedules and completed historical results...";
  try {
    const predictionsPath = `/api/sports/${SPORT}/predictions`;
    const [current, historical, monitoring, predictions, playerLeaders] = await Promise.all([
      api(`/api/sports/${SPORT}/season?season=${encodeURIComponent(data.season)}&refresh=1`),
      api(`/api/sports/${SPORT}/season?season=${encodeURIComponent(data.historicalSeason)}&refresh=1`),
      SPORT === "baseball" ? api("/api/baseball/monitoring") : Promise.resolve(null),
      api(`${predictionsPath}?season=${encodeURIComponent(data.season)}&refresh=1&limit=30&refreshOdds=1`).catch(() => null),
      api(`/api/sports/${SPORT}/player-leaders${SPORT === "baseball" ? `?season=${encodeURIComponent(data.season)}` : ""}`).catch(() => null),
    ]);
    state.current = current;
    state.historical = historical;
    state.monitoring = monitoring;
    state.predictions = predictions || null;
    state.playerLeaders = playerLeaders || null;
    // Parlay legs are picked by confidence, not chronological order, so they
    // need the full upcoming board — the Predictions tab above only fetches
    // the nearest-date limit=30 slice, which frequently has no games that
    // clear a parlay's win-probability threshold even when higher-confidence
    // games exist further out.
    state.allPredictions = await api(`${predictionsPath}?season=${encodeURIComponent(data.season)}&limit=0`).catch(() => predictions);
    state.parlayLedger = await api(`/api/sports/${SPORT}/parlay-ledger`).catch(() => null);
    // Standings/team-rating context needs settled games. In the offseason
    // gap (e.g. NBA/NFL in August, current-season predictions carry zero
    // completed games) fall back to the last completed season purely for
    // Tables/Teams Profile/Futures, while Predictions keeps showing the
    // actual upcoming current-season schedule above.
    state.standingsSource = predictions;
    if (!(predictions?.summary?.completedGames > 0)) {
      state.standingsSource = await api(`${predictionsPath}?season=${encodeURIComponent(data.historicalSeason)}&limit=0`).catch(() => predictions);
    }
    status.textContent = predictions
      ? `${data.league}: trained forecast model active - ${predictions.summary?.totalPredictions ?? predictions.summary?.predictions ?? 0} upcoming forecasts`
      : `${data.league}: ${current.summary.games} current-season games | ${historical.summary.completedGames} completed historical games imported`;
  } catch (error) {
    status.textContent = `Schedule import is unavailable right now: ${error.message}`;
  }
  renderFeature();
}

featureNav();
renderFeature();
loadData();
