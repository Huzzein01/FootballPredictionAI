"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { validateCandidate, averageMae } = require("../src/sharedSportModel/modelValidator");

function tempModelPath(model) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "model-validator-test-"));
  const file = path.join(dir, "live_model.json");
  if (model) fs.writeFileSync(file, JSON.stringify(model));
  return file;
}

test("averageMae averages home/away validation MAE, ignoring missing sides", () => {
  assert.equal(averageMae({ home: { validationMae: 2 }, away: { validationMae: 4 } }), 3);
  assert.equal(averageMae({ home: { validationMae: 5 } }), 5);
  assert.equal(averageMae({}), null);
});

test("promotes automatically when there is no live model yet", () => {
  const livePath = tempModelPath(null);
  const verdict = validateCandidate({ selection: { home: { validationMae: 3 }, away: { validationMae: 3 } } }, livePath);
  assert.equal(verdict.promote, true);
  assert.equal(verdict.reason, "no live model yet");
});

test("promotes a candidate with equal or better MAE than the live model", () => {
  const livePath = tempModelPath({ selection: { home: { validationMae: 5 }, away: { validationMae: 5 } } });
  const verdict = validateCandidate({ selection: { home: { validationMae: 4 }, away: { validationMae: 4 } } }, livePath);
  assert.equal(verdict.promote, true);
  assert.equal(verdict.liveMae, 5);
  assert.equal(verdict.candidateMae, 4);
});

test("promotes a candidate within the regression tolerance", () => {
  const livePath = tempModelPath({ selection: { home: { validationMae: 10 }, away: { validationMae: 10 } } });
  // 11.4 is within the default 15% tolerance (10 * 1.15 = 11.5).
  const verdict = validateCandidate({ selection: { home: { validationMae: 11.4 }, away: { validationMae: 11.4 } } }, livePath);
  assert.equal(verdict.promote, true);
});

test("rejects a candidate that regresses beyond the tolerance", () => {
  const livePath = tempModelPath({ selection: { home: { validationMae: 10 }, away: { validationMae: 10 } } });
  // 12 exceeds 10 * 1.15 = 11.5.
  const verdict = validateCandidate({ selection: { home: { validationMae: 12 }, away: { validationMae: 12 } } }, livePath);
  assert.equal(verdict.promote, false);
  assert.match(verdict.reason, /more than 1\.15x/);
});

test("respects a custom regression ratio", () => {
  const livePath = tempModelPath({ selection: { home: { validationMae: 10 }, away: { validationMae: 10 } } });
  const verdict = validateCandidate({ selection: { home: { validationMae: 10.5 }, away: { validationMae: 10.5 } } }, livePath, { maxRegressionRatio: 1.02 });
  assert.equal(verdict.promote, false);
});

test("promotes by default when the live model file is unreadable or has no MAE", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "model-validator-test-"));
  const corruptPath = path.join(dir, "corrupt.json");
  fs.writeFileSync(corruptPath, "{ not valid json");
  const verdict = validateCandidate({ selection: { home: { validationMae: 5 }, away: { validationMae: 5 } } }, corruptPath);
  assert.equal(verdict.promote, true);
  assert.equal(verdict.reason, "live model file unreadable");
});
