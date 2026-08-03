"use strict";

function decimalFromAmerican(value) {
  const odds = Number(value);
  if (!Number.isFinite(odds) || odds === 0) return null;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

function impliedProbability(decimal) {
  const odds = Number(decimal);
  return odds > 1 ? 1 / odds : null;
}

function noVigMoneyline(odds = {}) {
  const homeDecimal = Number(odds.homeDecimal) || decimalFromAmerican(odds.homeAmerican);
  const awayDecimal = Number(odds.awayDecimal) || decimalFromAmerican(odds.awayAmerican);
  const home = impliedProbability(homeDecimal), away = impliedProbability(awayDecimal);
  if (home == null || away == null) return null;
  return { homeProbability: home / (home + away), awayProbability: away / (home + away), homeDecimal, awayDecimal, overround: home + away };
}

module.exports = { decimalFromAmerican, impliedProbability, noVigMoneyline };
