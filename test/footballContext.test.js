const test = require("node:test");
const assert = require("node:assert/strict");
const { chooseFootballContext } = require("../src/footballContext");

test("international fixture signal takes priority over an active club calendar", () => {
  const decision = chooseFootballContext({
    now: new Date("2026-08-04T12:00:00Z"),
    clubFixtures: [{ date: "2026-08-21", league: "EPL" }],
    internationalFixtures: [{ kickoffUtc: "2026-08-07T19:00:00Z", league: "International Friendly" }],
  });
  assert.equal(decision.context, "international");
  assert.match(decision.reason, /International fixture/);
});

test("active club fixtures select club mode when no international fixture is imminent", () => {
  const decision = chooseFootballContext({
    now: new Date("2026-08-04T12:00:00Z"),
    clubFixtures: [{ kickoffUtc: "2026-08-21T19:00:00Z", league: "EPL" }],
    internationalFixtures: [],
  });
  assert.equal(decision.context, "club");
  assert.equal(decision.season, "2026-27");
});
