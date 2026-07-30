"use strict";

function mean(values) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }

function solve(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    if (Math.abs(augmented[pivot][col]) < 1e-10) augmented[pivot][col] += 1e-8;
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];
    const divisor = augmented[col][col];
    for (let j = col; j <= n; j += 1) augmented[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j <= n; j += 1) augmented[row][j] -= factor * augmented[col][j];
    }
  }
  return augmented.map((row) => row[n]);
}

function fitRidge(rows, targets, alpha = 1) {
  if (!rows.length) throw new Error("Cannot train a model with no rows");
  const width = rows[0].length;
  const scales = Array.from({ length: width }, (_, index) => {
    const values = rows.map((row) => row[index]);
    const center = mean(values);
    const spread = Math.sqrt(mean(values.map((value) => (value - center) ** 2))) || 1;
    return { center, spread };
  });
  const x = rows.map((row) => [1, ...row.map((value, index) => (value - scales[index].center) / scales[index].spread)]);
  const p = width + 1;
  const xtx = Array.from({ length: p }, () => Array(p).fill(0));
  const xty = Array(p).fill(0);
  x.forEach((row, i) => row.forEach((left, a) => {
    xty[a] += left * targets[i];
    row.forEach((right, b) => { xtx[a][b] += left * right; });
  }));
  for (let i = 1; i < p; i += 1) xtx[i][i] += alpha;
  const weights = solve(xtx, xty);
  return { alpha, scales, weights, predict(row) { return weights[0] + row.reduce((sum, value, index) => sum + weights[index + 1] * ((value - scales[index].center) / scales[index].spread), 0); } };
}

function chronologicalFolds(rows, folds = 4) {
  const ordered = [...rows].sort((a, b) => Date.parse(a.snapshot.firstPitchUtc) - Date.parse(b.snapshot.firstPitchUtc));
  const start = Math.max(8, Math.floor(ordered.length / (folds + 1)));
  const result = [];
  for (let split = start; split < ordered.length; split += start) {
    const test = ordered.slice(split, Math.min(split + start, ordered.length));
    if (test.length) result.push({ train: ordered.slice(0, split), test });
  }
  return result;
}

function chooseAlpha(rows, target, vector, candidates = [0, 0.1, 1, 5, 20]) {
  const folds = chronologicalFolds(rows);
  if (!folds.length) return { alpha: 1, validationMae: null };
  const scored = candidates.map((alpha) => {
    const errors = [];
    folds.forEach(({ train, test }) => {
      const model = fitRidge(train.map((row) => vector(row.snapshot)), train.map((row) => Number(row[target])), alpha);
      test.forEach((row) => errors.push(Math.abs(model.predict(vector(row.snapshot)) - Number(row[target]))));
    });
    return { alpha, validationMae: mean(errors) };
  });
  return scored.sort((a, b) => a.validationMae - b.validationMae)[0];
}

module.exports = { fitRidge, chronologicalFolds, chooseAlpha };
