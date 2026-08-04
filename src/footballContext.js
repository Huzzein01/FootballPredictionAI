function timestampFor(fixture) {
  const value = fixture?.kickoffUtc || fixture?.date || "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function classifyFixtureWindow(fixtures, now = new Date()) {
  const nowMs = now.getTime();
  const internationalWindowMs = 7 * 86_400_000;
  const clubWindowMs = 45 * 86_400_000;
  const recentClubWindowMs = 21 * 86_400_000;
  const sorted = (fixtures || [])
    .map((fixture) => ({ fixture, timestamp: timestampFor(fixture) }))
    .filter((entry) => entry.timestamp != null)
    .sort((left, right) => left.timestamp - right.timestamp);
  return {
    live: sorted.find(({ fixture }) => fixture.statusState === "in" || fixture.statusState === "in_progress")?.fixture || null,
    upcoming: sorted.find(({ timestamp }) => timestamp >= nowMs && timestamp - nowMs <= internationalWindowMs)?.fixture || null,
    clubActive: sorted.some(({ timestamp }) => timestamp >= nowMs - recentClubWindowMs && timestamp <= nowMs + clubWindowMs),
  };
}

function clubSeasonFor(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  return month >= 7 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

function chooseFootballContext({ now = new Date(), clubFixtures = [], internationalFixtures = [] } = {}) {
  const international = classifyFixtureWindow(internationalFixtures, now);
  if (international.live) {
    return { context: "international", reason: `Live ${international.live.league || "international"} fixture`, fixture: international.live, season: "international" };
  }
  if (international.upcoming) {
    return { context: "international", reason: `International fixture within seven days`, fixture: international.upcoming, season: "international" };
  }

  const club = classifyFixtureWindow(clubFixtures, now);
  if (club.clubActive) {
    return { context: "club", reason: `Active ${clubSeasonFor(now)} club fixture calendar`, fixture: club.upcoming, season: clubSeasonFor(now) };
  }
  return { context: "club", reason: "No current international fixture signal", fixture: club.upcoming, season: clubSeasonFor(now) };
}

module.exports = { chooseFootballContext, clubSeasonFor };
