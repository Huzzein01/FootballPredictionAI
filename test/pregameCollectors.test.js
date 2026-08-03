"use strict";
const fs = require("fs"); const os = require("os"); const path = require("path"); const test = require("node:test"); const assert = require("node:assert/strict");
const { collectPregameFeatures } = require("../src/baseballModel/pregameCollectors");
test("collectors timestamp form and safely mark unavailable pregame fields", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mlb-collectors-")); const capturedAt = "2026-07-30T12:00:00Z";
  const history = { dates: [{ games: [{ gameDate: "2026-07-29T18:00:00Z", status: { abstractGameState: "Final" }, teams: { home: { team: { name: "Home" }, score: 5 }, away: { team: { name: "Away" }, score: 3 } } }] }] };
  const feed = { gameData: { probablePitchers: { home: { fullName: "Home Starter" }, away: { fullName: "Away Starter" } }, weather: { temp: "75" }, status: { detailedState: "Pre-Game" } }, liveData: { boxscore: { teams: { home: { battingOrder: [1, 2] }, away: { battingOrder: [3, 4] } } } } };
  const fetchImpl = async (url) => ({ ok: true, json: async () => url.includes("schedule?") ? history : feed });
  const schedule = { games: [{ gameId: "mlb:1", firstPitchUtc: "2026-07-31T18:00:00Z", homeTeam: "Home", awayTeam: "Away", venue: "Park", status: "Scheduled", schedule: { source: "schedule", observedAt: capturedAt, availableAt: capturedAt, quality: "known" } }] };
  const result = await collectPregameFeatures({ normalizedSchedule: schedule, capturedAt, root, fetchImpl }); assert.equal(result.captured, 1);
  const snapshot = JSON.parse(fs.readFileSync(result.snapshots[0].filePath, "utf8")); assert.equal(snapshot.features.teamForm.quality, "known"); assert.equal(snapshot.features.startingPitchers.quality, "partial"); assert.equal(snapshot.features.bullpen.quality, "unknown");
});
