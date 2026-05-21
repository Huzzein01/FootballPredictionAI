const { archivedLeagueTables } = require("./leagueTableService");
const { readFixtureData, internationalGroupTables } = require("./internationalData");
const { listPlayerProfiles } = require("./playerProfileStore");
const { listTeamProfiles } = require("./teamProfileStore");
const { loadMatches, normalizeTeamName } = require("./footballData");

const CLUB_LEAGUES = ["EPL", "La Liga", "Bundesliga", "Ligue 1", "Serie A"];
const HISTORICAL_SEASONS = ["2020-21", "2021-22", "2022-23", "2023-24", "2024-25", "2025-26"];
const NEXT_SEASON_RULES = {
  EPL: { relegatedCount: 3, promotedCount: 3, secondTierCode: "eng.2", secondTierName: "Championship" },
  "La Liga": { relegatedCount: 3, promotedCount: 3, secondTierCode: "esp.2", secondTierName: "LaLiga 2" },
  Bundesliga: { relegatedCount: 2, promotedCount: 2, secondTierCode: "ger.2", secondTierName: "2. Bundesliga" },
  "Ligue 1": { relegatedCount: 2, promotedCount: 2, secondTierCode: "fra.2", secondTierName: "Ligue 2" },
  "Serie A": { relegatedCount: 3, promotedCount: 3, secondTierCode: "ita.2", secondTierName: "Serie B" },
};

const TEAM_SCORER_CANDIDATES = {
  EPL: {
    Arsenal: ["Viktor Gyokeres", "Bukayo Saka"],
    "Man City": ["Erling Haaland", "Phil Foden"],
    "Man United": ["Benjamin Sesko", "Matheus Cunha", "Bruno Fernandes"],
    "Aston Villa": ["Ollie Watkins"],
    Liverpool: ["Alexander Isak", "Dominik Szoboszlai"],
    Bournemouth: ["Evanilson"],
    Brighton: ["Kaoru Mitoma", "Danny Welbeck"],
    Chelsea: ["Cole Palmer"],
    Brentford: ["Igor Thiago", "Kevin Schade"],
    Sunderland: ["Wilson Isidor"],
    "Newcastle United": ["Anthony Gordon", "Harvey Barnes"],
    Everton: ["Beto"],
    Fulham: ["Raul Jimenez"],
    "Leeds United": ["Joel Piroe"],
    "Crystal Palace": ["Jean-Philippe Mateta"],
    "Nott'm Forest": ["Chris Wood"],
    Tottenham: ["Dominic Solanke", "Brennan Johnson"],
    "West Ham United": ["Jarrod Bowen"],
    Burnley: ["Lyle Foster"],
    "Wolverhampton Wanderers": ["Jorgen Strand Larsen"],
    "Coventry City": ["Haji Wright"],
    "Ipswich Town": ["George Hirst"],
    Millwall: ["Mihailo Ivanovic"],
  },
  "La Liga": {
    Barcelona: ["Raphinha", "Lamine Yamal", "Fermin Lopez"],
    "Real Madrid": ["Kylian Mbappe", "Vinicius Junior", "Jude Bellingham"],
    Villarreal: ["Ayoze Perez"],
    "Ath Madrid": ["Julian Alvarez", "Antoine Griezmann"],
    Betis: ["Antony"],
    "Celta Vigo": ["Iago Aspas"],
    Getafe: ["Borja Mayoral"],
    "Rayo Vallecano": ["Alvaro Garcia"],
    Valencia: ["Hugo Duro"],
    "Real Sociedad": ["Mikel Oyarzabal"],
    Espanyol: ["Javi Puado"],
    "Ath Bilbao": ["Inaki Williams", "Nico Williams"],
    "Alavés": ["Kike Garcia"],
    Sevilla: ["Isaac Romero"],
    Osasuna: ["Ante Budimir"],
    Elche: ["Rafa Mir"],
    Levante: ["Jose Luis Morales"],
    Girona: ["Cristhian Stuani"],
    Mallorca: ["Vedat Muriqi"],
    Oviedo: ["Santi Cazorla"],
    "Racing Santander": ["Andres Martin"],
    "Deportivo La Coruña": ["Lucas Perez"],
    "Almería": ["Luis Suarez"],
  },
  Bundesliga: {
    "Bayern Munich": ["Harry Kane", "Michael Olise", "Jamal Musiala"],
    "Borussia Dortmund": ["Serhou Guirassy"],
    "RB Leipzig": ["Lois Openda"],
    "VfB Stuttgart": ["Deniz Undav"],
    "TSG Hoffenheim": ["Andrej Kramaric"],
    "Bayer Leverkusen": ["Patrik Schick", "Florian Wirtz"],
    "SC Freiburg": ["Vincenzo Grifo"],
    "Eintracht Frankfurt": ["Omar Marmoush"],
    "FC Augsburg": ["Ermedin Demirovic"],
    Mainz: ["Jonathan Burkardt"],
    "1. FC Union Berlin": ["Benedict Hollerbach"],
    "Borussia Mönchengladbach": ["Tim Kleindienst"],
    "Hamburg SV": ["Robert Glatzel"],
    "FC Koln": ["Davie Selke"],
    "Werder Bremen": ["Marvin Ducksch"],
    "VfL Wolfsburg": ["Jonas Wind"],
    "1. FC Heidenheim 1846": ["Marvin Pieringer"],
    "St. Pauli": ["Oladapo Afolayan"],
    "Schalke 04": ["Kenan Karaman"],
    "SV 07 Elversberg": ["Fisnik Asllani"],
  },
  "Ligue 1": {
    "Paris SG": ["Ousmane Dembele", "Desire Doue", "Khvicha Kvaratskhelia"],
    Lens: ["Florian Sotoca"],
    Lille: ["Jonathan David"],
    Lyon: ["Alexandre Lacazette"],
    Marseille: ["Pierre-Emerick Aubameyang"],
    "Stade Rennais": ["Arnaud Kalimuendo"],
    "AS Monaco": ["Folarin Balogun"],
    Strasbourg: ["Emanuel Emegha"],
    Lorient: ["Eli Junior Kroupi"],
    Toulouse: ["Thijs Dallinga"],
    "Paris FC": ["Jean-Philippe Krasso"],
    Brest: ["Ludovic Ajorque"],
    Angers: ["Himad Abdelli"],
    "Le Havre AC": ["Emmanuel Sabbi"],
    "AJ Auxerre": ["Lassine Sinayoko"],
    Nice: ["Terem Moffi"],
    Nantes: ["Mostafa Mohamed"],
    Metz: ["Georges Mikautadze"],
    Troyes: ["Rafiki Said"],
    "Le Mans": ["Antoine Rabillard"],
  },
  "Serie A": {
    "Inter Milan": ["Marcus Thuram", "Lautaro Martinez"],
    Napoli: ["Victor Osimhen", "Romelu Lukaku"],
    "AS Roma": ["Paulo Dybala"],
    "AC Milan": ["Rafael Leao"],
    Como: ["Patrick Cutrone"],
    Juventus: ["Dusan Vlahovic"],
    Atalanta: ["Ademola Lookman"],
    Bologna: ["Riccardo Orsolini"],
    Lazio: ["Mattia Zaccagni"],
    Udinese: ["Lorenzo Lucca"],
    Sassuolo: ["Domenico Berardi"],
    Torino: ["Duvan Zapata"],
    Parma: ["Dennis Man"],
    Genoa: ["Mateo Retegui"],
    Fiorentina: ["Moise Kean"],
    Cagliari: ["Zito Luvumbo"],
    Lecce: ["Nikola Krstovic"],
    Cremonese: ["Massimo Coda"],
    "Hellas Verona": ["Casper Tengstedt"],
    Pisa: ["Stefano Moreo"],
    Venezia: ["Joel Pohjanpalo"],
    Frosinone: ["Gennaro Borrelli"],
    Monza: ["Dany Mota"],
  },
};

const TEAM_ASSIST_CANDIDATES = {
  Arsenal: "Bukayo Saka",
  "Man City": "Phil Foden",
  "Man United": "Bruno Fernandes",
  Liverpool: "Dominik Szoboszlai",
  Chelsea: "Cole Palmer",
  Brighton: "Kaoru Mitoma",
  Brentford: "Mikkel Damsgaard",
  Tottenham: "James Maddison",
  "Newcastle United": "Anthony Gordon",
  Barcelona: "Lamine Yamal",
  "Real Madrid": "Jude Bellingham",
  "Bayern Munich": "Michael Olise",
  "Paris SG": "Ousmane Dembele",
  "Inter Milan": "Marcus Thuram",
};

const CHAMPIONS_LEAGUE_QUALIFIED = [
  { team: "Arsenal", league: "EPL", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Man City", league: "EPL", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Man United", league: "EPL", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Aston Villa", league: "EPL", status: "Projected league phase from EPL top four", source: "Current Premier League table baseline" },
  { team: "Liverpool", league: "EPL", status: "European Performance Spot as it stands", source: "UEFA European Performance Spot tracker" },
  { team: "Barcelona", league: "La Liga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Real Madrid", league: "La Liga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Villarreal", league: "La Liga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Ath Madrid", league: "La Liga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Betis", league: "La Liga", status: "Projected league phase from Spain performance spot", source: "UEFA European Performance Spot tracker" },
  { team: "Bayern Munich", league: "Bundesliga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Borussia Dortmund", league: "Bundesliga", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "RB Leipzig", league: "Bundesliga", status: "League phase qualified", source: "FourFourTwo qualification tracker" },
  { team: "VfB Stuttgart", league: "Bundesliga", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Inter Milan", league: "Serie A", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Napoli", league: "Serie A", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Paris SG", league: "Ligue 1", status: "League phase qualified", source: "BBC/UEFA qualification tracker" },
  { team: "Lens", league: "Ligue 1", status: "League phase qualified", source: "FourFourTwo qualification tracker" },
  { team: "Lille", league: "Ligue 1", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "PSV Eindhoven", league: "Eredivisie", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Feyenoord", league: "Eredivisie", status: "League phase qualified", source: "FourFourTwo qualification tracker" },
  { team: "Porto", league: "Primeira Liga", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Slavia Prague", league: "Czech First League", status: "League phase qualified", source: "BBC qualification tracker" },
  { team: "Galatasaray", league: "Turkiye", status: "League phase qualified", source: "FourFourTwo qualification tracker" },
  { team: "Shakhtar Donetsk", league: "Ukraine", status: "League phase qualified via UEFA rebalancing", source: "UEFA rebalancing update" },
];

const FUTURES_SOURCES = {
  championsLeague: {
    name: "BBC Sport 2026-27 Champions League qualified-team tracker",
    url: "https://www.bbc.co.uk/sport/football/articles/crl177pxrl4o",
  },
  performanceSpots: {
    name: "UEFA European Performance Spot tracker",
    url: "https://www.uefa.com/uefachampionsleague/news/02a2-1fdbe9a25733-8d37ff5f9226-1000--202627-uefa-champions-league-which-teams-are-in-the-european-performance-spots-as-it-stands/",
  },
};

const EUROPE_PROFILE_RANGES = {
  "Europa League": {
    EPL: [6, 7],
    "La Liga": [6, 7],
    Bundesliga: [5, 6],
    "Ligue 1": [4, 5],
    "Serie A": [5, 6],
  },
  "Conference League": {
    EPL: [8],
    "La Liga": [8],
    Bundesliga: [7],
    "Ligue 1": [6],
    "Serie A": [7],
  },
};

const INTERNATIONAL_RATINGS = {
  Argentina: 92,
  France: 91,
  Brazil: 90,
  Spain: 89,
  England: 88,
  Portugal: 87,
  Netherlands: 86,
  Belgium: 84,
  Germany: 84,
  Croatia: 83,
  Uruguay: 82,
  Colombia: 82,
  Morocco: 81,
  Switzerland: 80,
  USA: 79,
  Mexico: 79,
  Japan: 79,
  Senegal: 78,
  Ecuador: 78,
  Austria: 76,
  Denmark: 76,
  Serbia: 75,
  Sweden: 75,
  Australia: 74,
  Tunisia: 73,
  Ghana: 72,
  Canada: 72,
  Qatar: 71,
  "Saudi Arabia": 71,
};

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(value, decimals = 1) {
  const scale = 10 ** decimals;
  return Math.round(numeric(value) * scale) / scale;
}

function confidenceFromRank(index, total, floor = 54, ceiling = 76) {
  if (!total || total === 1) return ceiling;
  return round(ceiling - (index / Math.max(1, total - 1)) * (ceiling - floor), 1);
}

function pickSource(league) {
  return {
    name: "ESPN public standings API",
    url: league?.sourceUrl || "https://www.espn.com/soccer/standings",
  };
}

function statMap(entry) {
  return Object.fromEntries((entry.stats || []).map((stat) => [stat.name, stat.value]));
}

async function fetchEspnStandingsByCode(sourceCode, season = "2025") {
  const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/${sourceCode}/standings?region=us&lang=en&contentorigin=espn&season=${season}`;
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 FootballPredictionAI futures-refresh" } });
  if (!response.ok) return { standings: [], sourceUrl: url };
  const payload = await response.json();
  const entries = payload?.children?.[0]?.standings?.entries || payload?.standings?.entries || [];
  return {
    sourceUrl: url,
    standings: entries
      .map((entry, index) => {
        const stats = statMap(entry);
        return {
          rank: numeric(stats.rank) || index + 1,
          team: normalizeTeamName(entry.team?.displayName || entry.team?.name || entry.team?.shortDisplayName || ""),
          played: numeric(stats.gamesPlayed),
          wins: numeric(stats.wins),
          draws: numeric(stats.ties),
          losses: numeric(stats.losses),
          points: numeric(stats.points),
          goalsFor: numeric(stats.pointsFor),
          goalsAgainst: numeric(stats.pointsAgainst),
          goalDifference: numeric(stats.pointDifferential),
        };
      })
      .filter((entry) => entry.team),
  };
}

function tablePickFromLeague(leagueName, league, season) {
  const standings = league?.standings || [];
  const leader = standings[0];
  if (!leader) return null;
  const complete = standings.every((entry) => numeric(entry.played) >= numeric(league.totalGames || 38));
  const second = standings[1];
  const pointsGap = second ? numeric(leader.points) - numeric(second.points) : 0;
  return {
    rank: 1,
    label: leader.team,
    detail: `${leagueName} ${season}: ${leader.points} pts, +${leader.goalDifference} GD${complete ? "; final-table baseline" : `; ${pointsGap} point lead`}.`,
    confidence: complete ? 72 : Math.min(74, 58 + Math.max(0, pointsGap) * 2),
    note: complete
      ? "Use this as a next-season futures baseline until fresh fixtures, transfers, odds, and summer form are imported."
      : "Current table leader with ledger results layered into the standings feed.",
    source: pickSource(league),
  };
}

function scorerPicksForLeague(leagueName, profiles) {
  return profiles
    .filter((profile) => profile.league === leagueName)
    .map((profile) => {
      const totals = profile.totals || {};
      return {
        player: profile.player,
        team: profile.team,
        goals: numeric(totals.goals),
        goalsPer90: numeric(totals.goalsPer90),
        assists: numeric(totals.assists),
      };
    })
    .filter((candidate) => candidate.goals > 0 || candidate.goalsPer90 > 0)
    .sort((a, b) => b.goals - a.goals || b.goalsPer90 - a.goalsPer90)
    .slice(0, 5)
    .map((candidate, index, list) => ({
      rank: index + 1,
      label: candidate.player,
      detail: `${candidate.team}: ${candidate.goals} goals, ${round(candidate.goalsPer90, 2)} goals/90, ${candidate.assists} assists in the tracked profile baseline.`,
      confidence: confidenceFromRank(index, list.length, 50, 68),
      note: "Player-profile baseline plus manual training entries. Improve this market with match-by-match minutes, shots, and SOT updates.",
      source: { name: "Player profile baselines and manual training", url: "" },
    }));
}

function emptyTeamTrend(team, league) {
  return {
    team,
    league,
    seasons: 0,
    weightSum: 0,
    weightedScore: 0,
    weightedPpg: 0,
    weightedGf: 0,
    weightedGa: 0,
    weightedGd: 0,
    titles: 0,
    topFour: 0,
    latestRank: 99,
    latestPoints: 0,
    latestGoalsFor: 0,
  };
}

function localSeasonTable(league, season) {
  const table = new Map();
  for (const row of loadMatches()) {
    if (row.League !== league || row.Season !== season || row.FTHG === "" || row.FTAG === "") continue;
    const home = normalizeTeamName(row.HomeTeam);
    const away = normalizeTeamName(row.AwayTeam);
    for (const team of [home, away]) {
      if (!table.has(team)) {
        table.set(team, {
          team,
          league,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
        });
      }
    }
    const homeGoals = numeric(row.FTHG);
    const awayGoals = numeric(row.FTAG);
    const homeRow = table.get(home);
    const awayRow = table.get(away);
    homeRow.played += 1;
    awayRow.played += 1;
    homeRow.goalsFor += homeGoals;
    homeRow.goalsAgainst += awayGoals;
    awayRow.goalsFor += awayGoals;
    awayRow.goalsAgainst += homeGoals;
    if (homeGoals > awayGoals) {
      homeRow.wins += 1;
      awayRow.losses += 1;
      homeRow.points += 3;
    } else if (awayGoals > homeGoals) {
      awayRow.wins += 1;
      homeRow.losses += 1;
      awayRow.points += 3;
    } else {
      homeRow.draws += 1;
      awayRow.draws += 1;
      homeRow.points += 1;
      awayRow.points += 1;
    }
  }
  return [...table.values()]
    .map((entry) => ({ ...entry, goalDifference: entry.goalsFor - entry.goalsAgainst }))
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function updateTrend(trend, row, seasonIndex) {
  const weight = 1 + seasonIndex * 0.25;
  const ppg = numeric(row.played) ? numeric(row.points) / numeric(row.played) : 0;
  const gf = numeric(row.played) ? numeric(row.goalsFor) / numeric(row.played) : 0;
  const ga = numeric(row.played) ? numeric(row.goalsAgainst) / numeric(row.played) : 0;
  const gd = numeric(row.played) ? numeric(row.goalDifference) / numeric(row.played) : 0;
  trend.seasons += 1;
  trend.weightSum += weight;
  trend.weightedPpg += ppg * weight;
  trend.weightedGf += gf * weight;
  trend.weightedGa += ga * weight;
  trend.weightedGd += gd * weight;
  trend.weightedScore += (ppg * 38 + gd * 10 + gf * 5 - ga * 4 + Math.max(0, 7 - numeric(row.rank)) * 1.4) * weight;
  trend.titles += numeric(row.rank) === 1 ? 1 : 0;
  trend.topFour += numeric(row.rank) <= 4 ? 1 : 0;
  if (seasonIndex === HISTORICAL_SEASONS.length - 1) {
    trend.latestRank = numeric(row.rank);
    trend.latestPoints = numeric(row.points);
    trend.latestGoalsFor = numeric(row.goalsFor);
  }
}

async function historicalTablesForLeague(league) {
  const tables = {};
  for (const [seasonIndex, season] of HISTORICAL_SEASONS.entries()) {
    if (league === "Serie A") {
      const data = await archivedLeagueTables(season);
      tables[season] = data.leagues?.[league]?.standings || [];
    } else {
      tables[season] = localSeasonTable(league, season);
    }
    tables[season].forEach((row) => {
      row.seasonIndex = seasonIndex;
    });
  }
  return tables;
}

async function currentTopLeagueTable(league) {
  const data = await archivedLeagueTables("2025-26");
  return data.leagues?.[league]?.standings || localSeasonTable(league, "2025-26");
}

async function secondTierTablesForLeague(league) {
  const rule = NEXT_SEASON_RULES[league];
  if (!rule) return { "2024-25": [], "2025-26": [], sourceUrl: "" };
  const [previous, current] = await Promise.all([
    fetchEspnStandingsByCode(rule.secondTierCode, "2024"),
    fetchEspnStandingsByCode(rule.secondTierCode, "2025"),
  ]);
  return {
    "2024-25": previous.standings,
    "2025-26": current.standings,
    sourceUrl: current.sourceUrl || previous.sourceUrl || "",
  };
}

function promotedTrendFromSecondTier(league, team, secondTables, promotionRank) {
  const rows = ["2024-25", "2025-26"]
    .map((season) => ({ season, row: (secondTables[season] || []).find((entry) => normalizeTeamName(entry.team) === team) }))
    .filter((item) => item.row);
  const trend = emptyTeamTrend(team, league);
  for (const [index, item] of rows.entries()) {
    const weight = 1 + index * 0.35;
    const row = item.row;
    const ppg = numeric(row.played) ? numeric(row.points) / numeric(row.played) : 0;
    const gf = numeric(row.played) ? numeric(row.goalsFor) / numeric(row.played) : 0;
    const ga = numeric(row.played) ? numeric(row.goalsAgainst) / numeric(row.played) : 0;
    const gd = numeric(row.played) ? numeric(row.goalDifference) / numeric(row.played) : 0;
    trend.seasons += 1;
    trend.weightSum += weight;
    trend.weightedPpg += ppg * weight;
    trend.weightedGf += gf * weight;
    trend.weightedGa += ga * weight;
    trend.weightedGd += gd * weight;
    trend.weightedScore += (ppg * 34 + gd * 8 + gf * 4 - ga * 5 + Math.max(0, 4 - promotionRank) * 1.5 - 18) * weight;
    if (item.season === "2025-26") {
      trend.latestRank = numeric(row.rank);
      trend.latestPoints = numeric(row.points);
      trend.latestGoalsFor = numeric(row.goalsFor);
    }
  }
  if (!rows.length) {
    trend.weightSum = 1;
    trend.weightedScore = 28;
  }
  const divisor = trend.weightSum || 1;
  return {
    ...trend,
    promoted: true,
    promotionRank,
    secondTierSummary: rows
      .map((item) => `${item.season}: #${item.row.rank}, ${item.row.points} pts, ${item.row.goalsFor}-${item.row.goalsAgainst} goals`)
      .join("; "),
    rating: round(trend.weightedScore / divisor, 2),
    ppg: round(trend.weightedPpg / divisor, 2),
    goalsForPerMatch: round(trend.weightedGf / divisor, 2),
    goalsAgainstPerMatch: round(trend.weightedGa / divisor, 2),
    gdPerMatch: round(trend.weightedGd / divisor, 2),
  };
}

async function nextSeasonComposition(league) {
  const rule = NEXT_SEASON_RULES[league];
  const topTable = await currentTopLeagueTable(league);
  const secondTables = await secondTierTablesForLeague(league);
  if (!rule || !topTable.length) {
    return {
      teams: topTable.map((entry) => normalizeTeamName(entry.team)),
      relegated: [],
      promoted: [],
      secondTables,
    };
  }
  const relegated = topTable.slice(-rule.relegatedCount).map((entry) => normalizeTeamName(entry.team));
  const promoted = (secondTables["2025-26"] || [])
    .slice(0, rule.promotedCount)
    .map((entry, index) => ({
      team: normalizeTeamName(entry.team),
      rank: index + 1,
      row: entry,
      secondTierName: rule.secondTierName,
    }));
  const teams = [
    ...topTable
      .map((entry) => normalizeTeamName(entry.team))
      .filter((team) => !relegated.includes(team)),
    ...promoted.map((entry) => entry.team),
  ];
  return { teams, relegated, promoted, secondTables };
}

async function leagueTrends(league) {
  const tables = await historicalTablesForLeague(league);
  const composition = await nextSeasonComposition(league);
  const currentTeams = composition.teams.length ? composition.teams : (tables["2025-26"] || []).map((row) => row.team);
  const trends = new Map(currentTeams.map((team) => [team, emptyTeamTrend(team, league)]));
  for (const [seasonIndex, season] of HISTORICAL_SEASONS.entries()) {
    for (const row of tables[season] || []) {
      const team = normalizeTeamName(row.team);
      if (!trends.has(team)) continue;
      updateTrend(trends.get(team), row, seasonIndex);
    }
  }
  for (const promoted of composition.promoted || []) {
    trends.set(promoted.team, promotedTrendFromSecondTier(league, promoted.team, composition.secondTables, promoted.rank));
  }
  return [...trends.values()]
    .map((trend) => {
      if (trend.promoted) return trend;
      const divisor = trend.weightSum || trend.seasons || 1;
      return {
        ...trend,
        rating: round(trend.weightedScore / divisor, 2),
        ppg: round(trend.weightedPpg / divisor, 2),
        goalsForPerMatch: round(trend.weightedGf / divisor, 2),
        goalsAgainstPerMatch: round(trend.weightedGa / divisor, 2),
        gdPerMatch: round(trend.weightedGd / divisor, 2),
      };
    })
    .sort((a, b) => b.rating - a.rating || a.latestRank - b.latestRank || a.team.localeCompare(b.team));
}

function playerProfileCandidates(league, profiles, metric = "goals") {
  const rateKey = metric === "assists" ? "assistsPer90" : "goalsPer90";
  const staleCandidates = new Set([
    "Brentford|Bryan Mbeumo",
    "Brighton|Joao Pedro",
    "Tottenham|Son Heung-min",
    "Liverpool|Darwin Nunez",
    "Newcastle United|Alexander Isak",
  ].map((item) => item.toLowerCase()));
  return profiles
    .filter((profile) => profile.league === league)
    .map((profile) => {
      const totals = profile.totals || {};
      return {
        player: profile.player,
        team: normalizeTeamName(profile.team),
        value: numeric(totals[metric]),
        rate: numeric(totals[rateKey]),
      };
    })
    .filter((candidate) => !staleCandidates.has(`${candidate.team}|${candidate.player}`.toLowerCase()))
    .filter((candidate) => candidate.value > 0 || candidate.rate > 0);
}

function teamScorerWatchlist(league, trends, profiles) {
  const profileByTeam = new Map();
  for (const candidate of playerProfileCandidates(league, profiles, "goals")) {
    const key = normalizeTeamName(candidate.team);
    const existing = profileByTeam.get(key);
    if (!existing || candidate.value > existing.value || candidate.rate > existing.rate) profileByTeam.set(key, candidate);
  }
  return trends.map((trend, index) => {
    const team = normalizeTeamName(trend.team);
    const profileCandidate = profileByTeam.get(team);
    const names = profileCandidate ? [profileCandidate.player] : TEAM_SCORER_CANDIDATES[league]?.[team] || ["Primary striker/penalty taker"];
    return {
      rank: index + 1,
      market: "Team top scorer candidate",
      label: `${trend.team}: ${names.join(" / ")}`,
      detail: `${trend.team} trend: ${round(trend.goalsForPerMatch, 2)} goals per match, latest season ${trend.latestGoalsFor} goals. Candidate should be rechecked after summer transfers.`,
      confidence: confidenceFromRank(index, trends.length, 42, 61),
      note: profileCandidate
        ? "Candidate selected from the tracked player-profile scoring baseline."
        : "Candidate is a pre-season watchlist placeholder until squad, transfer, and scorer feed data are imported.",
      source: { name: profileCandidate ? "Player profile baselines" : "Historical team scoring trend plus candidate watchlist", url: "" },
    };
  });
}

function topMarketWatchlist(league, trends, profiles, metric) {
  const profileCandidates = playerProfileCandidates(league, profiles, metric).map((candidate) => ({
    ...candidate,
    rating: candidate.value * 2 + candidate.rate * 9,
    sourceName: "Player profile baseline",
  }));
  const fallbackCandidates = trends
    .slice(0, 10)
    .map((trend) => {
      const team = normalizeTeamName(trend.team);
      const scorer = (TEAM_SCORER_CANDIDATES[league]?.[team] || [])[0];
      const assister = TEAM_ASSIST_CANDIDATES[team];
      const player = metric === "assists" ? assister || scorer : scorer;
      if (!player) return null;
      return {
        player,
        team: trend.team,
        value: 0,
        rate: 0,
        rating: trend.goalsForPerMatch * 8 + Math.max(0, 8 - trend.latestRank),
        sourceName: "Team scoring trend watchlist",
      };
    })
    .filter(Boolean);
  const seen = new Set();
  return [...profileCandidates, ...fallbackCandidates]
    .sort((a, b) => b.rating - a.rating || a.player.localeCompare(b.player))
    .filter((candidate) => {
      const key = `${candidate.player}|${candidate.team}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((candidate, index, list) => ({
      rank: index + 1,
      market: metric === "assists" ? "Top assist watchlist" : "League top scorer watchlist",
      label: candidate.player,
      detail: `${candidate.team}: ${candidate.value ? `${candidate.value} ${metric}` : "candidate watchlist"}${candidate.rate ? `, ${round(candidate.rate, 2)} per 90` : ""}.`,
      confidence: confidenceFromRank(index, list.length, 46, metric === "assists" ? 64 : 67),
      note: metric === "assists" ? "Assist market needs summer squads and minutes updates for better accuracy." : "Scorer market is trend-based until the new season fixture and roster feeds arrive.",
      source: { name: candidate.sourceName, url: "" },
    }));
}

function leagueWinnerPicksFromTrends(league, tableName, trends) {
  return trends.slice(0, 5).map((trend, index, list) => ({
    rank: index + 1,
    market: index === 0 ? "Projected 2026-27 league winner" : "Title challenger",
    label: trend.team,
    detail: trend.promoted
      ? `${tableName || league}: promoted side baseline, ${trend.secondTierSummary || "second-tier profile imported"}.`
      : `${tableName || league}: trend rating ${trend.rating}, ${trend.ppg} weighted PPG, ${trend.titles} title baseline(s), ${trend.topFour} top-four baseline(s) since 2020-21.`,
    confidence: confidenceFromRank(index, list.length, 54, 72),
    note: trend.promoted
      ? "Promoted-team projection uses the past two second-tier seasons and should be rechecked once top-flight odds and fixture difficulty are imported."
      : "Compiled from 2020-21 through 2025-26 tables/results. Refresh this after transfers, fixtures, odds, injuries, and preseason minutes are imported.",
    source: { name: trend.promoted ? "Second-tier promotion table baseline" : "2020-21 through 2025-26 league-table and result compilation", url: "" },
  }));
}

function promotedTeamBaselinePicks(league, trends) {
  return trends
    .filter((trend) => trend.promoted)
    .sort((a, b) => a.promotionRank - b.promotionRank)
    .map((trend, index, list) => ({
      rank: index + 1,
      market: "Promoted team baseline",
      label: trend.team,
      detail: `${league}: promotion rank #${trend.promotionRank}. ${trend.secondTierSummary || "Second-tier table profile imported."}`,
      confidence: confidenceFromRank(index, list.length, 44, 58),
      note: "This replaces relegated top-flight teams in the 2026-27 futures board. Re-score once fixtures, transfer windows, and top-flight odds are imported.",
      source: { name: "Past two second-tier seasons and 2025-26 promotion table", url: "" },
    }));
}

function championsLeagueProfileSections(allLeagueTrends) {
  const trendLookup = new Map();
  for (const trend of allLeagueTrends.flat()) {
    trendLookup.set(normalizeTeamName(trend.team), trend);
  }
  const picks = CHAMPIONS_LEAGUE_QUALIFIED.map((team) => {
    const trend = trendLookup.get(normalizeTeamName(team.team));
    const rating = trend ? trend.rating : 48;
    return {
      ...team,
      rating,
      trend,
    };
  })
    .sort((a, b) => b.rating - a.rating || a.team.localeCompare(b.team))
    .map((candidate, index, list) => ({
      rank: index + 1,
      market: candidate.status,
      label: candidate.team,
      detail: `${candidate.league}: Champions League profile rating ${round(candidate.rating, 1)}${candidate.trend ? `, ${candidate.trend.ppg} domestic weighted PPG` : ""}.`,
      confidence: confidenceFromRank(index, list.length, 45, 68),
      note: `Qualified-team baseline as of 2026-05-21. Fixture draw, transfers, squad lists, odds, and European form should be layered in once available.`,
      source: FUTURES_SOURCES.championsLeague,
    }));
  return {
    id: "champions-league-profile",
    title: "Champions League Profile",
    subtitle: `${picks.length} qualified/projected teams tracked so far. Fixtures are not imported yet, so this is a team-strength profile, not a match board.`,
    picks,
  };
}

async function projectedEuropeanProfileSection(competition, allLeagueTrends = []) {
  const ranges = EUROPE_PROFILE_RANGES[competition];
  const trendLookup = new Map();
  for (const trend of allLeagueTrends.flat()) trendLookup.set(`${trend.league}|${normalizeTeamName(trend.team)}`, trend);
  const picks = [];
  for (const league of CLUB_LEAGUES) {
    const table = await currentTopLeagueTable(league);
    for (const rank of ranges?.[league] || []) {
      const row = table[rank - 1];
      if (!row) continue;
      const team = normalizeTeamName(row.team);
      const trend = trendLookup.get(`${league}|${team}`);
      picks.push({
        team,
        league,
        rank,
        rating: trend?.rating || Math.max(40, 70 - rank * 3),
        trend,
      });
    }
  }
  return {
    id: `${competition.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-profile`,
    title: `${competition} Profile`,
    subtitle: `${picks.length} projected teams from current domestic table bands. Cup winners and UEFA access-list changes can still alter this.`,
    picks: picks
      .sort((a, b) => b.rating - a.rating || a.rank - b.rank || a.team.localeCompare(b.team))
      .map((candidate, index, list) => ({
        rank: index + 1,
        market: `${competition} projected qualifier`,
        label: candidate.team,
        detail: `${candidate.league}: domestic rank band #${candidate.rank}${candidate.trend ? `, 2026-27 trend rating ${candidate.trend.rating}` : ""}.`,
        confidence: confidenceFromRank(index, list.length, 42, 62),
        note: "Projected European profile only. Re-train this once official UEFA access lists, cup winners, and qualifying rounds are locked.",
        source: FUTURES_SOURCES.performanceSpots,
      })),
  };
}

async function nextSeasonClubFutures({ league = "All" } = {}) {
  const playerProfiles = listPlayerProfiles().profiles || [];
  const europeanProfileOnly = ["Champions League", "Europa League", "Conference League"].includes(league);
  const leagueNames = league && league !== "All" && !europeanProfileOnly ? [league] : CLUB_LEAGUES;
  const trendPairs = [];
  for (const leagueName of leagueNames) {
    trendPairs.push([leagueName, await leagueTrends(leagueName)]);
  }
  const sections = [];
  if (!europeanProfileOnly) {
    for (const [leagueName, trends] of trendPairs) {
      sections.push({
        id: `${leagueName}-2026-27-futures`,
        title: `${leagueName} 2026-27 Futures`,
        subtitle: `${HISTORICAL_SEASONS[0]} through ${HISTORICAL_SEASONS[HISTORICAL_SEASONS.length - 1]} compiled baseline, before new fixtures and summer transfer adjustments.`,
        picks: [
          ...leagueWinnerPicksFromTrends(leagueName, leagueName, trends),
          ...promotedTeamBaselinePicks(leagueName, trends),
          ...topMarketWatchlist(leagueName, trends, playerProfiles, "goals"),
          ...topMarketWatchlist(leagueName, trends, playerProfiles, "assists"),
          ...teamScorerWatchlist(leagueName, trends, playerProfiles),
        ],
      });
    }
  }
  if (league === "All" || league === "Champions League") {
    const allTrends = league === "Champions League" ? await Promise.all(CLUB_LEAGUES.map((leagueName) => leagueTrends(leagueName))) : trendPairs.map(([, trends]) => trends);
    sections.unshift(championsLeagueProfileSections(allTrends));
  }
  if (league === "All" || league === "Europa League" || league === "Conference League") {
    const allTrends = league === "All" ? trendPairs.map(([, trends]) => trends) : await Promise.all(CLUB_LEAGUES.map((leagueName) => leagueTrends(leagueName)));
    const profiles = league === "All"
      ? [await projectedEuropeanProfileSection("Europa League", allTrends), await projectedEuropeanProfileSection("Conference League", allTrends)]
      : [await projectedEuropeanProfileSection(league, allTrends)];
    sections.splice(league === "All" ? 1 : 0, 0, ...profiles);
  }
  return {
    context: "club",
    season: "2026-27",
    league,
    generatedAt: new Date().toISOString(),
    unavailable: false,
    sourcePolicy:
      "2026-27 futures are pre-fixture projections compiled from 2020-21 through 2025-26 league results/tables, tracked player profiles, and a dated Champions League qualification profile. Re-train after transfers, fixtures, odds, injuries, and squad lists are available.",
    sections,
  };
}

async function clubFutures({ season = "2025-26", league = "All" } = {}) {
  if (season === "2026-27") return nextSeasonClubFutures({ league });
  const tableData = await archivedLeagueTables(season);
  const playerProfiles = listPlayerProfiles().profiles || [];
  const teamProfiles = listTeamProfiles(season, tableData).profiles || [];
  if (tableData.unavailable) {
    return {
      context: "club",
      season,
      league,
      generatedAt: new Date().toISOString(),
      unavailable: true,
      message: tableData.message,
      sections: [],
    };
  }

  const leagueNames = league && league !== "All" ? [league] : CLUB_LEAGUES;
  const sections = [];
  for (const leagueName of leagueNames) {
    const tableLeague = tableData.leagues?.[leagueName];
    if (!tableLeague) continue;
    const leagueWinner = tablePickFromLeague(leagueName, tableLeague, season);
    const scorerPicks = scorerPicksForLeague(leagueName, playerProfiles);
    const trainedTeams = teamProfiles.filter((profile) => profile.league === leagueName && numeric(profile.totals?.matches) > 0).length;
    sections.push({
      id: `${leagueName}-futures`,
      title: `${tableLeague.name || leagueName} Futures`,
      subtitle: `${trainedTeams} manually trained team profile${trainedTeams === 1 ? "" : "s"} layered into club context.`,
      picks: [
        ...(leagueWinner ? [{ ...leagueWinner, market: "League winner / next-season baseline" }] : []),
        ...scorerPicks.map((pick) => ({ ...pick, market: "Top scorer watchlist" })),
      ],
    });
  }

  return {
    context: "club",
    season,
    league,
    generatedAt: new Date().toISOString(),
    unavailable: false,
    sourcePolicy: "Futures use public league tables, tracked player profiles, and manually trained team-profile form. Treat completed seasons as baseline priors for the next campaign.",
    sections,
  };
}

function internationalWinnerPicks() {
  const fixtureData = readFixtureData();
  const teams = fixtureData.teams?.length ? fixtureData.teams : Object.values(fixtureData.groups || {}).flat();
  return [...new Set(teams)]
    .map((team) => ({
      team,
      rating: INTERNATIONAL_RATINGS[team] || 68,
      group: Object.entries(fixtureData.groups || {}).find(([, groupTeams]) => groupTeams.includes(team))?.[0] || "",
    }))
    .sort((a, b) => b.rating - a.rating || a.team.localeCompare(b.team))
    .slice(0, 8)
    .map((candidate, index, list) => ({
      rank: index + 1,
      market: "World Cup winner watchlist",
      label: candidate.team,
      detail: `${candidate.group ? `Group ${candidate.group}; ` : ""}international baseline rating ${candidate.rating}.`,
      confidence: confidenceFromRank(index, list.length, 52, 70),
      note: "Early futures lean before final squads, injuries, odds, and group-stage results are layered in.",
      source: { name: "World Cup 2026 fixture feed and model ratings", url: fixtureData.source?.url || "" },
    }));
}

function internationalScorerPicks() {
  const profiles = listPlayerProfiles().profiles || [];
  const fixtureTeams = new Set(readFixtureData().teams || []);
  return profiles
    .map((profile) => {
      const international = profile.internationalProfile || {};
      const totals = international.totals || {};
      return {
        player: profile.player,
        team: international.team,
        goals: numeric(totals.goals),
        goalsPer90: numeric(totals.goalsPer90),
        shotsPer90: numeric(totals.shotsPer90),
      };
    })
    .filter((candidate) => candidate.team && (!fixtureTeams.size || fixtureTeams.has(candidate.team)) && (candidate.goals > 0 || candidate.goalsPer90 > 0))
    .sort((a, b) => b.goals - a.goals || b.goalsPer90 - a.goalsPer90)
    .slice(0, 8)
    .map((candidate, index, list) => ({
      rank: index + 1,
      market: "World Cup top scorer watchlist",
      label: candidate.player,
      detail: `${candidate.team}: ${candidate.goals} international/World Cup baseline goals, ${round(candidate.goalsPer90, 2)} goals/90, ${round(candidate.shotsPer90, 2)} shots/90.`,
      confidence: confidenceFromRank(index, list.length, 50, 69),
      note: "Uses the international player-profile baseline plus prior World Cup data where available.",
      source: { name: "International player profiles and imported World Cup screenshots", url: "" },
    }));
}

async function internationalFutures({ season = "2026 World Cup" } = {}) {
  const groups = internationalGroupTables();
  return {
    context: "international",
    season,
    league: "International",
    generatedAt: new Date().toISOString(),
    unavailable: season !== "2026 World Cup",
    message: season !== "2026 World Cup" ? `${season} futures are archive-only until fixtures and squads are imported.` : "",
    sourcePolicy: "International futures use World Cup fixtures, group-table state, model ratings, and player-profile international baselines.",
    sections:
      season === "2026 World Cup"
        ? [
            {
              id: "world-cup-winner",
              title: "World Cup Winner Futures",
              subtitle: `${groups.length} group table${groups.length === 1 ? "" : "s"} active. Results will update these leans after each settled international fixture.`,
              picks: internationalWinnerPicks(),
            },
            {
              id: "world-cup-top-scorer",
              title: "World Cup Top Scorer Futures",
              subtitle: "Based on tracked international player profiles and prior World Cup training rows.",
              picks: internationalScorerPicks(),
            },
          ]
        : [],
  };
}

async function futuresPredictions({ context = "club", season, league } = {}) {
  if (context === "international") return internationalFutures({ season: season || "2026 World Cup" });
  return clubFutures({ season: season || "2025-26", league: league || "All" });
}

module.exports = {
  futuresPredictions,
};
