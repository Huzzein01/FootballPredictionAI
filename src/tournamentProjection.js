/**
 * src/tournamentProjection.js
 *
 * Simulates the WC 2026 knockout bracket from the predicted group-stage
 * outcomes.  Returns a bracket tree suitable for the futures page.
 *
 * Rounds modelled:
 *   Group stage   → 32 qualifiers (24 auto + 8 best 3rd-place)
 *   Round of 16   → 16 games → 16 QF participants
 *   Quarterfinals → 8 games  → 8 SF participants
 *   Semifinals    → 4 games  → 4 "Final Four" participants
 *   Final Four    → 2 games  → 2 finalists
 *   Final         → 1 game   → 1 champion
 *
 * The display collapses "Semifinals + Final Four" into the single label the
 * user sees as "4 semifinalists" and "2 finalists".
 */

"use strict";

const { predictInternationalFixture, readFixtureData } = require("./internationalData");

// ── Group pairings for R16 ────────────────────────────────────────────────────
// Adjacent groups cross-pair: A↔B, C↔D, E↔F, G↔H, I↔J, K↔L
// Side-1 matchups (using winners from left group vs runners-up from right group):
//   1A-2B, 1C-2D, 1E-2F, 1G-2H, 1I-2J, 1K-2L  (6 games)
// Side-2 matchups (flip):
//   1B-2A, 1D-2C, 1F-2E, 1H-2G, 1J-2I, 1L-2K  (6 games)
// 3rd-place matchups (best 8 sorted by group-stage metrics, paired 1v8, 2v7 …):
//   4 more games → 16 total R16 games
const GROUP_PAIRS = [
  ["A", "B"], ["C", "D"], ["E", "F"],
  ["G", "H"], ["I", "J"], ["K", "L"],
];

// ── Simulate a single knockout match ─────────────────────────────────────────
function simulateKnockoutMatch(homeSlot, awaySlot, fixtureStub) {
  // Build a lightweight fixture object compatible with predictInternationalFixture
  const fixture = {
    homeTeam:    homeSlot.team,
    awayTeam:    awaySlot.team,
    homeFlagUrl: homeSlot.flagUrl  || "",
    awayFlagUrl: awaySlot.flagUrl  || "",
    homeCode:    homeSlot.code     || "",
    awayCode:    awaySlot.code     || "",
    group:       fixtureStub?.group   || "Knockout",
    matchNumber: fixtureStub?.matchNumber || 0,
    venue:       fixtureStub?.venue   || "",
    city:        fixtureStub?.city    || "",
    date:        fixtureStub?.date    || "",
    kickoffUtc:  fixtureStub?.kickoffUtc  || "",
    kickoffLocal: fixtureStub?.kickoffLocal || "",
    hostCountry: fixtureStub?.hostCountry  || "",
    // Activates WC_TOURNAMENT_PRESTIGE bonus in predictInternationalFixture()
    // so historically dominant nations (Argentina, France, Brazil, Spain, etc.)
    // get appropriate extra weight in deep knockout rounds.
    isKnockout:  true,
  };

  try {
    const pred = predictInternationalFixture(fixture, []);
    const homeProb = pred.probabilities.homeWinPct;
    const awayProb = pred.probabilities.awayWinPct;
    const drawProb = pred.probabilities.drawPct;

    // In knockout, draw goes to AET/penalties — redistribute evenly between H/A
    const adjustedHome = homeProb + drawProb * 0.5;
    const adjustedAway = awayProb + drawProb * 0.5;
    const winner = adjustedHome >= adjustedAway ? homeSlot : awaySlot;
    const winProb = adjustedHome >= adjustedAway ? adjustedHome : adjustedAway;

    return {
      home:       homeSlot,
      away:       awaySlot,
      winner,
      loser:      winner === homeSlot ? awaySlot : homeSlot,
      confidence: Math.round(winProb * 10) / 10,
      homeWinPct: Math.round(adjustedHome * 10) / 10,
      awayWinPct: Math.round(adjustedAway * 10) / 10,
    };
  } catch (_) {
    // Fallback: higher FIFA rating wins
    return {
      home: homeSlot, away: awaySlot,
      winner: homeSlot, loser: awaySlot,
      confidence: 55, homeWinPct: 55, awayWinPct: 45,
    };
  }
}

// ── Simulate all 6 group-stage fixtures for one group ────────────────────────
function simulateGroup(groupLetter, teams, allFixtures) {
  const fixtures = allFixtures.filter(f => f.groupLetter === groupLetter);
  const standings = {};
  teams.forEach(t => {
    standings[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  });

  for (const f of fixtures) {
    const home = standings[f.homeTeam];
    const away = standings[f.awayTeam];
    if (!home || !away) continue;

    let pred;
    try { pred = predictInternationalFixture(f, []); } catch (_) { continue; }

    const result = pred.prediction;           // "H" | "D" | "A"
    const [hg, ag] = (pred.projectedScore || "1-1").split("-").map(Number);

    home.p++;  away.p++;
    home.gf += hg; home.ga += ag; home.gd += hg - ag;
    away.gf += ag; away.ga += hg; away.gd += ag - hg;

    if (result === "H") {
      home.w++; home.pts += 3; away.l++;
    } else if (result === "A") {
      away.w++; away.pts += 3; home.l++;
    } else {
      home.d++; home.pts += 1; away.d++; away.pts += 1;
    }
  }

  // Sort: pts → gd → gf → name
  const ranked = Object.values(standings).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
  );

  return ranked.map((row, i) => ({ ...row, rank: i + 1, group: groupLetter }));
}

// ── Build a team "slot" (carries metadata through bracket) ───────────────────
function makeSlot(teamName, allFixtures) {
  const sample = allFixtures.find(f => f.homeTeam === teamName || f.awayTeam === teamName);
  return {
    team:    teamName,
    flagUrl: sample
      ? (sample.homeTeam === teamName ? sample.homeFlagUrl : sample.awayFlagUrl)
      : "",
    code: sample
      ? (sample.homeTeam === teamName ? sample.homeCode : sample.awayCode)
      : "",
  };
}

// ── Select 32 qualifiers from group results ───────────────────────────────────
function selectQualifiers(groupStandings, allFixtures) {
  const auto = [];      // 24 teams: 1st + 2nd from each of 12 groups
  const thirds = [];    // 12 teams: 3rd from each group

  for (const [group, rows] of Object.entries(groupStandings)) {
    auto.push({ ...makeSlot(rows[0].team, allFixtures), rank: 1, group, stats: rows[0] });
    auto.push({ ...makeSlot(rows[1].team, allFixtures), rank: 2, group, stats: rows[1] });
    thirds.push({ ...makeSlot(rows[2].team, allFixtures), rank: 3, group, stats: rows[2] });
  }

  // Best 8 third-place teams by pts → gd → gf
  thirds.sort((a, b) =>
    b.stats.pts - a.stats.pts ||
    b.stats.gd  - a.stats.gd  ||
    b.stats.gf  - a.stats.gf  ||
    a.team.localeCompare(b.team)
  );
  const best8thirds = thirds.slice(0, 8);

  return { auto, thirds: best8thirds };
}

// ── Build the 16 R16 matchups ─────────────────────────────────────────────────
// Produces 16 {home, away, label} objects
function buildR16Matchups({ auto, thirds }) {
  const byGroup = {};
  for (const slot of auto) {
    if (!byGroup[slot.group]) byGroup[slot.group] = {};
    byGroup[slot.group][slot.rank] = slot;
  }

  const matchups = [];

  // 12 matchups: cross-pair adjacent groups (Side A and Side B)
  for (const [g1, g2] of GROUP_PAIRS) {
    // Side A: Group-G1 winner vs Group-G2 runner-up
    const home1 = byGroup[g1]?.[1];
    const away1 = byGroup[g2]?.[2];
    if (home1 && away1) {
      matchups.push({ home: home1, away: away1, label: `1${g1} vs 2${g2}`, sideIndex: matchups.length });
    }
    // Side B: Group-G2 winner vs Group-G1 runner-up
    const home2 = byGroup[g2]?.[1];
    const away2 = byGroup[g1]?.[2];
    if (home2 && away2) {
      matchups.push({ home: home2, away: away2, label: `1${g2} vs 2${g1}`, sideIndex: matchups.length });
    }
  }

  // 4 matchups with the 8 best 3rd-place teams (seed 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5)
  const t = thirds;
  const thirdPairs = [[0, 7], [1, 6], [2, 5], [3, 4]];
  for (const [i, j] of thirdPairs) {
    if (t[i] && t[j]) {
      matchups.push({
        home: t[i], away: t[j],
        label: `3rd-${t[i].group} vs 3rd-${t[j].group}`,
        sideIndex: matchups.length,
      });
    }
  }

  return matchups;   // 16 matchups
}

// ── Simulate one full round, return match results and winners list ─────────────
function simulateRound(matchups, roundLabel) {
  const results = [];
  for (const m of matchups) {
    const result = simulateKnockoutMatch(m.home, m.away, null);
    results.push({
      label:      m.label || `${m.home.team} vs ${m.away.team}`,
      round:      roundLabel,
      home:       m.home,
      away:       m.away,
      winner:     result.winner,
      loser:      result.loser,
      confidence: result.confidence,
      homeWinPct: result.homeWinPct,
      awayWinPct: result.awayWinPct,
    });
  }
  return results;
}

// ── Pair consecutive winners into next-round matchups ─────────────────────────
function pairWinners(results) {
  const matchups = [];
  for (let i = 0; i < results.length - 1; i += 2) {
    matchups.push({
      home:  results[i].winner,
      away:  results[i + 1].winner,
      label: `W(${results[i].label}) vs W(${results[i + 1].label})`,
    });
  }
  return matchups;
}

// ── Main entry point ──────────────────────────────────────────────────────────
function projectTournament() {
  const fixtureData = readFixtureData();
  const allFixtures = fixtureData.fixtures || [];
  const groups      = fixtureData.groups   || {};

  // ── 1. Simulate group stage ─────────────────────────────────────────────────
  const groupStandings = {};
  for (const [letter, teams] of Object.entries(groups)) {
    groupStandings[letter] = simulateGroup(letter, teams, allFixtures);
  }

  // ── 2. Select 32 qualifiers ─────────────────────────────────────────────────
  const { auto, thirds } = selectQualifiers(groupStandings, allFixtures);

  // ── 3. Build + simulate Round of 16 ────────────────────────────────────────
  const r16Matchups = buildR16Matchups({ auto, thirds });
  const r16Results  = simulateRound(r16Matchups, "Round of 16");

  // ── 4. Quarterfinals ────────────────────────────────────────────────────────
  const qfMatchups = pairWinners(r16Results);
  const qfResults  = simulateRound(qfMatchups, "Quarterfinals");

  // ── 5. Semifinals ───────────────────────────────────────────────────────────
  const sfMatchups = pairWinners(qfResults);
  const sfResults  = simulateRound(sfMatchups, "Semifinals");

  // ── 6. "Final Four" — narrows 4 SF winners to 2 finalists ──────────────────
  const ffMatchups = pairWinners(sfResults);
  const ffResults  = simulateRound(ffMatchups, "Final Four");

  // ── 7. Third-place play-off (FF losers) ─────────────────────────────────────
  const thirdPlaceMatchup = [{
    home:  ffResults[0].loser,
    away:  ffResults[1].loser,
    label: "Third-place play-off",
  }];
  const thirdPlaceResults = simulateRound(thirdPlaceMatchup, "Third Place");

  // ── 8. Final ────────────────────────────────────────────────────────────────
  const finalMatchup = [{
    home:  ffResults[0].winner,
    away:  ffResults[1].winner,
    label: "Final",
  }];
  const finalResults = simulateRound(finalMatchup, "Final");
  const champion = finalResults[0].winner;

  // ── 9. Build compact display layers ─────────────────────────────────────────
  // Each layer is a deduplicated list of teams at that stage
  function advancers(results) {
    return results.map(r => r.winner);
  }
  function toSlimMatch(r) {
    return {
      home:       { team: r.home.team, flag: r.home.flagUrl },
      away:       { team: r.away.team, flag: r.away.flagUrl },
      winner:     r.winner.team,
      confidence: r.confidence,
      homeWinPct: r.homeWinPct,
      awayWinPct: r.awayWinPct,
      source:     "projected",
      score:      null,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    groupStandings,
    qualifiers: {
      auto:   auto.map(s => ({ team: s.team, flag: s.flagUrl, rank: s.rank, group: s.group })),
      thirds: thirds.map(s => ({ team: s.team, flag: s.flagUrl, group: s.group })),
    },
    bracket: {
      r16: {
        label:    "Round of 16",
        subtitle: "32 qualifiers enter · 16 advance",
        matches:  r16Results.map(toSlimMatch),
        advancers: advancers(r16Results).map(s => ({ team: s.team, flag: s.flagUrl })),
      },
      qf: {
        label:    "Quarterfinals",
        subtitle: "16 teams · 8 advance",
        matches:  qfResults.map(toSlimMatch),
        advancers: advancers(qfResults).map(s => ({ team: s.team, flag: s.flagUrl })),
      },
      sf: {
        label:    "Semifinals",
        subtitle: "8 teams · 4 advance",
        matches:  sfResults.map(toSlimMatch),
        advancers: advancers(sfResults).map(s => ({ team: s.team, flag: s.flagUrl })),
      },
      finalFour: {
        label:    "Final Four",
        subtitle: "4 teams · 2 finalists",
        matches:  ffResults.map(toSlimMatch),
        advancers: advancers(ffResults).map(s => ({ team: s.team, flag: s.flagUrl })),
      },
      thirdPlace: {
        label:    "Third-Place Play-off",
        subtitle: "Semifinal losers · bronze medal match",
        matches:  thirdPlaceResults.map(toSlimMatch),
        advancers: [{ team: thirdPlaceResults[0].winner.team, flag: thirdPlaceResults[0].winner.flagUrl }],
      },
      final: {
        label:    "Final",
        subtitle: "2 finalists · 1 champion",
        matches:  finalResults.map(toSlimMatch),
        advancers: [ { team: champion.team, flag: champion.flagUrl } ],
      },
    },
    champion: { team: champion.team, flag: champion.flagUrl },
    disclaimer: "Model-only projection. No live odds, injury data, or real-time fixtures applied to knockout stage.",
  };
}

module.exports = { projectTournament };
