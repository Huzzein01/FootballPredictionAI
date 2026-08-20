"use strict";

// Free, keyless odds source used as a fallback when The Odds API is
// unavailable (e.g. out of usage credits). ESPN's public scoreboard API
// embeds real sportsbook lines (moneyline home/away/draw) on the same
// per-league scoreboard endpoint already used elsewhere for fixtures, so
// this reuses that endpoint and matches purely by espnEventId, which every
// fixture row already carries.

const fs = require("fs");
const { writeFileIfWritable } = require("./runtimePaths");
const { ESPN_LEAGUES, fixturePathForSeason } = require("./espnFixtureService");

const USER_AGENT = "Mozilla/5.0 FootballPredictionAI espn-odds-refresh";

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function readFixtureCsv(season) {
  const fixturePath = fixturePathForSeason(season);
  if (!fs.existsSync(fixturePath)) return { headers: [], rows: [] };
  const lines = fs.readFileSync(fixturePath, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines.shift() || "");
  const rows = lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
  return { headers, rows };
}

function writeFixtureCsv(headers, rows, season) {
  const finalHeaders = [...new Set([...headers, "date", "league", "homeTeam", "awayTeam", "homeOdds", "drawOdds", "awayOdds", "oddsSource", "oddsStatus", "oddsSourceUrl", "oddsSnapshotAt"])];
  const output = [finalHeaders.join(","), ...rows.map((row) => finalHeaders.map((header) => csvCell(row[header])).join(","))].join("\n") + "\n";
  writeFileIfWritable(fixturePathForSeason(season), output);
}

function hasUsableOdds(row) {
  return [row.homeOdds, row.drawOdds, row.awayOdds].every((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 100;
  });
}

function decimalFromAmerican(value) {
  const text = String(value ?? "").replace(/[^\d+-]/g, "");
  const n = Number(text);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function dateRange(daysBack = 3, daysForward = 60) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + daysForward);
  const stamp = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");
  return `${stamp(start)}-${stamp(end)}`;
}

function oddsFromEspnCompetition(competition) {
  const entries = competition?.odds || [];
  for (const entry of entries) {
    if (!entry) continue;
    const moneyline = entry.moneyline;
    if (!moneyline) continue;
    const homeOdds = decimalFromAmerican(moneyline.home?.close?.odds ?? moneyline.home?.open?.odds);
    const awayOdds = decimalFromAmerican(moneyline.away?.close?.odds ?? moneyline.away?.open?.odds);
    const drawOdds = decimalFromAmerican(moneyline.draw?.close?.odds ?? moneyline.draw?.open?.odds ?? entry.drawOdds?.moneyLine);
    if (!homeOdds || !awayOdds || !drawOdds) continue;
    return {
      homeOdds: homeOdds.toFixed(2),
      drawOdds: drawOdds.toFixed(2),
      awayOdds: awayOdds.toFixed(2),
      providerName: entry.provider?.displayName || entry.provider?.name || "ESPN sportsbook partner",
      sourceUrl: entry.link?.href || "",
    };
  }
  return null;
}

async function fetchLeagueOdds(league, dateWindow) {
  const code = ESPN_LEAGUES[league];
  if (!code) return { league, skipped: true, oddsByEventId: new Map() };
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${dateWindow}&limit=500`;
  const response = await fetch(sourceUrl, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`ESPN ${league} scoreboard failed: ${response.status}`);
  const payload = await response.json();
  const oddsByEventId = new Map();
  for (const event of payload.events || []) {
    const competition = event.competitions?.[0];
    const odds = oddsFromEspnCompetition(competition);
    if (!odds) continue;
    oddsByEventId.set(String(event.id || competition?.id || ""), { ...odds, sourceUrl: odds.sourceUrl || sourceUrl });
  }
  return { league, skipped: false, sourceUrl, oddsByEventId };
}

// Fill only rows that currently lack usable 1X2 odds, matching purely by the
// espnEventId every row already carries (set when the fixture itself was
// pulled from ESPN). Never overwrites odds that already came from another
// source (e.g. The Odds API) so this is safe to layer on top.
async function refreshEspnOdds({ force = false, daysBack = 3, daysForward = 60, season = "2025-26" } = {}) {
  const { headers, rows } = readFixtureCsv(season);
  if (!headers.length || !rows.length) return { checked: 0, updated: 0, leagues: [] };

  const dateWindow = dateRange(daysBack, daysForward);
  const targetLeagues = [...new Set(
    rows
      .filter((row) => (force || !hasUsableOdds(row)) && row.espnEventId && ESPN_LEAGUES[row.league])
      .map((row) => row.league)
  )];

  const leagueResults = [];
  const errors = [];
  for (const league of targetLeagues) {
    try {
      leagueResults.push(await fetchLeagueOdds(league, dateWindow));
    } catch (error) {
      errors.push({ league, message: error.message });
    }
  }

  const oddsByEventId = new Map();
  for (const result of leagueResults) {
    for (const [eventId, odds] of result.oddsByEventId) oddsByEventId.set(eventId, odds);
  }

  let checked = 0;
  let updated = 0;
  const filled = [];
  for (const row of rows) {
    if (!row.espnEventId) continue;
    if (!force && hasUsableOdds(row)) continue;
    checked += 1;
    const odds = oddsByEventId.get(String(row.espnEventId));
    if (!odds) continue;
    row.homeOdds = odds.homeOdds;
    row.drawOdds = odds.drawOdds;
    row.awayOdds = odds.awayOdds;
    row.oddsSource = `ESPN (${odds.providerName})`;
    row.oddsStatus = "Live bookmaker line (ESPN public API)";
    row.oddsSourceUrl = odds.sourceUrl;
    row.oddsSnapshotAt = new Date().toISOString();
    updated += 1;
    filled.push({ date: row.date, league: row.league, fixture: `${row.homeTeam} vs ${row.awayTeam}`, homeOdds: row.homeOdds, drawOdds: row.drawOdds, awayOdds: row.awayOdds });
  }

  if (updated) writeFixtureCsv(headers, rows, season);

  return {
    checked,
    updated,
    season,
    leagues: targetLeagues,
    dateWindow,
    errors,
    filled,
  };
}

// The site serves whichever season's fixture file matches the current
// calendar (last season's file lingers with a handful of unsettled rows,
// the new season's file is what "Upcoming Predictions" actually renders by
// default), so keep both topped up rather than guessing which one a caller
// meant.
async function refreshEspnOddsAllSeasons(options = {}) {
  const seasons = ["2025-26", "2026-27"];
  const results = [];
  for (const season of seasons) {
    results.push(await refreshEspnOdds({ ...options, season }));
  }
  return {
    checked: results.reduce((sum, r) => sum + r.checked, 0),
    updated: results.reduce((sum, r) => sum + r.updated, 0),
    seasons: results,
  };
}

module.exports = {
  refreshEspnOdds,
  refreshEspnOddsAllSeasons,
};
