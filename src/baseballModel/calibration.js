"use strict";

function clamp(value) { return Math.max(0.001, Math.min(0.999, Number(value))); }
function logit(value) { const p = clamp(value); return Math.log(p / (1 - p)); }
function sigmoid(value) { return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, value)))); }
function logLoss(rows, key) { return rows.reduce((sum, row) => sum - Math.log(row.homeWon ? clamp(row[key]) : 1 - clamp(row[key])), 0) / Math.max(1, rows.length); }

function fitPlattScaler(observations, { epochs = 400, learningRate = 0.05 } = {}) {
  if (!Array.isArray(observations) || observations.length < 30) throw new Error("Platt calibration requires at least 30 held-out observations");
  let intercept = 0, slope = 1;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    let interceptGradient = 0, slopeGradient = 0;
    observations.forEach((row) => { const feature = logit(row.modelProbability); const residual = sigmoid(intercept + slope * feature) - Number(row.homeWon); interceptGradient += residual; slopeGradient += residual * feature; });
    intercept -= learningRate * interceptGradient / observations.length;
    slope -= learningRate * slopeGradient / observations.length;
  }
  return { method: "platt-v1", intercept, slope, observations: observations.length, apply: (probability) => sigmoid(intercept + slope * logit(probability)) };
}

function selectMarketBlend(observations, platt, weights = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) {
  const usable = observations.filter((row) => Number.isFinite(row.marketProbability));
  if (usable.length < 30) return { validated: false, reason: "Insufficient held-out market observations", weight: 0 };
  const scored = weights.map((weight) => {
    const rows = usable.map((row) => ({ ...row, blended: platt.apply(row.modelProbability) * (1 - weight) + row.marketProbability * weight }));
    return { weight, validationLogLoss: logLoss(rows, "blended") };
  }).sort((left, right) => left.validationLogLoss - right.validationLogLoss);
  return { validated: true, method: "platt-market-blend-v1", platt: { method: platt.method, intercept: platt.intercept, slope: platt.slope }, observations: usable.length, ...scored[0] };
}

function applyCalibration(probability, calibration) {
  if (!calibration?.platt) return probability;
  return sigmoid(calibration.platt.intercept + calibration.platt.slope * logit(probability));
}

module.exports = { fitPlattScaler, selectMarketBlend, applyCalibration };
