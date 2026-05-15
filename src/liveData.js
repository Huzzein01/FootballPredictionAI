const PROVIDERS = {
  footballData: {
    name: "football-data.org",
    envKey: "FOOTBALL_DATA_API_KEY",
    baseUrl: "https://api.football-data.org/v4",
  },
  apiFootball: {
    name: "API-Football",
    envKey: "APISPORTS_KEY",
    baseUrl: "https://v3.football.api-sports.io",
  },
  theSportsDb: {
    name: "TheSportsDB",
    envKey: "THESPORTSDB_API_KEY",
    baseUrl: "https://www.thesportsdb.com/api/v2/json",
  },
};

async function fetchFootballData(path) {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error("Set FOOTBALL_DATA_API_KEY to use football-data.org live data.");
  const response = await fetch(`${PROVIDERS.footballData.baseUrl}${path}`, {
    headers: { "X-Auth-Token": key },
  });
  if (!response.ok) throw new Error(`football-data.org returned ${response.status}`);
  return response.json();
}

async function fetchApiFootball(path) {
  const key = process.env.APISPORTS_KEY;
  if (!key) throw new Error("Set APISPORTS_KEY to use API-Football live/player data.");
  const response = await fetch(`${PROVIDERS.apiFootball.baseUrl}${path}`, {
    headers: { "x-apisports-key": key },
  });
  if (!response.ok) throw new Error(`API-Football returned ${response.status}`);
  return response.json();
}

async function fetchTheSportsDb(path) {
  const key = process.env.THESPORTSDB_API_KEY || "3";
  const response = await fetch(`${PROVIDERS.theSportsDb.baseUrl}/${key}${path}`);
  if (!response.ok) throw new Error(`TheSportsDB returned ${response.status}`);
  return response.json();
}

async function getLiveContext({ provider = "footballData", competitionCode, teamId, fixtureId, season }) {
  if (provider === "footballData") {
    const [standings, matches] = await Promise.all([
      competitionCode ? fetchFootballData(`/competitions/${competitionCode}/standings`) : Promise.resolve(null),
      teamId ? fetchFootballData(`/teams/${teamId}/matches?status=SCHEDULED`) : Promise.resolve(null),
    ]);
    return { provider: PROVIDERS.footballData.name, standings, matches };
  }

  if (provider === "apiFootball") {
    const [fixtureStats, players] = await Promise.all([
      fixtureId ? fetchApiFootball(`/fixtures/statistics?fixture=${fixtureId}`) : Promise.resolve(null),
      teamId && season ? fetchApiFootball(`/players?team=${teamId}&season=${season}`) : Promise.resolve(null),
    ]);
    return { provider: PROVIDERS.apiFootball.name, fixtureStats, players };
  }

  if (provider === "theSportsDb") {
    const team = teamId ? await fetchTheSportsDb(`/lookupteam.php?id=${teamId}`) : null;
    return { provider: PROVIDERS.theSportsDb.name, team };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

module.exports = {
  PROVIDERS,
  getLiveContext,
};
