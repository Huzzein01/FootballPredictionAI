const LABELS = ["H", "D", "A"];

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values, avg) {
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) || 1;
}

function fitScaler(rows) {
  const featureCount = rows[0].features.length;
  const means = [];
  const stds = [];
  for (let i = 0; i < featureCount; i += 1) {
    const column = rows.map((row) => row.features[i]);
    const avg = mean(column);
    means.push(avg);
    stds.push(std(column, avg));
  }
  return { means, stds };
}

function transform(features, scaler) {
  return features.map((value, i) => (value - scaler.means[i]) / scaler.stds[i]);
}

function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

function linearPredictProba(model, features) {
  const x = [1, ...transform(features, model.scaler)];
  const scores = model.weights.map((weights) => weights.reduce((sum, weight, i) => sum + weight * x[i], 0));
  const probabilities = softmax(scores);
  return Object.fromEntries(model.labels.map((label, i) => [label, probabilities[i]]));
}

function marketProba(model, features) {
  const names = model.featureNames || [];
  const start = names.indexOf("marketHomeProb");
  if (start < 0) return { H: 1 / 3, D: 1 / 3, A: 1 / 3 };
  return { H: features[start], D: features[start + 1], A: features[start + 2] };
}

function predictProba(model, features) {
  const learned = linearPredictProba(model, features);
  const market = marketProba(model, features);
  const marketWeight = model.marketBlend ?? 0;
  return Object.fromEntries(
    model.labels.map((label) => [label, learned[label] * (1 - marketWeight) + market[label] * marketWeight])
  );
}

function trainSoftmax(rows, options = {}) {
  const scaler = fitScaler(rows);
  const labels = LABELS;
  const featureCount = rows[0].features.length + 1;
  const weights = labels.map(() => Array(featureCount).fill(0));
  const learningRate = options.learningRate ?? 0.04;
  const epochs = options.epochs ?? 900;
  const l2 = options.l2 ?? 0.001;
  const classWeights = options.classWeights || {};

  const xs = rows.map((row) => [1, ...transform(row.features, scaler)]);
  const ys = rows.map((row) => labels.indexOf(row.label));
  const rowWeights = rows.map((row) => classWeights[row.label] ?? 1);
  const totalWeight = rowWeights.reduce((sum, value) => sum + value, 0);

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradients = labels.map(() => Array(featureCount).fill(0));
    for (let r = 0; r < xs.length; r += 1) {
      const x = xs[r];
      const scores = weights.map((classWeights) => classWeights.reduce((sum, weight, i) => sum + weight * x[i], 0));
      const probs = softmax(scores);
      const rowWeight = rowWeights[r];
      for (let c = 0; c < labels.length; c += 1) {
        const error = (probs[c] - (ys[r] === c ? 1 : 0)) * rowWeight;
        for (let i = 0; i < featureCount; i += 1) gradients[c][i] += error * x[i];
      }
    }

    for (let c = 0; c < labels.length; c += 1) {
      for (let i = 0; i < featureCount; i += 1) {
        const penalty = i === 0 ? 0 : l2 * weights[c][i];
        weights[c][i] -= learningRate * (gradients[c][i] / totalWeight + penalty);
      }
    }
  }

  return { type: "softmax-logistic-regression", labels, scaler, weights };
}

function evaluate(model, rows) {
  const confusion = Object.fromEntries(LABELS.map((a) => [a, Object.fromEntries(LABELS.map((p) => [p, 0]))]));
  let correct = 0;
  let logLoss = 0;
  for (const row of rows) {
    const probs = predictProba(model, row.features);
    const predicted = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0];
    if (predicted === row.label) correct += 1;
    confusion[row.label][predicted] += 1;
    logLoss -= Math.log(Math.max(probs[row.label], 1e-12));
  }
  return {
    rows: rows.length,
    accuracy: correct / rows.length,
    logLoss: logLoss / rows.length,
    confusion,
  };
}

module.exports = {
  LABELS,
  evaluate,
  linearPredictProba,
  predictProba,
  trainSoftmax,
};
