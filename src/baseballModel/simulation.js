"use strict";

function random(seed = 42) { let state = seed >>> 0; return () => { state += 0x6D2B79F5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; }; }
function poisson(lambda, next) { let count = 0; let probability = Math.exp(-Math.max(0.01, lambda)); let product = 1; do { count += 1; product *= next(); } while (product > probability); return count - 1; }
function gamma(shape, scale, next) {
  if (shape < 1) return gamma(shape + 1, scale, next) * Math.pow(next(), 1 / shape);
  const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { const x = Math.sqrt(-2 * Math.log(next())) * Math.cos(2 * Math.PI * next()); const v = (1 + c * x) ** 3; if (v > 0 && Math.log(next()) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale; }
}
function countSample(mean, variance, next) {
  if (variance <= mean + 0.05) return poisson(mean, next);
  const shape = (mean * mean) / Math.max(0.01, variance - mean);
  return poisson(gamma(shape, mean / shape, next), next);
}

function simulateGame({ homeRuns, awayRuns, homeVariance, awayVariance, sharedVariance = 0, simulations = 20000, seed = 42 }) {
  const next = random(seed); let homeWins = 0, ties = 0, totalRuns = 0, homeCover = 0;
  const scoreCounts = new Map();
  for (let i = 0; i < simulations; i += 1) {
    // A shared Gamma game-environment multiplier captures park/weather/game
    // variance that pushes both offenses in the same direction.
    const environment = sharedVariance > 0 ? gamma(1 / sharedVariance, sharedVariance, next) : 1;
    const home = countSample(Math.max(0.1, homeRuns * environment), Math.max(homeRuns * environment, homeVariance || homeRuns), next);
    const away = countSample(Math.max(0.1, awayRuns * environment), Math.max(awayRuns * environment, awayVariance || awayRuns), next);
    if (home > away) homeWins += 1; else if (home === away) ties += 1;
    if (home - away > 1.5) homeCover += 1;
    totalRuns += home + away;
    const key = `${home}-${away}`;
    scoreCounts.set(key, (scoreCounts.get(key) || 0) + 1);
  }
  // Baseball cannot settle tied: allocate extra-inning ties evenly in the
  // absence of a team-specific extra-inning model.
  const scoreDistribution = [...scoreCounts.entries()]
    .map(([score, count]) => { const [homeRuns, awayRuns] = score.split("-").map(Number); return { homeRuns, awayRuns, probability: count / simulations }; })
    .sort((left, right) => right.probability - left.probability || left.homeRuns - right.homeRuns || left.awayRuns - right.awayRuns);
  return { homeWinProbability: (homeWins + ties / 2) / simulations, awayWinProbability: 1 - (homeWins + ties / 2) / simulations, homeRunLineMinus1_5: homeCover / simulations, expectedTotalRuns: totalRuns / simulations, scoreDistribution, sharedVariance, seed, simulations };
}

function impliedHomeProbability(odds) {
  const home = Number(odds?.homeDecimal), away = Number(odds?.awayDecimal);
  if (!(home > 1 && away > 1)) return null;
  const h = 1 / home, a = 1 / away;
  return h / (h + a);
}

function blendMarketProbability(modelProbability, odds, marketWeight = 0.2) {
  const market = impliedHomeProbability(odds);
  if (market == null) return modelProbability;
  return modelProbability * (1 - marketWeight) + market * marketWeight;
}

module.exports = { simulateGame, blendMarketProbability, impliedHomeProbability };
