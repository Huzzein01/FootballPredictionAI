/* ===========================================================================
   Football Analyst — immersive front-end (v2)
  Data-first sportsbook dashboard wired to the prediction APIs.
   =========================================================================== */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
async function api(path, opts) { const r = await fetch(path, opts); if (!r.ok) throw new Error(`${r.status}`); return r.json(); }
async function apiWithTimeout(path, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try { return await api(path, { signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

const STATE = {
  context: "international", section: "predictions", matchday: "all",
  sortBy: "confidence", clubSeason: "2026-27", internationalSeason: "2026 World Cup", competitionType: "league", competitions: ["All Leagues"],
  liveTimer: null, goalWatch: null, contextTimer: null, pulseTimer: null, pulseData: null, pulseMeta: null, liveScores: {}, parlayRisk: "safe",
  futuresView: null,
  futuresSelection: null,
};

const FUTURES_VIEW_OPTIONS = [
  { id: "standings", label: "Standings" },
  { id: "bracket", label: "Bracket" },
  { id: "scorers", label: "Top Scorers" },
  { id: "assists", label: "Top Assists" },
  { id: "cleanSheets", label: "Clean Sheets" },
];
const CLUB_COMP_BRACKET_IDS = { "Champions League": "champions-league", "Europa League": "europa-league", "Conference League": "conference-league" };
const DOMESTIC_CUP_BRACKET_IDS = { "FA Cup": "fa-cup", "Carabao Cup": "carabao-cup", "Copa del Rey": "copa-del-rey", "DFB-Pokal": "dfb-pokal", "Coppa Italia": "coppa-italia", "Coupe de France": "coupe-de-france" };
const FUTURES_LEAGUE_OPTIONS = ["EPL", "La Liga", "Bundesliga", "Ligue 1", "Serie A"];
const FUTURES_COMPETITION_OPTIONS = [...Object.keys(CLUB_COMP_BRACKET_IDS), ...Object.keys(DOMESTIC_CUP_BRACKET_IDS)];
const FUTURES_SELECTION_OPTIONS = [...FUTURES_LEAGUE_OPTIONS, ...FUTURES_COMPETITION_OPTIONS];

const CLUB_SEASONS = ["2026-27", "2025-26", "2024-25", "2023-24", "2022-23", "2021-22", "2020-21"];
const INTERNATIONAL_SEASONS = ["2026 World Cup", "2022 World Cup", "2018 World Cup"];
const FOOTBALL_CATALOG = {
  league: ["All Leagues", "EPL", "La Liga", "Bundesliga", "Ligue 1", "Serie A", "Eredivisie", "Primeira Liga", "Scottish Premiership", "Turkish Super Lig", "Belgian Pro League", "Danish Superliga", "Eliteserien", "Allsvenskan", "Swiss Super League"],
  competition: ["All Competitions", "Champions League", "Europa League", "Conference League", "UEFA Super Cup", "FA Cup", "Carabao Cup", "Copa del Rey", "DFB-Pokal", "Coppa Italia", "Coupe de France"],
};
const KNOCKOUT_COMPETITIONS = new Set(FOOTBALL_CATALOG.competition.slice(1));

const SECTIONS = [
  { id: "predictions", label: "Predictions" },
  { id: "live", label: "Live Now", intl: true },
  { id: "parlays", label: "Parlays" },
  { id: "slip", label: "Daily Slip", intl: true },
  { id: "teams", label: "Team Profiles" },
  { id: "players", label: "Player Profiles" },
  { id: "futures", label: "Futures" },
  { id: "tables", label: "Tables" },
  { id: "results", label: "Results" },
  { id: "training", label: "Model Training", intl: true },
  { id: "fixtures", label: "Fixtures" },
  { id: "single", label: "Single Predictor" },
];

// Every crest/flag always renders something — a real image when one
// resolves, otherwise a generated colored-initials badge, never a blank gap.
function teamInitials(name) {
  const words = String(name || "").replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
function teamColor(name) {
  let hash = 0;
  for (const c of String(name || "")) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360}, 52%, 38%)`;
}
function initialsDataUri(name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="7" fill="${teamColor(name)}"/><text x="20" y="26" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${teamInitials(name)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
const flag = (url, name) => {
  const fallback = initialsDataUri(name);
  return url
    ? `<img class="flag" src="${esc(url)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">`
    : `<img class="flag" src="${fallback}" alt="" loading="lazy">`;
};
const clubCrest = (team, supplied, league) => {
  const fallback = initialsDataUri(team);
  const src = supplied || `/api/club-crest?team=${encodeURIComponent(team)}&league=${encodeURIComponent(league || "")}`;
  return `<img class="flag" src="${esc(src)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">`;
};
const stat = (b, s, cls = "") => `<div class="hero-stat"><b class="${cls}">${esc(b)}</b><span>${esc(s)}</span></div>`;
const seasonFor = () => STATE.context === "international" ? STATE.internationalSeason : STATE.clubSeason;
const isCurrentInternationalSeason = () => STATE.internationalSeason === "2026 World Cup";

/* ── Theme (adaptive / light / dark) ────────────────────────────────────────
   "Adaptive" follows local time (light 4am-4pm, dark otherwise) rather than
   prefers-color-scheme, matching the sportsbook's day/night broadcast feel. */
function centralHour() {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hour12: false }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value);
  } catch { return new Date().getHours(); }
}
const adaptiveTheme = () => { const hour = centralHour(); return hour >= 4 && hour < 16 ? "light" : "dark"; };
function applyTheme(mode) {
  const selected = ["light", "dark", "adaptive"].includes(mode) ? mode : "adaptive";
  document.documentElement.dataset.theme = selected === "adaptive" ? adaptiveTheme() : selected;
  document.documentElement.dataset.themeMode = selected;
  const select = $("#themeSelect");
  if (select) select.value = selected;
  localStorage.setItem("football-theme-mode", selected);
}
function initTheme() {
  applyTheme(localStorage.getItem("football-theme-mode") || "adaptive");
  $("#themeSelect")?.addEventListener("change", (event) => applyTheme(event.target.value));
  window.setInterval(() => { if ((localStorage.getItem("football-theme-mode") || "adaptive") === "adaptive") applyTheme("adaptive"); }, 60_000);
}

/* ── Boot ────────────────────────────────────────────────────────────────── */
async function bootApp() {
  initTheme();
  buildNav();
  buildSectionNav();
  bindContextSwitch();
  bindSeasonSwitch();
  await applyModelContext();
  bindCompetitionFilter();
  bindFilterPanel();
  positionCtxGlow();
  renderSection();
  refreshHeroStats();
  STATE.contextTimer = window.setInterval(() => applyModelContext({ rerender: true }), 15 * 60_000);
}
async function applyModelContext({ rerender = false } = {}) {
  const decision = await api("/api/football/context").catch(() => null);
  if (!decision?.context) return;
  const changed = STATE.context !== decision.context;
  STATE.context = decision.context;
  if (decision.context === "club" && CLUB_SEASONS.includes(decision.season)) STATE.clubSeason = decision.season;
  document.documentElement.dataset.context = STATE.context;
  $("#ctxSwitch").querySelectorAll(".ctx-btn").forEach((button) => button.classList.toggle("is-active", button.dataset.ctx === STATE.context));
  positionCtxGlow();
  updateSeasonSwitch();
  updateCompetitionSwitch();
  updateHeroSubtitle();
  updateFilterSummary();
  if (rerender && changed) {
    if (!sectionAllowed(STATE.section)) STATE.section = "predictions";
    buildSectionNav();
    renderSection();
    refreshHeroStats();
  }
}

function bindContextSwitch() {
  $("#ctxSwitch").querySelectorAll(".ctx-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (STATE.context === btn.dataset.ctx) return;
      STATE.context = btn.dataset.ctx;
      document.documentElement.dataset.context = STATE.context;
      $("#ctxSwitch").querySelectorAll(".ctx-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      positionCtxGlow();
      updateSeasonSwitch();
      updateCompetitionSwitch();
      updateHeroSubtitle();
      updateFilterSummary();
      if (!sectionAllowed(STATE.section)) STATE.section = "predictions";
      buildSectionNav(); renderSection(); refreshHeroStats();
    });
  });
}
function updateHeroSubtitle() {
  // Mode and season are already communicated by the filter summary; leaving
  // this line empty keeps the hero focused on the current sport.
  $("#heroSub").hidden = true;
}
function bindSeasonSwitch() {
  const select = $("#clubSeasonSwitch");
  if (!select) return;
  const savedClub = localStorage.getItem("football-club-season");
  const savedInternational = localStorage.getItem("football-international-season");
  if (CLUB_SEASONS.includes(savedClub)) STATE.clubSeason = savedClub;
  if (INTERNATIONAL_SEASONS.includes(savedInternational)) STATE.internationalSeason = savedInternational;
  select.addEventListener("change", () => {
    if (STATE.context === "international") {
      STATE.internationalSeason = select.value;
      localStorage.setItem("football-international-season", select.value);
    } else {
      STATE.clubSeason = select.value;
      localStorage.setItem("football-club-season", select.value);
    }
    STATE.matchday = "all";
    updateHeroSubtitle();
    updateFilterSummary();
    renderSection();
    refreshHeroStats();
  });
  updateSeasonSwitch();
  updateHeroSubtitle();
  updateFilterSummary();
}
function updateSeasonSwitch() {
  const select = $("#clubSeasonSwitch");
  if (!select) return;
  const options = STATE.context === "international" ? INTERNATIONAL_SEASONS : CLUB_SEASONS;
  const selected = seasonFor();
  select.innerHTML = options.map((season) => `<option value="${esc(season)}">${esc(season)}</option>`).join("");
  select.value = selected;
}
function bindCompetitionFilter() {
  const type = $("#competitionType");
  const optionsHost = $("#competitionOptions");
  if (!type || !optionsHost) return;
  const savedType = localStorage.getItem("football-competition-type");
  let savedCompetitions = [];
  try { savedCompetitions = JSON.parse(localStorage.getItem("football-competitions") || "[]"); } catch (_) { savedCompetitions = []; }
  if (Object.hasOwn(FOOTBALL_CATALOG, savedType)) STATE.competitionType = savedType;
  const available = FOOTBALL_CATALOG[STATE.competitionType];
  if (Array.isArray(savedCompetitions) && savedCompetitions.length && savedCompetitions.every((name) => available.includes(name))) STATE.competitions = savedCompetitions;
  type.addEventListener("change", () => {
    STATE.competitionType = type.value;
    STATE.competitions = [FOOTBALL_CATALOG[STATE.competitionType][0]];
    localStorage.setItem("football-competition-type", STATE.competitionType);
    localStorage.setItem("football-competitions", JSON.stringify(STATE.competitions));
    updateCompetitionSwitch();
    updateFilterSummary();
    renderSection();
  });
  updateCompetitionSwitch();
}
function updateCompetitionSwitch() {
  const wrap = $("#competitionSwitch");
  const pickerField = $("#competitionPicker");
  const type = $("#competitionType");
  const optionsHost = $("#competitionOptions");
  const summary = $("#competitionSummary");
  if (!wrap || !pickerField || !type || !optionsHost || !summary) return;
  const international = STATE.context === "international";
  wrap.hidden = international;
  pickerField.hidden = international;
  if (international) return;
  type.value = STATE.competitionType;
  const options = FOOTBALL_CATALOG[STATE.competitionType];
  const allName = options[0];
  if (!STATE.competitions.length || STATE.competitions.some((name) => !options.includes(name))) STATE.competitions = [allName];
  if (STATE.competitions.includes(allName) && STATE.competitions.length > 1) STATE.competitions = [allName];
  summary.textContent = STATE.competitions.includes(allName) ? allName : `${STATE.competitions.length} selected`;
  optionsHost.innerHTML = options.map((name) => `<label><input type="checkbox" value="${esc(name)}"${STATE.competitions.includes(name) ? " checked" : ""}> <span>${esc(name)}</span></label>`).join("");
  optionsHost.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => {
    const picked = [...optionsHost.querySelectorAll("input:checked")].map((box) => box.value);
    STATE.competitions = input.value === allName && input.checked ? [allName] : picked.filter((name) => name !== allName);
    if (!STATE.competitions.length) STATE.competitions = [allName];
    localStorage.setItem("football-competitions", JSON.stringify(STATE.competitions));
    updateCompetitionSwitch();
    updateFilterSummary();
    renderSection();
  }));
}
function bindFilterPanel() {
  const button = $("#filterToggle");
  const panel = $("#filterPanel");
  if (!button || !panel) return;
  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
  });
  document.addEventListener("click", (event) => {
    if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) {
      panel.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }
  });
}
function updateFilterSummary() {
  const summary = $("#filterSummary");
  if (!summary) return;
  const mode = STATE.context === "international" ? "International" : "Club";
  summary.textContent = STATE.context === "international" ? `${mode} · ${STATE.internationalSeason}` : `${mode} · ${STATE.clubSeason} · ${competitionLabel()}`;
}
function isCompetitionEntry(entry) {
  return KNOCKOUT_COMPETITIONS.has(String(entry?.league || entry?.competition || ""));
}
function filterFootballEntries(entries) {
  if (STATE.context === "international") return entries;
  const filtered = (entries || []).filter((entry) => {
    const isCompetition = isCompetitionEntry(entry);
    if (STATE.competitionType === "league") {
      return !isCompetition && (STATE.competitions.includes("All Leagues") || STATE.competitions.includes(entry.league));
    }
    return isCompetition && (STATE.competitions.includes("All Competitions") || STATE.competitions.includes(entry.league));
  });
  return filtered;
}
function competitionLabel() {
  if (STATE.context === "international") return "International";
  const allName = FOOTBALL_CATALOG[STATE.competitionType][0];
  return STATE.competitions.includes(allName) ? allName : STATE.competitions.join(", ");
}
function selectedLeague() { return STATE.competitionType === "league" && STATE.competitions.length === 1 && STATE.competitions[0] !== "All Leagues" ? STATE.competitions[0] : "All"; }
function positionCtxGlow() {
  const active = $("#ctxSwitch .ctx-btn.is-active"), glow = $(".ctx-glow");
  if (active && glow) { glow.style.left = active.offsetLeft + "px"; glow.style.width = active.offsetWidth + "px"; }
}
const sectionAllowed = (id) => { const s = SECTIONS.find((x) => x.id === id); return s && (!s.intl || STATE.context === "international"); };

function buildNav() {
  const nav = $("#nav"); nav.innerHTML = "";
  const brand = el("a", "nav-brand", '<img class="nav-brand-mark" src="/brand/prediction-weave.svg" alt=""><span>Sportsbooks <b>Analyst</b></span>');
  brand.href = "/home/";
  brand.setAttribute("aria-label", "Sportsbooks Analyst home");
  nav.appendChild(brand);
  const sportLinks = [
    { label: "Football", href: "/football/", active: true },
    { label: "Baseball", href: "/baseball/" },
    { label: "Basketball", href: "/basketball/" },
    { label: "American Football", href: "/american-football/" },
  ];
  sportLinks.forEach((sport) => {
    const link = el("a", "nav-btn nav-sport" + (sport.active ? " is-active" : ""), esc(sport.label));
    link.href = sport.href;
    if (sport.active) link.setAttribute("aria-current", "page");
    nav.appendChild(link);
  });
}

function buildSectionNav() {
  const nav = $("#sectionNav");
  if (!nav) return;
  nav.innerHTML = "";
  SECTIONS.filter((s) => !s.intl || STATE.context === "international").forEach((s) => {
    const b = el("button", "feature-tab" + (s.id === STATE.section ? " active" : ""), esc(s.label));
    b.addEventListener("click", () => { STATE.section = s.id; buildSectionNav(); renderSection(); updateFuturesViewFilter(); });
    nav.appendChild(b);
  });
  updateFuturesViewFilter();
}
function renderFuturesViewOptions() {
  const optionsHost = $("#futuresViewOptions");
  const summary = $("#futuresViewSummary");
  if (!optionsHost || !summary) return;
  const view = loadFuturesView();
  const allIds = FUTURES_VIEW_OPTIONS.map((o) => o.id);
  summary.textContent = view.length === allIds.length ? "All" : `${view.length} selected`;
  optionsHost.innerHTML = FUTURES_VIEW_OPTIONS.map((opt) => `<label><input type="checkbox" value="${esc(opt.id)}"${view.includes(opt.id) ? " checked" : ""}> <span>${esc(opt.label)}</span></label>`).join("");
  optionsHost.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => {
    const picked = [...optionsHost.querySelectorAll("input:checked")].map((box) => box.value);
    STATE.futuresView = picked.length ? picked : [input.value];
    localStorage.setItem("football-futures-view", JSON.stringify(STATE.futuresView));
    renderFuturesViewOptions();
    if (STATE.section === "futures") renderSection();
  }));
}
function updateFuturesViewFilter() {
  const field = $("#futuresViewField");
  if (!field) return;
  field.hidden = STATE.section !== "futures";
  if (!field.hidden) renderFuturesViewOptions();
  const compField = $("#futuresCompetitionsField");
  if (!compField) return;
  compField.hidden = STATE.section !== "futures" || STATE.context === "international";
  if (!compField.hidden) renderFuturesSelectionOptions();
}
function loadFuturesSelection() {
  if (STATE.futuresSelection) return STATE.futuresSelection;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("football-futures-selection") || "null"); } catch (_) { saved = null; }
  STATE.futuresSelection = Array.isArray(saved) && saved.length && saved.every((name) => FUTURES_SELECTION_OPTIONS.includes(name))
    ? saved
    : [...FUTURES_SELECTION_OPTIONS];
  return STATE.futuresSelection;
}
function renderFuturesSelectionOptions() {
  const optionsHost = $("#futuresCompetitionsOptions");
  const summary = $("#futuresCompetitionsSummary");
  if (!optionsHost || !summary) return;
  const selection = loadFuturesSelection();
  summary.textContent = selection.length === FUTURES_SELECTION_OPTIONS.length ? "All" : selection.length ? `${selection.length} selected` : "None";
  const group = (label, names) => `<div class="competition-options-group">${esc(label)}</div>${names.map((name) => `<label><input type="checkbox" value="${esc(name)}"${selection.includes(name) ? " checked" : ""}> <span>${esc(name)}</span></label>`).join("")}`;
  optionsHost.innerHTML = group("Leagues", FUTURES_LEAGUE_OPTIONS) + group("Competitions", FUTURES_COMPETITION_OPTIONS);
  optionsHost.querySelectorAll("input").forEach((input) => input.addEventListener("change", () => {
    STATE.futuresSelection = [...optionsHost.querySelectorAll("input:checked")].map((box) => box.value);
    localStorage.setItem("football-futures-selection", JSON.stringify(STATE.futuresSelection));
    renderFuturesSelectionOptions();
    if (STATE.section === "futures") renderSection();
  }));
}

/* ── Analyst Pulse ─────────────────────────────────────────────────────────
   The hero rotates on shared 30-minute boundaries, never with fabricated
   values. Every panel is calculated from the current prediction feed and
   model metadata already used by this workspace. */
const PULSE_INTERVAL_MS = 30 * 60_000;
const shortDateTime = (value) => {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date)
    : "Unavailable";
};
const predictionPick = (prediction) => prediction.prediction === "H"
  ? `${prediction.homeTeam} win`
  : prediction.prediction === "A" ? `${prediction.awayTeam} win` : "Draw";
function pulsePanel(label, title, detail, metrics = []) {
  return `<div class="pulse-head"><span>Analyst Pulse · ${esc(label)}</span></div>
    <div class="pulse-body"><div><strong>${esc(title)}</strong><p>${esc(detail)}</p></div>
    <div class="pulse-metrics">${metrics.map(([value, caption]) => `<span><b>${esc(value)}</b>${esc(caption)}</span>`).join("")}</div></div>`;
}
async function refreshHeroStats() {
  const host = $("#heroStats");
  const context = STATE.context;
  const season = seasonFor();
  const predictionData = STATE.pulseData;
  if (!predictionData || predictionData.context !== context || predictionData.season !== season) {
    host.innerHTML = pulsePanel("Analyst Pulse", "Preparing current slate", "Verified fixture insights will appear when the active prediction board has loaded.", []);
    return;
  }
  const predictions = predictionData.predictions
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const summary = predictionData.summary || {};
  const meta = STATE.pulseMeta;
  if (!meta) {
    apiWithTimeout("/api/meta").then((nextMeta) => {
      STATE.pulseMeta = nextMeta;
      if (STATE.context === context && seasonFor() === season) refreshHeroStats();
    }).catch(() => {});
  }
  const best = [...predictions].sort((a, b) => num(b.confidence) - num(a.confidence))[0];
  const competitions = new Map();
  predictions.forEach((prediction) => {
    const name = prediction.league || prediction.group || "Uncategorised";
    competitions.set(name, (competitions.get(name) || 0) + 1);
  });
  const leadingCompetition = [...competitions.entries()].sort((a, b) => b[1] - a[1])[0];
  const slate = [...predictions].sort((a, b) => num(b.confidence) - num(a.confidence)).slice(0, 3);
  const slateText = slate.length
    ? slate.map((prediction) => `${prediction.homeTeam} vs ${prediction.awayTeam}`).join(" · ")
    : "No upcoming fixtures match the active filters.";
  const slides = [
      best
        ? pulsePanel("Featured prediction", `${best.homeTeam} vs ${best.awayTeam}`, `${predictionPick(best)} · projected ${best.projectedScore || "score unavailable"}`, [[`${Math.round(num(best.confidence))}%`, "confidence"], [formatKickoff(best.date, best.kickoffUtc), "kickoff"]])
        : pulsePanel("Featured prediction", "No featured fixture", "No upcoming fixture is available for the active filters.", [["0", "fixtures"]]),
      pulsePanel("Model health", `${context === "international" ? "International" : "Club"} model active`, `Last trained ${shortDateTime(meta?.trainedAt)}.`, [[String(summary.total ?? predictions.length), "upcoming"], [String(summary.withOdds ?? 0), "market-backed"], [context === "international" ? "International" : "Club", "mode"]]),
      pulsePanel("Competition pulse", leadingCompetition ? `${leadingCompetition[0]} leads the current slate` : "No active competitions", leadingCompetition ? `${leadingCompetition[1]} upcoming fixture${leadingCompetition[1] === 1 ? "" : "s"} in the active filter.` : "Change the filters to broaden the slate.", [[String(competitions.size), "competitions"], [String(predictions.length), "fixtures"]]),
      pulsePanel("Daily slate", slate.length ? `${slate.length} highest-confidence fixtures` : "Daily slate unavailable", slateText, slate.length ? [[`${Math.round(num(slate[0].confidence))}%`, "top confidence"], [slate[0].league || slate[0].group || "Fixture", "leading market"]] : [["—", "top confidence"]]),
  ];
  const slot = Math.floor(Date.now() / PULSE_INTERVAL_MS) % slides.length;
  host.innerHTML = slides[slot];
  if (STATE.pulseTimer) clearTimeout(STATE.pulseTimer);
  const untilNextSlot = PULSE_INTERVAL_MS - (Date.now() % PULSE_INTERVAL_MS) + 100;
  STATE.pulseTimer = window.setTimeout(refreshHeroStats, untilNextSlot);
}

/* ── Router ──────────────────────────────────────────────────────────────── */
function renderSection() {
  if (STATE.liveTimer) { clearInterval(STATE.liveTimer); STATE.liveTimer = null; }
  // Every call gets a fresh token; render functions that accept one should
  // bail out after their first await if a newer render has since started, so
  // a slow/stale in-flight render can never stomp a later one's DOM output.
  const token = (STATE.renderToken = (STATE.renderToken || 0) + 1);
  $("#stage").innerHTML = `<div class="loading"><div class="spinner"></div><span>Loading…</span></div>`;
  if (STATE.context === "international" && !isCurrentInternationalSeason()) {
    $("#stage").innerHTML = `<div class="empty"><b>${esc(STATE.internationalSeason)}</b> is available as historical context. Its fixtures and model cards will appear here after that tournament's verified data feed is imported.</div>`;
    return;
  }
  const map = { predictions: renderPredictions, live: renderLive, parlays: renderParlays, slip: renderSlip,
    teams: renderTeams, players: renderPlayers, futures: renderFutures, tables: renderTables,
    results: renderResults, training: renderTraining, fixtures: renderFixtures, single: renderSingle };
  (map[STATE.section] || renderPredictions)(token).catch((e) => {
    if (token !== STATE.renderToken) return; // a newer render has already taken over
    $("#stage").innerHTML = `<div class="empty">Couldn't load this section: ${esc(e.message)}</div>`;
  });
}
const headEl = (title, sub) => el("div", "section-head", `<h2>${esc(title)}</h2><span class="sub">${esc(sub || "")}</span>`);

/* ── Predictions ─────────────────────────────────────────────────────────── */
async function renderPredictions(token) {
  const intl = STATE.context === "international";
  const url = intl
    ? "/api/international/fixture-predictions"
    : `/api/fixture-predictions?season=${encodeURIComponent(STATE.clubSeason)}`;
  const data = await api(url);
  if (token !== undefined && token !== STATE.renderToken) return; // a newer render has since started
  const preds = filterFootballEntries(data.predictions || []);
  STATE.pulseData = { context: STATE.context, season: seasonFor(), predictions: preds, summary: data.summary || {} };
  refreshHeroStats();
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Upcoming Predictions", `${preds.length} ${competitionLabel()} fixtures · model picks, confidence & odds`));

  // ── Sort + season toolbar ──────────────────────────────────────────────────
  const toolbar = el("div", "pred-toolbar");
  const sortOpts = [
    { k: "confidence", l: "Confidence ↓" },
    { k: "date", l: "Date" },
  ];
  sortOpts.forEach(({ k, l }) => {
    const b = el("button", "sort-btn" + (STATE.sortBy === k ? " is-active" : ""), l); b.type = "button";
    b.onclick = () => { STATE.sortBy = k; renderPredictions(); };
    toolbar.appendChild(b);
  });
  stage.appendChild(toolbar);

  // ── Matchday filter (international only) ──────────────────────────────────
  if (intl) {
    const mds = [...new Set(preds.map((p) => p.matchday).filter(Boolean))].sort((a, b) => a - b);
    if (mds.length) {
      const bar = el("div", "matchday-bar");
      const chip = (v, l) => { const c = el("button", "md-chip" + (String(STATE.matchday) === String(v) ? " is-active" : ""), esc(l)); c.onclick = () => { STATE.matchday = v; renderPredictions(); }; return c; };
      bar.appendChild(chip("all", "All matchdays"));
      mds.forEach((md) => bar.appendChild(chip(md, preds.find((p) => p.matchday === md)?.matchdayLabel || ("Matchday " + md))));
      stage.appendChild(bar);
    }
  }

  let list = preds;
  if (intl && STATE.matchday !== "all") list = preds.filter((p) => p.matchday === STATE.matchday);

  // ── Sort ──────────────────────────────────────────────────────────────────
  list = [...list].sort((a, b) => {
    if (STATE.sortBy === "confidence") return num(b.confidence) - num(a.confidence);
    if (STATE.sortBy === "date") return (a.date || "").localeCompare(b.date || "");
    return (a.league || a.group || "").localeCompare(b.league || b.group || "");
  });

  if (!list.length) {
    stage.appendChild(el("div", "empty", "No upcoming fixtures for this filter."));
    if (intl) await renderRecentInternationalChampion(stage);
    return;
  }
  const grid = el("div", "grid"); list.slice(0, 60).forEach((p) => grid.appendChild(predictionCard(p)));
  stage.appendChild(grid);
}
async function renderRecentInternationalChampion(stage) {
  const champion = await api("/api/international/recent-champion").catch(() => null);
  if (!champion?.winner) return;
  const date = new Date(`${champion.date}T12:00:00Z`);
  const wonOn = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date)
    : champion.date;
  stage.appendChild(el("aside", "recent-champion", `<span>Most recent international tournament</span><strong>${esc(champion.winner)} won ${esc(champion.tournament)}</strong><small>${esc(wonOn)} · Final ${esc(champion.score)}</small>`));
}
function predictionCard(p) {
  const pickLabel = p.prediction === "H" ? `${p.homeTeam} win` : p.prediction === "A" ? `${p.awayTeam} win` : "Draw";
  const pr = p.probabilities || {};
  const h = Math.round(pr.homeWinPct ?? 0), d = Math.round(pr.drawPct ?? 0), a = Math.round(pr.awayWinPct ?? 0);
  const o = p.odds || {};
  const card = el("article", "card");
  card.dataset.pick = p.prediction || "";
  if (num(p.confidence) >= 55) card.classList.add("high-conf");
  card.innerHTML = `
    <div class="card-top"><span>${esc(p.matchdayLabel || p.league || p.group || "Fixture")} · ${esc(formatKickoff(p.date, p.kickoffUtc))}</span><span class="pill ${p.prediction === "D" ? "draw" : "pick"}">${esc(pickLabel)} · ${esc(String(p.confidence ?? ""))}%</span></div>
    <div class="match"><div class="team">${STATE.context === "club" ? clubCrest(p.homeTeam, p.homeLogoUrl, p.league) : flag(p.homeFlagUrl, p.homeTeam)}<span class="tn">${esc(p.homeTeam)}</span></div><div class="vs">vs</div><div class="team">${STATE.context === "club" ? clubCrest(p.awayTeam, p.awayLogoUrl, p.league) : flag(p.awayFlagUrl, p.awayTeam)}<span class="tn">${esc(p.awayTeam)}</span></div></div>
    <div class="conf-bar"><i class="conf-h" style="width:${h}%"></i><i class="conf-d" style="width:${d}%"></i><i class="conf-a" style="width:${a}%"></i></div>
    <div class="conf-legend"><span>H ${h}%</span><span>D ${d}%</span><span>A ${a}%</span></div>
    <div class="proj">Projected score <b>${esc(p.projectedScore || "—")}</b></div>
    <div class="odds-row">${oddChip("1", o.homeOdds, p.prediction === "H")}${oddChip("X", o.drawOdds, p.prediction === "D")}${oddChip("2", o.awayOdds, p.prediction === "A")}</div>`;
  return card;
}
const oddChip = (l, v, best) => `<div class="odds-chip${best ? " best" : ""}">${l}<b>${v ? esc(v) : "—"}</b></div>`;
function formatKickoff(date, kickoffUtc) { const parsed = new Date(kickoffUtc || date || ""); return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed) : String(date || "TBD"); }

/* ── Live Now ────────────────────────────────────────────────────────────── */
async function renderLive() {
  const paint = async () => {
    const data = await api("/api/international/live");
    const stage = $("#stage"); const matches = data.matches || []; stage.innerHTML = "";
    stage.appendChild(headEl("", ""));
    $(".section-head h2", stage).innerHTML = `<span class="live-badge"><span class="live-dot"></span>Live Now</span>`;
    $(".section-head .sub", stage).textContent = matches.length ? `${matches.length} in progress · auto-refresh 30s` : "no matches in progress";
    if (!matches.length) { stage.appendChild(el("div", "empty", "No World Cup matches are live right now. This view — and the goal celebration — fire automatically when one kicks off.")); return; }
    const grid = el("div", "grid");
    matches.forEach((m) => {
      const pl = m.prediction === "H" ? `${m.homeTeam} win` : m.prediction === "A" ? `${m.awayTeam} win` : m.prediction === "D" ? "Draw" : "—";
      const track = m.pickTrackingLive === true ? `<span style="color:var(--good);font-weight:700">pick ahead ✓</span>` : m.pickTrackingLive === false ? `<span style="color:var(--bad)">pick behind</span>` : "";
      const c = el("article", "card");
      c.innerHTML = `<div class="card-top"><span>${esc(m.matchdayLabel || m.group || "World Cup")}</span><span class="live-badge"><span class="live-dot"></span>${esc(m.clock || "LIVE")}</span></div>
        <div class="match"><div class="team">${flag(m.homeFlagUrl, m.homeTeam)}<span class="tn">${esc(m.homeTeam)}</span></div><div class="score"><span class="live">${m.homeGoals ?? "-"}</span> : <span class="live">${m.awayGoals ?? "-"}</span></div><div class="team">${flag(m.awayFlagUrl, m.awayTeam)}<span class="tn">${esc(m.awayTeam)}</span></div></div>
        <div class="proj">Model: <b>${esc(pl)}</b>${m.confidence != null ? ` (${Math.round(m.confidence)}%)` : ""} · proj ${esc(m.projectedScore || "—")} ${track}</div>`;
      grid.appendChild(c);
    });
    stage.appendChild(grid);
  };
  await paint();
  STATE.liveTimer = setInterval(() => { if (STATE.section === "live") paint().catch(() => {}); }, 30000);
}

/* ── Parlays ─────────────────────────────────────────────────────────────── */
async function renderParlays() {
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Multi-Leg Parlays", "model-built tickets · player props + match picks"));
  const controls = el("div", "controls");
  controls.innerHTML = `
    <label>Legs<select id="pLegs"><option>4</option><option selected>6</option><option>8</option><option>10</option></select></label>
    <label>Tickets<select id="pTickets"><option>1</option><option selected>2</option><option>3</option></select></label>
    <span class="toggle" id="pRisk"><button data-r="safe" class="on">Safe</button><button data-r="risky">Risk</button></span>
    <button class="btn" id="pGo">Generate ⚡</button>`;
  stage.appendChild(controls);
  const out = el("div", "grid"); out.id = "parlayOut"; stage.appendChild(out);
  $("#pRisk").querySelectorAll("button").forEach((b) => b.onclick = () => { STATE.parlayRisk = b.dataset.r; $("#pRisk").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); });
  const gen = async () => {
    out.innerHTML = `<div class="loading"><div class="spinner"></div><span>Building tickets…</span></div>`;
    const legs = $("#pLegs").value, tickets = $("#pTickets").value;
  const url = `/api/parlay?context=${STATE.context}&league=${STATE.context === "international" ? "International" : encodeURIComponent(selectedLeague())}&legs=${legs}&tickets=${tickets}&type=mixed&riskMode=${STATE.parlayRisk}&generationMode=multi`;
    try {
      const data = await api(url);
      const parlays = data.parlays || [];
      out.innerHTML = "";
      if (!parlays.length) { out.innerHTML = `<div class="empty">No parlays available right now.</div>`; return; }
      parlays.forEach((p, i) => out.appendChild(parlayCard(p, i)));
    } catch (e) { out.innerHTML = `<div class="empty">Couldn't build parlays: ${esc(e.message)}</div>`; }
  };
  $("#pGo").onclick = gen;
  gen();
}
function parlayCard(p, i) {
  const legs = p.legs || [];
  const combined = legs.reduce((a, l) => a * (num(l.decimalOdds, 1) || 1), 1);
  const c = el("article", "card");
  c.innerHTML = `<div class="card-top"><span>Ticket ${i + 1}${p.riskMode === "risky" ? " · risk" : ""}</span><span class="pill">${Math.round(p.averageConfidence || 0)}% avg</span></div>
    <ul class="legs">${legs.map(legRow).join("")}</ul>
    <div class="parlay-foot"><div><div class="lbl">${legs.length} legs · combined</div></div><div class="odds">${combined.toFixed(2)}×</div></div>`;
  return c;
}
const legRow = (l) => `<li class="leg"><div><span class="leg-type">${esc((l.type || "").slice(0, 4))}</span><span class="lp">${esc(l.pick || l.market)}</span><div class="lm">${esc(l.fixture || "")}${l.confidence ? " · " + Math.round(l.confidence) + "%" : ""}</div></div><span class="lo">${num(l.decimalOdds) ? num(l.decimalOdds).toFixed(2) : "—"}</span></li>`;

/* ── Daily Slip & Capital ────────────────────────────────────────────────── */
async function renderSlip() {
  const data = await api("/api/international/daily-slip");
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Daily Slip & Capital", "highest-confidence slip · compounding bankroll"));
  const growth = data.startingBankroll ? Math.round(((data.bankroll - data.startingBankroll) / data.startingBankroll) * 100) : 0;
  const kpis = el("div", "kpi-grid");
  kpis.innerHTML = `<div class="kpi gold"><b>${esc(String(data.bankroll))}</b><span>Bankroll (${esc(data.currency || "units")})</span></div>
    <div class="kpi ${growth >= 0 ? "good" : ""}"><b>${growth >= 0 ? "+" : ""}${growth}%</b><span>Growth</span></div>
    <div class="kpi"><b>${esc(String(data.startingBankroll ?? 100))}</b><span>Starting</span></div>
    <div class="kpi"><b>${(data.slips || []).length}</b><span>Slips tracked</span></div>`;
  stage.appendChild(kpis);
  const t = data.today;
  if (t) {
    const c = el("article", "card");
    c.innerHTML = `<div class="card-top"><span>Today's slip · ${esc(t.date)}</span><span class="pill pick">${t.legCount} legs @ ${num(t.combinedOdds).toFixed(2)}×</span></div>
      <ul class="legs">${(t.legs || []).map((l) => `<li class="leg"><div><span class="lp">${esc(l.pick)}</span><div class="lm">${esc(l.fixture)}${l.confidence ? " · " + Math.round(l.confidence) + "%" : ""}</div></div><span class="lo">${num(l.decimalOdds).toFixed(2)}</span></li>`).join("")}</ul>
      <div class="parlay-foot"><div><div class="lbl">Stake ${esc(String(t.stake))} → potential</div></div><div class="odds">${esc(String(t.potentialReturn))}</div></div>`;
    stage.appendChild(c);
  } else { stage.appendChild(el("div", "empty", data.note || "No slip yet — rolls when fixtures qualify.")); }
  const settled = (data.slips || []).filter((s) => s.status !== "PENDING");
  if (settled.length) {
    const h = el("div", "section-head", `<h2 style="font-size:18px">Slip history</h2>`); stage.appendChild(h);
    const grid = el("div", "grid");
    settled.slice(0, 12).forEach((s) => {
      const won = s.status === "WON";
      const c = el("article", "card");
      c.innerHTML = `<div class="card-top"><span>${esc(s.date)}</span><span class="pill" style="background:${won ? "rgba(74,222,128,.2)" : "rgba(248,113,113,.2)"};color:${won ? "var(--good)" : "var(--bad)"}">${esc(s.status)}</span></div>
        <div class="proj">${s.legCount} legs @ ${num(s.combinedOdds).toFixed(2)}× · stake ${esc(String(s.stake))} · ${won ? "profit +" + esc(String(s.profit)) : "−" + esc(String(s.stake))} · bankroll → <b>${esc(String(s.bankrollAfter))}</b></div>`;
      grid.appendChild(c);
    });
    stage.appendChild(grid);
  }
}

/* ── Team Profiles ───────────────────────────────────────────────────────── */
async function renderTeams() {
  const data = await api(`/api/team-profiles?season=${encodeURIComponent(seasonFor())}&context=${STATE.context}`);
  const profiles = data.profiles || [];
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Team Profiles", `${profiles.length} teams · ${STATE.context === "international" ? "live World Cup match stats" : "season form"}`));
  const grid = el("div", "grid");
  profiles.forEach((p) => {
    const t = p.totals || {};
    const last = (p.latestEntries || []).slice(0, 5);
    const c = el("article", "card");
    c.innerHTML = `<div class="card-top"><span>${esc(p.league)}</span><span class="formchips">${last.map((e) => `<span class="fc ${esc(e.result)}">${esc(e.result)}</span>`).join("") || ""}</span></div>
      <div class="pcard">${flag(null, p.displayName || p.team)}<div class="pmeta"><b>${esc(p.displayName || p.team)}</b><span>${esc(p.importedBaseline?.source || "")}</span></div></div>
      <div class="pstats">
        <div class="pstat"><b>${t.matches || 0}</b><span>matches</span></div>
        <div class="pstat"><b>${(t.pointsPerGame || 0).toFixed(2)}</b><span>PPG</span></div>
        <div class="pstat"><b>${(t.goalsForPerGame || 0).toFixed(1)}</b><span>GF/g</span></div>
        <div class="pstat"><b>${(t.shotsForPerGame || 0).toFixed(1)}</b><span>shots/g</span></div>
        <div class="pstat"><b>${(t.sotForPerGame || 0).toFixed(1)}</b><span>SOT/g</span></div>
        <div class="pstat"><b>${Math.round((t.cleanSheetRate || 0) * 100)}%</b><span>clean sheet</span></div>
      </div>`;
    grid.appendChild(c);
  });
  stage.appendChild(grid);
}

/* ── Player Profiles ─────────────────────────────────────────────────────── */
async function renderPlayers() {
  const data = await api(`/api/player-profiles?season=${encodeURIComponent(seasonFor())}&context=${STATE.context}`);
  const profiles = data.profiles || [];
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Player Profiles", `${profiles.length} players · goals, assists & shot output`));
  const grid = el("div", "grid");
  profiles.forEach((p) => {
    const t = p.totals || {};
    const c = el("article", "card");
    c.innerHTML = `<div class="card-top"><span>${esc(p.team)}</span><span class="pill">${esc(p.role || p.position || "")}</span></div>
      <div class="pcard">${p.photoUrl ? `<img class="photo" src="${esc(p.photoUrl)}" alt="" onerror="this.style.visibility='hidden'">` : `<div class="photo"></div>`}<div class="pmeta"><b>${esc(p.displayName || p.player)}</b><span>${esc(p.team)}</span></div></div>
      <div class="pstats">
        <div class="pstat"><b>${num(t.goals)}</b><span>goals</span></div>
        <div class="pstat"><b>${num(t.assists)}</b><span>assists</span></div>
        <div class="pstat"><b>${num(t.shots)}</b><span>shots</span></div>
        <div class="pstat"><b>${num(t.goalsPer90).toFixed(2)}</b><span>G/90</span></div>
        <div class="pstat"><b>${num(t.assistsPer90).toFixed(2)}</b><span>A/90</span></div>
        <div class="pstat"><b>${num(t.appearances || t.nineties)}</b><span>apps</span></div>
      </div>`;
    grid.appendChild(c);
  });
  if (!profiles.length) stage.appendChild(el("div", "empty", "No player profiles for this context yet."));
  else stage.appendChild(grid);
}

/* ── Futures (standings + fluid bracket + player markets) ───────────────── */
const miniBadge = (src, name) => {
  const fallback = initialsDataUri(name);
  return src
    ? `<img class="crest-sm" src="${esc(src)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'">`
    : `<img class="crest-sm" src="${fallback}" alt="" loading="lazy">`;
};
const clubBadge = (team) => miniBadge(team ? `/api/club-crest?team=${encodeURIComponent(team)}` : "", team);
const formChips = (form) => `<span class="form-chips">${(form || []).map((f) => `<span class="form-chip ${esc(f)}">${esc(f)}</span>`).join("")}</span>`;
function loadFuturesView() {
  if (STATE.futuresView) return STATE.futuresView;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("football-futures-view") || "null"); } catch (_) { saved = null; }
  const valid = FUTURES_VIEW_OPTIONS.map((o) => o.id);
  STATE.futuresView = Array.isArray(saved) && saved.length && saved.every((id) => valid.includes(id)) ? saved : [...valid];
  return STATE.futuresView;
}
function pickCategory(pick) {
  const m = (pick.market || "").toLowerCase();
  if (m.includes("clean sheet")) return "cleanSheets";
  if (m.includes("assist")) return "assists";
  if (m.includes("scorer") || m.includes("scoring")) return "scorers";
  return "winner";
}
function pickTeamGuess(pick, category) {
  if (category === "winner") return pick.label;
  const m = /^([^:]+):/.exec(pick.detail || "");
  return m ? m[1].trim() : "";
}
function deriveRounds(payload) {
  if (Array.isArray(payload?.rounds) && payload.rounds.length) return payload.rounds;
  const bracket = payload?.bracket || {};
  const order = ["r32", "r16", "qf", "sf", "finalFour", "thirdPlace", "final"];
  const keys = Object.keys(bracket).filter((k) => bracket[k]);
  const ordered = order.filter((k) => keys.includes(k));
  const extra = keys.filter((k) => !order.includes(k));
  return [...ordered, ...extra].map((id) => ({ id, ...bracket[id] }));
}
function bracketSlot(raw) {
  if (raw && typeof raw === "object") return { team: raw.team || raw.name || "TBD", flag: raw.flag || null };
  return { team: raw || "TBD", flag: null };
}
function renderBracketBlock(payload, crestFn) {
  const rounds = deriveRounds(payload);
  if (!rounds.length) return null;
  const wrap = el("div");
  if (payload.champion?.team) {
    wrap.appendChild(el("div", "champion", `<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">${esc(payload.championLabel || "Projected champion")}</div><div class="ct">${esc(payload.champion.team)}</div>`));
  }
  const track = el("div", "bracket");
  rounds.forEach((round) => {
    const col = el("div", "bround", `<h4>${esc(round.label || round.id)}</h4>`);
    (round.matches || []).forEach((m) => {
      const home = bracketSlot(m.home), away = bracketSlot(m.away);
      // Bracket sources disagree on shape: club/international bracket winners
      // are team-name strings with homeWinPct/awayWinPct; domestic cup
      // brackets return a {team} winner object with homeProb/awayProb.
      const winnerTeam = m.winner && typeof m.winner === "object" ? m.winner.team : m.winner;
      const homePct = m.homeWinPct ?? m.homeProb;
      const awayPct = m.awayWinPct ?? m.awayProb;
      const box = el("div", "bmatch");
      box.innerHTML = `<div class="bmatch-card">
        <div class="bslot${winnerTeam && winnerTeam === home.team ? " win" : ""}">${crestFn(home)}<span class="bslot-name">${esc(home.team)}</span><span class="bslot-pct">${homePct != null ? Math.round(homePct) + "%" : ""}</span></div>
        <div class="bslot${winnerTeam && winnerTeam === away.team ? " win" : ""}">${crestFn(away)}<span class="bslot-name">${esc(away.team)}</span><span class="bslot-pct">${awayPct != null ? Math.round(awayPct) + "%" : ""}</span></div>
        ${m.score ? `<div class="bmatch-score">${esc(m.score)}</div>` : ""}</div>`;
      col.appendChild(box);
    });
    if (!round.matches?.length && round.advancers?.length) {
      round.advancers.forEach((a) => {
        const slot = bracketSlot(a);
        col.appendChild(el("div", "bmatch", `<div class="bmatch-card"><div class="bslot win">${crestFn(slot)}<span class="bslot-name">${esc(slot.team)}</span></div></div>`));
      });
    }
    track.appendChild(col);
  });
  wrap.appendChild(track);
  if (payload.disclaimer) wrap.appendChild(el("div", "lm", esc(payload.disclaimer)));
  return wrap;
}
function bracketEndpointFor(name) {
  if (CLUB_COMP_BRACKET_IDS[name]) return { title: name, url: `/api/futures-bracket/${CLUB_COMP_BRACKET_IDS[name]}`, crestFn: (slot) => clubBadge(slot.team) };
  if (DOMESTIC_CUP_BRACKET_IDS[name]) return { title: name, url: `/api/cup-bracket/${DOMESTIC_CUP_BRACKET_IDS[name]}`, crestFn: (slot) => clubBadge(slot.team) };
  return null;
}
function renderStandingsCard(section) {
  const rows = section.projectedTable || [];
  if (!rows.length) return null;
  const zoneLegend = { CL: ["Champions League", "var(--good)"], EL: ["Europa League", "var(--ox)"], CONF: ["Conference League", "var(--amber)"], PO: ["Promotion play-off", "var(--muted)"], REL: ["Relegation", "var(--bad)"] };
  const usedZones = [...new Set(rows.map((r) => r.zone).filter(Boolean))];
  const body = rows.map((r) => `
    <tr class="${r.zone ? "zone-" + r.zone : ""}">
      <td><span class="rk">${r.rank}</span></td>
      <td class="team-cell">${clubBadge(r.team)}<span>${esc(r.team)}${r.promoted ? ' <small style="color:var(--muted);font-weight:500">(promoted)</small>' : ""}</span></td>
      <td>${num(r.played)}</td><td>${num(r.wins)}</td><td>${num(r.draws)}</td><td>${num(r.losses)}</td>
      <td>${num(r.goalsFor)}</td><td>${num(r.goalsAgainst)}</td><td>${num(r.goalDifference) > 0 ? "+" : ""}${num(r.goalDifference)}</td>
      <td><b>${num(r.points)}</b></td>
      <td>${formChips(r.form)}</td>
    </tr>`).join("");
  const card = el("article", "card");
  card.innerHTML = `<div class="card-top"><span>${esc(section.title)}</span></div>
    <div class="lm" style="margin-bottom:8px">${esc(section.subtitle || "")}</div>
    ${section.methodology ? `<div class="futures-methodology"><b>Projection formula:</b> ${esc(section.methodology)}</div>` : ""}
    <div class="standings-wrap"><table class="table standings">
      <thead><tr><th>#</th><th>Team</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    ${usedZones.length ? `<div class="standings-legend">${usedZones.map((z) => `<span><i style="background:${(zoneLegend[z] || [])[1] || "var(--muted)"}"></i>${esc((zoneLegend[z] || [])[0] || z)}</span>`).join("")}</div>` : ""}`;
  return card;
}
function renderPickListCard(title, picks, category) {
  if (!picks.length) return null;
  const rows = picks.slice(0, 15).map((pk) => {
    const team = pickTeamGuess(pk, category);
    const hasProjection = pk.projected != null;
    const stat = hasProjection
      ? `<span class="fut-stat"><b>${esc(String(pk.projected))}</b><small>${esc(pk.unit || "")}</small></span>`
      : `<span class="fut-conf-bar"><i style="width:${Math.min(100, num(pk.confidence))}%"></i></span><span class="fut-conf">${num(pk.confidence)}%</span>`;
    return `
    <div class="fut-pick">${clubBadge(team)}<span class="fut-rank">${pk.rank}</span>
      <span class="fut-label">${esc(pk.label)}<span class="fut-detail">${esc(pk.detail || "")}</span></span>
      ${stat}</div>`;
  }).join("");
  const card = el("article", "card");
  card.innerHTML = `<div class="card-top"><span>${esc(title)}</span></div>${rows}`;
  return card;
}
function renderSectionCards(stage, sec, view) {
  let rendered = false;
  if (view.includes("standings") && sec.type === "league-table") {
    const card = renderStandingsCard(sec);
    if (card) { stage.appendChild(card); rendered = true; }
  }
  const byCategory = { scorers: [], assists: [], cleanSheets: [] };
  (sec.picks || []).forEach((pk) => { const cat = pickCategory(pk); if (byCategory[cat]) byCategory[cat].push(pk); });
  const wantedGroups = [
    ["scorers", `${sec.title} — Projected Top Scorers`],
    ["assists", `${sec.title} — Projected Top Assists`],
    ["cleanSheets", `${sec.title} — Projected Clean Sheets`],
  ];
  wantedGroups.forEach(([key, title]) => {
    if (!view.includes(key)) return;
    const card = renderPickListCard(title, byCategory[key], key);
    if (card) { stage.appendChild(card); rendered = true; }
  });
  return rendered;
}
async function renderFutures(token) {
  const stale = () => token !== undefined && token !== STATE.renderToken;
  const intl = STATE.context === "international";
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Futures", "projected standings, brackets, top scorer, top assist & clean sheet markets"));

  const view = loadFuturesView();
  updateFuturesViewFilter();

  if (intl) {
    // International keeps a single World Cup context (no multi-competition
    // selection applies here).
    const data = await api(`/api/futures?context=international&season=${encodeURIComponent(seasonFor())}&league=International`);
    if (stale()) return; // a newer render has since started
    if (data.unavailable) { stage.appendChild(el("div", "empty", data.message || "Futures unavailable right now.")); return; }
    if (view.includes("bracket")) {
      const bracketMount = el("div");
      stage.appendChild(bracketMount);
      api("/api/international/bracket").then((br) => {
        if (stale()) return;
        const block = renderBracketBlock(br, (slot) => miniBadge(slot.flag, slot.team));
        if (block) { bracketMount.appendChild(el("div", "section-head", `<h2 style="font-size:18px">World Cup — Bracket Projection</h2>`)); bracketMount.appendChild(block); }
      }).catch(() => {});
    }
    let anyContent = false;
    (data.sections || []).forEach((sec) => { if (renderSectionCards(stage, sec, view)) anyContent = true; });
    if (!anyContent) stage.appendChild(el("div", "empty", data.message || "No futures markets available yet."));
    return;
  }

  // Club context: users can select any combination of leagues and knockout
  // competitions at once (see the "Show" filter), so the page can display
  // several bracket projections and several league standings together.
  const selection = loadFuturesSelection();
  const data = await api(`/api/futures?context=club&season=${encodeURIComponent(seasonFor())}&league=All`);
  if (stale()) return; // a newer render has since started
  if (data.unavailable) { stage.appendChild(el("div", "empty", data.message || "Futures unavailable right now.")); return; }
  if (!selection.length) { stage.appendChild(el("div", "empty", "Select at least one league or competition in Filters → Show.")); return; }

  // Brackets — one block per selected knockout competition, fetched in
  // parallel (all cache-first server-side) but appended in selection order.
  const bracketTargets = selection.map(bracketEndpointFor).filter(Boolean);
  if (view.includes("bracket") && bracketTargets.length) {
    const mounts = bracketTargets.map(() => el("div"));
    mounts.forEach((mount) => stage.appendChild(mount));
    await Promise.all(bracketTargets.map((target, index) =>
      api(target.url).then((br) => {
        if (stale()) return;
        const block = renderBracketBlock(br, target.crestFn);
        if (block) {
          mounts[index].appendChild(el("div", "section-head", `<h2 style="font-size:18px">${esc(target.title)} — Bracket Projection</h2>`));
          mounts[index].appendChild(block);
        }
      }).catch(() => {})
    ));
  }

  let anyContent = false;
  (data.sections || []).forEach((sec) => {
    const matchedLeague = FUTURES_LEAGUE_OPTIONS.find((name) => sec.type === "league-table" && sec.title.startsWith(`${name} —`));
    const matchedComp = ["Champions League", "Europa League", "Conference League"].find((name) => sec.title === `${name} Futures`);
    const matchedName = matchedLeague || matchedComp;
    if (!matchedName || !selection.includes(matchedName)) return;
    if (renderSectionCards(stage, sec, view)) anyContent = true;
  });
  if (!anyContent && !(view.includes("bracket") && bracketTargets.length)) {
    stage.appendChild(el("div", "empty", "No futures markets for this selection yet — try a different combination in Filters → Show."));
  }
}

/* ── Tables ──────────────────────────────────────────────────────────────── */
async function renderTables() {
  const stage = $("#stage");
  if (STATE.context === "international") {
    const data = await api("/api/international/group-tables");
    stage.innerHTML = ""; stage.appendChild(headEl("Group Tables", "live standings · auto-built from settled results"));
    const grid = el("div", "grid");
    (data.groups || []).forEach((g) => {
      const rows = (g.standings || []).map((r, i) => `<tr class="${i < 2 ? "adv" : ""}"><td><span class="rk">${i + 1}</span></td><td>${esc(r.team)}</td><td>${r.played}</td><td>${r.wins}-${r.draws}-${r.losses}</td><td>${r.goalsFor}:${r.goalsAgainst}</td><td><b>${r.points}</b></td></tr>`).join("");
      const c = el("article", "card");
      c.innerHTML = `<div class="card-top"><span>Group ${esc(g.group)}</span><span>${g.appliedResults || 0} played</span></div><table class="table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W-D-L</th><th>GF:GA</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>`;
      grid.appendChild(c);
    });
    stage.appendChild(grid); return;
  }
  if (STATE.competitionType === "competition") {
    const stage = $("#stage"); stage.innerHTML = "";
    stage.appendChild(headEl("Competition workspace", `${competitionLabel()} is a knockout competition`));
    stage.appendChild(el("div", "empty", "League tables do not apply to knockout competitions. Use Fixtures, Futures, and Results to follow rounds, ties, and tournament outcomes."));
    return;
  }
  const data = await api(`/api/league-tables?season=${encodeURIComponent(seasonFor())}`).catch(() => null);
  stage.innerHTML = ""; stage.appendChild(headEl("League Tables", "current standings"));
  const leagues = data?.leagues ? Object.entries(data.leagues).filter(([name]) => STATE.competitions.includes("All Leagues") || STATE.competitions.includes(name)) : [];
  if (!leagues.length) { stage.appendChild(el("div", "empty", "League tables unavailable right now.")); return; }
  const grid = el("div", "grid");
  leagues.forEach(([name, lg]) => {
    const rows = (lg.standings || []).slice(0, 20).map((r, i) => `<tr><td><span class="rk">${i + 1}</span></td><td class="table-team"><div class="team">${clubCrest(r.team, "", name)}<span class="tn">${esc(r.team)}</span></div></td><td>${r.played}</td><td>${r.goalsFor}:${r.goalsAgainst}</td><td><b>${r.points}</b></td></tr>`).join("");
    const c = el("article", "card");
    c.innerHTML = `<div class="card-top"><span>${esc(name)}</span></div><table class="table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>GF:GA</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>`;
    grid.appendChild(c);
  });
  stage.appendChild(grid);
}

/* ── Results ─────────────────────────────────────────────────────────────── */
async function renderResults() {
  const intl = STATE.context === "international";
  const data = await api(intl ? "/api/played-fixtures?context=international" : `/api/played-fixtures?context=club&season=${encodeURIComponent(STATE.clubSeason)}`);
  const preds = filterFootballEntries(data.predictions || []).filter((p) => p.played);
  const stage = $("#stage"); stage.innerHTML = ""; const s = data.summary || {};
  stage.appendChild(headEl("Results", `${s.total || preds.length} settled · model ${s.correct ?? "—"}/${s.total ?? "—"}${s.exactScores ? " · " + s.exactScores + " exact" : ""}`));
  if (!preds.length) { stage.appendChild(el("div", "empty", "No completed matches yet — results appear automatically as games finish.")); return; }
  const grid = el("div", "grid");
  preds.slice(0, 80).forEach((p) => {
    const pl = p.played || {}; const ok = pl.modelCorrect === true, wrong = pl.modelCorrect === false;
    const verdict = ok ? `<span class="pill" style="background:rgba(74,222,128,.2);color:var(--good)">Model ✓</span>` : wrong ? `<span class="pill" style="background:rgba(248,113,113,.2);color:var(--bad)">Model ✗</span>` : `<span class="pill">—</span>`;
    const pk = p.prediction === "H" ? `${p.homeTeam} win` : p.prediction === "A" ? `${p.awayTeam} win` : p.prediction === "D" ? "Draw" : "result";
    const c = el("article", "card");
    c.innerHTML = `<div class="card-top"><span>${esc(p.matchdayLabel || p.league || "")} · ${esc(p.date || "")}</span>${verdict}</div>
      <div class="match"><div class="team">${intl ? flag(p.homeFlagUrl, p.homeTeam) : clubCrest(p.homeTeam, p.homeLogoUrl, p.league)}<span class="tn">${esc(p.homeTeam)}</span></div><div class="score">${esc(String(pl.homeGoals))} : ${esc(String(pl.awayGoals))}</div><div class="team">${intl ? flag(p.awayFlagUrl, p.awayTeam) : clubCrest(p.awayTeam, p.awayLogoUrl, p.league)}<span class="tn">${esc(p.awayTeam)}</span></div></div>
      <div class="proj">Model: <b>${esc(pk)}</b>${p.confidence != null ? ` (${esc(String(p.confidence))}%)` : ""} · proj ${esc(p.projectedScore || "—")}${pl.exactScoreCorrect ? " · exact ✓" : ""}</div>`;
    grid.appendChild(c);
  });
  stage.appendChild(grid);
}

/* ── Model Training ──────────────────────────────────────────────────────── */
async function renderTraining() {
  const acc = await api("/api/international/training-accuracy");
  const L = acc.latest || {}; const live = acc.live || {};
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Model Training", "24/7 auto-tuning · target 75% high-confidence by matchday 4"));
  const hi = L.highConfidenceAccuracy != null ? Math.round(L.highConfidenceAccuracy * 100) : 0;
  const target = Math.round((acc.target || 0.75) * 100);
  const kpis = el("div", "kpi-grid");
  kpis.innerHTML = `<div class="kpi ${hi >= target ? "good" : ""}"><b>${hi}%</b><span>High-conf accuracy</span></div>
    <div class="kpi"><b>${L.tunedRawAccuracy != null ? Math.round(L.tunedRawAccuracy * 100) + "%" : "—"}</b><span>Raw 1X2</span></div>
    <div class="kpi"><b>${L.tunedMacroF1 != null ? L.tunedMacroF1.toFixed(3) : "—"}</b><span>Macro-F1</span></div>
    <div class="kpi gold"><b>${L.drawsPredicted ?? "—"}</b><span>Draws predicted</span></div>
    <div class="kpi"><b>MD ${L.currentMatchday ?? live.currentMatchday ?? 1}/${L.targetMatchday ?? 4}</b><span>Matchday</span></div>
    <div class="kpi"><b>${L.corpusSize ?? "—"}</b><span>Training matches</span></div>`;
  stage.appendChild(kpis);
  const card = el("article", "card");
  card.innerHTML = `<div class="card-top"><span>Progress to ${target}% target</span><span class="pill ${L.targetMet ? "pick" : ""}">${L.targetMet ? "✓ met" : "in progress"}</span></div>
    <div class="progress"><i style="width:${Math.min(100, Math.round((hi / target) * 100))}%"></i></div>
    <div class="proj">High-confidence picks (≥${L.highConfidenceThreshold || 55}%): <b>${L.highConfidencePicks ?? 0}</b> staked · live WC record ${live.correct ?? "—"}/${live.matchdayResults ?? "—"} · draw recall ${L.drawRecall != null ? Math.round(L.drawRecall * 100) + "%" : "—"} · last tuned ${esc((acc.tuning?.tunedBy || "").replace("auto-tune:", "") || "—")}</div>`;
  stage.appendChild(card);
}

/* ── International Fixtures ───────────────────────────────────────────────── */
async function renderFixtures() {
  if (STATE.context === "club") {
    const data = await api(`/api/fixture-predictions?season=${encodeURIComponent(STATE.clubSeason)}`);
    const fixtures = filterFootballEntries(data.predictions || []);
    const stage = $("#stage"); stage.innerHTML = "";
    stage.appendChild(headEl("Fixtures", `${fixtures.length} scheduled ${competitionLabel()} matches`));
    if (!fixtures.length) { stage.appendChild(el("div", "empty", `No ${competitionLabel()} fixtures are available for ${STATE.clubSeason} yet.`)); return; }
    const grid = el("div", "grid");
    fixtures.slice(0, 120).forEach((fixture) => {
      const c = el("article", "card");
      c.innerHTML = `<div class="card-top"><span>${esc(fixture.league || "")}</span><span>${esc(fixture.date || "")}</span></div><div class="match"><div class="team">${flag(fixture.homeFlagUrl || fixture.homeLogoUrl, fixture.homeTeam)}<span class="tn">${esc(fixture.homeTeam)}</span></div><div class="vs">vs</div><div class="team">${flag(fixture.awayFlagUrl || fixture.awayLogoUrl, fixture.awayTeam)}<span class="tn">${esc(fixture.awayTeam)}</span></div></div>`;
      grid.appendChild(c);
    });
    stage.appendChild(grid);
    return;
  }
  const data = await api("/api/international/fixtures");
  const fixtures = data.fixtures || [];
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Fixtures", `${fixtures.length} upcoming World Cup matches`));
  const byDate = {};
  fixtures.forEach((f) => { (byDate[f.date] = byDate[f.date] || []).push(f); });
  Object.keys(byDate).sort().forEach((date) => {
    stage.appendChild(el("div", "section-head", `<h2 style="font-size:16px">${esc(date)}</h2><span class="sub">${byDate[date].length} matches</span>`));
    const grid = el("div", "grid");
    byDate[date].forEach((f) => {
      const c = el("article", "card");
      c.innerHTML = `<div class="card-top"><span>${esc(f.group || "")}</span><span>${esc((f.kickoffLocal || f.kickoffUtc || "").slice(11, 16) || "")}</span></div>
        <div class="match"><div class="team">${flag(f.homeFlagUrl, f.homeTeam)}<span class="tn">${esc(f.homeTeam)}</span></div><div class="vs">vs</div><div class="team">${flag(f.awayFlagUrl, f.awayTeam)}<span class="tn">${esc(f.awayTeam)}</span></div></div>
        <div class="proj" style="text-align:center">${esc(f.venue || "")}${f.city ? " · " + esc(f.city) : ""}</div>`;
      grid.appendChild(c);
    });
    stage.appendChild(grid);
  });
}

/* ── Single Predictor ────────────────────────────────────────────────────── */
async function renderSingle() {
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Single Predictor", "pick any two teams · instant model projection"));
  let teams = [];
  const teamInfo = new Map();
  const rememberTeam = (team, info) => { if (team && !teamInfo.has(team)) teamInfo.set(team, info); };
  try {
    if (STATE.context === "international") {
      const data = await api("/api/international/fixtures");
      teams = data.teams || [];
      (data.fixtures || []).forEach((fixture) => {
        rememberTeam(fixture.homeTeam, { flagUrl: fixture.homeFlagUrl, league: seasonFor() });
        rememberTeam(fixture.awayTeam, { flagUrl: fixture.awayFlagUrl, league: seasonFor() });
      });
    }
    else {
      const data = await api(`/api/fixture-predictions?season=${encodeURIComponent(STATE.clubSeason)}`);
      const fixtures = filterFootballEntries(data.predictions || []);
      teams = [...new Set(fixtures.flatMap((p) => [p.homeTeam, p.awayTeam]))];
      fixtures.forEach((fixture) => {
        rememberTeam(fixture.homeTeam, { crestUrl: fixture.homeLogoUrl, league: fixture.league });
        rememberTeam(fixture.awayTeam, { crestUrl: fixture.awayLogoUrl, league: fixture.league });
      });
    }
    teams = [...new Set(teams)].sort();
  } catch (_) {}
  const opts = teams.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  const scope = STATE.context === "club" ? `${STATE.clubSeason} · ${competitionLabel()}` : STATE.internationalSeason;
  const crest = (team) => {
    const info = teamInfo.get(team) || {};
    return STATE.context === "club"
      ? clubCrest(team, info.crestUrl, info.league || selectedLeague())
      : flag(info.flagUrl, team);
  };
  const form = el("section", "single-predictor");
  form.innerHTML = `
    <div class="single-predictor-top">
      <div><span class="single-kicker">Manual matchup</span><p>Choose any two teams from the active data workspace.</p></div>
      <span class="single-scope">${esc(scope)}</span>
    </div>
    <div class="single-form">
      <label class="single-team-field">
        <span>Home team</span>
        <div class="single-select"><span class="single-crest" id="sHomeCrest"></span><select id="sHome" aria-label="Home team">${opts}</select></div>
      </label>
      <div class="single-versus" aria-hidden="true">VS</div>
      <label class="single-team-field">
        <span>Away team</span>
        <div class="single-select"><span class="single-crest" id="sAwayCrest"></span><select id="sAway" aria-label="Away team">${opts}</select></div>
      </label>
    </div>
    <div class="single-predictor-actions">
      <span class="single-note">Uses the current ${STATE.context === "club" ? "club" : "international"} model baseline.</span>
      <button type="button" class="btn single-submit" id="sPredict" ${teams.length < 2 ? "disabled" : ""}>Generate prediction <span aria-hidden="true">→</span></button>
    </div>
    <div class="single-manual-odds" id="sManualOdds" hidden>
      <div><b>Market odds unavailable</b><p id="sOddsNotice">Enter decimal 1X2 odds to continue with this prediction.</p></div>
      <div class="manual-odds-fields">
        <label>Home <input id="sHomeOdds" inputmode="decimal" type="number" min="1.01" step="0.01" placeholder="2.40"></label>
        <label>Draw <input id="sDrawOdds" inputmode="decimal" type="number" min="1.01" step="0.01" placeholder="3.50"></label>
        <label>Away <input id="sAwayOdds" inputmode="decimal" type="number" min="1.01" step="0.01" placeholder="2.90"></label>
        <button type="button" class="btn single-manual-submit" id="sManualSubmit">Use these odds</button>
      </div>
    </div>`;
  stage.appendChild(form);
  const result = el("div", "single-result"); stage.appendChild(result);
  const home = $("#sHome", form), away = $("#sAway", form), go = $("#sPredict", form);
  if (!teams.length) {
    form.querySelector(".single-form").innerHTML = `<div class="single-no-teams">No teams are available for this filter. Change the Football filters and try again.</div>`;
    return;
  }
  if (teams[1]) away.selectedIndex = 1;
  const updateCrests = () => {
    $("#sHomeCrest", form).innerHTML = crest(home.value);
    $("#sAwayCrest", form).innerHTML = crest(away.value);
  };
  updateCrests();
  home.addEventListener("change", updateCrests);
  away.addEventListener("change", updateCrests);
  const predict = async (odds, source = "") => {
    const homeTeam = home.value, awayTeam = away.value;
    if (homeTeam === awayTeam) { result.innerHTML = `<div class="empty">Pick two different teams.</div>`; return false; }
    result.innerHTML = `<div class="loading"><div class="spinner"></div><span>Predicting…</span></div>`;
    try {
      const data = await api("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        homeTeam, awayTeam, context: STATE.context, season: seasonFor(),
        league: STATE.context === "international" ? seasonFor() : (teamInfo.get(homeTeam)?.league || selectedLeague()),
        homeOdds: odds.homeOdds, drawOdds: odds.drawOdds, awayOdds: odds.awayOdds,
        oddsSource: source,
      }) });
      const p = data.prediction || data;
      const pickLabel = p.prediction === "H" ? `${homeTeam} win` : p.prediction === "A" ? `${awayTeam} win` : p.prediction === "D" ? "Draw" : "—";
      const grid = el("div", "grid"); grid.appendChild(predictionCard({ ...p, homeTeam, awayTeam, league: "Single predictor" }));
      result.innerHTML = ""; result.appendChild(grid);
      void pickLabel;
      return true;
    } catch (e) { result.innerHTML = `<div class="empty">Prediction unavailable for this matchup (${esc(e.message)}).</div>`; return false; }
  };
  const manualOdds = $("#sManualOdds", form);
  go.onclick = async () => {
    const homeTeam = home.value, awayTeam = away.value;
    if (homeTeam === awayTeam) { result.innerHTML = `<div class="empty">Pick two different teams.</div>`; return; }
    manualOdds.hidden = true;
    go.disabled = true; go.innerHTML = "Checking odds…";
    const homeLeague = teamInfo.get(homeTeam)?.league;
    const awayLeague = teamInfo.get(awayTeam)?.league;
    const league = STATE.context === "international" ? seasonFor() : (homeLeague && homeLeague === awayLeague ? homeLeague : "");
    try {
      const lookup = await api("/api/odds/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ homeTeam, awayTeam, context: STATE.context, league }) });
      if (lookup.found && lookup.odds) {
        await predict(lookup.odds, lookup.provider || "The Odds API");
        return;
      }
      $("#sOddsNotice", form).textContent = `${lookup.reason || "No public market is available for this matchup yet."} Enter decimal 1X2 odds to continue.`;
      manualOdds.hidden = false;
    } catch (_) {
      $("#sOddsNotice", form).textContent = "Odds could not be retrieved right now. Enter decimal 1X2 odds to continue.";
      manualOdds.hidden = false;
    } finally {
      go.disabled = false; go.innerHTML = "Generate prediction <span aria-hidden=\"true\">→</span>";
    }
  };
  $("#sManualSubmit", form).onclick = () => {
    const odds = { homeOdds: $("#sHomeOdds", form).value, drawOdds: $("#sDrawOdds", form).value, awayOdds: $("#sAwayOdds", form).value };
    if (!Object.values(odds).every((value) => Number(value) > 1)) {
      $("#sOddsNotice", form).textContent = "Enter valid decimal odds greater than 1.00 for home, draw, and away.";
      return;
    }
    predict(odds, "User-entered odds");
  };
}

/* ── Go ──────────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", bootApp);
window.addEventListener("resize", positionCtxGlow);
