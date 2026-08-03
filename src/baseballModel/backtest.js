"use strict";

const { chronologicalFolds } = require("./regression");
const { trainBaseballModel } = require("./pipeline");
const { fitCountRegression } = require("./countRegression");

function distribution(mean, variance, limit = 35) {
  const safeMean = Math.max(0.05, mean);
  if (variance <= safeMean + 0.01) {
    const values = [Math.exp(-safeMean)];
    for (let score = 1; score <= limit; score += 1) values.push(values[score - 1] * safeMean / score);
    return values;
  }
  const shape = Math.max(0.05, safeMean * safeMean / (variance - safeMean));
  const probability = shape / (shape + safeMean);
  const values = [Math.pow(probability, shape)];
  for (let score = 1; score <= limit; score += 1) values.push(values[score - 1] * ((score - 1 + shape) / score) * (1 - probability));
  return values;
}

function homeWinProbability(homeMean, awayMean, homeVariance, awayVariance) {
  const home = distribution(homeMean, homeVariance);
  const away = distribution(awayMean, awayVariance);
  let probability = 0;
  home.forEach((homeP, homeRuns) => away.forEach((awayP, awayRuns) => { if (homeRuns > awayRuns) probability += homeP * awayP; else if (homeRuns === awayRuns) probability += homeP * awayP / 2; }));
  return Math.max(0.001, Math.min(0.999, probability));
}

function metrics(predictions) {
  const count = predictions.length;
  const absolute = predictions.flatMap((row) => [Math.abs(row.homeRuns - row.homeExpected), Math.abs(row.awayRuns - row.awayExpected)]);
  const squared = predictions.flatMap((row) => [(row.homeRuns - row.homeExpected) ** 2, (row.awayRuns - row.awayExpected) ** 2]);
  const logLoss = predictions.reduce((sum, row) => sum - Math.log(row.homeWon ? row.homeWinProbability : 1 - row.homeWinProbability), 0) / count;
  const brier = predictions.reduce((sum, row) => sum + (Number(row.homeWon) - row.homeWinProbability) ** 2, 0) / count;
  const bins = Array.from({ length: 10 }, () => ({ count: 0, probability: 0, outcome: 0 }));
  predictions.forEach((row) => { const bin = bins[Math.min(9, Math.floor(row.homeWinProbability * 10))]; bin.count += 1; bin.probability += row.homeWinProbability; bin.outcome += Number(row.homeWon); });
  const calibration = bins.map((bin, index) => ({ bin: index, count: bin.count, averageProbability: bin.count ? bin.probability / bin.count : null, empiricalWinRate: bin.count ? bin.outcome / bin.count : null })).filter((bin) => bin.count);
  const ece = calibration.reduce((sum, bin) => sum + (bin.count / count) * Math.abs(bin.averageProbability - bin.empiricalWinRate), 0);
  return { games: count, logLoss, brier, calibrationError: ece, runMae: absolute.reduce((sum, value) => sum + value, 0) / absolute.length, runRmse: Math.sqrt(squared.reduce((sum, value) => sum + value, 0) / squared.length), calibration };
}

function candidates() {
  return {
    ridge: (train) => { const model = trainBaseballModel(train); return { predict: (snapshot) => ({ homeExpected: Math.max(0.1, model.homeModel.predict(require("./features").vector(snapshot))), awayExpected: Math.max(0.1, model.awayModel.predict(require("./features").vector(snapshot))), homeVariance: model.residualVariance.home, awayVariance: model.residualVariance.away }) }; },
    poisson: (train) => { const home = fitCountRegression(train, "homeRuns"); const away = fitCountRegression(train, "awayRuns"); return { predict: (snapshot) => ({ homeExpected: home.predict(snapshot), awayExpected: away.predict(snapshot), homeVariance: home.predict(snapshot), awayVariance: away.predict(snapshot) }) }; },
    negativeBinomial: (train) => { const home = fitCountRegression(train, "homeRuns", { distribution: "negative-binomial" }); const away = fitCountRegression(train, "awayRuns", { distribution: "negative-binomial" }); return { predict: (snapshot) => { const homeExpected = home.predict(snapshot), awayExpected = away.predict(snapshot); return { homeExpected, awayExpected, homeVariance: homeExpected + homeExpected ** 2 / home.dispersion, awayVariance: awayExpected + awayExpected ** 2 / away.dispersion }; } }; },
  };
}

function runChronologicalBacktest(rows, { folds = 4 } = {}) {
  const result = { contract: "baseball-chronological-backtest-v1", folds: [], models: {} };
  const builders = candidates();
  Object.keys(builders).forEach((name) => { result.models[name] = []; });
  chronologicalFolds(rows, folds).forEach(({ train, test }, fold) => {
    const period = { fold: fold + 1, trainRows: train.length, testRows: test.length, trainEndsAt: train.at(-1).snapshot.firstPitchUtc, testStartsAt: test[0].snapshot.firstPitchUtc };
    result.folds.push(period);
    Object.entries(builders).forEach(([name, build]) => {
      const model = build(train);
      test.forEach((row) => { const prediction = model.predict(row.snapshot); result.models[name].push({ homeRuns: Number(row.homeRuns), awayRuns: Number(row.awayRuns), homeWon: Number(row.homeRuns) > Number(row.awayRuns), homeWinProbability: homeWinProbability(prediction.homeExpected, prediction.awayExpected, prediction.homeVariance, prediction.awayVariance), ...prediction }); });
    });
  });
  result.metrics = Object.fromEntries(Object.entries(result.models).map(([name, predictions]) => [name, metrics(predictions)]));
  delete result.models;
  return result;
}

module.exports = { runChronologicalBacktest, homeWinProbability, metrics };
