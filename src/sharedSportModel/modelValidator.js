"use strict";

const fs = require("fs");

function averageMae(selection) {
  const values = [selection?.home?.validationMae, selection?.away?.validationMae].filter((value) => Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// Only promote a freshly trained candidate model over whatever is currently
// live if it isn't meaningfully worse — protects production predictions
// from an automated retrain (e.g. a data-fetch hiccup producing a thin or
// skewed training set) silently degrading accuracy. maxRegressionRatio is
// generous (allows up to 15% worse validation MAE) since chronological
// cross-validation on a growing season is naturally noisy game to game.
function validateCandidate(candidateModel, livePath, { maxRegressionRatio = 1.15 } = {}) {
  const candidateMae = averageMae(candidateModel.selection);
  if (!fs.existsSync(livePath)) {
    return { promote: true, reason: "no live model yet", candidateMae, liveMae: null };
  }
  let liveModel;
  try {
    liveModel = JSON.parse(fs.readFileSync(livePath, "utf8"));
  } catch {
    return { promote: true, reason: "live model file unreadable", candidateMae, liveMae: null };
  }
  const liveMae = averageMae(liveModel.selection);
  if (!Number.isFinite(candidateMae) || !Number.isFinite(liveMae)) {
    return { promote: true, reason: "MAE unavailable on one side, promoting by default", candidateMae, liveMae };
  }
  if (candidateMae > liveMae * maxRegressionRatio) {
    return { promote: false, reason: `candidate MAE ${candidateMae.toFixed(3)} is more than ${maxRegressionRatio}x live MAE ${liveMae.toFixed(3)}`, candidateMae, liveMae };
  }
  return { promote: true, reason: "candidate MAE within tolerance", candidateMae, liveMae };
}

module.exports = { validateCandidate, averageMae };
