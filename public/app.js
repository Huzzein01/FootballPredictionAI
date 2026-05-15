const resultLabels = { H: "Home win", D: "Draw", A: "Away win" };
const shortLabels = { H: "Home", D: "Draw", A: "Away" };

const form = document.querySelector("#predictForm");
const output = document.querySelector("#predictionOutput");
const ledgerBody = document.querySelector("#ledgerBody");
const teamList = document.querySelector("#teamList");
const leagueSelect = document.querySelector("#leagueSelect");
const themeSelect = document.querySelector("#themeSelect");
const fixtureBoard = document.querySelector("#fixtureBoard");
const boardMessage = document.querySelector("#boardMessage");
const boardStatus = document.querySelector("#boardStatus");
const boardLeagueFilter = document.querySelector("#boardLeagueFilter");
const boardSortSelect = document.querySelector("#boardSortSelect");
const trackAllButton = document.querySelector("#trackAllButton");
const playedBoard = document.querySelector("#playedBoard");
const playedStatus = document.querySelector("#playedStatus");
const playedLeagueFilter = document.querySelector("#playedLeagueFilter");
const refreshPlayedButton = document.querySelector("#refreshPlayedButton");
const parlayStatus = document.querySelector("#parlayStatus");
const parlayLeagueFilter = document.querySelector("#parlayLeagueFilter");
const parlayLegCount = document.querySelector("#parlayLegCount");
const parlayTicketCount = document.querySelector("#parlayTicketCount");
const parlayTypeSelect = document.querySelector("#parlayTypeSelect");
const parlaySortSelect = document.querySelector("#parlaySortSelect");
const refreshParlayButton = document.querySelector("#refreshParlayButton");
const trackParlaysButton = document.querySelector("#trackParlaysButton");
const parlayMessage = document.querySelector("#parlayMessage");
const parlayOutput = document.querySelector("#parlayOutput");
const parlayLedgerOutput = document.querySelector("#parlayLedgerOutput");
const parlayLedgerStatus = document.querySelector("#parlayLedgerStatus");
const parlayAccuracyStats = document.querySelector("#parlayAccuracyStats");
const refreshParlayLedgerButton = document.querySelector("#refreshParlayLedgerButton");
const pageTabs = [...document.querySelectorAll("[data-page-target]")];
const pageSections = [...document.querySelectorAll("[data-page]")];

let meta = null;
let fixturePredictions = [];
let playedPredictions = [];
let currentParlays = [];
let parlayRefreshSeed = 0;

const CENTRAL_TIME_ZONE = "America/Chicago";

const TEAM_DISPLAY_NAMES = {
  "Ath Bilbao": "Athletic Club",
  "Ath Madrid": "Atletico Madrid",
  "FC Koln": "FC Koln",
  "Man City": "Man City",
  "Man United": "Man United",
  "Nott'm Forest": "Nottingham Forest",
  "Oviedo": "Real Oviedo",
  "Paris SG": "Paris SG",
  "Tottenham": "Tottenham",
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
  "Sevilla": "https://a.espncdn.com/i/teamlogos/soccer/500/243.png",
  "Sunderland": "https://a.espncdn.com/i/teamlogos/soccer/500/366.png",
  "Tottenham": "https://a.espncdn.com/i/teamlogos/soccer/500/367.png",
  "Tottenham Hotspur": "https://a.espncdn.com/i/teamlogos/soccer/500/367.png",
  "Valencia": "https://a.espncdn.com/i/teamlogos/soccer/500/94.png",
  "Villarreal": "https://a.espncdn.com/i/teamlogos/soccer/500/102.png",
};

const TEAM_COLORS = {
  "Arsenal": "#ef0107",
  "Aston Villa": "#95bfe5",
  "Atletico Madrid": "#cb3524",
  "Barcelona": "#a50044",
  "Bayern Munich": "#dc052d",
  "Chelsea": "#034694",
  "Liverpool": "#c8102e",
  "Man City": "#6cabdd",
  "Man United": "#da291c",
  "Paris SG": "#004170",
  "Real Madrid": "#febe10",
  "Tottenham": "#132257",
};

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

function showPage(page) {
  const fallback = pageSections.some((section) => section.dataset.page === page) ? page : "predictions";
  pageSections.forEach((section) => section.classList.toggle("is-active", section.dataset.page === fallback));
  pageTabs.forEach((tab) => {
    const active = tab.dataset.pageTarget === fallback;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-current", active ? "page" : "false");
  });
  history.replaceState(null, "", `#${fallback}`);
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

function displayTeam(team) {
  return TEAM_DISPLAY_NAMES[team] || team;
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

function teamLine(team) {
  return `<span class="team-line">${teamBadge(team)}<span class="team-name">${escapeHtml(displayTeam(team))}</span></span>`;
}

function fixtureTeams(prediction) {
  return `
    <h3 class="fixture-teams">
      ${teamLine(prediction.homeTeam)}
      <span class="versus">vs</span>
      ${teamLine(prediction.awayTeam)}
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
  const source = context.source === "public-standings" ? "Live table" : "Local form table";
  const homeManual = context.home.manualNote ? ` (${context.home.manualNote})` : "";
  const awayManual = context.away.manualNote ? ` (${context.away.manualNote})` : "";
  return `${source}: ${displayTeam(prediction.homeTeam)} ${context.home.note}${homeManual}; ${displayTeam(prediction.awayTeam)} ${context.away.note}${awayManual}`;
}

function motivationLine(prediction) {
  const text = motivationText(prediction);
  return text ? `<div class="motivation-line">${escapeHtml(text)}</div>` : "";
}

function setBoardMessage(message, kind = "info") {
  boardMessage.className = `board-message ${message ? "is-visible" : ""} ${kind}`;
  boardMessage.textContent = message;
}

function setParlayMessage(message, kind = "info") {
  parlayMessage.className = `board-message ${message ? "is-visible" : ""} ${kind}`;
  parlayMessage.textContent = message;
}

function renderBoard() {
  const selectedLeague = boardLeagueFilter.value;
  const filtered = sortFixturePredictions(
    selectedLeague === "All" ? fixturePredictions : fixturePredictions.filter((prediction) => prediction.league === selectedLeague),
    boardSortSelect.value
  );

  document.querySelector("#boardTotal").textContent = fixturePredictions.length;
  document.querySelector("#boardWithOdds").textContent = fixturePredictions.filter((prediction) => prediction.hasOdds).length;
  document.querySelector("#boardModelOnly").textContent = fixturePredictions.filter((prediction) => !prediction.hasOdds).length;
  boardStatus.textContent = `${filtered.length} fixture${filtered.length === 1 ? "" : "s"} shown`;

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

function renderPlayedBoard() {
  const selectedLeague = playedLeagueFilter.value;
  const filtered = selectedLeague === "All" ? playedPredictions : playedPredictions.filter((prediction) => prediction.league === selectedLeague);
  const correct = playedPredictions.filter((prediction) => prediction.played?.modelCorrect === true).length;
  const wrong = playedPredictions.filter((prediction) => prediction.played?.modelCorrect === false).length;
  const voided = playedPredictions.filter((prediction) => prediction.played?.modelCorrect === null).length;
  const exact = playedPredictions.filter((prediction) => prediction.played?.exactScoreCorrect === true).length;

  document.querySelector("#playedTotal").textContent = playedPredictions.length;
  document.querySelector("#playedCorrect").textContent = correct;
  document.querySelector("#playedWrong").textContent = wrong;
  document.querySelector("#playedExact").textContent = exact;
  document.querySelector("#playedVoided").textContent = voided;
  playedStatus.textContent = `${filtered.length} played match${filtered.length === 1 ? "" : "es"} shown`;

  if (!filtered.length) {
    playedBoard.innerHTML = `<div class="empty-state">No played fixtures have been settled from parlays yet.</div>`;
    return;
  }

  playedBoard.innerHTML = filtered
    .map((prediction) => {
      const settled = prediction.played || {};
      const picks = (settled.picks || []).slice(0, 4);
      return `
        <article class="fixture-card scoreboard-row played-card ${playedClass(prediction)}">
          <div class="card-topline">
            <span>${escapeHtml(prediction.date)}</span>
            <span>${escapeHtml(prediction.league)}</span>
          </div>
          ${fixtureTeams(prediction)}
          <div class="callout">
            <span class="pick-pill played-result">${escapeHtml(playedStatusText(prediction))}</span>
            <strong>${settled.hits || 0}-${settled.misses || 0}</strong>
          </div>
          <div class="score-line">
            <span>Original pick</span>
            <strong>${escapeHtml(pickText(prediction))}</strong>
          </div>
          <div class="score-line">
            <span>Projected score</span>
            <strong>${escapeHtml(prediction.projectedScore || "")}</strong>
          </div>
          <div class="score-line">
            <span>Final score</span>
            <strong>${escapeHtml(settled.actualScore || "Awaiting verification")}</strong>
          </div>
          <div class="score-line">
            <span>Score grade</span>
            <strong>${settled.exactScoreCorrect === true ? "Exact" : settled.exactScoreCorrect === false ? "Missed" : "Pending"}</strong>
          </div>
          ${
            settled.sourceUrl
              ? `<div class="odds-line"><span>Verified by</span><strong><a href="${escapeHtml(settled.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(settled.sourceName || "Source")}</a></strong></div>`
              : ""
          }
          ${motivationLine(prediction)}
          <ul class="played-pick-list">
            ${picks.map((pick) => `<li><span>${escapeHtml(pick.status)}</span>${escapeHtml(pick.pick)} <small>${escapeHtml(pick.market)}</small></li>`).join("")}
          </ul>
        </article>
      `;
    })
    .join("");
}

function updateTeamList() {
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
  `;
}

function renderParlay(data) {
  const fbref = data.fbref || {};
  const parlays = data.parlays?.length ? data.parlays : data.parlay?.legs?.length ? [data.parlay] : [];
  const legs = parlays.flatMap((parlay) => parlay.legs || []);
  currentParlays = parlays;

  document.querySelector("#fbrefRows").textContent = fbref.processedRows || 0;
  document.querySelector("#fbrefPlayers").textContent = fbref.players || 0;
  document.querySelector("#playerLegCount").textContent = data.playerCandidateCount || 0;
  document.querySelector("#teamScoreLegCount").textContent = data.teamScoreCandidateCount || 0;
  parlayStatus.textContent = fbref.hasPlayerStats
    ? `Using imported FBref stats from ${fbref.seasons.join(", ") || "local files"} | ${data.availableFixtureCount || 0} fixtures available | ${data.excludedFixtureCount || 0} played excluded`
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
}

function renderParlayTicket(parlay) {
  const legs = parlay.legs || [];
  return `
    <article class="parlay-ticket">
      <div class="ticket-head">
        <div>
          <h3>${escapeHtml(parlay.name)}</h3>
          <p class="muted">${legs.length} legs | average confidence ${Number(parlay.averageConfidence || 0).toFixed(1)}%</p>
        </div>
        <div class="ticket-actions">
          <div class="ticket-stats">
            <span>${(parlay.playerStatLegs || []).length} player</span>
            <span>${(parlay.teamScoreLegs || []).length} score</span>
            <span>${(parlay.matchResultLegs || []).length} result</span>
          </div>
          <button class="track-ticket-button" type="button" data-track-ticket="${escapeHtml(parlay.id)}">Track this option</button>
        </div>
      </div>
      <ol class="parlay-leg-list">
        ${legs.map((leg, index) => renderLegListItem(leg, index + 1)).join("")}
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

function renderLegListItem(leg, index) {
  const detail =
    leg.type === "player"
      ? `${leg.fbrefMetric} | ${leg.fbrefSeason} | ${leg.source}`
      : `Projected score ${leg.projectedScore || "N/A"} | ${leg.source || ""}`;
  return `
    <li class="parlay-leg-row ${leg.type}-leg">
      <span class="leg-number">${index}</span>
      <div>
        <strong>${escapeHtml(leg.pick)}</strong>
        ${fixtureMiniLine(leg.fixture)}
        <p class="fbref-line">${escapeHtml(detail)}</p>
      </div>
      <div class="leg-row-meta">
        <span>${escapeHtml(leg.market)}</span>
        <strong>${Number(leg.confidence || 0).toFixed(1)}%</strong>
      </div>
    </li>
  `;
}

function renderLegCard(leg) {
  const typeClass = leg.type === "player" ? "player-leg" : leg.type === "score" ? "score-leg" : "match-leg";
  const detail =
    leg.type === "player"
      ? `FBref: ${leg.fbrefMetric} | ${leg.fbrefSeason} | ${leg.source}`
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

function renderParlayLedger(data) {
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
              <p class="muted">${parlay.legs.length} legs | ${escapeHtml(parlay.status)} | created ${new Date(parlay.createdAt).toLocaleString()}</p>
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

function showMessage(message, kind = "error") {
  output.classList.add("is-visible");
  output.innerHTML = `<div class="${kind === "error" ? "error-box" : "info-box"}">${escapeHtml(message)}</div>`;
}

function scoreCorrect(item) {
  return String(item.projectedScore || "").trim() === `${item.homeGoals}-${item.awayGoals}`;
}

function renderLedger(predictions) {
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
  const data = await api("/api/backtests");
  updateSummary(data.summary);
  renderLedger(data.predictions);
}

async function refreshFixtureBoard() {
  setBoardMessage("Loading fixture predictions...", "info");
  const data = await api("/api/fixture-predictions");
  fixturePredictions = data.predictions;

  const leagues = [...new Set(fixturePredictions.map((prediction) => prediction.league))].sort();
  boardLeagueFilter.innerHTML = `<option value="All">All leagues</option>${leagues.map((league) => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}`;

  renderBoard();
  setBoardMessage("", "info");
}

async function refreshPlayedBoard() {
  const data = await api("/api/played-fixtures");
  playedPredictions = data.predictions || [];

  const leagues = [...new Set(playedPredictions.map((prediction) => prediction.league))].sort();
  playedLeagueFilter.innerHTML = `<option value="All">All leagues</option>${leagues.map((league) => `<option value="${escapeHtml(league)}">${escapeHtml(league)}</option>`).join("")}`;

  renderPlayedBoard();
}

async function refreshParlay({ forceNew = false } = {}) {
  if (forceNew) parlayRefreshSeed += 1;
  const league = encodeURIComponent(parlayLeagueFilter.value);
  const legs = encodeURIComponent(parlayLegCount.value);
  const tickets = encodeURIComponent(parlayTicketCount.value);
  const type = encodeURIComponent(parlayTypeSelect.value);
  setParlayMessage(forceNew ? "Building a fresh parlay variation..." : "Building parlay from fixtures and imported player stats...", "info");
  const data = await api(`/api/parlay?league=${league}&legs=${legs}&tickets=${tickets}&type=${type}&refreshSeed=${parlayRefreshSeed}`);
  renderParlay(data);
}

async function refreshParlayLedger() {
  const data = await api("/api/parlay-backtests");
  renderParlayLedger(data);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
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
    const data = await api("/api/fixture-predictions/backtest", { method: "POST", body: JSON.stringify({}) });
    updateSummary(data.summary);
    await refreshLedger();
    setBoardMessage(data.saved.length ? `Added ${data.saved.length} predictions to the ledger.` : "These fixture-board predictions are already being tracked.", "info");
  } catch (error) {
    setBoardMessage(error.name === "AbortError" ? "Saving predictions timed out." : error.message, "error");
  } finally {
    trackAllButton.disabled = false;
    trackAllButton.textContent = originalText;
  }
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
  await refreshTrainingStatus();
});

document.querySelector("#refreshButton").addEventListener("click", refreshLedger);
leagueSelect.addEventListener("change", updateTeamList);
boardLeagueFilter.addEventListener("change", renderBoard);
boardSortSelect.addEventListener("change", renderBoard);
playedLeagueFilter.addEventListener("change", renderPlayedBoard);
refreshPlayedButton.addEventListener("click", refreshPlayedBoard);
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
refreshParlayButton.addEventListener("click", () => refreshParlay({ forceNew: true }));
parlayOutput.addEventListener("click", async (event) => {
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
parlayLeagueFilter.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlayLegCount.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlayTicketCount.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlayTypeSelect.addEventListener("change", () => refreshParlay({ forceNew: true }));
parlaySortSelect.addEventListener("change", renderParlayTickets);
refreshParlayLedgerButton.addEventListener("click", refreshParlayLedger);
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
  if (data.updated?.newlyMissedParlays > 0) {
    setParlayMessage(`Parlay missed. Retraining has started, and new parlay options were regenerated without ${data.updated.playedFixture?.fixture || "that played fixture"}.`, "info");
    await refreshParlay();
  }
  await refreshFixtureBoard();
  await refreshPlayedBoard();
  await refreshTrainingStatus();
});

async function init() {
  try {
    initTheme();
    showPage(location.hash.replace("#", "") || "predictions");
    meta = await api("/api/meta");
    renderModelMeta(meta, meta.trainingStatus);
    updateTeamList();
    await refreshFixtureBoard();
    await refreshPlayedBoard();
    await refreshParlay();
    await refreshParlayLedger();
    await refreshLedger();
  } catch (error) {
    document.querySelector("#modelMeta").textContent = "Unable to load model status";
    setBoardMessage(error.name === "AbortError" ? "The app could not reach the local prediction server." : error.message, "error");
    showMessage(error.name === "AbortError" ? "The app could not reach the local prediction server." : error.message);
  }
}

init();
