"use strict";

const { vector } = require("./features");

function mean(values) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function variance(values) { const avg = mean(values); return mean(values.map((value) => (value - avg) ** 2)); }

function fitCountRegression(rows, target, { distribution = "poisson", epochs = 220, learningRate = 0.035, l2 = 0.01 } = {}) {
  const inputs = rows.map((row) => vector(row.snapshot));
  const targets = rows.map((row) => Number(row[target]));
  const width = inputs[0].length;
  const scales = Array.from({ length: width }, (_, index) => ({ center: mean(inputs.map((row) => row[index])), spread: Math.sqrt(variance(inputs.map((row) => row[index]))) || 1 }));
  const x = inputs.map((row) => [1, ...row.map((value, index) => (value - scales[index].center) / scales[index].spread)]);
  const targetMean = Math.max(0.1, mean(targets));
  const targetVariance = variance(targets);
  const dispersion = Math.max(0.5, Math.min(1000, targetVariance > targetMean ? (targetMean * targetMean) / (targetVariance - targetMean) : 1000));
  const weights = [Math.log(targetMean), ...Array(width).fill(0)];
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = Array(width + 1).fill(0);
    x.forEach((row, index) => {
      const eta = Math.max(-4, Math.min(4, row.reduce((sum, value, column) => sum + value * weights[column], 0)));
      const predicted = Math.exp(eta);
      const residual = distribution === "negative-binomial" ? (predicted - targets[index]) / (1 + predicted / dispersion) : predicted - targets[index];
      row.forEach((value, column) => { gradient[column] += residual * value; });
    });
    weights.forEach((_, index) => { const penalty = index ? l2 * weights[index] : 0; weights[index] -= learningRate * ((gradient[index] / x.length) + penalty); });
  }
  return { distribution, dispersion, scales, weights, predict(snapshot) { const values = vector(snapshot); const eta = Math.max(-4, Math.min(4, weights[0] + values.reduce((sum, value, index) => sum + weights[index + 1] * ((value - scales[index].center) / scales[index].spread), 0))); return Math.exp(eta); } };
}

module.exports = { fitCountRegression };
