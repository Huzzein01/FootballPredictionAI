"use strict";

// The historical model may use a partial record.  It must never infer an
// appearance from a club's age, a season gap, or an undated aggregate result.
const MIN_TRAINING_DATE = "1985-01-01";

const MAJOR_COMPETITION_TYPES = new Set(["league", "cup", "playoff", "continental", "club-world"]);

function isDatedVerifiedMatch(match, { through = "9999-12-31" } = {}) {
  return Boolean(
    match
    && /^\d{4}-\d{2}-\d{2}$/.test(match.date || "")
    && match.date >= MIN_TRAINING_DATE
    && match.date <= through
    && Number.isFinite(Number(match?.score?.for))
    && Number.isFinite(Number(match?.score?.against))
    && ((Array.isArray(match.sources) && match.sources.some((source) => source?.url && source?.retrievedAt)) || match.sourceRef)
  );
}

// Friendlies are deliberately narrow.  We include a preseason game only when
// its date, score, opponent and cross-confederation context are explicit.
function isInScopeMatch(match, options = {}) {
  if (!isDatedVerifiedMatch(match, options)) return false;
  if (MAJOR_COMPETITION_TYPES.has(match?.competition?.type)) return true;
  return match?.competition?.type === "friendly"
    && match?.competition?.preseason === true
    && ["Europe", "South America"].includes(match?.competition?.opponentConfederation);
}

module.exports = { MIN_TRAINING_DATE, MAJOR_COMPETITION_TYPES, isDatedVerifiedMatch, isInScopeMatch };
