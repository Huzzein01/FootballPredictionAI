/**
 * src/clubBracketProjection.js
 *
 * Parses UEFA competition txt files and produces a knockout bracket tree
 * in the same format as tournamentProjection.js, so renderBracketTree()
 * in app.js can render it without modification.
 *
 * For completed ties (both legs in the file): uses actual aggregate result.
 * For partial ties (leg 1 done, leg 2 missing): projects leg 2 with
 *   predictMatch(), accounting for leg 1 home-field deficit.
 * For unreached finals (N.N.): fills in from projected SF winners.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

let predictMatchFn = null;
function getPredictMatch() {
  if (!predictMatchFn) {
    try {
      predictMatchFn = require("./predictionService").predictMatch;
    } catch (_) {
      predictMatchFn = () => null;
    }
  }
  return predictMatchFn;
}

// ── Competition-specific prestige ratings ─────────────────────────────────────
//
// The domestic match model doesn't have training data for most CL/EL/ECL clubs
// (especially continental ones) and returns a flat 37/28.5/34.5 for any
// unrecognised pairing.  These ratings give a meaningful signal for projecting
// ties that have no actual result yet.
//
// Scale: roughly mirrors FIFA club ranking strength (100 = world-class,
// 60 = solid mid-table Europa/Conference team).
//
// Sources:
//   CL 2025-26:  UCL actual results (R16/QF done; SF leg 2 + Final = PSG confirmed winner)
//   EL 2024-25:  Tottenham won; Bilbao beaten finalist
//   ECL 2024-25: Chelsea won; Real Betis beaten finalist
//
const CLUB_RATINGS = {
  // ── Champions League tier ───────────────────────────────────────────────────
  "Paris Saint-Germain FC":          90,  // 2025-26 CL champion; dominant campaign
  "FC Bayern München":               88,  // 4× CL; regular finalists
  "Real Madrid CF":                  88,  // 15× CL; most decorated club in Europe
  "FC Barcelona":                    85,  // 5× CL; beat Newcastle 8-3 agg
  "Arsenal FC":                      84,  // 2025-26 CL finalist; strong season
  "Club Atlético de Madrid":         83,  // 2× CL finalist; beat Barca QF
  "Liverpool FC":                    83,  // 6× CL winner; strong domestic + CL form
  "FC Internazionale Milano":        82,  // 2023 CL finalist; Italian powerhouse
  "Manchester City FC":              82,  // 2023 CL winner; recently declined
  "Chelsea FC":                      80,  // 2× CL winner; 2024-25 ECL champion
  "Borussia Dortmund":               78,  // 2024 CL finalist; 2× CL winner
  "Bayer 04 Leverkusen":             78,  // Bundesliga 2023-24 winners; CL R16 exit
  "Tottenham Hotspur FC":            77,  // 2024-25 EL champion
  "Newcastle United FC":             76,  // Emerging CL-level squad
  "Sporting Clube de Portugal":      75,  // Strong CL campaign; CL QF
  "Juventus FC":                     74,  // 2× CL winner; inconsistent lately
  "Atalanta BC":                     74,  // 2024 EL winner; physical CL football
  "SSC Napoli":                      73,
  "Olympique de Marseille":          71,
  "Eintracht Frankfurt":             71,
  "AS Monaco FC":                    70,
  "Athletic Club":                   70,
  "Galatasaray SK":                  69,
  "PSV":                             69,
  "FK Bodø/Glimt":                   66,
  "Sport Lisboa e Benfica":          72,
  "AFC Ajax":                        70,
  "SK Slavia Praha":                 65,
  "Club Brugge KV":                  67,
  "Royale Union Saint-Gilloise":     63,
  "Villarreal CF":                   69,
  "FK Kairat":                       55,
  "PAE Olympiakos SFP":              64,
  "Paphos FC":                       58,
  "Qarabağ Ağdam FK":               60,
  "FC København":                    65,
  // ── Europa League / Conference League ──────────────────────────────────────
  "Athletic Club Bilbao":            76,
  "Bayer Leverkusen":                78,
  "Real Betis Balompié":             72,
  "ACF Fiorentina":                  71,
  "Rangers FC":                      69,
  "RSC Anderlecht":                  67,
  "FC Basel":                        66,
  "Fenerbahçe SK":                   68,
  "AS Roma":                         73,
  "Lazio":                           72,
  "Villarreal":                      69,
  "Olympique Lyonnais":              72,
  "Eintracht Frankfurt":             71,
  "West Ham United FC":              74,
  "AZ Alkmaar":                      67,
  "Slavia Praha":                    65,
  "FC Sheriff":                      60,
};

/** Get club prestige rating, defaulting to 65 for unknown clubs. */
function clubRatingFor(team) {
  return CLUB_RATINGS[team] ?? 65;
}

/**
 * Detect whether predictMatch returned the generic fallback by checking if
 * all three probabilities equal the flat 37/28.5/34.5 values (within ±1pp).
 */
function isGenericFallback(probs) {
  if (!probs) return true;
  const { homeWinPct = 0, drawPct = 0, awayWinPct = 0 } = probs;
  return (
    Math.abs(homeWinPct - 37)   < 1.5 &&
    Math.abs(drawPct    - 28.5) < 1.5 &&
    Math.abs(awayWinPct - 34.5) < 1.5
  );
}

// ── Competition registry ──────────────────────────────────────────────────────
const COMPETITIONS = {
  "champions-league": {
    label:   "UEFA Champions League",
    season:  "2025-26",
    txtPath: path.join(__dirname, "..", "data", "uefa", "2025-26", "cl.txt"),
    championLabel: "Champions League Winner",
  },
  "europa-league": {
    label:   "UEFA Europa League",
    season:  "2024-25",
    txtPath: path.join(__dirname, "..", "data", "uefa", "2024-25", "el.txt"),
    championLabel: "Europa League Winner",
  },
  "conference-league": {
    label:   "UEFA Conference League",
    season:  "2024-25",
    txtPath: path.join(__dirname, "..", "data", "uefa", "2024-25", "conf.txt"),
    championLabel: "Conference League Winner",
  },
};

// ── Text parsing helpers ──────────────────────────────────────────────────────

/** Strip trailing " (COUNTRY_CODE)" from a team name. */
function cleanTeam(raw) {
  return raw.trim().replace(/\s*\([A-Z]{2,3}\)\s*$/, "").trim();
}

/**
 * Parse a score string into { home, away, penHome, penAway, type }.
 * Handles:  "3-1 (2-0)"  |  "5-0 a.e.t. (3-0, 1-0)"  |  "3-2 pen. 0-2 a.e.t. (...)"
 */
function parseScore(scoreStr) {
  if (!scoreStr) return null;
  const s = scoreStr.trim();

  // Penalties: "3-2 pen. 0-2 a.e.t. ..."  →  pen 3-2, aet 0-2
  const penRe = /^(\d+)-(\d+)\s+pen\.\s+(\d+)-(\d+)/;
  const penM  = s.match(penRe);
  if (penM) {
    return {
      home: parseInt(penM[3]), away: parseInt(penM[4]),   // aggregate goals (aet score)
      penHome: parseInt(penM[1]), penAway: parseInt(penM[2]),
      type: "pen",
    };
  }

  // AET: "5-0 a.e.t. ..."
  const aetRe = /^(\d+)-(\d+)\s+a\.e\.t/;
  const aetM  = s.match(aetRe);
  if (aetM) {
    return { home: parseInt(aetM[1]), away: parseInt(aetM[2]), type: "aet" };
  }

  // Normal: "3-1 (2-0)" or "3-1"
  const normRe = /^(\d+)-(\d+)/;
  const normM  = s.match(normRe);
  if (normM) {
    return { home: parseInt(normM[1]), away: parseInt(normM[2]), type: "normal" };
  }

  return null;
}

/**
 * Parse a single fixture line.
 * Returns { home, away, score } or null if not parseable.
 * score may be null if no result yet.
 */
function parseMatchLine(trimmedLine) {
  if (!trimmedLine.includes(" v ")) return null;

  // Remove leading time stamp (e.g. "18.45  " or "21.00  ")
  const noTime = trimmedLine.replace(/^\d{1,2}[:.]\d{2}\s+/, "").trim();

  const vIdx = noTime.indexOf(" v ");
  if (vIdx === -1) return null;

  const homeFull = noTime.slice(0, vIdx).trim();
  const rest     = noTime.slice(vIdx + 3).trim();

  // The away team ends at the country code "(XXX)"; everything after is the score
  let awayFull, scoreStr;
  const countryEnd = rest.search(/\([A-Z]{2,3}\)\s/);
  if (countryEnd !== -1) {
    const closeIdx = rest.indexOf(")", countryEnd) + 1;
    awayFull  = rest.slice(0, closeIdx).trim();
    scoreStr  = rest.slice(closeIdx).trim() || null;
  } else {
    // No country code (N.N. placeholder or malformed)
    // See if there's a score at the end (N-N pattern after team name)
    const scoreIdx = rest.search(/\s\d+-\d+/);
    if (scoreIdx !== -1) {
      awayFull  = rest.slice(0, scoreIdx).trim();
      scoreStr  = rest.slice(scoreIdx).trim();
    } else {
      awayFull  = rest.trim();
      scoreStr  = null;
    }
  }

  const home = cleanTeam(homeFull);
  const away = cleanTeam(awayFull);

  // Filter out non-fixture lines (e.g. "Tue Mar/10", "1-2 (0-1)")
  if (!home || home.length < 2) return null;
  if (/^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\/\d/.test(home)) return null; // date line

  return {
    home,
    away,
    score: parseScore(scoreStr),
  };
}

/**
 * Read a UEFA txt file and extract matches grouped by stage.
 * Returns { r16: [], qf: [], sf: [], final: [] }
 */
function parseTxtFile(txtPath) {
  const content  = fs.readFileSync(txtPath, "utf8");
  const lines    = content.split("\n");
  const stages   = { r16: [], qf: [], sf: [], final: [] };
  let   current  = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    // Detect stage header
    if (/».*Finals[,\s]+Round of 16|»\s*Round of 16/i.test(trimmed)) {
      current = "r16";
    } else if (/».*Finals[,\s]+Quarterfinals?|»\s*Quarterfinals?/i.test(trimmed)) {
      current = "qf";
    } else if (/».*Finals[,\s]+Semifinals?|»\s*Semifinals?/i.test(trimmed)) {
      current = "sf";
    } else if (/».*Finals?[,\s]+Final$|»\s*Final$/i.test(trimmed)) {
      current = "final";
    } else if (/^»/.test(trimmed)) {
      current = null; // other section (League, Playoffs) — ignore
    }

    if (!current) continue;

    const parsed = parseMatchLine(trimmed);
    if (parsed) stages[current].push(parsed);
  }

  return stages;
}

// ── Tie grouping & winner resolution ─────────────────────────────────────────

/**
 * Group a flat list of matches (from one stage) into 2-leg ties.
 * A tie is { leg1, leg2 } where leg2 has home/away reversed from leg1.
 * Single-leg finals remain { leg1, leg2: null }.
 */
function groupIntoTies(matches) {
  const used = new Set();
  const ties = [];

  for (let i = 0; i < matches.length; i++) {
    if (used.has(i)) continue;
    const m1 = matches[i];

    // Skip N.N. placeholders — they'll be replaced by projected teams
    if (m1.home === "N.N." || m1.away === "N.N.") {
      used.add(i);
      ties.push({ leg1: m1, leg2: null });
      continue;
    }

    // Find the reverse fixture (leg 2)
    let leg2 = null;
    for (let j = i + 1; j < matches.length; j++) {
      if (used.has(j)) continue;
      const m2 = matches[j];
      if (m2.home === m1.away && m2.away === m1.home) {
        leg2 = m2;
        used.add(j);
        break;
      }
    }

    used.add(i);
    ties.push({ leg1: m1, leg2 });
  }

  return ties;
}

/**
 * Determine the winner of a tie.
 *
 * Returns {
 *   home, away,   // original leg-1 home/away
 *   winner,       // winning team name (or null if undetermined)
 *   loser,
 *   homeWinPct,   // probability used (actual → 100/0, projected → model pct)
 *   awayWinPct,
 *   confidence,   // same as winner's pct
 *   source,       // "actual" | "projected"
 *   displayScore, // aggregated score string for display
 * }
 */
function resolveTie(tie) {
  const { leg1, leg2 } = tie;
  const teamA = leg1.home;
  const teamB = leg1.away;

  // ── Case: N.N. — no result possible ─────────────────────────────────────
  if (teamA === "N.N." || teamB === "N.N.") {
    return { home: teamA, away: teamB, winner: null, loser: null, homeWinPct: 50, awayWinPct: 50, confidence: 50, source: "projected", displayScore: null };
  }

  // ── Case: Single-leg final ───────────────────────────────────────────────
  if (!leg2) {
    if (leg1.score) {
      const w = leg1.score.home > leg1.score.away ? teamA : teamB;
      const l = w === teamA ? teamB : teamA;
      return {
        home: teamA, away: teamB,
        winner: w, loser: l,
        homeWinPct: w === teamA ? 100 : 0,
        awayWinPct: w === teamB ? 100 : 0,
        confidence: 100,
        source: "actual",
        displayScore: `${leg1.score.home}–${leg1.score.away}`,
      };
    }
    // No result → predict
    return predictTie(teamA, teamB, 0, 0);
  }

  // ── Case: Two-legged tie — both legs complete ────────────────────────────
  if (leg1.score && leg2.score) {
    const aggA = leg1.score.home + leg2.score.away;  // teamA aggregate
    const aggB = leg1.score.away + leg2.score.home;  // teamB aggregate

    let winner, loser;

    if (aggA > aggB) {
      winner = teamA; loser = teamB;
    } else if (aggB > aggA) {
      winner = teamB; loser = teamA;
    } else {
      // Tied aggregate — resolve by pen/aet on leg 2
      const st = leg2.score.type;
      if (st === "pen") {
        // leg2.score.penHome is leg2's home team's pen score; leg2.home = teamB (reversed)
        winner = leg2.score.penHome > leg2.score.penAway ? teamB : teamA;
        loser  = winner === teamA ? teamB : teamA;
      } else {
        // Even after aet — favour teamB (home in leg 2, slight edge) as approximation
        winner = teamB; loser = teamA;
      }
    }

    return {
      home: teamA, away: teamB,
      winner, loser,
      homeWinPct: winner === teamA ? 100 : 0,
      awayWinPct: winner === teamB ? 100 : 0,
      confidence: 100,
      source: "actual",
      displayScore: `${aggA}–${aggB} agg`,
    };
  }

  // ── Case: Leg 1 complete, leg 2 missing ─────────────────────────────────
  if (leg1.score && !leg2.score) {
    // Leg 1 result: teamA scored leg1.score.home, teamB scored leg1.score.away
    // Advantage going into leg 2: positive = teamA ahead
    const advA = leg1.score.home - leg1.score.away;
    return predictTie(teamA, teamB, advA, 0);
  }

  // ── Neither leg has a result ─────────────────────────────────────────────
  return predictTie(teamA, teamB, 0, 0);
}

/**
 * Use the prediction model to project a tie, with an existing aggregate advantage.
 * advA > 0  →  teamA is ahead; advA < 0  →  teamB is ahead.
 *
 * When the domestic model returns the generic fallback (37/28.5/34.5) —
 * which happens for any club not in the domestic training data — we substitute
 * a competition-specific prestige model using CLUB_RATINGS instead.
 */
function predictTie(teamA, teamB, advA = 0) {
  const predictMatch = getPredictMatch();
  let homeP = 50, awayP = 50;

  try {
    // teamB is the home team in leg 2 (reversed fixture)
    const pred = predictMatch(teamB, teamA, {});

    // Determine which probability signal to use
    let homeWinPct, drawPct, awayWinPct;

    if (pred?.probabilities && !isGenericFallback(pred.probabilities)) {
      // Domestic model has real data for these clubs — use it
      ({ homeWinPct, drawPct, awayWinPct } = pred.probabilities);
    } else {
      // Generic fallback: use club prestige ratings to compute a meaningful signal.
      // teamB is "home" in leg 2; apply a small home factor (+3 rating pts).
      const rA = clubRatingFor(teamA);
      const rB = clubRatingFor(teamB) + 3;  // leg-2 home edge
      const diff = rB - rA;
      // Logistic curve: diff/15 keeps the scale stable (15 rating pts → ~65% win)
      const logit = (d) => 1 / (1 + Math.exp(-d / 15));
      const bShare = logit(diff);
      const draw   = Math.min(0.28, Math.max(0.16, 0.26 - Math.abs(diff) * 0.003));
      homeWinPct = Math.round((1 - draw) * (1 - bShare) * 100 * 10) / 10; // teamA wins as away
      awayWinPct = Math.round((1 - draw) * bShare        * 100 * 10) / 10; // teamB wins as home
      drawPct    = Math.round(draw * 100 * 10) / 10;
    }

    // teamB is home in leg 2; redistribute draw 50/50 for KO
    const adjB = homeWinPct + drawPct * 0.5;  // wait — homeWinPct here = teamA as away wins; flip
    // Careful: in predictMatch(teamB, teamA), teamB is home → homeWinPct = teamB wins
    // So adjB (teamB) = homeWinPct + draw*0.5; adjA (teamA) = awayWinPct + draw*0.5
    const adjBfinal = (pred?.probabilities && !isGenericFallback(pred.probabilities))
      ? homeWinPct  + drawPct * 0.5   // predictMatch(teamB,teamA): homeWinPct = teamB
      : awayWinPct  + drawPct * 0.5;  // prestige model: homeWinPct computed as teamA-away wins → flip
    const adjAfinal = (pred?.probabilities && !isGenericFallback(pred.probabilities))
      ? awayWinPct  + drawPct * 0.5   // predictMatch(teamB,teamA): awayWinPct = teamA
      : homeWinPct  + drawPct * 0.5;  // prestige model: awayWinPct = teamB home → flip

    // Apply leg-1 advantage: each goal advantage is worth ~10pp
    const advBoost = Math.min(25, Math.abs(advA) * 10);
    if (advA > 0) {
      homeP = Math.round(Math.min(90, adjAfinal + advBoost)); // teamA ahead
      awayP = 100 - homeP;
    } else if (advA < 0) {
      awayP = Math.round(Math.min(90, adjBfinal + advBoost)); // teamB ahead
      homeP = 100 - awayP;
    } else {
      homeP = Math.round(adjAfinal);
      awayP = Math.round(adjBfinal);
    }
  } catch (_) {
    // Last resort: use raw prestige ratings
    const rA = clubRatingFor(teamA);
    const rB = clubRatingFor(teamB);
    const advBoost = Math.min(25, Math.abs(advA) * 10);
    const baseA = 50 + (rA - rB) * 0.8;
    if (advA > 0) {
      homeP = Math.round(Math.min(90, baseA + advBoost));
    } else if (advA < 0) {
      homeP = Math.round(Math.max(10, baseA - advBoost));
    } else {
      homeP = Math.round(Math.min(90, Math.max(10, baseA)));
    }
    awayP = 100 - homeP;
  }

  const winner = homeP >= awayP ? teamA : teamB;
  const loser  = winner === teamA ? teamB : teamA;
  return {
    home: teamA, away: teamB,
    winner, loser,
    homeWinPct: homeP,
    awayWinPct: awayP,
    confidence: Math.max(homeP, awayP),
    source: "projected",
    displayScore: null,
  };
}

// ── Bracket builder ───────────────────────────────────────────────────────────

/**
 * Build a bracket tree from resolved ties at each stage.
 * When the Final contains N.N. teams, fills them in from the projected SF winners.
 */
function buildBracketTree(stageMatches, comp) {
  // ── 1. Parse and resolve each stage ────────────────────────────────────────
  const resolve = (matches) =>
    groupIntoTies(matches).map(resolveTie);

  const r16Results = resolve(stageMatches.r16);
  const qfResults  = resolve(stageMatches.qf);
  const sfResults  = resolve(stageMatches.sf);

  // For the Final, inject projected SF winners if N.N.
  let finalMatches = stageMatches.final;
  if (finalMatches.length === 1 && (finalMatches[0].home === "N.N." || finalMatches[0].away === "N.N.")) {
    const sfWinners = sfResults.map(r => r.winner).filter(Boolean);
    if (sfWinners.length >= 2) {
      finalMatches = [{
        home:  sfWinners[0],
        away:  sfWinners[1],
        score: null,
      }];
    }
  }
  const finalResults = resolve(finalMatches);

  // ── 2. Convert results to slim-match format ────────────────────────────────
  function toSlimMatch(r) {
    return {
      home:       { team: r.home, flag: null },
      away:       { team: r.away, flag: null },
      winner:     r.winner,
      confidence: r.confidence,
      homeWinPct: r.homeWinPct,
      awayWinPct: r.awayWinPct,
      source:     r.source,
      score:      r.displayScore,
    };
  }

  function advancers(results) {
    return results.map(r => ({ team: r.winner || "TBD", flag: null }));
  }

  const champion = finalResults[0]?.winner;

  return {
    generatedAt:  new Date().toISOString(),
    competition:  { label: comp.label, season: comp.season },
    bracket: {
      r16: r16Results.length ? {
        label:    "Round of 16",
        subtitle: "16 teams enter · 8 advance",
        matches:  r16Results.map(toSlimMatch),
        advancers: advancers(r16Results),
      } : undefined,
      qf: qfResults.length ? {
        label:    "Quarterfinals",
        subtitle: "8 teams · 4 advance",
        matches:  qfResults.map(toSlimMatch),
        advancers: advancers(qfResults),
      } : undefined,
      sf: sfResults.length ? {
        label:    "Semifinals",
        subtitle: "4 teams · 2 finalists",
        matches:  sfResults.map(toSlimMatch),
        advancers: advancers(sfResults),
      } : undefined,
      final: finalResults.length ? {
        label:    "Final",
        subtitle: "2 finalists · 1 champion",
        matches:  finalResults.map(toSlimMatch),
        advancers: champion ? [{ team: champion, flag: null }] : [],
      } : undefined,
    },
    champion:   champion ? { team: champion, flag: null } : null,
    championLabel: comp.championLabel,
    disclaimer: r16Results.some(r => r.source === "projected")
      ? "Rounds with missing results use model projections."
      : "All results from official competition data.",
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build and return the knockout bracket for a competition.
 *
 * @param {string} competitionId — one of "champions-league" | "europa-league" | "conference-league"
 * @returns {object} bracket tree compatible with renderBracketTree() in app.js
 */
function projectClubBracket(competitionId) {
  const comp = COMPETITIONS[competitionId];
  if (!comp) throw new Error(`Unknown competition: "${competitionId}"`);
  if (!fs.existsSync(comp.txtPath)) throw new Error(`Data file not found: ${comp.txtPath}`);

  const stageMatches = parseTxtFile(comp.txtPath);
  return buildBracketTree(stageMatches, comp);
}

module.exports = { projectClubBracket, COMPETITIONS };
