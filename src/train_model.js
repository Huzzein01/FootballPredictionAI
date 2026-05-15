const fs = require("fs");
const path = require("path");
const { buildCurrentFeatureVector, buildTrainingRows, FEATURE_NAMES } = require("./features");
const { evaluate, trainSoftmax } = require("./model");

const MODEL_DIR = path.join(process.cwd(), "model");
const MODEL_PATH = path.join(MODEL_DIR, "football_match_model.json");
const TRAINING_PATH = path.join(MODEL_DIR, "training_rows.json");
const TUNING_PATH = path.join(MODEL_DIR, "tuning_results.json");
const BACKTEST_PATH = path.join(process.cwd(), "data", "backtests.json");

function feedbackTrainingRows() {
  if (!fs.existsSync(BACKTEST_PATH)) return [];
  const store = JSON.parse(fs.readFileSync(BACKTEST_PATH, "utf8"));

  return (store.predictions || [])
    .filter((entry) => entry.status === "SETTLED" && ["H", "D", "A"].includes(entry.actualResult))
    .map((entry) => {
      const featureVector =
        Array.isArray(entry.featureVector) && entry.featureVector.length === FEATURE_NAMES.length
          ? entry.featureVector
          : buildCurrentFeatureVector(entry.league, entry.homeTeam, entry.awayTeam, entry.odds || {}, entry.season || "2025-26").features;
      return {
        season: "feedback",
        league: entry.league,
        date: entry.date || entry.settledAt || "",
        homeTeam: entry.homeTeam,
        awayTeam: entry.awayTeam,
        label: entry.actualResult,
        features: featureVector,
        sourceFile: "backtest-feedback",
      };
    });
}

function splitRows(rows) {
  const train = rows.filter((row) => row.sourceFile === "backtest-feedback" || !["2024-25", "2025-26"].includes(row.season));
  const validation = rows.filter((row) => row.season === "2024-25");
  const test = rows.filter((row) => row.season === "2025-26");
  return { train, validation, test };
}

function tune(train, validation) {
  const baseCandidates = [
    { learningRate: 0.04, l2: 0.001, epochs: 450, classWeights: {} },
    { learningRate: 0.06, l2: 0.001, epochs: 450, classWeights: {} },
    { learningRate: 0.04, l2: 0.003, epochs: 650, classWeights: {} },
    { learningRate: 0.03, l2: 0.0003, epochs: 650, classWeights: {} },
    { learningRate: 0.05, l2: 0.003, epochs: 550, classWeights: { D: 1.25 } },
    { learningRate: 0.04, l2: 0.001, epochs: 550, classWeights: { D: 1.5 } },
  ];
  const blends = [0, 0.25, 0.5, 0.75, 1];
  const candidates = [];

  for (const candidate of baseCandidates) {
    const model = trainSoftmax(train, candidate);
    model.featureNames = FEATURE_NAMES;
    for (const marketBlend of blends) {
      model.marketBlend = marketBlend;
      candidates.push({ ...candidate, marketBlend, metrics: evaluate(model, validation) });
    }
  }

  return candidates.sort((a, b) => b.metrics.accuracy - a.metrics.accuracy || a.metrics.logLoss - b.metrics.logLoss)[0];
}

function main() {
  const feedbackRows = feedbackTrainingRows();
  const rows = [...buildTrainingRows(), ...feedbackRows].filter((row) => row.features.every(Number.isFinite));
  const { train, validation, test } = splitRows(rows);
  const best = tune(train, validation);
  const finalTrain = [...train, ...validation];
  const model = trainSoftmax(finalTrain, {
    learningRate: best.learningRate,
    l2: best.l2,
    epochs: best.epochs,
    classWeights: best.classWeights,
  });
  model.featureNames = FEATURE_NAMES;
  model.marketBlend = best.marketBlend;
  const trainMetrics = evaluate(model, train);
  const validationMetrics = evaluate(model, validation);
  const testMetrics = evaluate(model, test);

  fs.mkdirSync(MODEL_DIR, { recursive: true });
  const artifact = {
    ...model,
    featureNames: FEATURE_NAMES,
    trainedAt: new Date().toISOString(),
    dataCoverage: "2020-21 through 2024-25 train/tune; 2025-26 partial holdout test",
    trainingPolicy:
      "Club form/stat model with current-season player goal, assist, shot, and shot-on-target strength features when imported from Thunderbit/FBref screenshots or CSVs. Training rows include pre-match table context for title-race pressure, European-place pressure, relegation pressure, secured-title rotation risk, and dead-rubber risk. Current predictions use refreshed public league-table context when available. Settled backtest match results are added to the training split as feedback rows. Missing player-stat fields default to zero by club/season.",
    feedbackRows: feedbackRows.length,
    hyperparameters: {
      learningRate: best.learningRate,
      l2: best.l2,
      epochs: best.epochs,
      classWeights: best.classWeights,
      marketBlend: best.marketBlend,
    },
    target: "FTR: H=home win, D=draw, A=away win",
    metrics: { train: trainMetrics, validation: validationMetrics, test: testMetrics },
  };
  fs.writeFileSync(MODEL_PATH, JSON.stringify(artifact, null, 2));
  fs.writeFileSync(TRAINING_PATH, JSON.stringify(rows, null, 2));
  fs.writeFileSync(TUNING_PATH, JSON.stringify(best, null, 2));

  console.log(`Model saved: ${MODEL_PATH}`);
  console.log(`Training rows saved: ${TRAINING_PATH}`);
  console.log(`Tuning result saved: ${TUNING_PATH}`);
  console.log(`Backtest feedback rows included: ${feedbackRows.length}`);
  console.log(`Best hyperparameters: learningRate=${best.learningRate}, l2=${best.l2}, epochs=${best.epochs}`);
  console.log(`Train accuracy: ${(trainMetrics.accuracy * 100).toFixed(1)}% | log loss: ${trainMetrics.logLoss.toFixed(3)}`);
  console.log(`2024-25 validation accuracy: ${(validationMetrics.accuracy * 100).toFixed(1)}% | log loss: ${validationMetrics.logLoss.toFixed(3)}`);
  console.log(`2025-26 holdout accuracy: ${(testMetrics.accuracy * 100).toFixed(1)}% | log loss: ${testMetrics.logLoss.toFixed(3)}`);
}

main();
process.exit(0);
