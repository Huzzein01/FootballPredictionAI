#!/usr/bin/env node
"use strict";
/**
 * Fetches the latest FIFA Men's World Ranking from inside.fifa.com and stores
 * it as data/international/fifa_rankings.json for the international model.
 *
 * The public page is JS-rendered; the data comes from the JSON API
 *   https://inside.fifa.com/api/ranking-overview?locale=en&dateId=<id>
 * The list of available ranking dates is embedded in the page source, so we
 * scrape the newest dateId first, then pull the full table.
 *
 * Run:  node scripts/fetchFifaRankings.js
 */

const fs = require("fs");
const path = require("path");

const OUT_PATH = path.join(__dirname, "..", "data", "international", "fifa_rankings.json");
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" };

async function fetchText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.json();
}

async function main() {
  const page = await fetchText("https://inside.fifa.com/fifa-world-ranking/men");

  // dateIds look like "id14803"; the page embeds all available ranking dates.
  // Numerically newest id = latest ranking publication.
  const ids = [...new Set(page.match(/id\d{4,6}/g) || [])]
    .map((token) => ({ token, n: Number(token.slice(2)) }))
    .filter((entry) => Number.isFinite(entry.n))
    .sort((a, b) => b.n - a.n);
  if (!ids.length) throw new Error("No ranking dateIds found in page source");

  let data = null;
  let usedId = null;
  for (const { token } of ids.slice(0, 8)) {
    const candidate = await fetchJson(`https://inside.fifa.com/api/ranking-overview?locale=en&dateId=${token}`);
    if (Array.isArray(candidate.rankings) && candidate.rankings.length) {
      data = candidate;
      usedId = token;
      break;
    }
  }
  if (!data) throw new Error("No dateId returned a populated ranking table");

  const rankings = data.rankings.map((row) => {
    const item = row.rankingItem || row;
    return {
      rank: Number(item.rank),
      previousRank: Number(item.previousRank ?? row.previousRank ?? item.rank),
      team: String(item.name || "").trim(),
      countryCode: item.countryCode || "",
      points: Number(item.totalPoints),
      previousPoints: Number(row.previousPoints ?? item.previousPoints ?? item.totalPoints),
    };
  }).filter((row) => row.team && Number.isFinite(row.points));

  const output = {
    fetchedAt: new Date().toISOString(),
    dateId: usedId,
    rankingDate: data.dates?.find?.((d) => d.id === usedId)?.iso || data.rankingDate || "",
    sourceUrl: "https://inside.fifa.com/fifa-world-ranking/men",
    count: rankings.length,
    rankings,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`Saved ${rankings.length} rankings (dateId ${usedId}) to ${OUT_PATH}`);
  console.log("Top 10:", rankings.slice(0, 10).map((r) => `${r.rank}. ${r.team} ${r.points}`).join(" | "));
}

main().catch((err) => {
  console.error("FIFA ranking fetch failed:", err.message);
  process.exit(1);
});
