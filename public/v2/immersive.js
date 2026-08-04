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

const STATE = {
  context: "international", section: "predictions", matchday: "all",
  sortBy: "confidence", clubSeason: "2026-27", internationalSeason: "2026 World Cup", competitionType: "league", competitions: ["All Leagues"],
  liveTimer: null, goalWatch: null, contextTimer: null, liveScores: {}, parlayRisk: "safe",
};

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

const flag = (url) => url ? `<img class="flag" src="${esc(url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="flag"></span>`;
const clubCrest = (team, supplied, league) => `<img class="flag" src="${esc(supplied || `/api/club-crest?team=${encodeURIComponent(team)}&league=${encodeURIComponent(league || "")}`)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
const stat = (b, s, cls = "") => `<div class="hero-stat"><b class="${cls}">${esc(b)}</b><span>${esc(s)}</span></div>`;
const seasonFor = () => STATE.context === "international" ? STATE.internationalSeason : STATE.clubSeason;
const isCurrentInternationalSeason = () => STATE.internationalSeason === "2026 World Cup";

/* ── Boot ────────────────────────────────────────────────────────────────── */
async function bootApp() {
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
  updateSeasonCalendarStatus(decision);
  if (rerender && changed) {
    if (!sectionAllowed(STATE.section)) STATE.section = "predictions";
    buildSectionNav();
    renderSection();
    refreshHeroStats();
  }
}
function updateSeasonCalendarStatus(decision = null) {
  const status = $("#seasonCalendarStatus");
  if (!status) return;
  status.textContent = decision?.reason || `${STATE.context === "club" ? "Club" : "International"} · manual selection`;
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
      updateSeasonCalendarStatus();
      if (!sectionAllowed(STATE.section)) STATE.section = "predictions";
      buildSectionNav(); renderSection(); refreshHeroStats();
    });
  });
}
function updateHeroSubtitle() {
  $("#heroSub").textContent = STATE.context === "international"
    ? `International football · ${STATE.internationalSeason}`
    : `Club football · ${STATE.clubSeason} season`;
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
    updateSeasonCalendarStatus();
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
  const brand = el("a", "nav-brand", '<span class="nav-brand-mark" aria-hidden="true">✦</span><span>Sportsbooks <b>Analyst</b></span>');
  brand.href = "/v2/";
  brand.setAttribute("aria-label", "Sportsbooks Analyst home");
  nav.appendChild(brand);
  const classic = el("button", "nav-btn nav-ui-toggle", "Classic UI");
  classic.title = "Open the classic interface";
  classic.addEventListener("click", () => window.location.assign("/classic/"));
  const sportLinks = [
    { label: "Football", href: "/football/", active: true },
    { label: "Baseball", href: "/baseball/" },
    { label: "Basketball", href: "/basketball/" },
  ];
  sportLinks.forEach((sport) => {
    const link = el("a", "nav-btn nav-sport" + (sport.active ? " is-active" : ""), esc(sport.label));
    link.href = sport.href;
    if (sport.active) link.setAttribute("aria-current", "page");
    nav.appendChild(link);
  });
  nav.appendChild(el("span", "nav-divider", ""));
  nav.appendChild(classic);
}

function buildSectionNav() {
  const nav = $("#sectionNav");
  if (!nav) return;
  nav.innerHTML = "";
  SECTIONS.filter((s) => !s.intl || STATE.context === "international").forEach((s) => {
    const b = el("button", "feature-tab" + (s.id === STATE.section ? " active" : ""), esc(s.label));
    b.addEventListener("click", () => { STATE.section = s.id; buildSectionNav(); renderSection(); });
    nav.appendChild(b);
  });
}

/* ── Hero stats ──────────────────────────────────────────────────────────── */
async function refreshHeroStats() {
  const host = $("#heroStats");
  host.innerHTML = stat("—", "loading");
  try {
    if (STATE.context === "international") {
      const [acc, res] = await Promise.all([
        api("/api/international/training-accuracy").catch(() => null),
        api("/api/played-fixtures?context=international").catch(() => null),
      ]);
      const hi = acc?.latest?.highConfidenceAccuracy != null ? Math.round(acc.latest.highConfidenceAccuracy * 100) + "%" : "—";
      const md = acc?.latest?.currentMatchday || acc?.live?.currentMatchday || 1;
      const s = res?.summary || {};
      host.innerHTML = stat(hi, "High-conf accuracy", "good") + stat("MD " + md, "Current matchday")
        + stat(s.total ?? 0, "Matches settled") + stat(s.total ? `${s.correct}/${s.total}` : "—", "Model record");
    } else {
      host.innerHTML = stat("Club", "Mode") + stat("Live", "ESPN feed") + stat("Auto", "Retraining") + stat("⚽", "Predictions");
    }
  } catch (_) { host.innerHTML = stat("—", "stats unavailable"); }
}

/* ── Router ──────────────────────────────────────────────────────────────── */
function renderSection() {
  if (STATE.liveTimer) { clearInterval(STATE.liveTimer); STATE.liveTimer = null; }
  $("#stage").innerHTML = `<div class="loading"><div class="spinner"></div><span>Loading…</span></div>`;
  if (STATE.context === "international" && !isCurrentInternationalSeason()) {
    $("#stage").innerHTML = `<div class="empty"><b>${esc(STATE.internationalSeason)}</b> is available as historical context. Its fixtures and model cards will appear here after that tournament's verified data feed is imported.</div>`;
    return;
  }
  const map = { predictions: renderPredictions, live: renderLive, parlays: renderParlays, slip: renderSlip,
    teams: renderTeams, players: renderPlayers, futures: renderFutures, tables: renderTables,
    results: renderResults, training: renderTraining, fixtures: renderFixtures, single: renderSingle };
  (map[STATE.section] || renderPredictions)().catch((e) => {
    $("#stage").innerHTML = `<div class="empty">Couldn't load this section: ${esc(e.message)}</div>`;
  });
}
const headEl = (title, sub) => el("div", "section-head", `<h2>${esc(title)}</h2><span class="sub">${esc(sub || "")}</span>`);

/* ── Predictions ─────────────────────────────────────────────────────────── */
async function renderPredictions() {
  const intl = STATE.context === "international";
  const url = intl
    ? "/api/international/fixture-predictions"
    : `/api/fixture-predictions?season=${encodeURIComponent(STATE.clubSeason)}`;
  const data = await api(url);
  const preds = filterFootballEntries(data.predictions || []);
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
    <div class="match"><div class="team">${STATE.context === "club" ? clubCrest(p.homeTeam, p.homeLogoUrl, p.league) : flag(p.homeFlagUrl)}<span class="tn">${esc(p.homeTeam)}</span></div><div class="vs">vs</div><div class="team">${STATE.context === "club" ? clubCrest(p.awayTeam, p.awayLogoUrl, p.league) : flag(p.awayFlagUrl)}<span class="tn">${esc(p.awayTeam)}</span></div></div>
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
        <div class="match"><div class="team">${flag(m.homeFlagUrl)}<span class="tn">${esc(m.homeTeam)}</span></div><div class="score"><span class="live">${m.homeGoals ?? "-"}</span> : <span class="live">${m.awayGoals ?? "-"}</span></div><div class="team">${flag(m.awayFlagUrl)}<span class="tn">${esc(m.awayTeam)}</span></div></div>
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
      <div class="pcard">${flag(null)}<div class="pmeta"><b>${esc(p.displayName || p.team)}</b><span>${esc(p.importedBaseline?.source || "")}</span></div></div>
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

/* ── Futures (+ bracket) ─────────────────────────────────────────────────── */
async function renderFutures() {
  const intl = STATE.context === "international";
  const data = await api(`/api/futures?context=${STATE.context}&season=${encodeURIComponent(seasonFor())}&league=${intl ? "International" : selectedLeague()}`);
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Futures", data.unavailable ? (data.message || "unavailable") : "winner, top scorer & top assist markets"));
  // Bracket placeholder (filled async so it never blocks the futures picks).
  const bracketMount = el("div"); if (intl) stage.appendChild(bracketMount);
  // Futures pick cards render immediately.
  const grid = el("div", "grid");
  (data.sections || []).forEach((sec) => {
    const c = el("article", "card");
    const picks = (sec.picks || []).slice(0, 8).map((pk) => `
      <div class="fut-pick"><span class="fut-rank">${pk.rank}</span>
        <span class="fut-label">${esc(pk.label)}<span class="fut-detail">${esc(pk.detail || "")}</span></span>
        <span class="fut-conf-bar"><i style="width:${Math.min(100, num(pk.confidence))}%"></i></span>
        <span class="fut-conf">${num(pk.confidence)}%</span></div>`).join("");
    c.innerHTML = `<div class="card-top"><span>${esc(sec.title)}</span></div><div class="lm" style="margin-bottom:8px">${esc(sec.subtitle || "")}</div>${picks}`;
    grid.appendChild(c);
  });
  if (grid.children.length) stage.appendChild(grid);
  else if (!intl) stage.appendChild(el("div", "empty", data.message || "No futures markets for this league yet."));
  // Load the bracket separately.
  if (intl) {
    api("/api/international/bracket").then((br) => {
      if (STATE.section !== "futures") return;
      if (br.champion) bracketMount.appendChild(el("div", "champion", `<div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Projected champion</div><div class="ct">${esc(br.champion.team)}</div>`));
      const rounds = br.bracket || {};
      const tn = (x) => (x && typeof x === "object") ? (x.team || x.name || "") : (x || "");
      const wrap = el("div", "bracket");
      [["r16", "Round of 16"], ["qf", "Quarter-Finals"], ["sf", "Semi-Finals"], ["final", "Final"]].forEach(([k, label]) => {
        const r = rounds[k]; if (!r) return;
        const col = el("div", "bround", `<h4>${esc(label)}</h4>`);
        (r.matches || []).forEach((m) => {
          const home = tn(m.home), away = tn(m.away), w = tn(m.winner);
          col.appendChild(el("div", "btie", `<span class="${w && w === home ? "w" : ""}">${esc(home)}</span> v <span class="${w && w === away ? "w" : ""}">${esc(away)}</span>`));
        });
        wrap.appendChild(col);
      });
      if (wrap.children.length) { bracketMount.appendChild(el("div", "section-head", `<h2 style="font-size:18px">Bracket projection</h2>`)); bracketMount.appendChild(wrap); }
    }).catch(() => {});
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
    const rows = (lg.standings || []).slice(0, 20).map((r, i) => `<tr><td><span class="rk">${i + 1}</span></td><td>${esc(r.team)}</td><td>${r.played}</td><td>${r.goalsFor}:${r.goalsAgainst}</td><td><b>${r.points}</b></td></tr>`).join("");
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
      <div class="match"><div class="team">${intl ? flag(p.homeFlagUrl) : clubCrest(p.homeTeam, p.homeLogoUrl, p.league)}<span class="tn">${esc(p.homeTeam)}</span></div><div class="score">${esc(String(pl.homeGoals))} : ${esc(String(pl.awayGoals))}</div><div class="team">${intl ? flag(p.awayFlagUrl) : clubCrest(p.awayTeam, p.awayLogoUrl, p.league)}<span class="tn">${esc(p.awayTeam)}</span></div></div>
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
      c.innerHTML = `<div class="card-top"><span>${esc(fixture.league || "")}</span><span>${esc(fixture.date || "")}</span></div><div class="match"><div class="team">${flag(fixture.homeFlagUrl || fixture.homeLogoUrl)}<span class="tn">${esc(fixture.homeTeam)}</span></div><div class="vs">vs</div><div class="team">${flag(fixture.awayFlagUrl || fixture.awayLogoUrl)}<span class="tn">${esc(fixture.awayTeam)}</span></div></div>`;
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
        <div class="match"><div class="team">${flag(f.homeFlagUrl)}<span class="tn">${esc(f.homeTeam)}</span></div><div class="vs">vs</div><div class="team">${flag(f.awayFlagUrl)}<span class="tn">${esc(f.awayTeam)}</span></div></div>
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
      : flag(info.flagUrl);
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
