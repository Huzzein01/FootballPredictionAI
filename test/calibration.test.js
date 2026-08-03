"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const { decimalFromAmerican, noVigMoneyline } = require("../src/baseballModel/odds");
const { fitPlattScaler, selectMarketBlend, applyCalibration } = require("../src/baseballModel/calibration");
test("odds conversion removes two-way vig", () => { assert.equal(decimalFromAmerican(150), 2.5); assert.equal(decimalFromAmerican(-200), 1.5); const market = noVigMoneyline({ homeAmerican: -110, awayAmerican: -110 }); assert.ok(Math.abs(market.homeProbability - 0.5) < 1e-10); assert.ok(market.overround > 1); });
test("market blending requires held-out validation", () => { const rows = Array.from({ length: 40 }, (_, index) => ({ modelProbability: 0.35 + (index % 5) * 0.1, marketProbability: 0.4 + (index % 4) * 0.08, homeWon: index % 2 })); const platt = fitPlattScaler(rows); const selected = selectMarketBlend(rows, platt); assert.equal(selected.validated, true); assert.ok(applyCalibration(0.5, selected) > 0 && applyCalibration(0.5, selected) < 1); assert.equal(selectMarketBlend(rows.slice(0, 5), platt).validated, false); });
