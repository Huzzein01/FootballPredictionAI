/* ===========================================================================
   Football Analyst — immersive front-end (v2)
   Vanilla SPA: splash sequence, router, and section renderers wired to the
   existing /api endpoints. No build step, no dependencies.
   =========================================================================== */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
async function api(path) { const r = await fetch(path); if (!r.ok) throw new Error(`${r.status} ${path}`); return r.json(); }

const STATE = { context: "international", section: "predictions", matchday: "all", liveTimer: null };

const SECTIONS = [
  { id: "predictions", label: "Predictions", both: true },
  { id: "live", label: "Live Now", intlOnly: true },
  { id: "results", label: "Results", both: true },
  { id: "tables", label: "Group Tables", intlOnly: true },
  { id: "parlays", label: "Parlays", both: true, soon: true },
  { id: "teams", label: "Team Profiles", both: true, soon: true },
  { id: "futures", label: "Futures", both: true, soon: true },
];

/* ── Splash sequence ─────────────────────────────────────────────────────── */
function runSplash() {
  const splash = $("#splash");
  const ball = $(".ball", splash);
  const net = $(".net", splash);
  const flash = $(".strike-flash", splash);
  const board = $(".scoreboard", splash);
  const goalText = $(".goal-flash", splash);
  const sbHome = $(".sb-h", splash);

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const T = reduce ? 0.15 : 1;

  setTimeout(() => board.classList.add("show"), 300 * T);
  // Strike moment (~1.84s): flash, ball flies, net shakes
  setTimeout(() => {
    flash.classList.add("fire");
    ball.classList.add("go");
  }, 1840 * T);
  // Ball reaches the net (~2.46s): GOAL
  setTimeout(() => {
    net.classList.add("shake");
    goalText.classList.add("fire");
    sbHome.textContent = "1";
    sbHome.classList.add("pop");
  }, 2460 * T);
  // Lift into the app
  const finish = () => endSplash();
  setTimeout(finish, (reduce ? 600 : 3500));
  $("#skipSplash").addEventListener("click", endSplash, { once: true });
}

let splashEnded = false;
function endSplash() {
  if (splashEnded) return; splashEnded = true;
  const splash = $("#splash");
  splash.classList.add("lift");
  setTimeout(() => { splash.remove(); }, 700);
  const app = $("#app");
  app.hidden = false;
  bootApp();
}

/* ── App boot ────────────────────────────────────────────────────────────── */
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
      $("#heroSub").textContent = STATE.context === "international"
        ? "2026 World Cup · immersive prediction engine"
        : "Club football · immersive prediction engine";
      // Reset to a valid section for this context.
      if (!sectionAllowed(STATE.section)) STATE.section = "predictions";
      buildNav();
      renderSection();
      refreshHeroStats();
    });
  });
}
function positionCtxGlow() {
  const active = $("#ctxSwitch .ctx-btn.is-active");
  const glow = $(".ctx-glow");
  if (active && glow) { glow.style.left = active.offsetLeft + "px"; glow.style.width = active.offsetWidth + "px"; }
}

function sectionAllowed(id) {
  const s = SECTIONS.find((x) => x.id === id);
  if (!s) return false;
  if (s.intlOnly && STATE.context !== "international") return false;
  return true;
}

function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = "";
  SECTIONS.filter((s) => s.both || s.intlOnly === (STATE.context === "international") || (s.intlOnly && STATE.context === "international"))
    .filter((s) => !(s.intlOnly && STATE.context !== "international"))
    .forEach((s) => {
      const b = el("button", "nav-btn" + (s.id === STATE.section ? " is-active" : ""), esc(s.label) + (s.soon ? " ·" : ""));
      b.addEventListener("click", () => { STATE.section = s.id; buildNav(); renderSection(); });
      nav.appendChild(b);
    });
}

/* ── Hero stats ──────────────────────────────────────────────────────────── */
async function refreshHeroStats() {
  const host = $("#heroStats");
  host.innerHTML = `<div class="hero-stat"><b>—</b><span>loading</span></div>`;
  try {
    if (STATE.context === "international") {
      const [acc, res] = await Promise.all([
        api("/api/international/training-accuracy").catch(() => null),
        api("/api/played-fixtures?context=international").catch(() => null),
      ]);
      const hi = acc?.latest?.highConfidenceAccuracy != null ? Math.round(acc.latest.highConfidenceAccuracy * 100) + "%" : "—";
      const md = acc?.latest?.currentMatchday || acc?.live?.currentMatchday || 0;
      const played = res?.summary?.total ?? 0;
      const rec = res?.summary ? `${res.summary.correct}/${res.summary.total}` : "—";
      host.innerHTML = stat(hi, "High-conf accuracy", "good") + stat("MD " + (md || "1"), "Current matchday")
        + stat(played, "Matches settled") + stat(rec, "Model record");
    } else {
      host.innerHTML = stat("Club", "Mode") + stat("Live", "ESPN feed") + stat("Auto", "Retraining") + stat("⚽", "");
    }
  } catch (_) {
    host.innerHTML = stat("—", "stats unavailable");
  }
}
const stat = (b, s, cls = "") => `<div class="hero-stat"><b class="${cls}">${esc(b)}</b><span>${esc(s)}</span></div>`;

/* ── Section router ──────────────────────────────────────────────────────── */
function renderSection() {
  if (STATE.liveTimer) { clearInterval(STATE.liveTimer); STATE.liveTimer = null; }
  const stage = $("#stage");
  stage.innerHTML = `<div class="loading"><div class="spinner"></div><span>Loading ${esc(STATE.section)}…</span></div>`;
  const map = { predictions: renderPredictions, live: renderLive, results: renderResults, tables: renderTables };
  const fn = map[STATE.section];
  const soon = SECTIONS.find((s) => s.id === STATE.section)?.soon;
  if (soon || !fn) return renderSoon();
  fn().catch((e) => { stage.innerHTML = `<div class="empty">Couldn't load this section: ${esc(e.message)}</div>`; });
}

function renderSoon() {
  $("#stage").innerHTML = `<div class="soon"><div class="ball2">⚽</div><h2 style="font-family:var(--display);letter-spacing:1px;margin:10px 0 6px">Coming next in the new UI</h2><p>This section is being ported into the immersive experience. It still works in the <a href="/" class="foot-link">classic UI</a> meanwhile.</p></div>`;
}

/* ── Predictions ─────────────────────────────────────────────────────────── */
async function renderPredictions() {
  const intl = STATE.context === "international";
  const data = await api(intl ? "/api/international/fixture-predictions" : "/api/fixture-predictions");
  const preds = data.predictions || [];
  const stage = $("#stage");
  stage.innerHTML = "";
  const head = el("div", "section-head", `<h2>Upcoming Predictions</h2><span class="sub">${preds.length} fixtures · model picks with confidence & odds</span>`);
  stage.appendChild(head);

  if (intl) {
    const mds = [...new Set(preds.map((p) => p.matchday).filter(Boolean))].sort((a, b) => a - b);
    if (mds.length) {
      const bar = el("div", "matchday-bar");
      const chip = (val, label) => { const c = el("button", "md-chip" + (String(STATE.matchday) === String(val) ? " is-active" : ""), esc(label)); c.onclick = () => { STATE.matchday = val; renderPredictions(); }; return c; };
      bar.appendChild(chip("all", "All matchdays"));
      mds.forEach((md) => bar.appendChild(chip(md, preds.find((p) => p.matchday === md)?.matchdayLabel || ("Matchday " + md))));
      stage.appendChild(bar);
    }
  }
  let list = preds;
  if (intl && STATE.matchday !== "all") list = preds.filter((p) => p.matchday === STATE.matchday);

  if (!list.length) { stage.appendChild(el("div", "empty", "No upcoming fixtures for this filter.")); return; }
  const grid = el("div", "grid");
  list.slice(0, 60).forEach((p) => grid.appendChild(predictionCard(p)));
  stage.appendChild(grid);
}

function predictionCard(p) {
  const pickLabel = p.prediction === "H" ? `${p.homeTeam} win` : p.prediction === "A" ? `${p.awayTeam} win` : "Draw";
  const probs = p.probabilities || {};
  const h = Math.round(probs.homeWinPct ?? 0), d = Math.round(probs.drawPct ?? 0), a = Math.round(probs.awayWinPct ?? 0);
  const odds = p.odds || {};
  const pickType = p.prediction === "D" ? "draw" : "pick";
  const card = el("article", "card");
  card.innerHTML = `
    <div class="card-top"><span>${esc(p.matchdayLabel || p.league || p.group || "Fixture")}</span><span class="pill ${pickType}">${esc(pickLabel)} · ${esc(String(p.confidence ?? ""))}%</span></div>
    <div class="match">
      <div class="team">${flag(p.homeFlagUrl)}<span class="tn">${esc(p.homeTeam)}</span></div>
      <div class="vs">vs</div>
      <div class="team">${flag(p.awayFlagUrl)}<span class="tn">${esc(p.awayTeam)}</span></div>
    </div>
    <div class="conf-bar"><i class="conf-h" style="width:${h}%"></i><i class="conf-d" style="width:${d}%"></i><i class="conf-a" style="width:${a}%"></i></div>
    <div class="conf-legend"><span>H ${h}%</span><span>D ${d}%</span><span>A ${a}%</span></div>
    <div class="proj">Projected score <b>${esc(p.projectedScore || "—")}</b></div>
    <div class="odds-row">
      ${oddChip("1", odds.homeOdds, p.prediction === "H")}
      ${oddChip("X", odds.drawOdds, p.prediction === "D")}
      ${oddChip("2", odds.awayOdds, p.prediction === "A")}
    </div>`;
  return card;
}
const oddChip = (l, v, best) => `<div class="odds-chip${best ? " best" : ""}">${l}<b>${v ? esc(v) : "—"}</b></div>`;
const flag = (url) => url ? `<img class="flag" src="${esc(url)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="flag"></span>`;

/* ── Live Now ────────────────────────────────────────────────────────────── */
async function renderLive() {
  const paint = async () => {
    const data = await api("/api/international/live");
    const stage = $("#stage");
    const matches = data.matches || [];
    stage.innerHTML = "";
    stage.appendChild(el("div", "section-head", `<h2><span class="live-badge"><span class="live-dot"></span>Live Now</span></h2><span class="sub">${matches.length ? matches.length + " in progress · auto-refresh 30s" : "no matches in progress"}</span>`));
    if (!matches.length) { stage.appendChild(el("div", "empty", "No World Cup matches are live right now. This view lights up automatically when one kicks off.")); return; }
    const grid = el("div", "grid");
    matches.forEach((m) => {
      const pickLabel = m.prediction === "H" ? `${m.homeTeam} win` : m.prediction === "A" ? `${m.awayTeam} win` : m.prediction === "D" ? "Draw" : "—";
      const track = m.pickTrackingLive === true ? `<span style="color:var(--good);font-weight:700">pick ahead ✓</span>` : m.pickTrackingLive === false ? `<span style="color:var(--bad)">pick behind</span>` : "";
      const c = el("article", "card");
      c.innerHTML = `
        <div class="card-top"><span>${esc(m.matchdayLabel || m.group || "World Cup")}</span><span class="live-badge"><span class="live-dot"></span>${esc(m.clock || "LIVE")}</span></div>
        <div class="match">
          <div class="team">${flag(m.homeFlagUrl)}<span class="tn">${esc(m.homeTeam)}</span></div>
          <div class="score"><span class="live">${m.homeGoals ?? "-"}</span> : <span class="live">${m.awayGoals ?? "-"}</span></div>
          <div class="team">${flag(m.awayFlagUrl)}<span class="tn">${esc(m.awayTeam)}</span></div>
        </div>
        <div class="proj">Model: <b>${esc(pickLabel)}</b>${m.confidence != null ? ` (${Math.round(m.confidence)}%)` : ""} · proj ${esc(m.projectedScore || "—")} ${track}</div>`;
      grid.appendChild(c);
    });
    stage.appendChild(grid);
  };
  await paint();
  STATE.liveTimer = setInterval(() => { if (STATE.section === "live") paint().catch(() => {}); }, 30000);
}

/* ── Results ─────────────────────────────────────────────────────────────── */
async function renderResults() {
  const intl = STATE.context === "international";
  const data = await api(intl ? "/api/played-fixtures?context=international" : "/api/played-fixtures?context=club&season=2025-26");
  const preds = (data.predictions || []).filter((p) => p.played);
  const stage = $("#stage");
  stage.innerHTML = "";
  const s = data.summary || {};
  stage.appendChild(el("div", "section-head", `<h2>Results</h2><span class="sub">${s.total || preds.length} settled · model ${s.correct ?? "—"}/${s.total ?? "—"}${s.exactScores ? " · " + s.exactScores + " exact" : ""}</span>`));
  if (!preds.length) { stage.appendChild(el("div", "empty", "No completed matches yet — results appear here automatically as games finish.")); return; }
  const grid = el("div", "grid");
  preds.slice(0, 80).forEach((p) => {
    const pl = p.played || {};
    const ok = pl.modelCorrect === true, wrong = pl.modelCorrect === false;
    const verdict = ok ? `<span class="pill" style="background:rgba(74,222,128,.2);color:var(--good)">Model ✓</span>` : wrong ? `<span class="pill" style="background:rgba(248,113,113,.2);color:var(--bad)">Model ✗</span>` : `<span class="pill">—</span>`;
    const pickLabel = p.prediction === "H" ? `${p.homeTeam} win` : p.prediction === "A" ? `${p.awayTeam} win` : p.prediction === "D" ? "Draw" : "result";
    const c = el("article", "card");
    c.innerHTML = `
      <div class="card-top"><span>${esc(p.matchdayLabel || p.league || "")} · ${esc(p.date || "")}</span>${verdict}</div>
      <div class="match">
        <div class="team">${flag(p.homeFlagUrl)}<span class="tn">${esc(p.homeTeam)}</span></div>
        <div class="score">${esc(String(pl.homeGoals))} : ${esc(String(pl.awayGoals))}</div>
        <div class="team">${flag(p.awayFlagUrl)}<span class="tn">${esc(p.awayTeam)}</span></div>
      </div>
      <div class="proj">Model pick: <b>${esc(pickLabel)}</b>${p.confidence != null ? ` (${esc(String(p.confidence))}%)` : ""} · proj ${esc(p.projectedScore || "—")}${pl.exactScoreCorrect ? " · exact ✓" : ""}</div>`;
    grid.appendChild(c);
  });
  stage.appendChild(grid);
}

/* ── Group Tables ────────────────────────────────────────────────────────── */
async function renderTables() {
  const data = await api("/api/international/group-tables");
  const groups = data.groups || [];
  const stage = $("#stage");
  stage.innerHTML = "";
  stage.appendChild(el("div", "section-head", `<h2>Group Tables</h2><span class="sub">live standings · auto-built from settled results</span>`));
  const grid = el("div", "grid");
  groups.forEach((g) => {
    const rows = (g.standings || []).map((r, i) => `
      <tr class="${i < 2 ? "adv" : ""}">
        <td><span class="rk">${i + 1}</span></td><td>${esc(r.team)}</td>
        <td>${r.played}</td><td>${r.wins}-${r.draws}-${r.losses}</td>
        <td>${r.goalsFor}:${r.goalsAgainst}</td><td><b>${r.points}</b></td>
      </tr>`).join("");
    const c = el("article", "card");
    c.innerHTML = `<div class="card-top"><span>Group ${esc(g.group)}</span><span>${g.appliedResults || 0} played</span></div>
      <table class="table"><thead><tr><th>#</th><th>Team</th><th>P</th><th>W-D-L</th><th>GF:GA</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table>`;
    grid.appendChild(c);
  });
  stage.appendChild(grid);
}

/* ── Go ──────────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", runSplash);
window.addEventListener("resize", positionCtxGlow);
