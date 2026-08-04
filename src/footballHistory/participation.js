"use strict";

const { isDatedVerifiedMatch } = require("./scope");

// This is an observed participation index, not an assertion of complete
// participation. A source-backed index lets collectors target known gaps while
// preserving the distinction between no record and no appearance.
function observedParticipation(record, { through = "9999-12-31" } = {}) {
  const rows = new Map();
  for (const match of record?.matches || []) {
    if (!isDatedVerifiedMatch(match, { through })) continue;
    const competition = match.competition || {};
    const key = [match.season, competition.name, competition.type, competition.country].join("|");
    const existing = rows.get(key) || {
      season: match.season,
      competition: { name: competition.name || "Unknown", type: competition.type || "unknown", country: competition.country || "" },
      firstMatch: match.date,
      lastMatch: match.date,
      datedMatchCount: 0,
      sourceIds: [],
    };
    existing.firstMatch = existing.firstMatch < match.date ? existing.firstMatch : match.date;
    existing.lastMatch = existing.lastMatch > match.date ? existing.lastMatch : match.date;
    existing.datedMatchCount += 1;
    existing.sourceIds.push(match.id);
    rows.set(key, existing);
  }
  return [...rows.values()].map((entry) => ({ ...entry, sourceIds: [...new Set(entry.sourceIds)].sort() }))
    .sort((a, b) => a.season.localeCompare(b.season) || a.competition.name.localeCompare(b.competition.name));
}

module.exports = { observedParticipation };
