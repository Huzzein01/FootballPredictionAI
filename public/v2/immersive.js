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
  sortBy: "confidence", clubSeason: "2026-27",
  liveTimer: null, goalWatch: null, liveScores: {}, parlayRisk: "safe",
};

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
  { id: "fixtures", label: "Fixtures", intl: true },
  { id: "single", label: "Single Predictor" },
];

const flag = (url) => url ? `<img class="flag" src="${esc(url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="flag"></span>`;
const stat = (b, s, cls = "") => `<div class="hero-stat"><b class="${cls}">${esc(b)}</b><span>${esc(s)}</span></div>`;
const seasonFor = () => STATE.context === "international" ? "2026 World Cup" : "2025-26";

/* ── Boot ────────────────────────────────────────────────────────────────── */
function bootApp() {
  buildNav();
  bindContextSwitch();
  positionCtxGlow();
  renderSection();
  refreshHeroStats();
}

function bindContextSwitch() {
  $("#ctxSwitch").querySelectorAll(".ctx-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (STATE.context === btn.dataset.ctx) return;
      STATE.context = btn.dataset.ctx;
      document.documentElement.dataset.context = STATE.context;
      $("#ctxSwitch").querySelectorAll(".ctx-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      positionCtxGlow();
      $("#heroSub").textContent = STATE.context === "international" ? "2026 World Cup · data-led prediction dashboard" : "Club football · data-led prediction dashboard";
      if (!sectionAllowed(STATE.section)) STATE.section = "predictions";
      buildNav(); renderSection(); refreshHeroStats();
    });
  });
}
function positionCtxGlow() {
  const active = $("#ctxSwitch .ctx-btn.is-active"), glow = $(".ctx-glow");
  if (active && glow) { glow.style.left = active.offsetLeft + "px"; glow.style.width = active.offsetWidth + "px"; }
}
const sectionAllowed = (id) => { const s = SECTIONS.find((x) => x.id === id); return s && (!s.intl || STATE.context === "international"); };

function buildNav() {
  const nav = $("#nav"); nav.innerHTML = "";
  const brand = el("a", "nav-brand", '<span class="nav-brand-mark">SA</span><span>Sportsbooks <b>Analyst</b></span>');
  brand.href = "/v2/";
  brand.setAttribute("aria-label", "Sportsbooks Analyst home");
  nav.appendChild(brand);
  // Keep the mode switch first so it stays reachable when the section nav
  // overflows on smaller screens.
  const classic = el("button", "nav-btn nav-ui-toggle", "Classic UI");
  classic.title = "Open the classic interface";
  classic.addEventListener("click", () => window.location.assign("/classic/"));
  const sportLinks = [
    { label: "Football", href: "/v2/", active: true },
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
  SECTIONS.filter((s) => !s.intl || STATE.context === "international").forEach((s) => {
    const b = el("button", "nav-btn" + (s.id === STATE.section ? " is-active" : ""), esc(s.label));
    b.addEventListener("click", () => { STATE.section = s.id; buildNav(); renderSection(); });
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
  const preds = data.predictions || [];
  const stage = $("#stage"); stage.innerHTML = "";
  stage.appendChild(headEl("Upcoming Predictions", `${preds.length} fixtures · model picks, confidence & odds`));

  // ── Sort + season toolbar ──────────────────────────────────────────────────
  const toolbar = el("div", "pred-toolbar");
  const sortOpts = [
    { k: "confidence", l: "Confidence ↓" },
    { k: "date", l: "Date" },
    { k: intl ? "group" : "league", l: intl ? "Group" : "League" },
  ];
  sortOpts.forEach(({ k, l }) => {
    const b = el("button", "sort-btn" + (STATE.sortBy === k ? " is-active" : ""), l);
    b.onclick = () => { STATE.sortBy = k; renderPredictions(); };
    toolbar.appendChild(b);
  });
  if (!intl) {
    const wrap = el("label", "season-lbl", "Season ");
    const sel = el("select", "season-pick");
    ["2026-27", "2025-26", "2024-25", "2023-24"].forEach((s) => {
      const o = document.createElement("option"); o.value = s; o.textContent = s;
      if (s === STATE.clubSeason) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { STATE.clubSeason = sel.value; renderPredictions(); };
    wrap.appendChild(sel);
    toolbar.appendChild(wrap);
  }
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

  if (!list.length) { stage.appendChild(el("div", "empty", "No upcoming fixtures for this filter.")); return; }
  const grid = el("div", "grid"); list.slice(0, 60).forEach((p) => grid.appendChild(predictionCard(p)));
  stage.appendChild(grid);
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
    <div class="card-top"><span>${esc(p.matchdayLabel || p.league || p.group || "Fixture")}</span><span class="pill ${p.prediction === "D" ? "draw" : "pick"}">${esc(pickLabel)} · ${esc(String(p.confidence ?? ""))}%</span></div>
    <div class="match"><div class="team">${flag(p.homeFlagUrl)}<span class="tn">${esc(p.homeTeam)}</span></div><div class="vs">vs</div><div class="team">${flag(p.awayFlagUrl)}<span class="tn">${esc(p.awayTeam)}</span></div></div>
    <div class="conf-bar"><i class="conf-h" style="width:${h}%"></i><i class="conf-d" style="width:${d}%"></i><i class="conf-a" style="width:${a}%"></i></div>
    <div class="conf-legend"><span>H ${h}%</span><span>D ${d}%</span><span>A ${a}%</span></div>
    <div class="proj">Projected score <b>${esc(p.projectedScore || "—")}</b></div>
    <div class="odds-row">${oddChip("1", o.homeOdds, p.prediction === "H")}${oddChip("X", o.drawOdds, p.prediction === "D")}${oddChip("2", o.awayOdds, p.prediction === "A")}</div>`;
  return card;
}
const oddChip = (l, v, best) => `<div class="odds-chip${best ? " best" : ""}">${l}<b>${v ? esc(v) : "—"}</b></div>`;

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
    const url = `/api/parlay?context=${STATE.context}&league=${STATE.context === "international" ? "International" : "All"}&legs=${legs}&tickets=${tickets}&type=mixed&riskMode=${STATE.parlayRisk}&generationMode=multi`;
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
  const data = await api(`/api/futures?context=${STATE.context}&season=${encodeURIComponent(seasonFor())}&league=${intl ? "International" : "EPL"}`);
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
  const data = await api(`/api/league-tables?season=${encodeURIComponent(seasonFor())}`).catch(() => null);
  stage.innerHTML = ""; stage.appendChild(headEl("League Tables", "current standings"));
  const leagues = data?.leagues ? Object.entries(data.leagues) : [];
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
  const data = await api(intl ? "/api/played-fixtures?context=international" : "/api/played-fixtures?context=club&season=2025-26");
  const preds = (data.predictions || []).filter((p) => p.played);
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
      <div class="match"><div class="team">${flag(p.homeFlagUrl)}<span class="tn">${esc(p.homeTeam)}</span></div><div class="score">${esc(String(pl.homeGoals))} : ${esc(String(pl.awayGoals))}</div><div class="team">${flag(p.awayFlagUrl)}<span class="tn">${esc(p.awayTeam)}</span></div></div>
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
  try {
    if (STATE.context === "international") teams = (await api("/api/international/fixtures")).teams || [];
    else teams = [...new Set(((await api("/api/fixture-predictions")).predictions || []).flatMap((p) => [p.homeTeam, p.awayTeam]))];
    teams = [...new Set(teams)].sort();
  } catch (_) {}
  const opts = teams.map((t) => `<option>${esc(t)}</option>`).join("");
  const form = el("div", "single-form");
  form.innerHTML = `<label>Home<select id="sHome">${opts}</select></label><span class="vs">vs</span><label>Away<select id="sAway">${opts}</select></label>`;
  stage.appendChild(form);
  const go = el("button", "btn", "Predict ⚡"); go.style.marginTop = "12px"; stage.appendChild(go);
  const result = el("div", "single-result"); stage.appendChild(result);
  if (teams[1]) $("#sAway", form).selectedIndex = 1;
  go.onclick = async () => {
    const homeTeam = $("#sHome").value, awayTeam = $("#sAway").value;
    if (homeTeam === awayTeam) { result.innerHTML = `<div class="empty">Pick two different teams.</div>`; return; }
    result.innerHTML = `<div class="loading"><div class="spinner"></div><span>Predicting…</span></div>`;
    try {
      const data = await api("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ homeTeam, awayTeam, context: STATE.context, season: seasonFor() }) });
      const p = data.prediction || data;
      const pickLabel = p.prediction === "H" ? `${homeTeam} win` : p.prediction === "A" ? `${awayTeam} win` : p.prediction === "D" ? "Draw" : "—";
      const grid = el("div", "grid"); grid.appendChild(predictionCard({ ...p, homeTeam, awayTeam, league: "Single predictor" }));
      result.innerHTML = ""; result.appendChild(grid);
      void pickLabel;
    } catch (e) { result.innerHTML = `<div class="empty">Prediction unavailable for this matchup (${esc(e.message)}).</div>`; }
  };
}

/* ── Go ──────────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", bootApp);
window.addEventListener("resize", positionCtxGlow);
