const fs = require("fs");
const path = require("path");
const { fixturePredictionBoard } = require("./predictionService");
const { internationalFixturePredictions, internationalStatus, normalizeIntlTeam, readFriendlyTraining } = require("./internationalData");
const { FEATURE_NAMES } = require("./features");
const { aggregatePlayers, loadPlayerRows } = require("./playerStats");
const { fixtureSignatureFromFixture, playedFixtureKeys } = require("./parlayBacktestStore");

const FBREF_JSON_PATH = path.join(process.cwd(), "data", "fbref", "processed", "fbref_player_stats.json");
const FBREF_RAW_DIR = path.join(process.cwd(), "data", "fbref", "raw");
const BACKTEST_PATH = path.join(process.cwd(), "data", "backtests.json");
const PLAYED_RESULTS_PATH = path.join(process.cwd(), "data", "played_results.json");

const PLAYER_NAME_CORRECTIONS = new Map([
  ["alejandro gamacho", "Alejandro Garnacho"],
  ["alisson hbisxe", "Alisson"],
  ["flip teraensen seen", "Filip Jorgensen"],
  ["fuucas chevalier mera", "Lucas Chevalier"],
  ["guslicimo vicario hita", "Guglielmo Vicario"],
  ["jantonin kinsky mya cze", "Antonin Kinsky"],
  ["jonasurbig -rmblger", "Jonas Urbig"],
  ["ude bellingham", "Jude Bellingham"],
  ["jude bellinghan", "Jude Bellingham"],
  ["lwojciech szczesny yg pol", "Wojciech Szczesny"],
  ["manuelneuer mmblger", "Manuel Neuer"],
  ["matvei safonov gg rus", "Matvei Safonov"],
  ["oan garcia tese", "Joan Garcia"],
  ["robert sanchez heqesp", "Robert Sanchez"],
  ["juan musso selarg", "Juan Musso"],
]);

const INTERNATIONAL_PRIORITY_PLAYERS = new Set([
  "Lionel Messi",
  "Kylian Mbappe",
  "Harry Kane",
  "Cristiano Ronaldo",
  "Neymar",
  "Vinicius Junior",
  "Bukayo Saka",
  "Jude Bellingham",
  "Phil Foden",
  "Bruno Fernandes",
  "Ousmane Dembele",
  "Raphinha",
  "Lamine Yamal",
  "Antoine Griezmann",
  "Julian Alvarez",
  "Lautaro Martinez",
  "Christian Pulisic",
  "Memphis",
  "Son Heung-min",
  "Goncalo Ramos",
  "Olivier Giroud",
  "Kai Havertz",
  "Romelu Lukaku",
  "Robert Lewandowski",
  "Luis Suarez",
  "Achraf Hakimi",
  "Hakim Ziyech",
  "Luka Modric",
  "Ivan Perisic",
  "Federico Valverde",
  "Kevin De Bruyne",
  "Jamal Musiala",
  "Michael Olise",
]);

function pct(value) {
  return Number((value * 100).toFixed(1));
}

function parseProjectedScore(score) {
  const match = String(score || "").trim().match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  return { homeGoals: Number(match[1]), awayGoals: Number(match[2]) };
}

function decimalPrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 1 ? Number(price.toFixed(2)) : null;
}

function modelEstimatedPrice(confidence) {
  const probability = Math.max(8, Math.min(92, Number(confidence || 0))) / 100;
  return Number((1 / probability).toFixed(2));
}

function sportsbookMatchPrice(fixture, pick) {
  const odds = fixture.odds || {};
  if (pick === "Draw") return decimalPrice(odds.drawOdds);
  if (pick === `${fixture.homeTeam} win`) return decimalPrice(odds.homeOdds);
  if (pick === `${fixture.awayTeam} win`) return decimalPrice(odds.awayOdds);
  return null;
}

function withLegPricing(leg, fixture = null) {
  const sportsbookPrice = fixture && leg.type === "match" ? sportsbookMatchPrice(fixture, leg.pick) : null;
  if (sportsbookPrice) {
    return {
      ...leg,
      decimalOdds: sportsbookPrice,
      oddsType: "sportsbook",
      oddsSource: fixture.oddsSource || "The Odds API",
      oddsStatus: fixture.oddsStatus || "Public match-result odds",
      oddsSourceUrl: fixture.oddsSourceUrl || "",
      oddsSnapshotAt: fixture.oddsSnapshotAt || "",
    };
  }
  return {
    ...leg,
    decimalOdds: modelEstimatedPrice(leg.confidence),
    oddsType: "model-estimate",
    oddsSource: "Model-estimated fair price",
    oddsStatus: leg.type === "match" ? "No sportsbook price matched for this result leg" : "Sportsbook prop line not available from the current Odds API h2h feed",
    oddsSourceUrl: "",
    oddsSnapshotAt: "",
  };
}

function decorateLegsWithPricing(legs, fixtureMap) {
  return (legs || []).map((leg) => withLegPricing(leg, fixtureMap.get(String(leg.fixture || "").toLowerCase()) || null));
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

function featureValue(fixture, name) {
  const index = FEATURE_NAMES.indexOf(name);
  return index >= 0 ? Number(fixture.featureVector?.[index] || 0) : 0;
}

function fixtureLeanScore(fixture) {
  const topPct = Math.max(Number(fixture.probabilities?.homeWinPct || 0), Number(fixture.probabilities?.awayWinPct || 0));
  const drawPct = Number(fixture.probabilities?.drawPct || 0);
  return topPct - drawPct;
}

function cleanPlayerName(name) {
  const key = String(name || "").trim().toLowerCase();
  return PLAYER_NAME_CORRECTIONS.get(key) || String(name || "").trim();
}

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function settledFixtureKeys() {
  const keys = new Set(playedFixtureKeys());
  const backtests = readJsonFile(BACKTEST_PATH, { predictions: [] });
  for (const prediction of backtests.predictions || []) {
    if (prediction.status !== "SETTLED") continue;
    keys.add(fixtureSignatureFromFixture(prediction));
  }
  const playedResults = readJsonFile(PLAYED_RESULTS_PATH, { results: [] });
  for (const result of playedResults.results || []) {
    keys.add(fixtureSignatureFromFixture(result));
  }
  return keys;
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

function poissonAtLeast(lambda, threshold) {
  const rate = Math.max(0, Number(lambda) || 0);
  let cumulative = 0;
  for (let k = 0; k < threshold; k += 1) {
    cumulative += (Math.exp(-rate) * rate ** k) / factorial(k);
  }
  return Math.max(0, Math.min(1, 1 - cumulative));
}

function factorial(value) {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

function latestTeamPlayers(players, league, team) {
  const matches = players.filter((player) => player.league === league && player.squad === team);
  const latest = Math.max(0, ...matches.map((player) => seasonRank(player.season)));
  return matches.filter((player) => seasonRank(player.season) === latest);
}

function internationalTeamPlayers(players, team) {
  const grouped = new Map();
  for (const player of players.filter((item) => item.league === "International" && item.squad === team)) {
    const existing = grouped.get(player.player) || {
      ...player,
      appearances: 0,
      starts: 0,
      minutes: 0,
      nineties: 0,
      goals: 0,
      assists: 0,
      shots: 0,
      shotsOnTarget: 0,
      saves: 0,
      sourceTypes: new Set(),
      sourceLabels: new Set(),
    };
    existing.appearances += Number(player.appearances || 0);
    existing.starts += Number(player.starts || 0);
    existing.minutes += Number(player.minutes || 0);
    existing.nineties += Number(player.nineties || 0);
    existing.goals += Number(player.goals || 0);
    existing.assists += Number(player.assists || 0);
    existing.shots += Number(player.shots || 0);
    existing.shotsOnTarget += Number(player.shotsOnTarget || 0);
    existing.saves += Number(player.saves || 0);
    for (const type of player.sourceTypes || []) existing.sourceTypes.add(type);
    for (const label of player.sourceLabels || []) existing.sourceLabels.add(label);
    existing.season = "2018/2022 World Cup";
    grouped.set(player.player, existing);
  }
  return [...grouped.values()].map((player) => ({
    ...player,
    sourceTypes: [...player.sourceTypes],
    sourceLabels: [...player.sourceLabels],
    goalsPer90: player.nineties ? player.goals / player.nineties : 0,
    assistsPer90: player.nineties ? player.assists / player.nineties : 0,
    shotsPer90: player.nineties ? player.shots / player.nineties : 0,
    shotsOnTargetPer90: player.nineties ? player.shotsOnTarget / player.nineties : 0,
    goalAssistPer90: player.nineties ? (player.goals + player.assists) / player.nineties : 0,
  })).filter((player) =>
    INTERNATIONAL_PRIORITY_PLAYERS.has(cleanPlayerName(player.player)) &&
    player.goals <= 20 &&
    player.assists <= 15 &&
    player.goalsPer90 <= 3 &&
    player.assistsPer90 <= 3
  );
}

function riskSourceSuffix(source, metric, threshold) {
  return `${source}; risk mode: threshold is close to the player's average (${metric}), not a random long-shot`;
}

function playerPropCandidates(players, fixture, riskMode = "safe") {
  const isRiskyMode = riskMode === "risky";
  const teams = [fixture.homeTeam, fixture.awayTeam];
  const candidates = [];

  for (const team of teams) {
    for (const player of latestTeamPlayers(players, fixture.league, team)) {
      const playerName = cleanPlayerName(player.player);
      if (player.hasShotStats && player.shotsPer90 >= 2) {
        const baseConfidence = Math.min(86, 52 + player.shotsPer90 * 8);
        const metric = `${player.shotsPer90.toFixed(2)} shots/90`;
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
          fbrefMetric: metric,
          fbrefSeason: player.season,
          source: motivationSourceSuffix(fixture, team, playerSource(player)),
        });

        if (isRiskyMode && player.shotsPer90 >= 2.35) {
          const chance = poissonAtLeast(player.shotsPer90, 2);
          const riskBaseConfidence = 38 + chance * 42;
          candidates.push({
            type: "player",
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            date: fixture.date,
            league: fixture.league,
            team,
            player: playerName,
            market: "2+ shots",
            pick: `${playerName} 2+ shots`,
            confidence: adjustedConfidence(riskBaseConfidence, fixture, team, "player", 38, 76),
            fbrefMetric: metric,
            fbrefSeason: player.season,
            source: riskSourceSuffix(motivationSourceSuffix(fixture, team, playerSource(player)), metric, "2+ shots"),
            riskMode: true,
          });
        }
      }

      if (player.hasShotStats && player.shotsOnTargetPer90 >= 0.7) {
        const baseConfidence = Math.min(82, 50 + player.shotsOnTargetPer90 * 18);
        const metric = `${player.shotsOnTargetPer90.toFixed(2)} shots on target/90`;
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
          fbrefMetric: metric,
          fbrefSeason: player.season,
          source: motivationSourceSuffix(fixture, team, playerSource(player)),
        });

        if (isRiskyMode && player.shotsOnTargetPer90 >= 1.1) {
          const chance = poissonAtLeast(player.shotsOnTargetPer90, 2);
          const riskBaseConfidence = 34 + chance * 54;
          candidates.push({
            type: "player",
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            date: fixture.date,
            league: fixture.league,
            team,
            player: playerName,
            market: "2+ shots on target",
            pick: `${playerName} 2+ shots on target`,
            confidence: adjustedConfidence(riskBaseConfidence, fixture, team, "player", 32, 66),
            fbrefMetric: metric,
            fbrefSeason: player.season,
            source: riskSourceSuffix(motivationSourceSuffix(fixture, team, playerSource(player)), metric, "2+ shots on target"),
            riskMode: true,
          });
        }
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

        // First goal scorer — risk mode: player most likely to open the scoring
        if (isRiskyMode && player.goalsPer90 >= 0.4) {
          const teamGoals = projectedTeamGoals(fixture, team);
          // P(first scorer) ≈ P(player scores) × share of team goals × scoring-team lead factor
          const anytimeChance = poissonAtLeast(player.goalsPer90, 1);
          const teamGoalChance = Math.min(0.92, poissonAtLeast(Math.max(0.6, teamGoals), 1));
          const scoringShare = Math.min(0.55, player.goalsPer90 / Math.max(1, teamGoals));
          const firstScorerChance = anytimeChance * teamGoalChance * scoringShare * 1.35;
          const fgsConfidence = Math.max(22, Math.min(58, 20 + firstScorerChance * 120));
          candidates.push({
            type: "player",
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            date: fixture.date,
            league: fixture.league,
            team,
            player: playerName,
            market: "first goal scorer",
            pick: `${playerName} first goal scorer`,
            confidence: adjustedConfidence(fgsConfidence, fixture, team, "player", 20, 58),
            fbrefMetric: `${player.goalsPer90.toFixed(2)} goals/90, ${teamGoals} team goals projected`,
            fbrefSeason: player.season,
            source: riskSourceSuffix(motivationSourceSuffix(fixture, team, playerSource(player)), `${player.goalsPer90.toFixed(2)} goals/90`, "first goal scorer"),
            riskMode: true,
          });
        }
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

      if (isRiskyMode && player.hasGoalkeepingStats && player.savesPer90 >= 0.8 && player.savesPer90 <= 6 && player.nineties >= 3) {
        const oneSaveMetric = `${player.savesPer90.toFixed(2)} saves/90`;
        const oneSaveChance = poissonAtLeast(player.savesPer90, 1);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "1+ save",
          pick: `${playerName} 1+ save`,
          confidence: adjustedConfidence(40 + oneSaveChance * 35, fixture, team, "player", 35, 74),
          fbrefMetric: oneSaveMetric,
          fbrefSeason: player.season,
          source: riskSourceSuffix(motivationSourceSuffix(fixture, team, playerSource(player)), oneSaveMetric, "1+ save"),
          riskMode: true,
        });

        if (player.savesPer90 >= 1.55) {
          const twoSaveChance = poissonAtLeast(player.savesPer90, 2);
          candidates.push({
            type: "player",
            fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            date: fixture.date,
            league: fixture.league,
            team,
            player: playerName,
            market: "2+ saves",
            pick: `${playerName} 2+ saves`,
            confidence: adjustedConfidence(36 + twoSaveChance * 42, fixture, team, "player", 32, 68),
            fbrefMetric: oneSaveMetric,
            fbrefSeason: player.season,
            source: riskSourceSuffix(motivationSourceSuffix(fixture, team, playerSource(player)), oneSaveMetric, "2+ saves"),
            riskMode: true,
          });
        }
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

const WC2026_PROFILES_PATH = path.join(process.cwd(), "data", "international", "wc2026_player_profiles.json");

let wc2026ProfilesCache = null;
// Researched 2026 squad profiles (all 48 teams) — FIFA squad announcements,
// ESPN squad lists, and June 2026 pre-WC friendly performances.
function loadWc2026Profiles() {
  if (wc2026ProfilesCache) return wc2026ProfilesCache;
  wc2026ProfilesCache = readJsonFile(WC2026_PROFILES_PATH, { teams: {} });
  return wc2026ProfilesCache;
}

// Player-prop candidates from the researched 2026 squad profiles. Unlike the
// legacy 2018/2022 imported rows (39 squads, superstar whitelist only), this
// covers every team at the tournament — so fixtures like Mexico vs South
// Africa produce a full prop board instead of falling back to odds-only legs.
function wc2026ProfilePropCandidates(fixture, riskMode = "safe") {
  const isRiskyMode = riskMode === "risky";
  const profiles = loadWc2026Profiles().teams || {};
  const training = readFriendlyTraining();
  // Live tournament output (auto-synced from ESPN match summaries): players
  // actually scoring at the World Cup get their estimates trained upward.
  let liveStats = { players: {} };
  try {
    liveStats = require("./worldCupSync").readWcLivePlayerStats();
  } catch (_) { /* sync module unavailable — fall back to researched profiles */ }
  // Accent/case-insensitive keys: ESPN reports "Raúl Jiménez", profiles store
  // "Raul Jimenez" — both must hit the same live-stats record.
  const foldName = (name) => String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const liveByPlayer = new Map(Object.values(liveStats.players || {}).map((p) => [foldName(p.player), p]));
  const candidates = [];

  for (const team of [fixture.homeTeam, fixture.awayTeam]) {
    const fifaName = normalizeIntlTeam(team);
    const profile = profiles[fifaName];
    if (!profile || !Array.isArray(profile.players)) continue;
    const opponent = team === fixture.homeTeam ? fixture.awayTeam : fixture.homeTeam;
    const opponentProfile = profiles[normalizeIntlTeam(opponent)];
    const teamGoalProjection = Math.max(0.6, projectedTeamGoals(fixture, team));
    // Friendly form nudges prop confidence by up to ±3 — friendlies signal
    // capability without being treated as competitive-grade evidence.
    const friendlyDelta = training?.teams?.[fifaName]?.weightedFormDelta || 0;
    const formNudge = friendlyDelta * 0.75;
    // Stronger opposing attack → more save chances for the GK, fewer clean games.
    const opponentAttack = Number(opponentProfile?.attackTier ?? 0.5);
    const baseSource = `2026 squad research (FIFA/ESPN squad lists + June 2026 pre-WC friendlies)${profile.recentForm ? `; recent form: ${profile.recentForm}` : ""}`;

    for (const player of profile.players) {
      const playerName = cleanPlayerName(player.name);
      let goalsPer90 = Number(player.goalsPer90 || 0);
      let assistsPer90 = Number(player.assistsPer90 || 0);
      const shotsPer90 = Number(player.shotsPer90 || 0);
      const sotPer90 = Number(player.shotsOnTargetPer90 || 0);
      const savesPer90 = Number(player.savesPer90 || 0);
      const detail = [player.position, player.club].filter(Boolean).join(", ");
      // Blend in live tournament output once the player has featured.
      const live = liveByPlayer.get(foldName(playerName));
      let liveNote = "";
      if (live && live.matches > 0) {
        const liveGoalsRate = live.goals / live.matches;
        const liveAssistsRate = live.assists / live.matches;
        goalsPer90 = goalsPer90 * 0.6 + liveGoalsRate * 0.4;
        assistsPer90 = assistsPer90 * 0.6 + liveAssistsRate * 0.4;
        liveNote = `; WC 2026 so far: ${live.goals}g ${live.assists}a in ${live.matches} match${live.matches === 1 ? "" : "es"}`;
      }
      const playerSourceText = `${baseSource}${player.note ? `; ${player.note}` : ""}${liveNote}`;

      if (player.position !== "GK" && goalsPer90 >= 0.25) {
        const scoringChance = poissonAtLeast(goalsPer90 * Math.max(0.7, teamGoalProjection / 1.3), 1);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "anytime scorer",
          pick: `${playerName} anytime scorer`,
          confidence: Math.max(30, Math.min(isRiskyMode ? 74 : 66, 32 + scoringChance * 46 + teamGoalProjection * 2 + formNudge)),
          fbrefMetric: `${goalsPer90.toFixed(2)} goals/90 est. (${detail})`,
          fbrefSeason: "2026 squads",
          source: playerSourceText,
          riskMode: isRiskyMode && scoringChance < 0.4,
        });
      }

      if (player.position !== "GK" && assistsPer90 >= 0.18) {
        const assistChance = poissonAtLeast(assistsPer90 * Math.max(0.75, teamGoalProjection / 1.3), 1);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "assist",
          pick: `${playerName} to assist`,
          confidence: Math.max(28, Math.min(isRiskyMode ? 64 : 56, 28 + assistChance * 40 + teamGoalProjection * 1.5 + formNudge)),
          fbrefMetric: `${assistsPer90.toFixed(2)} assists/90 est. (${detail})`,
          fbrefSeason: "2026 squads",
          source: playerSourceText,
          riskMode: isRiskyMode,
        });
      }

      if (player.position !== "GK" && goalsPer90 + assistsPer90 >= 0.45) {
        const involvementChance = poissonAtLeast((goalsPer90 + assistsPer90) * Math.max(0.75, teamGoalProjection / 1.3), 1);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "score or assist",
          pick: `${playerName} to score or assist`,
          confidence: Math.max(32, Math.min(isRiskyMode ? 76 : 70, 34 + involvementChance * 44 + formNudge)),
          fbrefMetric: `${(goalsPer90 + assistsPer90).toFixed(2)} goals+assists/90 est. (${detail})`,
          fbrefSeason: "2026 squads",
          source: playerSourceText,
          riskMode: false,
        });
      }

      if (player.position !== "GK" && sotPer90 >= 0.7) {
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "1+ shot on target",
          pick: `${playerName} 1+ shot on target`,
          confidence: Math.max(36, Math.min(82, 46 + sotPer90 * 20 + formNudge)),
          fbrefMetric: `${sotPer90.toFixed(2)} shots on target/90 est. (${detail})`,
          fbrefSeason: "2026 squads",
          source: playerSourceText,
        });
      }

      if (isRiskyMode && player.position !== "GK" && shotsPer90 >= 2.3) {
        const twoShotChance = poissonAtLeast(shotsPer90, 2);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "2+ shots",
          pick: `${playerName} 2+ shots`,
          confidence: Math.max(36, Math.min(74, 36 + twoShotChance * 40 + formNudge)),
          fbrefMetric: `${shotsPer90.toFixed(2)} shots/90 est. (${detail})`,
          fbrefSeason: "2026 squads",
          source: `${playerSourceText}; risk mode: threshold close to the player's estimated volume`,
          riskMode: true,
        });
      }

      if (isRiskyMode && player.position === "GK" && savesPer90 >= 2.2) {
        const saveLambda = savesPer90 * (0.7 + opponentAttack * 0.6);
        const twoSaveChance = poissonAtLeast(saveLambda, 2);
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "2+ saves",
          pick: `${playerName} 2+ saves`,
          confidence: Math.max(34, Math.min(72, 34 + twoSaveChance * 42)),
          fbrefMetric: `${savesPer90.toFixed(2)} saves/90 est. vs ${opponent} attack tier ${opponentAttack.toFixed(2)} (${detail})`,
          fbrefSeason: "2026 squads",
          source: `${playerSourceText}; risk mode: save volume scaled by opponent attacking strength`,
          riskMode: true,
        });
      }
    }
  }
  return candidates;
}

function internationalPlayerPropCandidates(players, fixture, riskMode = "safe") {
  const isRiskyMode = riskMode === "risky";
  // Primary source: researched 2026 squad profiles covering all 48 teams.
  const candidates = wc2026ProfilePropCandidates(fixture, riskMode);
  const coveredPicks = new Set(candidates.map((leg) => `${leg.player}|${leg.market}`));
  // Legacy supplement: imported 2018/2022 World Cup rows for the marquee names.
  for (const team of [fixture.homeTeam, fixture.awayTeam]) {
    const teamGoalProjection = projectedTeamGoals(fixture, team);
    const teamPlayers = internationalTeamPlayers(players, team)
      .filter((player) => player.goals > 0 || player.assists > 0 || player.goalAssistPer90 >= 0.25)
      .sort((a, b) => b.goals + b.assists - (a.goals + a.assists) || b.goalAssistPer90 - a.goalAssistPer90)
      .slice(0, 5);
    for (const player of teamPlayers) {
      const playerName = cleanPlayerName(player.player);
      const scoringChance = poissonAtLeast(Math.max(0.12, player.goalsPer90 * Math.max(0.65, teamGoalProjection)), 1);
      if ((player.goals > 0 || player.goalsPer90 >= 0.25) && !coveredPicks.has(`${playerName}|anytime scorer`)) {
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "anytime scorer",
          pick: `${playerName} anytime scorer`,
          confidence: Math.max(34, Math.min(isRiskyMode ? 72 : 64, 34 + scoringChance * 42 + teamGoalProjection * 2)),
          fbrefMetric: `${player.goals} goals, ${player.goalsPer90.toFixed(2)} goals/90 in imported 2018/2022 World Cup rows`,
          fbrefSeason: "World Cup 2018/2022",
          source: "International model: imported World Cup player rows + 2026 fixture rating projection",
          riskMode: isRiskyMode && scoringChance < 0.42,
        });
      }
      const assistChance = poissonAtLeast(Math.max(0.08, player.assistsPer90 * Math.max(0.75, teamGoalProjection)), 1);
      if ((player.assists > 0 || player.assistsPer90 >= 0.2) && !coveredPicks.has(`${playerName}|assist`)) {
        candidates.push({
          type: "player",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team,
          player: playerName,
          market: "assist",
          pick: `${playerName} to assist`,
          confidence: Math.max(30, Math.min(isRiskyMode ? 66 : 58, 30 + assistChance * 38 + teamGoalProjection * 1.5)),
          fbrefMetric: `${player.assists} assists, ${player.assistsPer90.toFixed(2)} assists/90 in imported 2018/2022 World Cup rows`,
          fbrefSeason: "World Cup 2018/2022",
          source: "International model: imported World Cup player rows + 2026 fixture rating projection",
          riskMode: isRiskyMode,
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

function bttsLegs(fixtures, riskMode = "safe") {
  const isRiskyMode = riskMode === "risky";
  const legs = [];

  for (const fixture of fixtures) {
    const score = parseProjectedScore(fixture.projectedScore);
    const homeGF = featureValue(fixture, "homeGFPerGame");
    const awayGF = featureValue(fixture, "awayGFPerGame");
    const homeGA = featureValue(fixture, "homeGAPerGame");
    const awayGA = featureValue(fixture, "awayGAPerGame");
    const homeClean = featureValue(fixture, "homeCleanSheetRate");
    const awayClean = featureValue(fixture, "awayCleanSheetRate");
    const projectedYes = score ? score.homeGoals > 0 && score.awayGoals > 0 : false;
    const attackingSignal = (homeGF + awayGF + homeGA + awayGA) / 4;
    const cleanSheetSignal = (homeClean + awayClean) / 2;
    const yesScore = (projectedYes ? 0.42 : 0.1) + Math.min(0.38, attackingSignal * 0.18) - cleanSheetSignal * 0.16;
    const yes = yesScore >= 0.47;
    const bttsSource = `Projected score ${fixture.projectedScore || "N/A"}; scoring profile GF ${homeGF.toFixed(2)}-${awayGF.toFixed(2)}, GA ${homeGA.toFixed(2)}-${awayGA.toFixed(2)}, clean-sheet rate ${homeClean.toFixed(2)}-${awayClean.toFixed(2)}`;

    legs.push({
      type: "btts",
      fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
      date: fixture.date,
      league: fixture.league,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      market: "both teams to score",
      pick: yes ? "Both teams to score: Yes" : "Both teams to score: No",
      confidence: yes
        ? Math.max(44, Math.min(74, 46 + yesScore * 42 + fixtureLeanScore(fixture) * 0.08))
        : Math.max(42, Math.min(72, 62 - yesScore * 34 + cleanSheetSignal * 12)),
      projectedScore: fixture.projectedScore,
      source: bttsSource,
    });

    // Risk mode: "team to not score" / clean sheet props based on projected goals and clean sheet rate
    if (isRiskyMode) {
      // Home team clean sheet (away team doesn't score)
      const homeKeepsClean = score ? score.awayGoals === 0 : false;
      const homeCleanChance = homeClean * 0.7 + (homeGA <= 0.85 ? 0.18 : 0) + (homeKeepsClean ? 0.15 : 0);
      if (homeCleanChance >= 0.28 || homeClean >= 0.30) {
        const cleanConf = Math.max(34, Math.min(64, 30 + homeCleanChance * 90 + cleanSheetSignal * 6));
        legs.push({
          type: "btts",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          market: "team clean sheet",
          pick: `${fixture.homeTeam} to keep a clean sheet`,
          confidence: adjustedConfidence(cleanConf, fixture, fixture.homeTeam, "score", 30, 66),
          projectedScore: fixture.projectedScore,
          source: `${bttsSource}; ${fixture.homeTeam} clean sheet rate ${homeClean.toFixed(2)}, away GF rate ${awayGF.toFixed(2)}`,
          riskMode: true,
        });
      }

      // Away team clean sheet (home team doesn't score)
      const awayKeepsClean = score ? score.homeGoals === 0 : false;
      const awayCleanChance = awayClean * 0.7 + (awayGA <= 0.85 ? 0.18 : 0) + (awayKeepsClean ? 0.15 : 0);
      if (awayCleanChance >= 0.28 || awayClean >= 0.30) {
        const cleanConf = Math.max(34, Math.min(64, 30 + awayCleanChance * 90 + cleanSheetSignal * 6));
        legs.push({
          type: "btts",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          market: "team clean sheet",
          pick: `${fixture.awayTeam} to keep a clean sheet`,
          confidence: adjustedConfidence(cleanConf, fixture, fixture.awayTeam, "score", 30, 66),
          projectedScore: fixture.projectedScore,
          source: `${bttsSource}; ${fixture.awayTeam} clean sheet rate ${awayClean.toFixed(2)}, home GF rate ${homeGF.toFixed(2)}`,
          riskMode: true,
        });
      }
    }
  }

  return legs.sort((a, b) => b.confidence - a.confidence);
}

function cornerLegs(fixtures, riskMode = "safe") {
  const risky = riskMode === "risky";
  return fixtures
    .flatMap((fixture) => {
      const homeCorners = featureValue(fixture, "homeCornersPerGame");
      const awayCorners = featureValue(fixture, "awayCornersPerGame");
      const totalCorners = homeCorners + awayCorners;
      if (!totalCorners) return [];
      const totalLine = risky ? Math.max(7.5, Math.round(totalCorners * 2) / 2 - 0.5) : Math.max(6.5, Math.floor(totalCorners - 1.2) + 0.5);
      const homeLine = Math.max(2.5, Math.floor(homeCorners - (risky ? 0.4 : 0.9)) + 0.5);
      const awayLine = Math.max(2.5, Math.floor(awayCorners - (risky ? 0.4 : 0.9)) + 0.5);
      const source = `Corner model from season match data: ${fixture.homeTeam} ${homeCorners.toFixed(2)} corners/game, ${fixture.awayTeam} ${awayCorners.toFixed(2)} corners/game, combined ${totalCorners.toFixed(2)}.`;
      return [
        {
          type: "corner",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team: fixture.homeTeam,
          market: "team corners",
          pick: `${fixture.homeTeam} over ${homeLine.toFixed(1)} corners`,
          confidence: Math.max(40, Math.min(risky ? 68 : 78, 50 + Math.max(0, homeCorners - homeLine) * 13)),
          fbrefMetric: `${homeCorners.toFixed(2)} corners/game`,
          source,
          riskMode: risky && homeLine >= homeCorners - 0.5,
        },
        {
          type: "corner",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          team: fixture.awayTeam,
          market: "team corners",
          pick: `${fixture.awayTeam} over ${awayLine.toFixed(1)} corners`,
          confidence: Math.max(40, Math.min(risky ? 68 : 78, 50 + Math.max(0, awayCorners - awayLine) * 13)),
          fbrefMetric: `${awayCorners.toFixed(2)} corners/game`,
          source,
          riskMode: risky && awayLine >= awayCorners - 0.5,
        },
        {
          type: "corner",
          fixture: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          date: fixture.date,
          league: fixture.league,
          market: "total corners",
          pick: `Over ${totalLine.toFixed(1)} total corners`,
          confidence: Math.max(42, Math.min(risky ? 70 : 80, 52 + Math.max(0, totalCorners - totalLine) * 9)),
          fbrefMetric: `${totalCorners.toFixed(2)} combined corners/game`,
          source,
          riskMode: risky && totalLine >= totalCorners - 0.6,
        },
      ].filter((leg) => Number(leg.confidence || 0) >= 42);
    })
    .sort((a, b) => b.confidence - a.confidence);
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

function fixtureTeams(leg) {
  if (leg.homeTeam && leg.awayTeam) return { homeTeam: leg.homeTeam, awayTeam: leg.awayTeam };
  const [homeTeam, awayTeam] = String(leg.fixture || "").split(" vs ");
  return { homeTeam, awayTeam };
}

function outcomeFromGoals(homeGoals, awayGoals) {
  if (homeGoals > awayGoals) return "H";
  if (awayGoals > homeGoals) return "A";
  return "D";
}

function legCompatibilityProfile(leg) {
  const { homeTeam, awayTeam } = fixtureTeams(leg);
  const score = leg.type === "score" ? { homeGoals: leg.homeGoals, awayGoals: leg.awayGoals } : parseProjectedScore(leg.projectedScore);
  const profile = {
    fixture: leg.fixture,
    exactScore: null,
    outcome: null,
    btts: null,
    zeroGoalTeams: new Set(),
    requiresTeamGoal: null,
  };

  if (leg.type === "score" && Number.isFinite(Number(score?.homeGoals)) && Number.isFinite(Number(score?.awayGoals))) {
    const homeGoals = Number(score.homeGoals);
    const awayGoals = Number(score.awayGoals);
    profile.exactScore = `${homeGoals}-${awayGoals}`;
    profile.outcome = outcomeFromGoals(homeGoals, awayGoals);
    profile.btts = homeGoals > 0 && awayGoals > 0;
    if (homeGoals === 0 && homeTeam) profile.zeroGoalTeams.add(homeTeam);
    if (awayGoals === 0 && awayTeam) profile.zeroGoalTeams.add(awayTeam);
  }

  if (leg.type === "match") {
    if (leg.pick === "Draw") profile.outcome = "D";
    else if (homeTeam && leg.pick === `${homeTeam} win`) profile.outcome = "H";
    else if (awayTeam && leg.pick === `${awayTeam} win`) profile.outcome = "A";
  }

  if (leg.type === "btts") {
    if (String(leg.pick).includes("Yes")) profile.btts = true;
    if (String(leg.pick).includes("No")) profile.btts = false;
  }

  if (leg.type === "player" && ["anytime goal", "assist", "score or assist"].includes(leg.market)) {
    profile.requiresTeamGoal = leg.team || null;
  }

  return profile;
}

function legsAreCompatible(a, b) {
  if (!a || !b || a.fixture !== b.fixture) return true;
  const left = legCompatibilityProfile(a);
  const right = legCompatibilityProfile(b);

  if (left.exactScore && right.exactScore && left.exactScore !== right.exactScore) return false;
  if (left.outcome && right.outcome && left.outcome !== right.outcome) return false;
  if (left.btts !== null && right.btts !== null && left.btts !== right.btts) return false;
  if (left.requiresTeamGoal && right.zeroGoalTeams.has(left.requiresTeamGoal)) return false;
  if (right.requiresTeamGoal && left.zeroGoalTeams.has(right.requiresTeamGoal)) return false;
  return true;
}

function addCompatibleLeg(selected, used, leg) {
  const key = legKey(leg);
  if (used.has(key)) return false;
  if (!selected.every((existing) => legsAreCompatible(existing, leg))) return false;
  selected.push(leg);
  used.add(key);
  return true;
}

function reconcileCompatibleLegs(candidates, fallbackLists, requestedLegs, offset = 0) {
  const selected = [];
  const used = new Set();
  for (const leg of candidates) {
    if (selected.length >= requestedLegs) break;
    addCompatibleLeg(selected, used, leg);
  }
  for (const fallback of fallbackLists) {
    if (selected.length >= requestedLegs) break;
    for (const leg of rotate(fallback, offset + selected.length)) {
      if (addCompatibleLeg(selected, used, leg) && selected.length >= requestedLegs) break;
    }
  }
  return selected.slice(0, requestedLegs);
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

function buildTicket({ index, requestedLegs, playerLegs, scoreLegs, resultLegs, propLegs = [], fbref, refreshSeed = 0, type = "mixed", riskMode = "safe" }) {
  const used = new Set();
  const playerOnly = type === "players";
  const teamOnly = type === "teams";
  const isRiskyMode = riskMode === "risky";
  const targetProps = playerOnly ? 0 : Math.max(requestedLegs >= 5 ? 2 : 1, Math.floor(requestedLegs * (isRiskyMode ? 0.22 : 0.18)));
  const targetScore = playerOnly ? 0 : teamOnly ? Math.max(1, Math.floor(requestedLegs * 0.36)) : Math.max(1, Math.floor(requestedLegs * (isRiskyMode ? 0.16 : 0.22)));
  const targetResult = playerOnly ? 0 : 1;
  const targetPlayer = playerOnly ? requestedLegs : teamOnly ? 0 : Math.max(1, requestedLegs - targetProps - targetScore - targetResult);
  const seed = refreshSeed + index * 97 + requestedLegs * 13;
  const ticketPlayerLegs = isRiskyMode
    ? [
        ...shuffleWithSeed(playerLegs.filter((leg) => leg.riskMode), seed),
        ...shuffleWithSeed(playerLegs.filter((leg) => !leg.riskMode), seed + 17),
      ]
    : shuffleWithSeed(playerLegs, seed);
  const ticketPropLegs = shuffleWithSeed(propLegs, seed + 23);
  const ticketScoreLegs = shuffleWithSeed(scoreLegs, seed + 31);
  const ticketResultLegs = shuffleWithSeed(resultLegs, seed + 61);
  const offset = (index + refreshSeed) * Math.max(3, Math.floor(requestedLegs / 2));

  let selectedPlayerLegs = targetPlayer ? selectDiversePlayerLegs(ticketPlayerLegs, targetPlayer, used, offset) : [];
  if (isRiskyMode && targetPlayer) {
    const riskQuota = Math.min(targetPlayer, Math.max(1, Math.ceil(targetPlayer * 0.55)));
    for (const riskLeg of ticketPlayerLegs.filter((leg) => leg.riskMode)) {
      const currentRiskCount = selectedPlayerLegs.filter((leg) => leg.riskMode).length;
      if (currentRiskCount >= riskQuota) break;
      const riskKey = legKey(riskLeg);
      if (used.has(riskKey)) continue;
      const replaceIndex = selectedPlayerLegs.findLastIndex((leg) => !leg.riskMode);
      if (replaceIndex === -1) break;
      used.delete(legKey(selectedPlayerLegs[replaceIndex]));
      selectedPlayerLegs[replaceIndex] = riskLeg;
      used.add(riskKey);
    }
  }
  let selectedPropLegs = targetProps ? selectUnique(ticketPropLegs, targetProps, used, index + refreshSeed) : [];
  if (targetProps >= 2) {
    for (const type of ["btts", "corner"]) {
      if (selectedPropLegs.some((leg) => leg.type === type)) continue;
      const replacement = ticketPropLegs.find((leg) => leg.type === type && !used.has(legKey(leg)));
      const replaceIndex = selectedPropLegs.findIndex((leg) => leg.type !== type);
      if (!replacement || replaceIndex === -1) continue;
      used.delete(legKey(selectedPropLegs[replaceIndex]));
      selectedPropLegs[replaceIndex] = replacement;
      used.add(legKey(replacement));
    }
  }
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
  const legs = [...selectedPlayerLegs, ...selectedPropLegs, ...selectedScoreLegs, ...selectedResultLegs];

  const fallbackLists = playerOnly ? [ticketPlayerLegs] : teamOnly ? [ticketPropLegs, ticketScoreLegs, ticketResultLegs] : [ticketPlayerLegs, ticketPropLegs, ticketScoreLegs, ticketResultLegs];
  const finalLegs = reconcileCompatibleLegs(legs, fallbackLists, requestedLegs, offset);
  return {
    id: `generated_${index + 1}`,
    riskMode,
    name:
      type === "players"
        ? `Option ${index + 1}: ${isRiskyMode ? "Risk Mode " : ""}Player Props Parlay`
        : type === "teams"
        ? `Option ${index + 1}: ${isRiskyMode ? "Risk Mode " : ""}Team Picks Parlay`
        : fbref.hasPlayerStats
        ? `Option ${index + 1}: ${isRiskyMode ? "Risk Mode " : ""}Player Props + Team Model Parlay`
        : `Option ${index + 1}: ${isRiskyMode ? "Risk Mode " : ""}Team Model Parlay`,
    legs: finalLegs,
    playerStatLegs: finalLegs.filter((leg) => leg.type === "player"),
    teamScoreLegs: finalLegs.filter((leg) => leg.type === "score"),
    matchResultLegs: finalLegs.filter((leg) => leg.type === "match"),
    propLegs: finalLegs.filter((leg) => ["btts", "corner"].includes(leg.type)),
    averageConfidence: finalLegs.length ? pct(finalLegs.reduce((sum, leg) => sum + leg.confidence, 0) / finalLegs.length / 100) : 0,
  };
}

function decorateTicketsWithPricing(tickets, fixtures) {
  const fixtureMap = new Map(fixtures.map((fixture) => [`${fixture.homeTeam} vs ${fixture.awayTeam}`.toLowerCase(), fixture]));
  return (tickets || []).map((ticket) => {
    const pricedLegs = decorateLegsWithPricing(ticket.legs, fixtureMap);
    return {
      ...ticket,
      legs: pricedLegs,
      playerStatLegs: pricedLegs.filter((leg) => leg.type === "player"),
      teamScoreLegs: pricedLegs.filter((leg) => leg.type === "score"),
      matchResultLegs: pricedLegs.filter((leg) => leg.type === "match"),
      propLegs: pricedLegs.filter((leg) => ["btts", "corner"].includes(leg.type)),
      pricedLegCount: pricedLegs.filter((leg) => Number(leg.decimalOdds || 0) > 1).length,
      sportsbookLegCount: pricedLegs.filter((leg) => leg.oddsType === "sportsbook").length,
      estimatedLegCount: pricedLegs.filter((leg) => leg.oddsType !== "sportsbook").length,
    };
  });
}

// Round-robin player legs across markets (best anytime scorer, best shot on
// target, best assist, …) so a fixture ticket shows a varied prop board
// instead of five copies of the single highest-confidence market.
function diversifyPlayerLegs(legs) {
  const byMarket = new Map();
  for (const leg of legs) {
    const list = byMarket.get(leg.market) || [];
    list.push(leg);
    byMarket.set(leg.market, list);
  }
  const queues = [...byMarket.values()].sort((a, b) => Number(b[0]?.confidence || 0) - Number(a[0]?.confidence || 0));
  const ordered = [];
  const overflow = [];
  const perPlayer = new Map();
  let added = true;
  while (added) {
    added = false;
    for (const queue of queues) {
      const leg = queue.shift();
      if (!leg) continue;
      added = true;
      // At most 2 legs per player up front; extras go to the back so one
      // star doesn't crowd out the rest of the prop board.
      const count = perPlayer.get(leg.player) || 0;
      if (leg.player && count >= 2) {
        overflow.push(leg);
      } else {
        ordered.push(leg);
        perPlayer.set(leg.player, count + 1);
      }
    }
  }
  return [...ordered, ...overflow];
}

function buildFixtureGridTickets({ fixtures, requestedLegs, playerLegs, scoreLegs, resultLegs, propLegs, riskMode = "safe" }) {
  return fixtures.slice(0, 6).map((fixture, index) => {
    const fixtureName = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
    const byConfidence = (list) => list.filter((leg) => leg.fixture === fixtureName).sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
    const fixtureProps = byConfidence(propLegs);
    const fixtureBtts = fixtureProps.filter((leg) => leg.type === "btts");
    const fixtureCorners = fixtureProps.filter((leg) => leg.type === "corner");
    const fixturePlayers = diversifyPlayerLegs(byConfidence(playerLegs));
    const fixtureResults = byConfidence(resultLegs);
    const fixtureScores = byConfidence(scoreLegs);
    const propTarget = Math.min(fixtureProps.length, Math.max(2, Math.floor(requestedLegs * 0.35)));
    const playerTarget = Math.min(fixturePlayers.length, Math.max(1, Math.floor(requestedLegs * 0.45)));
    const used = new Set();
    const selected = [];
    const addLegs = (list, target) => {
      for (const leg of list) {
        if (selected.length >= requestedLegs || selected.filter((item) => list.includes(item)).length >= target) break;
        addCompatibleLeg(selected, used, leg);
      }
    };
    addLegs(fixtureBtts, Math.min(1, fixtureBtts.length));
    addLegs(fixtureCorners, Math.min(Math.max(1, propTarget - 1), fixtureCorners.length));
    addLegs(fixtureProps, propTarget);
    addLegs(fixturePlayers, playerTarget);
    addLegs(fixtureResults, Math.min(1, fixtureResults.length));
    addLegs(fixtureScores, Math.min(1, fixtureScores.length));
    for (const leg of [...fixtureProps, ...fixturePlayers, ...fixtureResults, ...fixtureScores]) {
      if (selected.length >= requestedLegs) break;
      addCompatibleLeg(selected, used, leg);
    }
    const fixtureLegs = selected
      .sort((a, b) => {
        const typeWeight = { btts: 4, corner: 3, player: 2, match: 1, score: 0 };
        return Number(b.confidence || 0) - Number(a.confidence || 0) || (typeWeight[b.type] || 0) - (typeWeight[a.type] || 0);
      })
      .slice(0, requestedLegs);
    return {
      id: `fixture_grid_${index + 1}`,
      riskMode,
      mode: "fixture-grid",
      fixture: fixtureName,
      date: fixture.date,
      league: fixture.league,
      name: `Fixture Grid ${index + 1}: ${fixtureName}`,
      legs: fixtureLegs,
      playerStatLegs: fixtureLegs.filter((leg) => leg.type === "player"),
      teamScoreLegs: fixtureLegs.filter((leg) => leg.type === "score"),
      matchResultLegs: fixtureLegs.filter((leg) => leg.type === "match"),
      propLegs: fixtureLegs.filter((leg) => ["btts", "corner"].includes(leg.type)),
      averageConfidence: fixtureLegs.length ? pct(fixtureLegs.reduce((sum, leg) => sum + leg.confidence, 0) / fixtureLegs.length / 100) : 0,
    };
  }).filter((ticket) => ticket.legs.length);
}

function buildInternationalParlays(options = {}) {
  const requestedLegs = Math.max(3, Math.min(20, Number(options.legs || 10)));
  const ticketCount = Math.max(1, Math.min(10, Number(options.tickets || 3)));
  const refreshSeed = Math.max(0, Number(options.refreshSeed || 0));
  const type = ["mixed", "teams", "players"].includes(options.type) ? options.type : "mixed";
  const riskMode = options.riskMode === "risky" ? "risky" : "safe";
  const generationMode = options.generationMode === "fixture-grid" ? "fixture-grid" : "multi";
  const date = String(options.date || "").trim();
  // Exclude fixtures already settled by the World Cup auto-sync — parlays
  // should only offer upcoming matches.
  const settledIntlKeys = new Set(
    (require("./backtestStore").listPredictions() || [])
      .filter((p) => p.source === "international-fixture-board" && p.status === "SETTLED")
      .map((p) => `${p.homeTeam}|${p.awayTeam}|${p.date}`.toLowerCase())
  );
  const allFixtures = internationalFixturePredictions().filter(
    (fixture) => (!date || fixture.date === date) && !settledIntlKeys.has(`${fixture.homeTeam}|${fixture.awayTeam}|${fixture.date}`.toLowerCase())
  );
  const fixtures = allFixtures;
  const players = aggregatePlayers(loadFbrefRows());
  const fbref = {
    ...fbrefStatus(),
    processedRows: internationalStatus().playerRows,
    players: internationalStatus().players,
    seasons: ["2018 World Cup", "2022 World Cup"],
    hasPlayerStats: internationalStatus().playerRows > 0,
  };
  const playerLegs = fixtures.flatMap((fixture) => internationalPlayerPropCandidates(players, fixture, riskMode));
  const scoreLegs = teamScoreLegs(fixtures);
  const resultLegs = matchResultLegs(fixtures);
  const propLegs = bttsLegs(fixtures);
  const eligiblePlayerLegs = playerLegs.sort((a, b) => (riskMode === "risky" ? Number(Boolean(b.riskMode)) - Number(Boolean(a.riskMode)) : 0) || Number(b.confidence || 0) - Number(a.confidence || 0));
  const eligibleScoreLegs = scoreLegs;
  const eligibleResultLegs = resultLegs;
  const eligiblePropLegs = propLegs;
  const rawParlays =
    generationMode === "fixture-grid"
      ? buildFixtureGridTickets({
          fixtures,
          requestedLegs,
          playerLegs: eligiblePlayerLegs,
          scoreLegs: eligibleScoreLegs,
          resultLegs: eligibleResultLegs,
          propLegs: eligiblePropLegs,
          riskMode,
        })
      : Array.from({ length: ticketCount }, (_, index) =>
          buildTicket({
            index,
            requestedLegs,
            playerLegs: eligiblePlayerLegs,
            scoreLegs: eligibleScoreLegs,
            resultLegs: eligibleResultLegs,
            propLegs: eligiblePropLegs,
            fbref,
            refreshSeed,
            type,
            riskMode,
          })
        ).filter((ticket) => ticket.legs.length);
  const parlays = decorateTicketsWithPricing(rawParlays, fixtures);

  return {
    fbref,
    filters: { league: "International", date, requestedLegs, ticketCount, type, refreshSeed, riskMode, generationMode, context: "international" },
    excludedFixtureCount: 0,
    availableFixtureCount: fixtures.length,
    playerCandidateCount: eligiblePlayerLegs.length,
    riskyPlayerCandidateCount: eligiblePlayerLegs.filter((leg) => leg.riskMode).length,
    teamScoreCandidateCount: eligibleScoreLegs.length,
    propCandidateCount: eligiblePropLegs.length,
    bttsCandidateCount: eligiblePropLegs.filter((leg) => leg.type === "btts").length,
    cornerCandidateCount: 0,
    parlays,
    parlay: {
      ...(parlays[0] || {
        name: "World Cup Model Parlay Waiting For Fixtures",
        legs: [],
        playerStatLegs: [],
        teamScoreLegs: [],
        matchResultLegs: [],
        averageConfidence: 0,
      }),
      note: `International ${riskMode} mode uses imported World Cup group-stage fixtures, model team ratings trained on down-weighted pre-WC friendlies, researched 2026 squad profiles for all 48 teams (FIFA/ESPN squad lists + June 2026 warm-up performances), and 2018/2022 World Cup player rows. ${generationMode === "fixture-grid" ? "Fixture grid mode groups props by individual World Cup matches." : "Multi-ticket mode builds broader World Cup parlays across the fixture pool."}`,
    },
  };
}

function buildParlays(options = {}) {
  if (options.context === "international") return buildInternationalParlays(options);
  const league = options.league || "All";
  const requestedLegs = Math.max(3, Math.min(20, Number(options.legs || 10)));
  const ticketCount = Math.max(1, Math.min(10, Number(options.tickets || 3)));
  const refreshSeed = Math.max(0, Number(options.refreshSeed || 0));
  const type = ["mixed", "teams", "players"].includes(options.type) ? options.type : "mixed";
  const riskMode = options.riskMode === "risky" ? "risky" : "safe";
  const generationMode = options.generationMode === "fixture-grid" ? "fixture-grid" : "multi";
  const date = String(options.date || "").trim();
  const excludedFixtureKeys = settledFixtureKeys();
  const allFixtures = fixturePredictionBoard().filter((fixture) => {
    const leagueMatches = league === "All" || fixture.league === league;
    const dateMatches = !date || fixture.date === date;
    return leagueMatches && dateMatches;
  });
  const fixtures = allFixtures.filter((fixture) => !excludedFixtureKeys.has(fixtureSignatureFromFixture(fixture)));
  const fbref = fbrefStatus();
  const players = aggregatePlayers(loadFbrefRows());
  const playerLegs = fixtures.flatMap((fixture) => playerPropCandidates(players, fixture, riskMode));
  const scoreLegs = teamScoreLegs(fixtures);
  const resultLegs = matchResultLegs(fixtures);
  const propLegs = [...bttsLegs(fixtures, riskMode), ...cornerLegs(fixtures, riskMode)];
  const excludedLegFixtures = new Set([...excludedFixtureKeys]);
  const eligiblePlayerLegs = playerLegs
    .filter((leg) => !excludedLegFixtures.has([leg.date || "", leg.fixture || ""].join("|").toLowerCase()))
    .sort((a, b) => (riskMode === "risky" ? Number(Boolean(b.riskMode)) - Number(Boolean(a.riskMode)) : 0) || Number(b.confidence || 0) - Number(a.confidence || 0));
  const eligibleScoreLegs = scoreLegs.filter((leg) => !excludedLegFixtures.has([leg.date || "", leg.fixture || ""].join("|").toLowerCase()));
  const eligibleResultLegs = resultLegs.filter((leg) => !excludedLegFixtures.has([leg.date || "", leg.fixture || ""].join("|").toLowerCase()));
  const eligiblePropLegs = propLegs.filter((leg) => !excludedLegFixtures.has([leg.date || "", leg.fixture || ""].join("|").toLowerCase()));
  const rawParlays =
    generationMode === "fixture-grid"
      ? buildFixtureGridTickets({
          fixtures,
          requestedLegs,
          playerLegs: eligiblePlayerLegs,
          scoreLegs: eligibleScoreLegs,
          resultLegs: eligibleResultLegs,
          propLegs: eligiblePropLegs,
          riskMode,
        })
      : Array.from({ length: ticketCount }, (_, index) =>
          buildTicket({
            index,
            requestedLegs,
            playerLegs: eligiblePlayerLegs,
            scoreLegs: eligibleScoreLegs,
            resultLegs: eligibleResultLegs,
            propLegs: eligiblePropLegs,
            fbref,
            refreshSeed,
            type,
            riskMode,
          })
        ).filter((ticket) => ticket.legs.length);
  const parlays = decorateTicketsWithPricing(rawParlays, fixtures);

  return {
    fbref,
    filters: { league, date, requestedLegs, ticketCount, type, refreshSeed, riskMode, generationMode },
    excludedFixtureCount: allFixtures.length - fixtures.length,
    availableFixtureCount: fixtures.length,
    playerCandidateCount: eligiblePlayerLegs.length,
    riskyPlayerCandidateCount: eligiblePlayerLegs.filter((leg) => leg.riskMode).length,
    teamScoreCandidateCount: eligibleScoreLegs.length,
    propCandidateCount: eligiblePropLegs.length,
    bttsCandidateCount: eligiblePropLegs.filter((leg) => leg.type === "btts").length,
    cornerCandidateCount: eligiblePropLegs.filter((leg) => leg.type === "corner").length,
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
        ? `Mode: ${type}; risk profile: ${riskMode}. ${
            riskMode === "risky"
              ? "Risk mode prefers stat-supported alt lines such as 2+ shots, 2+ shots on target, and goalkeeper save props when the player's per-90 average is close enough to the threshold."
            : "Safe mode keeps the existing conservative thresholds and confidence ordering."
          } ${generationMode === "fixture-grid" ? "Fixture grid mode groups the best supported props by match across up to six fixtures." : "Multi-ticket mode keeps the broader mixed parlay builder."} Player legs are ranked from imported player-season stats, projected team scoring, match-result lean, and live table motivation including title-race, European-place, relegation, and title-secured rotation risk. BTTS legs use projected score, scoring profile, defensive concession, and clean-sheet signals. Corner legs use team corner averages from the fixture feature set. Team result and score legs use the local match model, including form, home/away edge, Elo, head-to-head, market odds when available, player-derived features, and live standings motivation. ${allFixtures.length - fixtures.length} played fixture${allFixtures.length - fixtures.length === 1 ? "" : "s"} excluded from new parlay generation.`
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
