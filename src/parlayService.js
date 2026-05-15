const fs = require("fs");
const path = require("path");
const { fixturePredictionBoard } = require("./predictionService");
const { aggregatePlayers, loadPlayerRows } = require("./playerStats");
const { fixtureSignatureFromFixture, playedFixtureKeys } = require("./parlayBacktestStore");

const FBREF_JSON_PATH = path.join(process.cwd(), "data", "fbref", "processed", "fbref_player_stats.json");
const FBREF_RAW_DIR = path.join(process.cwd(), "data", "fbref", "raw");

const PLAYER_NAME_CORRECTIONS = new Map([
  ["alejandro gamacho", "Alejandro Garnacho"],
  ["ude bellingham", "Jude Bellingham"],
  ["jude bellinghan", "Jude Bellingham"],
]);

function pct(value) {
  return Number((value * 100).toFixed(1));
}

function parseProjectedScore(score) {
  const match = String(score || "").trim().match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  return { homeGoals: Number(match[1]), awayGoals: Number(match[2]) };
}

function loadFbrefRows() {
  return loadPlayerRows();
}

function fbrefStatus() {
  const rows = loadFbrefRows();
  const rawCsvCount = fs.existsSync(FBREF_RAW_DIR)
    ? fs.readdirSync(FBREF_RAW_DIR).filter((file) => file.toLowerCase().endsWith(".csv")).length
    : 0;
  return {
    processedRows: rows.length,
    rawCsvCount,
    seasons: [...new Set(rows.map((row) => row.season).filter(Boolean))].sort(),
    leagues: [...new Set(rows.map((row) => row.league).filter(Boolean))].sort(),
    statTypes: [...new Set(rows.map((row) => row.statType).filter(Boolean))].sort(),
    players: new Set(rows.map((row) => row.Player).filter(Boolean)).size,
    hasPlayerStats: rows.length > 0,
    path: FBREF_JSON_PATH,
  };
}

function seasonRank(season) {
  const [start] = String(season || "").split("-").map(Number);
  return Number.isFinite(start) ? start : 0;
}

function playerSource(player) {
  const label = player.sourceLabels?.length ? player.sourceLabels.join("+") : "FBref";
  const statType = player.sourceTypes?.length ? player.sourceTypes.join("+") : "standard";
  return `${label} ${statType}`;
}

function cleanPlayerName(name) {
  const key = String(name || "").trim().toLowerCase();
  return PLAYER_NAME_CORRECTIONS.get(key) || String(name || "").trim();
}

function teamMotivation(fixture, team) {
  const context = fixture.standingContext || {};
  if (team === fixture.homeTeam) return context.home || {};
  if (team === fixture.awayTeam) return context.away || {};
  return {};
}

function projectedTeamGoals(fixture, team) {
  const score = parseProjectedScore(fixture.projectedScore);
  if (!score) return 1;
  if (team === fixture.homeTeam) return score.homeGoals;
  if (team === fixture.awayTeam) return score.awayGoals;
  return 1;
}

function motivationConfidenceAdjustment(fixture, team, marketType = "player") {
  const motivation = teamMotivation(fixture, team);
  const pressure =
    Number(motivation.titleRaceScore || 0) +
    Number(motivation.europeRaceScore || 0) * 0.7 +
    Number(motivation.relegationBattleScore || 0) * 0.85 +
    Math.max(0, Number(motivation.recordMotiveScore || 0)) * 0.45;
  const rotationRisk = Number(motivation.securedTitle || 0) + Number(motivation.deadRubber || 0) * 0.5;
  const projectedGoals = projectedTeamGoals(fixture, team);
  const resultBoost =
    (fixture.prediction === "H" && team === fixture.homeTeam) || (fixture.prediction === "A" && team === fixture.awayTeam)
      ? 3
      : fixture.prediction === "D"
      ? 0
      : -3;
  const scoringBoost = Math.max(-4, Math.min(7, (projectedGoals - 1) * 3));
  const rotationPenalty = marketType === "score" ? rotationRisk * 7 : rotationRisk * 9;
  return pressure * 5 + scoringBoost + resultBoost - rotationPenalty;
}

function motivationSummary(fixture, team) {
  const motivation = teamMotivation(fixture, team);
  const manual = motivation.manualNote ? ` (${motivation.manualNote})` : "";
  return motivation.note ? `${team}: ${motivation.note}${manual}` : "";
}

function motivationSourceSuffix(fixture, team, baseSource) {
  const summary = motivationSummary(fixture, team);
  const contextSource = fixture.standingContext?.source === "public-standings" ? "live table motivation" : "table motivation";
  return summary ? `${baseSource}; ${contextSource}: ${summary}` : baseSource;
}

function adjustedConfidence(base, fixture, team, marketType, min, max) {
  return Math.max(min, Math.min(max, base + motivationConfidenceAdjustment(fixture, team, marketType)));
}

function latestTeamPlayers(players, league, team) {
  const matches = players.filter((player) => player.league === league && player.squad === team);
  const latest = Math.max(0, ...matches.map((player) => seasonRank(player.season)));
  return matches.filter((player) => seasonRank(player.season) === latest);
}

function playerPropCandidates(players, fixture) {
  const teams = [fixture.homeTeam, fixture.awayTeam];
  const candidates = [];

  for (const team of teams) {
    for (const player of latestTeamPlayers(players, fixture.league, team)) {
      const playerName = cleanPlayerName(player.player);
      if (player.hasShotStats && player.shotsPer90 >= 2) {
        const baseConfidence = Math.min(86, 52 + player.shotsPer90 * 8);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "1+ shot",
          pick: `${playerName} 1+ shot`,
          confidence: adjustedConfidence(baseConfidence, fixture, team, "player", 35, 88),
          fbrefMetric: `${player.shotsPer90.toFixed(2)} shots/90`,
          fbrefSeason: player.season,
          source: motivationSourceSuffix(fixture, team, playerSource(player)),
        });
      }

      if (player.hasShotStats && player.shotsOnTargetPer90 >= 0.7) {
        const baseConfidence = Math.min(82, 50 + player.shotsOnTargetPer90 * 18);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "1+ shot on target",
          pick: `${playerName} 1+ shot on target`,
          confidence: adjustedConfidence(baseConfidence, fixture, team, "player", 35, 84),
          fbrefMetric: `${player.shotsOnTargetPer90.toFixed(2)} shots on target/90`,
          fbrefSeason: player.season,
          source: motivationSourceSuffix(fixture, team, playerSource(player)),
        });
      }

      if (player.goalsPer90 >= 0.3) {
        const baseConfidence = Math.min(78, 48 + player.goalsPer90 * 34);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "anytime goal",
          pick: `${playerName} to score`,
          confidence: adjustedConfidence(baseConfidence, fixture, team, "player", 32, 80),
          fbrefMetric: `${player.goalsPer90.toFixed(2)} goals/90`,
          fbrefSeason: player.season,
          source: motivationSourceSuffix(fixture, team, playerSource(player)),
        });
      }

      if (player.hasAssistStats && player.assistsPer90 >= 0.22) {
        const baseConfidence = Math.min(74, 47 + player.assistsPer90 * 38);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "assist",
          pick: `${playerName} to assist`,
          confidence: adjustedConfidence(baseConfidence, fixture, team, "player", 30, 76),
          fbrefMetric: `${player.assistsPer90.toFixed(2)} assists/90`,
          fbrefSeason: player.season,
          source: motivationSourceSuffix(fixture, team, playerSource(player)),
        });
      }

      if (player.hasAssistStats && player.goalAssistPer90 >= 0.38) {
        const baseConfidence = Math.min(80, 50 + player.goalAssistPer90 * 24);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "score or assist",
          pick: `${playerName} to score or assist`,
          confidence: adjustedConfidence(baseConfidence, fixture, team, "player", 34, 82),
          fbrefMetric: `${player.goalAssistPer90.toFixed(2)} goals+assists/90`,
          fbrefSeason: player.season,
          source: motivationSourceSuffix(fixture, team, playerSource(player)),
        });
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

function teamScoreLegs(fixtures) {
  return fixtures
    .map((fixture) => {
      const score = parseProjectedScore(fixture.projectedScore);
      if (!score) return null;
      const homeAdjustment = motivationConfidenceAdjustment(fixture, fixture.homeTeam, "score");
      const awayAdjustment = motivationConfidenceAdjustment(fixture, fixture.awayTeam, "score");
      const rotationRisk =
        Number(fixture.standingContext?.home?.securedTitle || 0) +
        Number(fixture.standingContext?.away?.securedTitle || 0) +
        Number(fixture.standingContext?.home?.deadRubber || 0) * 0.5 +
        Number(fixture.standingContext?.away?.deadRubber || 0) * 0.5;
      const baseConfidence = fixture.confidence * 0.82;
      const confidence = Math.max(30, Math.min(74, baseConfidence + (homeAdjustment + awayAdjustment) * 0.28 - rotationRisk * 4));
      const baseSource = fixture.hasOdds
        ? `${fixture.oddsSource || "Market odds"} + model score projection using form, home/away edge, Elo, head-to-head, and player features`
        : "model score projection using form, home/away edge, Elo, head-to-head, and player features";
      const motivationNotes = [motivationSummary(fixture, fixture.homeTeam), motivationSummary(fixture, fixture.awayTeam)].filter(Boolean).join("; ");
      return {
        type: "score",
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        date: fixture.date,
        league: fixture.league,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeGoals: score.homeGoals,
        awayGoals: score.awayGoals,
        pick: `${fixture.homeTeam} ${score.homeGoals} - ${score.awayGoals} ${fixture.awayTeam}`,
        market: "projected team score",
        confidence,
        projectedScore: fixture.projectedScore,
        source: motivationNotes ? `${baseSource}; live table motivation: ${motivationNotes}` : baseSource,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);
}

function matchResultLegs(fixtures) {
  const winnerLegs = fixtures
    .filter((fixture) => fixture.confidence >= 55)
    .map((fixture) => ({
      type: "match",
      fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      date: fixture.date,
      league: fixture.league,
      pick: fixture.prediction === "H" ? `${fixture.homeTeam} win` : fixture.prediction === "A" ? `${fixture.awayTeam} win` : "Draw",
      market: "match result",
      confidence: fixture.confidence,
      projectedScore: fixture.projectedScore,
      source: fixture.hasOdds
        ? `${fixture.oddsSource || "Market odds"} + model using form, home/away edge, Elo, head-to-head, player features, and table motivation`
        : "model using form, home/away edge, Elo, head-to-head, player features, and table motivation",
    }));

  const drawLegs = fixtures
    .map((fixture) => {
      const drawPct = Number(fixture.probabilities?.drawPct || 0);
      const topPct = Math.max(Number(fixture.probabilities?.homeWinPct || 0), Number(fixture.probabilities?.awayWinPct || 0));
      const closeGameScore = Number(fixture.calibration?.closeGameScore || 0);
      const h2hDrawRate = Number(fixture.calibration?.h2hDrawRate || 0);
      const marketDraw = Number(fixture.calibration?.marketDraw || 0) * 100;
      const isLiveDrawCandidate =
        drawPct >= 24 ||
        (drawPct >= 20 && topPct - drawPct <= 28) ||
        (drawPct >= 18 && closeGameScore >= 0.72) ||
        marketDraw >= 25;
      if (!isLiveDrawCandidate) return null;
      const confidence = Math.max(20, Math.min(42, drawPct + closeGameScore * 4 + h2hDrawRate * 3));
      return {
        type: "match",
        fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        date: fixture.date,
        league: fixture.league,
        pick: "Draw",
        market: "match result",
        confidence,
        projectedScore: drawPct > 34 ? "1-1" : "2-2",
        drawRisk: drawPct,
        source: fixture.hasOdds
          ? `${fixture.oddsSource || "Market odds"} + draw-risk calibration using tight odds, form, home/away edge, Elo, head-to-head, player features, and table motivation`
          : "draw-risk calibration using form, home/away edge, Elo, head-to-head, player features, and table motivation",
      };
    })
    .filter(Boolean);

  return [...winnerLegs, ...drawLegs].sort((a, b) => b.confidence - a.confidence);
}

function rotate(list, offset) {
  if (!list.length) return [];
  const start = offset % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

function seededRandom(seed) {
  let value = Math.max(1, Number(seed) || 1) % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffleWithSeed(list, seed) {
  const shuffled = [...list];
  const random = seededRandom(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function legKey(leg) {
  return [leg.type, leg.fixture, leg.player || "", leg.market, leg.pick].join("||").toLowerCase();
}

function selectUnique(source, targetCount, used, offset = 0) {
  const selected = [];
  for (const leg of rotate(source, offset)) {
    const key = legKey(leg);
    if (used.has(key)) continue;
    selected.push(leg);
    used.add(key);
    if (selected.length >= targetCount) break;
  }
  return selected;
}

function selectDiversePlayerLegs(source, targetCount, used, offset = 0) {
  const byTeam = new Map();
  for (const leg of source) {
    if (!byTeam.has(leg.team)) byTeam.set(leg.team, []);
    byTeam.get(leg.team).push(leg);
  }

  const teams = [...byTeam.entries()]
    .sort((a, b) => (b[1][0]?.confidence || 0) - (a[1][0]?.confidence || 0))
    .map(([team]) => team);
  const selected = [];
  const usedPlayers = new Set();

  for (let pass = 0; selected.length < targetCount && pass < 3; pass += 1) {
    const requireNewPlayer = pass === 0;
    for (const team of rotate(teams, offset + pass)) {
      const candidates = rotate(byTeam.get(team) || [], offset + pass);
      const leg = candidates.find((candidate) => {
        const key = legKey(candidate);
        if (used.has(key)) return false;
        if (requireNewPlayer && usedPlayers.has(candidate.player)) return false;
        return true;
      });
      if (!leg) continue;
      selected.push(leg);
      used.add(legKey(leg));
      usedPlayers.add(leg.player);
      if (selected.length >= targetCount) break;
    }
  }

  if (selected.length < targetCount) {
    selected.push(...selectUnique(source, targetCount - selected.length, used, offset + selected.length));
  }

  return selected;
}

function buildTicket({ index, requestedLegs, playerLegs, scoreLegs, resultLegs, fbref, refreshSeed = 0, type = "mixed" }) {
  const used = new Set();
  const playerOnly = type === "players";
  const teamOnly = type === "teams";
  const targetPlayer = playerOnly ? requestedLegs : teamOnly ? 0 : Math.max(2, Math.ceil(requestedLegs * 0.58));
  const targetScore = playerOnly ? 0 : teamOnly ? Math.max(1, Math.floor(requestedLegs * 0.45)) : Math.max(2, Math.floor(requestedLegs * 0.27));
  const targetResult = playerOnly ? 0 : Math.max(1, requestedLegs - targetPlayer - targetScore);
  const seed = refreshSeed + index * 97 + requestedLegs * 13;
  const ticketPlayerLegs = shuffleWithSeed(playerLegs, seed);
  const ticketScoreLegs = shuffleWithSeed(scoreLegs, seed + 31);
  const ticketResultLegs = shuffleWithSeed(resultLegs, seed + 61);
  const offset = (index + refreshSeed) * Math.max(3, Math.floor(requestedLegs / 2));

  const selectedPlayerLegs = targetPlayer ? selectDiversePlayerLegs(ticketPlayerLegs, targetPlayer, used, offset) : [];
  const selectedScoreLegs = targetScore ? selectUnique(ticketScoreLegs, targetScore, used, index * 2 + refreshSeed) : [];
  const drawExposureRandom = seededRandom(seed + 89);
  const resultSource =
    teamOnly
      ? ticketResultLegs.filter((leg) => {
          if (leg.pick !== "Draw") return true;
          const drawChance = Math.min(0.55, (requestedLegs >= 15 ? 0.18 : 0.1) + (Number(leg.drawRisk || 0) / 100) * 0.75);
          return drawExposureRandom() < drawChance;
        })
      : ticketResultLegs;
  const selectedResultLegs = targetResult ? selectUnique(resultSource.length ? resultSource : ticketResultLegs, targetResult, used, index * 3 + refreshSeed) : [];
  const legs = [...selectedPlayerLegs, ...selectedScoreLegs, ...selectedResultLegs];

  const fallbackLists = playerOnly ? [ticketPlayerLegs] : teamOnly ? [ticketScoreLegs, ticketResultLegs] : [ticketPlayerLegs, ticketScoreLegs, ticketResultLegs];
  for (const fallback of fallbackLists) {
    if (legs.length >= requestedLegs) break;
    for (const leg of rotate(fallback, offset + legs.length)) {
      const key = legKey(leg);
      if (used.has(key)) continue;
      legs.push(leg);
      used.add(key);
      if (legs.length >= requestedLegs) break;
    }
  }

  const finalLegs = legs.slice(0, requestedLegs);
  return {
    id: `generated_${index + 1}`,
    name:
      type === "players"
        ? `Option ${index + 1}: Player Props Parlay`
        : type === "teams"
        ? `Option ${index + 1}: Team Picks Parlay`
        : fbref.hasPlayerStats
        ? `Option ${index + 1}: Player Props + Team Model Parlay`
        : `Option ${index + 1}: Team Model Parlay`,
    legs: finalLegs,
    playerStatLegs: finalLegs.filter((leg) => leg.type === "player"),
    teamScoreLegs: finalLegs.filter((leg) => leg.type === "score"),
    matchResultLegs: finalLegs.filter((leg) => leg.type === "match"),
    averageConfidence: finalLegs.length ? pct(finalLegs.reduce((sum, leg) => sum + leg.confidence, 0) / finalLegs.length / 100) : 0,
  };
}

function buildParlays(options = {}) {
  const league = options.league || "All";
  const requestedLegs = Math.max(3, Math.min(20, Number(options.legs || 10)));
  const ticketCount = Math.max(1, Math.min(10, Number(options.tickets || 3)));
  const refreshSeed = Math.max(0, Number(options.refreshSeed || 0));
  const type = ["mixed", "teams", "players"].includes(options.type) ? options.type : "mixed";
  const excludedFixtureKeys = playedFixtureKeys();
  const allFixtures = fixturePredictionBoard().filter((fixture) => league === "All" || fixture.league === league);
  const fixtures = allFixtures.filter((fixture) => !excludedFixtureKeys.has(fixtureSignatureFromFixture(fixture)));
  const fbref = fbrefStatus();
  const players = aggregatePlayers(loadFbrefRows());
  const playerLegs = fixtures.flatMap((fixture) => playerPropCandidates(players, fixture));
  const scoreLegs = teamScoreLegs(fixtures);
  const resultLegs = matchResultLegs(fixtures);
  const excludedLegFixtures = new Set([...excludedFixtureKeys]);
  const eligiblePlayerLegs = playerLegs.filter((leg) => !excludedLegFixtures.has([leg.date || "", leg.fixture || ""].join("|").toLowerCase()));
  const eligibleScoreLegs = scoreLegs.filter((leg) => !excludedLegFixtures.has([leg.date || "", leg.fixture || ""].join("|").toLowerCase()));
  const eligibleResultLegs = resultLegs.filter((leg) => !excludedLegFixtures.has([leg.date || "", leg.fixture || ""].join("|").toLowerCase()));
  const parlays = Array.from({ length: ticketCount }, (_, index) =>
    buildTicket({
      index,
      requestedLegs,
      playerLegs: eligiblePlayerLegs,
      scoreLegs: eligibleScoreLegs,
      resultLegs: eligibleResultLegs,
      fbref,
      refreshSeed,
      type,
    })
  ).filter((ticket) => ticket.legs.length);

  return {
    fbref,
    filters: { league, requestedLegs, ticketCount, type, refreshSeed },
    excludedFixtureCount: allFixtures.length - fixtures.length,
    availableFixtureCount: fixtures.length,
    playerCandidateCount: eligiblePlayerLegs.length,
    teamScoreCandidateCount: eligibleScoreLegs.length,
    parlays,
    parlay: {
      ...(parlays[0] || {
        name: fbref.hasPlayerStats ? "FBref Player Props + Team Model Parlay" : "Team Model Parlay Waiting For Player Stats",
        legs: [],
        playerStatLegs: [],
        teamScoreLegs: [],
        matchResultLegs: [],
        averageConfidence: 0,
      }),
      note: fbref.hasPlayerStats
        ? `Mode: ${type}. Player legs are ranked from imported player-season stats, projected team scoring, match-result lean, and live table motivation including title-race, European-place, relegation, and title-secured rotation risk. Team result and score legs use the local match model, including form, home/away edge, Elo, head-to-head, market odds when available, player-derived features, and live standings motivation. ${allFixtures.length - fixtures.length} played fixture${allFixtures.length - fixtures.length === 1 ? "" : "s"} excluded from new parlay generation.`
        : "No imported player-stat rows were found, so this ticket currently includes team-score legs only. Import FBref or Thunderbit CSVs to add player props.",
    },
  };
}

module.exports = {
  buildParlay: buildParlays,
  buildParlays,
  fbrefStatus,
  loadFbrefRows,
};
