/**
 * scripts/buildSquadClimateProfiles.js
 *
 * Generates data/international/squad_climate_profiles.json
 *
 * For each of the 48 WC 2026 national teams, this script computes a
 * `squadClimateScore` (1.0 = cold-weather squad, 5.0 = hot/humid squad)
 * based on where each team's players actually compete at club level.
 *
 * Climate tiers reflect AVERAGE MATCH-DAY CONDITIONS DURING THE PLAYING
 * SEASON (roughly August–May) — not the country's summer temperature.
 * A Premier League player trains all season in cold/wet England (tier 2)
 * even if he was born in Senegal.
 *
 * SCALE:
 *   1.0–1.9  Cold        (Scotland, Scandinavia, northern MLS)
 *   2.0–2.9  Temperate   (England, Germany, Netherlands, Belgium, MLS mixed)
 *   3.0–3.5  Warm        (France, Italy, Croatia, Portuguesa Liga, Argentina)
 *   3.6–4.4  Hot/Dry     (Spain, Turkey, Morocco, South Africa, Liga MX, southern MLS)
 *   4.5–5.0  Hot/Humid   (Brazil, Saudi, Egypt, West Africa, Iraq, Qatar)
 *
 * METHODOLOGY:
 *   - Each team is assigned a league distribution (% of squad by league tier).
 *   - The weighted average of those tiers produces squadClimateScore.
 *   - Research base: ESPN squad lists, Wikipedia WC 2026 squads page,
 *     known club affiliations of key players as of June 2026.
 *   - altitudeAdapted: true for teams with ≥30 % of squad from clubs in
 *     cities above 1 500 m (mainly Colombia, Ecuador, Mexico domestic).
 *
 * Run:  node scripts/buildSquadClimateProfiles.js
 */

"use strict";
const fs   = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// 1. Climate tier for each league / country federation
//    Key = short label used in distribution objects below.
// ---------------------------------------------------------------------------
const LEAGUE_TIER = {
  // ── Tier 1: Cold ─────────────────────────────────────────────────────────
  "Scottish Premiership":        1.0,  // Edinburgh/Glasgow: 7–15 °C match day
  "Norwegian Eliteserien":       1.2,  // Oslo: 6–14 °C
  "Swedish Allsvenskan":         1.2,  // Stockholm: 7–16 °C (spring/autumn)
  "Danish Superliga":            1.5,  // Copenhagen: 8–16 °C
  "Finnish Veikkausliiga":       1.0,
  "MLS North":                   1.5,  // Seattle, Portland, Minn, NE, Toronto, Vancouver
  "Canadian Premier":            1.5,  // CPL: Halifax, Ottawa, Hamilton, Winnipeg, Calgary, Edmonton, Vancouver

  // ── Tier 2: Temperate ────────────────────────────────────────────────────
  "Premier League":              2.0,  // England: 8–17 °C avg
  "Championship / EFL":          2.0,
  "Bundesliga":                  2.2,  // Germany: 8–18 °C
  "Bundesliga 2":                2.2,
  "Eredivisie":                  2.0,  // Netherlands: 7–17 °C
  "Belgian Pro League":          2.0,  // Belgium: 8–17 °C
  "Austrian Bundesliga":         2.2,  // Vienna: 9–18 °C
  "Swiss Super League":          2.2,  // Zürich: 8–17 °C
  "Czech Liga":                  2.0,  // Prague: 8–17 °C
  "Polish Ekstraklasa":          2.0,
  "Ukrainian Premier League":    2.2,
  "Russian Premier League":      2.0,
  "MLS Mixed":                   2.8,  // Broad MLS average (all climates)

  // ── Tier 3: Warm ─────────────────────────────────────────────────────────
  "Ligue 1":                     3.0,  // France: 10–20 °C
  "Ligue 2":                     3.0,
  "Serie A":                     3.5,  // Italy: 12–22 °C (Milan–Rome–Naples range)
  "Serie B":                     3.5,
  "Croatian HNL":                3.2,
  "Serbian SuperLiga":           3.0,
  "Bosnian Premier League":      3.0,
  "Greek Super League":          3.5,
  "Primeira Liga":               3.5,  // Portugal: 13–22 °C
  "Argentine Primera":           3.5,  // Buenos Aires: 12–22 °C
  "Chilean Primera":             3.2,
  "Uruguayan Primera":           3.5,
  "Colombian Primera":           4.0,  // hot lowlands + cool altitude mixed
  "J1 League":                   3.5,  // Japan: hot humid summers but autumn/spring dominated
  "K League":                    3.5,  // Korea: similar pattern
  "A-League":                    3.5,  // Australia: varies; avg warm
  "New Zealand":                 2.5,

  // ── Tier 4: Hot / Dry ────────────────────────────────────────────────────
  "La Liga":                     4.0,  // Spain: 15–25 °C (Madrid/Barcelona avg season)
  "La Liga 2":                   4.0,
  "Süper Lig":                   4.0,  // Turkey: 12–25 °C Istanbul; Ankara cooler but Antalya hot
  "South African PSL":           4.0,  // Cape Town/JHB: 14–22 °C winter league
  "Moroccan Botola":             4.0,
  "Algerian Ligue Pro":          4.2,
  "Tunisian Ligue":              4.0,
  "Liga MX":                     4.0,  // Mexico: hot/warm, altitude varies
  "Ecuadorian Serie A":          4.0,  // coastal hot + altitude mix
  "Paraguayan Div Pro":          4.2,  // subtropical, 20–32 °C
  "MLS South":                   4.0,  // Atlanta, Miami, Houston, Dallas, Nashville, Austin
  "UAE Pro League":              4.5,
  "Qatar Stars League":          4.8,
  "Qatari domestic":             4.8,

  // ── Tier 5: Hot / Humid ──────────────────────────────────────────────────
  "Saudi Pro League":            5.0,  // Riyadh: 20–40 °C; season played Oct–May still very warm
  "Brazilian Série A":           5.0,  // 25–35 °C year-round
  "Egyptian Premier League":     4.8,  // Cairo: hot, moderate humidity
  "Iraqi Stars League":          4.8,
  "Jordanian Pro League":        4.5,
  "Iranian Persian Gulf Pro":    4.5,
  "Uzbek League":                3.5,  // continental; cold winters, hot summers; season mixed
  "Ghanaian Premier":            5.0,
  "Senegalese Ligue 1":          5.0,
  "Ivorian Ligue 1":             5.0,
  "DR Congo Linafoot":           5.0,
  "Haitian league":              5.0,
  "Panamanian Liga":             4.5,
  "Cape Verdean":                4.5,
  "West African other":          5.0,
  "Caribbean / CONCACAF other":  4.5,
  "Middle East other":           4.5,
  "Other European":              2.5,  // catch-all for minor European leagues
  "Other":                       3.0,  // generic fallback
};

// ---------------------------------------------------------------------------
// 2. Per-team research data
//    distribution: { leagueKey: fraction }  — must sum to 1.0
//    altitudeAdapted: squad has ≥30 % of players from clubs at >1 500 m
//    notes: brief justification
// ---------------------------------------------------------------------------
const TEAM_DATA = {

  // ══════════════════════════════════════════════════════════════════════════
  //  UEFA  (16 teams)
  // ══════════════════════════════════════════════════════════════════════════

  "England": {
    distribution: {
      "Premier League":   0.70,
      "Bundesliga":       0.10,
      "La Liga":          0.12,
      "Serie A":          0.05,
      "Other European":   0.03,
    },
    altitudeAdapted: false,
    notes: "Squad is Premier League-dominant. Key exceptions: Bellingham/Alexander-Arnold (Real Madrid), Kane (Bayern). Temperate English conditions dominate training environment.",
  },

  "France": {
    distribution: {
      "La Liga":          0.28,
      "Ligue 1":          0.20,
      "Serie A":          0.22,
      "Premier League":   0.20,
      "Bundesliga":       0.05,
      "Other":            0.05,
    },
    altitudeAdapted: false,
    notes: "Heavily spread across top 4 European leagues. Mbappe/Camavinga/Tchouameni at Real Madrid; Thuram at Inter; Maignan at Milan. French domestic players are warm-climate acclimated; La Liga/Serie A players skew hotter.",
  },

  "Germany": {
    distribution: {
      "Bundesliga":       0.65,
      "Premier League":   0.15,
      "La Liga":          0.08,
      "Serie A":          0.05,
      "Other European":   0.07,
    },
    altitudeAdapted: false,
    notes: "Bundesliga dominates. A few stars abroad (Havertz at Arsenal, Wirtz). German league conditions are temperate; squad is not heat-acclimatised.",
  },

  "Spain": {
    distribution: {
      "La Liga":          0.62,
      "Premier League":   0.18,
      "Bundesliga":       0.08,
      "Ligue 1":          0.05,
      "Serie A":          0.04,
      "Other":            0.03,
    },
    altitudeAdapted: false,
    notes: "La Liga-dominant. Most players train in warm/dry Madrid or Barcelona climate year-round. One of the most heat-adapted European squads.",
  },

  "Portugal": {
    distribution: {
      "Premier League":   0.25,
      "La Liga":          0.18,
      "Primeira Liga":    0.18,
      "Saudi Pro League": 0.12,
      "Serie A":          0.10,
      "Bundesliga":       0.08,
      "Ligue 1":          0.06,
      "Other":            0.03,
    },
    altitudeAdapted: false,
    notes: "Diverse distribution. Large Saudi contingent (Ronaldo, Neves, others) adds hot-climate exposure. Primeira Liga and La Liga players are warm-acclimated. Among the more heat-tolerant UEFA squads.",
  },

  "Netherlands": {
    distribution: {
      "Eredivisie":       0.35,
      "Premier League":   0.30,
      "Bundesliga":       0.12,
      "La Liga":          0.08,
      "Serie A":          0.08,
      "Other European":   0.07,
    },
    altitudeAdapted: false,
    notes: "Split between home Eredivisie and English/German leagues. All cold/temperate environments. Van Dijk (Liverpool), de Bruyne era winding down; younger players largely Europe-based.",
  },

  "Belgium": {
    distribution: {
      "Premier League":   0.30,
      "Bundesliga":       0.15,
      "Ligue 1":          0.15,
      "Serie A":          0.10,
      "La Liga":          0.10,
      "Belgian Pro League": 0.12,
      "Other European":   0.08,
    },
    altitudeAdapted: false,
    notes: "Premier League is the most-represented single league. No significant hot-climate club exposure beyond occasional La Liga players.",
  },

  "Croatia": {
    distribution: {
      "Bundesliga":       0.18,
      "Serie A":          0.18,
      "Premier League":   0.15,
      "Ligue 1":          0.12,
      "La Liga":          0.10,
      "Süper Lig":        0.08,
      "Croatian HNL":     0.10,
      "Other European":   0.09,
    },
    altitudeAdapted: false,
    notes: "Veteran core (Modric at Real Madrid) plus younger players spread across Europe. Turkish league presence adds moderate hot-climate exposure. Croatia's home league is warm-Mediterranean.",
  },

  "Norway": {
    distribution: {
      "Premier League":   0.35,
      "Bundesliga":       0.15,
      "Eredivisie":       0.12,
      "Ligue 1":          0.10,
      "Norwegian Eliteserien": 0.12,
      "Serie A":          0.08,
      "Other European":   0.08,
    },
    altitudeAdapted: false,
    notes: "Haaland (City), Odegaard (Arsenal), Sorloth, Normann — almost all in cold/temperate northern European leagues. One of the most cold-climate squads in the tournament. Large heat penalty expected in Miami/Monterrey.",
  },

  "Sweden": {
    distribution: {
      "Bundesliga":       0.20,
      "Premier League":   0.18,
      "Eredivisie":       0.12,
      "Swedish Allsvenskan": 0.15,
      "Serie A":          0.10,
      "Other European":   0.15,
      "Other":            0.10,
    },
    altitudeAdapted: false,
    notes: "Post-Ibrahimovic era; mix of Bundesliga and Scandinavian domestic. Swedish Allsvenskan players are cold-climate adapted. Heat will be a significant factor vs warm-weather opponents.",
  },

  "Switzerland": {
    distribution: {
      "Bundesliga":       0.18,
      "Premier League":   0.15,
      "Swiss Super League": 0.20,
      "Ligue 1":          0.12,
      "Serie A":          0.12,
      "Other European":   0.15,
      "Other":            0.08,
    },
    altitudeAdapted: false,
    notes: "Many players at mid-tier European clubs. Swiss Super League, Bundesliga, and Ligue 1 all temperate/warm. Xhaka (Bayer Leverkusen), Shaqiri winding down. Solid mid-table cold-climate exposure.",
  },

  "Austria": {
    distribution: {
      "Bundesliga":       0.35,
      "Austrian Bundesliga": 0.20,
      "Premier League":   0.12,
      "Serie A":          0.10,
      "Other European":   0.15,
      "Other":            0.08,
    },
    altitudeAdapted: false,
    notes: "Austrian domestic league is cold/temperate; Bundesliga likewise. Alaba at Real Madrid is the notable warm-climate exception. Squad leans cold overall.",
  },

  "Scotland": {
    distribution: {
      "Premier League":   0.35,
      "Scottish Premiership": 0.32,
      "Bundesliga":       0.05,
      "Other European":   0.18,
      "Other":            0.10,
    },
    altitudeAdapted: false,
    notes: "Coldest-climate squad in the tournament. Over 30 % play in the Scottish Premiership (among the coldest footballing environments in Europe). The rest mostly in the English Premier League. Will struggle most in Miami and Monterrey heat.",
  },

  "Türkiye": {
    distribution: {
      "Süper Lig":        0.52,
      "Premier League":   0.15,
      "Bundesliga":       0.10,
      "Serie A":          0.08,
      "La Liga":          0.07,
      "Other European":   0.08,
    },
    altitudeAdapted: false,
    notes: "Majority play in the Turkish Süper Lig — a warm-to-hot league (Istanbul summers 28–35 °C, Antalya even warmer). Among the most heat-adapted UEFA squads behind Spain and Portugal.",
  },

  "Bosnia and Herzegovina": {
    distribution: {
      "Bundesliga":       0.18,
      "Ligue 1":          0.12,
      "Serie A":          0.12,
      "Süper Lig":        0.10,
      "Premier League":   0.10,
      "Saudi Pro League": 0.08,
      "Other European":   0.20,
      "Bosnian Premier League": 0.10,
    },
    altitudeAdapted: false,
    notes: "Widely distributed across European leagues plus a Saudi contingent. Džeko era winding down. Decent mix of warm (Turkish, Saudi) and cold (Bundesliga) environments.",
  },

  "Czechia": {
    distribution: {
      "Czech Liga":       0.20,
      "Bundesliga":       0.15,
      "Premier League":   0.12,
      "Eredivisie":       0.10,
      "Serie A":          0.08,
      "Ligue 1":          0.08,
      "Other European":   0.15,
      "Other":            0.12,
    },
    altitudeAdapted: false,
    notes: "Soucek (West Ham), Kolar, Schick (Leverkusen), Hlozek. Czech domestic league is temperate; Bundesliga and PL likewise. Mid-range cold-climate exposure.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  AFC  (9 teams)
  // ══════════════════════════════════════════════════════════════════════════

  "Japan": {
    distribution: {
      "J1 League":        0.22,
      "Bundesliga":       0.16,
      "La Liga":          0.08,
      "Serie A":          0.10,
      "Premier League":   0.08,
      "Ligue 1":          0.08,
      "Eredivisie":       0.08,
      "Other European":   0.12,
      "Other":            0.08,
    },
    altitudeAdapted: false,
    notes: "J League is warm/humid in summer but seasons are spring/autumn-weighted. Many players in Bundesliga, Serie A, La Liga. Well-spread squad with moderate heat acclimatisation. Minamino, Doan, Endo (Liverpool), Kamada etc.",
  },

  "Korea Republic": {
    distribution: {
      "K League":         0.20,
      "Premier League":   0.15,
      "Bundesliga":       0.12,
      "Ligue 1":          0.08,
      "Serie A":          0.08,
      "La Liga":          0.05,
      "Other European":   0.20,
      "Other":            0.12,
    },
    altitudeAdapted: false,
    notes: "Son (Spurs), Lee Kang-In (PSG), Kim Min-Jae (Bayern). K League is warm but spring/autumn schedule moderates heat exposure. European-based players dominate. Moderate heat acclimatisation.",
  },

  "Australia": {
    distribution: {
      "A-League":         0.15,
      "Premier League":   0.20,
      "Scottish Premiership": 0.08,
      "Bundesliga":       0.10,
      "Eredivisie":       0.10,
      "Other European":   0.22,
      "Other":            0.15,
    },
    altitudeAdapted: false,
    notes: "Socceroos split between A-League (warm Australian climate) and European leagues. A-League season (Oct–May) includes warm Australian summer. European-based players in colder environments. Net: moderate warm-climate exposure.",
  },

  "IR Iran": {
    distribution: {
      "Iranian Persian Gulf Pro": 0.38,
      "Süper Lig":               0.12,
      "Bundesliga":               0.10,
      "Belgian Pro League":       0.08,
      "Other European":           0.15,
      "UAE Pro League":           0.08,
      "Middle East other":        0.09,
    },
    altitudeAdapted: false,
    notes: "Majority play in the Iranian domestic league (warm/hot continental climate, often 30–40 °C in summer though season somewhat moderated). Significant Turkish and Middle East exposure. One of the more heat-adapted Asian squads.",
  },

  "Saudi Arabia": {
    distribution: {
      "Saudi Pro League": 0.58,
      "Premier League":   0.15,
      "Bundesliga":       0.05,
      "Serie A":          0.05,
      "Other European":   0.10,
      "Other":            0.07,
    },
    altitudeAdapted: false,
    notes: "Over half the squad plays in the Saudi Pro League — one of the hottest footballing environments in the world (Riyadh regularly 35–45 °C, season Oct–May still very warm). Best heat-acclimatised Asian squad. Neymar / Al-Hilal influence; Al-Qassim, Al-Ittihad clubs dominate.",
  },

  "Qatar": {
    distribution: {
      "Qatar Stars League": 0.72,
      "Qatari domestic":    0.08,
      "Other European":     0.10,
      "Middle East other":  0.10,
    },
    altitudeAdapted: false,
    notes: "Nearly the entire squad plays in Qatar's domestic league (Doha: 28–45 °C year-round, season Oct–May). Most heat-acclimatised squad of the entire tournament — equally effective in Miami or Monterrey.",
  },

  "Jordan": {
    distribution: {
      "Jordanian Pro League": 0.42,
      "UAE Pro League":       0.12,
      "Saudi Pro League":     0.08,
      "Other European":       0.20,
      "Middle East other":    0.10,
      "Other":                0.08,
    },
    altitudeAdapted: false,
    notes: "Majority play in Jordan (Amman: hot, dry, 28–38 °C summers; season moderated to spring/autumn). Middle East club exposure makes this squad among the most heat-adapted in the tournament.",
  },

  "Iraq": {
    distribution: {
      "Iraqi Stars League": 0.45,
      "UAE Pro League":     0.12,
      "Middle East other":  0.18,
      "Other European":     0.15,
      "Other":              0.10,
    },
    altitudeAdapted: false,
    notes: "Iraqi domestic league (Baghdad: 40–50 °C summers, though season is autumn/winter-weighted). Even in the mild season matches are 25–35 °C. Combined with UAE exposure, Iraq is one of the top 3 heat-acclimatised squads.",
  },

  "Uzbekistan": {
    distribution: {
      "Uzbek League":         0.28,
      "Other European":       0.25,
      "Russian Premier League": 0.12,
      "Süper Lig":            0.12,
      "Bundesliga":           0.08,
      "Middle East other":    0.08,
      "Other":                0.07,
    },
    altitudeAdapted: false,
    notes: "Mix of domestic Uzbek league (hot continental summers, cold winters; season spring/autumn) and various European leagues. Some Turkish exposure. Net moderate warm-climate score.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CAF  (10 teams)
  // ══════════════════════════════════════════════════════════════════════════

  "Algeria": {
    distribution: {
      "Ligue 1":             0.30,
      "Algerian Ligue Pro":  0.18,
      "Süper Lig":           0.10,
      "Belgian Pro League":  0.08,
      "Premier League":      0.05,
      "Saudi Pro League":    0.07,
      "Other European":      0.14,
      "Other":               0.08,
    },
    altitudeAdapted: false,
    notes: "Strong Ligue 1 presence (many French-Algerian players). Algerian domestic league is hot/dry (Algiers: warm Mediterranean). Turkish and Saudi exposure adds further heat adaptation. Solid warm-weather squad.",
  },

  "Cabo Verde": {
    distribution: {
      "Ligue 1":             0.20,
      "Primeira Liga":       0.15,
      "Czech Liga":          0.10,
      "Cape Verdean":        0.15,
      "Belgian Pro League":  0.08,
      "Other European":      0.22,
      "Other":               0.10,
    },
    altitudeAdapted: false,
    notes: "Cape Verdean players are largely diaspora-based in France, Portugal, Czech Republic. Despite the islands being hot/tropical, players train in temperate European environments. Moderate climate score.",
  },

  "Côte d'Ivoire": {
    distribution: {
      "Ligue 1":               0.30,
      "Premier League":        0.15,
      "Bundesliga":            0.08,
      "Ivorian Ligue 1":       0.15,
      "Other European":        0.15,
      "West African other":    0.10,
      "Other":                 0.07,
    },
    altitudeAdapted: false,
    notes: "Ligue 1 is the primary base for Ivorian talent. Domestic league in Abidjan is extremely hot/humid year-round. Franck Kessie, Zaha, Haller profile: mid-range European with African heat baseline. Moderate-to-high warm acclimatisation.",
  },

  "Egypt": {
    distribution: {
      "Egyptian Premier League": 0.42,
      "Saudi Pro League":         0.12,
      "Premier League":           0.08,
      "Ligue 1":                  0.08,
      "Other European":           0.18,
      "Other":                    0.12,
    },
    altitudeAdapted: false,
    notes: "Largest contingent in Egyptian domestic league (Cairo: 30–40 °C in summer; season Oct–May still warm). Salah (Liverpool) is the main European exception. Saudi exposure adds further heat experience. High heat acclimatisation.",
  },

  "Ghana": {
    distribution: {
      "Premier League":      0.20,
      "Ghanaian Premier":    0.18,
      "Ligue 1":             0.10,
      "Süper Lig":           0.08,
      "Saudi Pro League":    0.05,
      "Other European":      0.22,
      "West African other":  0.10,
      "Other":               0.07,
    },
    altitudeAdapted: false,
    notes: "Split between Ghanaian domestic (Accra: 28–35 °C year-round, highly humid) and European leagues. Premier League players are cold-acclimated by day-to-day training but many have West African heritage and pre-season hot-weather experience. Moderate-to-high warm exposure.",
  },

  "Morocco": {
    distribution: {
      "Ligue 1":             0.25,
      "La Liga":             0.10,
      "Bundesliga":          0.10,
      "Moroccan Botola":     0.15,
      "Saudi Pro League":    0.08,
      "Serie A":             0.08,
      "Premier League":      0.10,
      "Other European":      0.09,
      "Other":               0.05,
    },
    altitudeAdapted: false,
    notes: "Strong across top European leagues since WC 2022 breakthrough. Moroccan domestic league is warm/dry. Hakimi (PSG), Ziyech, En-Nesyri (Seville/hot La Liga). Moderate-to-high heat acclimatisation.",
  },

  "Senegal": {
    distribution: {
      "Ligue 1":               0.35,
      "Premier League":        0.10,
      "Serie A":               0.08,
      "Süper Lig":             0.08,
      "Saudi Pro League":      0.08,
      "Senegalese Ligue 1":    0.12,
      "Other European":        0.12,
      "Other":                 0.07,
    },
    altitudeAdapted: false,
    notes: "Ligue 1 is the main base (Dakar-born players often go to France). Senegalese domestic league (Dakar: 28–35 °C, very humid). Mané at Al-Nassr (Saudi). Sadio's squad profile skews warm/hot overall.",
  },

  "South Africa": {
    distribution: {
      "South African PSL":   0.35,
      "Ligue 1":             0.12,
      "Premier League":      0.10,
      "Belgian Pro League":  0.08,
      "Czech Liga":          0.05,
      "Primeira Liga":       0.05,
      "Other European":      0.15,
      "Other":               0.10,
    },
    altitudeAdapted: false,
    notes: "South African PSL is a warm winter league (Cape Town mild, Johannesburg warm). Decent European presence. Net: moderately warm squad.",
  },

  "Tunisia": {
    distribution: {
      "Ligue 1":                  0.30,
      "Tunisian Ligue":           0.18,
      "Saudi Pro League":         0.08,
      "Süper Lig":                0.08,
      "Premier League":           0.08,
      "Other European":           0.18,
      "Other":                    0.10,
    },
    altitudeAdapted: false,
    notes: "Ligue 1 and Tunisian domestic are key. Tunis is warm/dry Mediterranean. Saudi and Turkish exposure adds heat. Mid-to-high warm acclimatisation, similar to Algeria.",
  },

  "Congo DR": {
    distribution: {
      "Ligue 1":             0.20,
      "Belgian Pro League":  0.15,
      "DR Congo Linafoot":   0.25,
      "Süper Lig":           0.08,
      "Saudi Pro League":    0.05,
      "Other European":      0.15,
      "West African other":  0.12,
    },
    altitudeAdapted: false,
    notes: "DR Congo Linafoot (Kinshasa: 26–32 °C year-round, humid equatorial) is the domestic base. Belgian and French leagues provide European exposure. High heat baseline from domestic league.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CONCACAF  (6 teams)
  // ══════════════════════════════════════════════════════════════════════════

  "USA": {
    distribution: {
      "Premier League":   0.15,
      "Bundesliga":       0.12,
      "MLS Mixed":        0.35,   // broad US mix — southern AND northern clubs
      "La Liga":          0.05,
      "Ligue 1":          0.05,
      "Serie A":          0.05,
      "Other European":   0.13,
      "Other":            0.10,
    },
    altitudeAdapted: false,
    notes: "USMNT split between European stars (Pulisic at AC Milan, Reyna, McKennie, Adams) and MLS-based players. Southern MLS (Atlanta, Houston, Miami, Dallas) players are heat-acclimatised; northern MLS less so. Pulisic/Serie A/Bundesliga players are in cool-temperate environments. Net: moderate.",
  },

  "Canada": {
    distribution: {
      "MLS Mixed":           0.35,
      "Premier League":      0.15,
      "Bundesliga":          0.10,
      "Other European":      0.22,
      "Canadian Premier":    0.08,
      "Other":               0.10,
    },
    altitudeAdapted: false,
    notes: "Davies (Bayern), Johnston, Eustaquio (Porto). Canadian MLS clubs are northern (Toronto, Vancouver, Montreal) — cool climate. Most European-based players in Bundesliga or similar temperate leagues. Low-to-moderate heat acclimatisation. Canada's home climate is cool.",
  },

  "Mexico": {
    distribution: {
      "Liga MX":          0.60,
      "MLS Mixed":        0.12,
      "La Liga":          0.05,
      "Premier League":   0.05,
      "Saudi Pro League": 0.05,
      "Other":            0.13,
    },
    altitudeAdapted: true,  // >30% of squad from Liga MX clubs in altitude cities (Mexico City 2,240m, Guadalajara 1,556m, Toluca 2,680m, Puebla 2,150m)
    notes: "Liga MX-dominant. Mexican clubs play across a wide climate range: Mexico City (altitude + mild temps), Guadalajara (altitude + warm), Monterrey (hot), Tijuana (mild), Puebla (altitude). Mexico is the most altitude-adapted non-South-American squad. Also heat-adapted from Monterrey/Tigres/CF Pachuca environments.",
  },

  "Curaçao": {
    distribution: {
      "Eredivisie":          0.22,
      "Belgian Pro League":  0.10,
      "Premier League":      0.08,
      "MLS Mixed":           0.10,
      "Other European":      0.30,
      "Caribbean / CONCACAF other": 0.20,
    },
    altitudeAdapted: false,
    notes: "Curaçao is a hot Caribbean island but the squad is largely diaspora-based in the Netherlands and Europe. Dutch/Belgian leagues are cold/temperate. Small MLS contingent. Despite island origins, players train in cool European climates — moderate climate score.",
  },

  "Haiti": {
    distribution: {
      "Haitian league":          0.25,
      "Ligue 1":                 0.15,
      "MLS Mixed":               0.12,
      "Other European":          0.15,
      "Caribbean / CONCACAF other": 0.15,
      "Other":                   0.18,
    },
    altitudeAdapted: false,
    notes: "Port-au-Prince is hot/humid year-round. Haitian domestic and Caribbean exposure is very warm. French-based Haitian diaspora players add warm Ligue 1 climate experience. Among the more heat-adapted CONCACAF squads.",
  },

  "Panama": {
    distribution: {
      "Panamanian Liga":           0.30,
      "MLS Mixed":                 0.15,
      "Argentine Primera":         0.08,
      "Colombian Primera":         0.08,
      "Other European":            0.20,
      "Caribbean / CONCACAF other": 0.12,
      "Other":                     0.07,
    },
    altitudeAdapted: false,
    notes: "Panama City is one of the hottest/most humid capitals in the Americas (30–35 °C, 80 %+ humidity year-round). Domestic league is very hot. Argentine and Colombian exposures add warm-weather acclimatisation. One of the most heat-adapted CONCACAF squads.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  CONMEBOL  (6 teams)
  // ══════════════════════════════════════════════════════════════════════════

  "Argentina": {
    distribution: {
      "La Liga":           0.20,
      "Argentine Primera": 0.18,
      "Saudi Pro League":  0.12,
      "Serie A":           0.10,
      "Premier League":    0.10,
      "Ligue 1":           0.08,
      "MLS Mixed":         0.05,
      "Bundesliga":        0.05,
      "Other":             0.12,
    },
    altitudeAdapted: false,
    notes: "Messi (Inter Miami MLS), Di María retired; Álvarez (Atlético), Martínez (Inter), De Paul (Atlético). Saudi contingent adds heat exposure. Argentine Primera is warm (Buenos Aires 15–28 °C). La Liga/Saudi together give warm-to-hot training environment for a large chunk of the squad.",
  },

  "Brazil": {
    distribution: {
      "Brazilian Série A":  0.30,
      "Premier League":     0.15,
      "La Liga":            0.12,
      "Saudi Pro League":   0.10,
      "Serie A":            0.08,
      "Ligue 1":            0.08,
      "Bundesliga":         0.05,
      "Other":              0.12,
    },
    altitudeAdapted: false,
    notes: "Vinicius/Rodrygo (Real Madrid), Endrick, Raphinha (Barça), Alisson/Firmino era fading. Large Brazilian domestic contingent (São Paulo, Rio, Recife: 25–35 °C, highly humid year-round). Even European-based Brazilian players grow up heat-acclimatised. Most heat-tolerant CONMEBOL squad.",
  },

  "Colombia": {
    distribution: {
      "Colombian Primera":  0.20,
      "Argentine Primera":  0.10,
      "Liga MX":            0.05,
      "Premier League":     0.10,
      "Serie A":            0.10,
      "Ligue 1":            0.10,
      "Bundesliga":         0.05,
      "La Liga":            0.08,
      "MLS Mixed":          0.08,
      "Saudi Pro League":   0.05,
      "Other":              0.09,
    },
    altitudeAdapted: true,  // Bogotá 2,640m; Medellín 1,495m; Manizales 2,153m
    notes: "Colombian Primera has the broadest altitude range of any league: Bogotá (2,640m), Manizales (2,153m), Medellín (1,495m) alongside coastal Barranquilla/Cali. Significant proportion of squad altitude-adapted. Also heat-adapted from Barranquilla (hot/humid coast). Díaz (Liverpool), Arias, Córdoba spread across Europe.",
  },

  "Ecuador": {
    distribution: {
      "Argentine Primera":   0.20,
      "Serie A":             0.12,
      "Premier League":      0.10,
      "Ligue 1":             0.08,
      "La Liga":             0.08,
      "Ecuadorian Serie A":  0.18,
      "MLS Mixed":           0.05,
      "Other":               0.19,
    },
    altitudeAdapted: true,  // Quito 2,850m (highest top-flight city in the world); Cuenca 2,550m
    notes: "Ecuadorian Serie A includes Quito (2,850m) and Cuenca (2,550m) — the highest-altitude competitive league on earth. Squad is highly altitude-adapted. European-based players (Caicedo at Chelsea, Plata) are less so, but home-based players make up ~18%+. One of the two most altitude-adapted squads alongside Bolivia (not qualified).",
  },

  "Uruguay": {
    distribution: {
      "Argentine Primera":   0.15,
      "Uruguayan Primera":   0.12,
      "Premier League":      0.12,
      "Serie A":             0.10,
      "La Liga":             0.08,
      "Ligue 1":             0.08,
      "Bundesliga":          0.05,
      "Saudi Pro League":    0.08,
      "MLS Mixed":           0.08,
      "Other European":      0.08,
      "Other":               0.06,
    },
    altitudeAdapted: false,
    notes: "Valverde (Real Madrid), Núñez (Liverpool), Bentancur, Cavani winding down. Uruguayan Primera and Argentine leagues are warm. Saudi and La Liga add heat. Broadly distributed; warm-to-hot overall.",
  },

  "Paraguay": {
    distribution: {
      "Argentine Primera":   0.25,
      "Paraguayan Div Pro":  0.18,
      "Brazilian Série A":   0.08,
      "Premier League":      0.08,
      "Serie A":             0.08,
      "Ligue 1":             0.08,
      "Saudi Pro League":    0.05,
      "Other European":      0.12,
      "Other":               0.08,
    },
    altitudeAdapted: false,
    notes: "Asunción is subtropical: 20–35 °C year-round, high humidity. Paraguayan domestic and Argentine Primera both warm. Brazilian exposure adds hot/humid baseline. Among the more heat-adapted CONMEBOL squads.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  OFC  (1 team)
  // ══════════════════════════════════════════════════════════════════════════

  "New Zealand": {
    distribution: {
      "A-League":              0.20,
      "Premier League":        0.15,
      "Scottish Premiership":  0.10,
      "Eredivisie":            0.10,
      "Norwegian Eliteserien": 0.05,
      "Other European":        0.22,
      "MLS Mixed":             0.10,
      "New Zealand":           0.08,
    },
    altitudeAdapted: false,
    notes: "All Whites spread thinly across many leagues, including cold Scottish and Norwegian ones. Wood (Burnley), Cacace (Leicester). A-League is warm (Australian summer). Net: moderate-low climate score.",
  },
};

// ---------------------------------------------------------------------------
// 3. Compute weighted squadClimateScore for each team
// ---------------------------------------------------------------------------
function computeScore(team, data) {
  const dist = data.distribution;
  let score = 0;
  let totalWeight = 0;
  for (const [league, weight] of Object.entries(dist)) {
    const tier = LEAGUE_TIER[league];
    if (tier === undefined) {
      console.warn(`  ⚠  Unknown league key "${league}" for ${team} — skipping`);
      continue;
    }
    score += tier * weight;
    totalWeight += weight;
  }
  if (Math.abs(totalWeight - 1.0) > 0.02) {
    console.warn(`  ⚠  ${team}: distribution sums to ${totalWeight.toFixed(3)} (expected 1.0)`);
  }
  return Math.round((score / totalWeight) * 100) / 100;
}

// ---------------------------------------------------------------------------
// 4. Validate all 48 fixture teams are covered
// ---------------------------------------------------------------------------
const FIXTURE_TEAMS = [
  "Algeria","Argentina","Australia","Austria","Belgium","Bosnia and Herzegovina",
  "Brazil","Cabo Verde","Canada","Colombia","Congo DR","Croatia","Curaçao",
  "Czechia","Côte d'Ivoire","Ecuador","Egypt","England","France","Germany",
  "Ghana","Haiti","IR Iran","Iraq","Japan","Jordan","Korea Republic","Mexico",
  "Morocco","Netherlands","New Zealand","Norway","Panama","Paraguay","Portugal",
  "Qatar","Saudi Arabia","Scotland","Senegal","South Africa","Spain","Sweden",
  "Switzerland","Tunisia","Türkiye","USA","Uruguay","Uzbekistan"
];

// ---------------------------------------------------------------------------
// 5. Build and write output JSON
// ---------------------------------------------------------------------------
function build() {
  const profiles = {};
  const missing  = [];
  const warnings = [];

  for (const team of FIXTURE_TEAMS) {
    if (!TEAM_DATA[team]) {
      missing.push(team);
      continue;
    }
    const data  = TEAM_DATA[team];
    const score = computeScore(team, data);
    let heatLabel;
    if      (score < 2.0) heatLabel = "Cold-climate squad";
    else if (score < 2.8) heatLabel = "Temperate-climate squad";
    else if (score < 3.6) heatLabel = "Warm-climate squad";
    else if (score < 4.4) heatLabel = "Hot/dry-climate squad";
    else                   heatLabel = "Hot/humid-climate squad";

    profiles[team] = {
      squadClimateScore: score,
      heatLabel,
      altitudeAdapted: data.altitudeAdapted || false,
      distribution: data.distribution,
      notes: data.notes,
    };
  }

  if (missing.length) {
    console.error("❌  Missing teams:", missing.join(", "));
    process.exit(1);
  }

  // Print summary table
  const sorted = Object.entries(profiles).sort((a, b) => b[1].squadClimateScore - a[1].squadClimateScore);
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Squad Climate Scores (hottest → coldest)");
  console.log("═══════════════════════════════════════════════════════════════");
  for (const [team, p] of sorted) {
    const alt = p.altitudeAdapted ? "⛰ " : "  ";
    console.log(`  ${alt}${team.padEnd(28)} ${p.squadClimateScore.toFixed(2)}  ${p.heatLabel}`);
  }
  console.log("═══════════════════════════════════════════════════════════════\n");

  const output = {
    _meta: {
      description: "WC 2026 squad climate profiles — average club-league climate tier per national team. Used by weatherService.js to compute heat/altitude adjustment in match predictions.",
      generatedAt: new Date().toISOString(),
      generatedBy: "scripts/buildSquadClimateProfiles.js",
      climateTierScale: {
        "1.0–1.9": "Cold (Scotland, Scandinavia, northern MLS)",
        "2.0–2.9": "Temperate (Premier League, Bundesliga, Eredivisie, Belgian, MLS mixed)",
        "3.0–3.5": "Warm (Ligue 1, Serie A, Primeira Liga, Argentine Primera, J/K League)",
        "3.6–4.4": "Hot/Dry (La Liga, Süper Lig, Liga MX, African domestic, Middle East)",
        "4.5–5.0": "Hot/Humid (Saudi Pro League, Brazilian Série A, Egyptian, West African, Iraqi, Qatari)",
      },
      altitudeAdaptedNote: "Teams marked altitudeAdapted:true have ≥30% of their squad from clubs in cities above 1,500m. They receive a reduced altitude penalty at Guadalajara (1,556m) and Mexico City (2,240m) fixtures.",
      teamCount: Object.keys(profiles).length,
    },
    profiles,
  };

  const outPath = path.join(__dirname, "..", "data", "international", "squad_climate_profiles.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`✅  Written → ${outPath}`);
  console.log(`    Teams: ${Object.keys(profiles).length}  |  Missing: ${missing.length}\n`);
}

build();
