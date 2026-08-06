const fs = require("fs");
const path = require("path");
const { normalizeTeamName } = require("./footballData");
const { API_FOOTBALL_PLAYER_STATS_PATH, readApiFootballPlayerStats } = require("./apiFootballPlayerStats");
const { mutableDataPath, readJsonWithFallback, repoDataPath, writeJson } = require("./runtimePaths");

const PLAYER_PROFILE_STATS_PATH = mutableDataPath("player_profile_updates.json");
const SEEDED_PLAYER_PROFILE_STATS_PATH = repoDataPath("player_profile_updates.json");
const IMPORTED_PLAYER_STATS_PATH = path.join(process.cwd(), "data", "fbref", "processed", "fbref_player_stats.json");
const WORLD_CUP_PLAYER_STATS_PATH = path.join(process.cwd(), "data", "international", "processed", "world_cup_player_stats.json");

const PLAYER_PROFILES = [
  {
    id: "erling-haaland",
    player: "Erling Haaland",
    team: "Man City",
    league: "EPL",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/71/Erling_Haaland_June_2025.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Erling_Haaland",
  },
  {
    id: "kylian-mbappe",
    player: "Kylian Mbappe",
    team: "Real Madrid",
    league: "La Liga",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/66/Picture_with_Mbapp%C3%A9_%28cropped_and_rotated%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Kylian_Mbapp%C3%A9",
  },
  {
    id: "vinicius-junior",
    player: "Vinicius Junior",
    team: "Real Madrid",
    league: "La Liga",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c6/2023_05_06_Final_de_la_Copa_del_Rey_-_52879242230_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Vin%C3%ADcius_J%C3%BAnior",
  },
  {
    id: "lamine-yamal",
    player: "Lamine Yamal",
    team: "Barcelona",
    league: "La Liga",
    role: "Attacker",
    position: "MF,FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/13/Lamine_Yamal_France_v_Spain_7.24.26-142.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Lamine_Yamal",
  },
  {
    id: "dominik-szoboszlai",
    player: "Dominik Szoboszlai",
    team: "Liverpool",
    league: "EPL",
    role: "Midfielder",
    position: "MF,DF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/52/Dominik_Szoboszlai_04012026_%281%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Dominik_Szoboszlai",
  },
  {
    id: "harry-kane",
    player: "Harry Kane",
    team: "Bayern Munich",
    league: "Bundesliga",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/91/Harry_Kane_on_October_10%2C_2023.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Harry_Kane",
  },
  {
    id: "bukayo-saka",
    player: "Bukayo Saka",
    team: "Arsenal",
    league: "EPL",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cd/1_bukayo_saka_arsenal_2025_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Bukayo_Saka",
  },
  {
    id: "bruno-fernandes",
    player: "Bruno Fernandes",
    team: "Man United",
    league: "EPL",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Bruno_Fernandes_USMNT_v_Portugal_Mar_31_2026-27_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Bruno_Fernandes",
  },
  {
    id: "jude-bellingham",
    player: "Jude Bellingham",
    team: "Real Madrid",
    league: "La Liga",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f9/25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Jude_Bellingham_-_240422_190551-2_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jude_Bellingham",
  },
  {
    id: "pedri",
    player: "Pedri",
    team: "Barcelona",
    league: "La Liga",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/13/Pedri.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Pedri",
  },
  {
    id: "jamal-musiala",
    player: "Jamal Musiala",
    team: "Bayern Munich",
    league: "Bundesliga",
    role: "Midfielder",
    position: "MF,FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/be/Jamal_Musiala_2022.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jamal_Musiala",
  },
  {
    id: "cole-palmer",
    player: "Cole Palmer",
    team: "Chelsea",
    league: "EPL",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Cole_Palmer_2025_FIFA_Club_World_Cup_Final.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Cole_Palmer",
  },
  {
    id: "david-raya",
    player: "David Raya",
    team: "Arsenal",
    league: "EPL",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/da/David_Raya_in_2025_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/David_Raya",
  },
  {
    id: "gianluigi-donnarumma",
    player: "Gianluigi Donnarumma",
    team: "Man City",
    league: "EPL",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2d/Norway_Italy_-_June_2025_A_17_%28Gianluigi_Donnarumma%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Gianluigi_Donnarumma",
  },
  {
    id: "jan-oblak",
    player: "Jan Oblak",
    team: "Atletico Madrid",
    league: "La Liga",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Jan_Oblak_2019.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jan_Oblak",
  },
  {
    id: "thibaut-courtois",
    player: "Thibaut Courtois",
    team: "Real Madrid",
    league: "La Liga",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f7/Thibaut_Courtois_at_the_2018_World_Cup_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Thibaut_Courtois",
  },
  {
    id: "benjamin-sesko",
    player: "Benjamin Sesko",
    team: "Man United",
    league: "EPL",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/FC_RB_Salzburg_gegen_SK_Austria_Klagenfurt_%282023-05-28%29_38_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Benjamin_%C5%A0e%C5%A1ko",
  },
  {
    id: "senne-lammens",
    player: "Senne Lammens",
    team: "Man United",
    league: "EPL",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/df/Senne_Lammens_USMNT_v_Belgium_Mar_28_2026-98_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Senne_Lammens",
  },
  {
    id: "matheus-cunha",
    player: "Matheus Cunha",
    team: "Man United",
    league: "EPL",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/80/Matheus_Cunha_em_2021.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Matheus_Cunha",
  },
  {
    id: "raphinha",
    player: "Raphinha",
    team: "Barcelona",
    league: "La Liga",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Raphael_Dias_Belloli_2023.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Raphinha",
  },
  {
    id: "fermin-lopez",
    player: "Fermin Lopez",
    team: "Barcelona",
    league: "La Liga",
    role: "Midfielder",
    position: "MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Ferm%C3%ADn_L%C3%B3pez_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ferm%C3%ADn_L%C3%B3pez",
  },
  {
    id: "michael-olise",
    player: "Michael Olise",
    team: "Bayern Munich",
    league: "Bundesliga",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/04/Michael_Olise_France_v_Senegal_16_June_2026-307_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Michael_Olise",
  },
  {
    id: "ousmane-dembele",
    player: "Ousmane Dembele",
    team: "Paris SG",
    league: "Ligue 1",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Ousmane_Demb%C3%A9l%C3%A9_2018_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ousmane_Demb%C3%A9l%C3%A9",
  },
  {
    id: "desire-doue",
    player: "Desire Doue",
    team: "Paris SG",
    league: "Ligue 1",
    role: "Attacker",
    position: "MF,FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Doue_asse_psg_2425.png",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/D%C3%A9sir%C3%A9_Dou%C3%A9",
  },
  {
    id: "khvicha-kvaratskhelia",
    player: "Khvicha Kvaratskhelia",
    team: "Paris SG",
    league: "Ligue 1",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Kvaratskhelia_asse_psg_2425.png",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Khvicha_Kvaratskhelia",
  },
  {
    id: "viktor-gyokeres",
    player: "Viktor Gyokeres",
    team: "Arsenal",
    league: "EPL",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ce/Viktor_Gy%C3%B6keres_2018.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Viktor_Gy%C3%B6keres",
  },
  {
    id: "ademola-lookman",
    player: "Ademola Lookman",
    team: "Atletico Madrid",
    league: "La Liga",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Ademola_Lookman_%282019%29_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ademola_Lookman",
  },
  {
    id: "phil-foden",
    player: "Phil Foden",
    team: "Man City",
    league: "EPL",
    role: "Midfielder",
    position: "MF,FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/53/2023-10-04_Fu%C3%9Fball%2C_M%C3%A4nner%2C_UEFA_Champions_League%2C_RB_Leipzig_-_Manchester_City_FC_1DX_2613%2C_Phil_Foden.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Phil_Foden",
  },
  {
    id: "achraf-hakimi",
    player: "Achraf Hakimi",
    team: "Paris SG",
    league: "Ligue 1",
    role: "Defender",
    position: "DF,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Achraf_Hakimi_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Achraf_Hakimi",
  },
  {
    id: "cristiano-ronaldo",
    player: "Cristiano Ronaldo",
    team: "Al-Nassr",
    league: "Saudi Pro League",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9c/President_Donald_Trump_meets_with_Cristiano_Ronaldo_in_the_Oval_Office_%2854933344262%29_%28cropped_and_rotated%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Cristiano_Ronaldo",
  },
  {
    id: "lionel-messi",
    player: "Lionel Messi",
    team: "Inter Miami",
    league: "MLS",
    role: "Attacker",
    position: "FW,MF",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Lionel_Messi_White_House_2026_%283x4_cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Lionel_Messi",
  },
  {
    id: "marcus-thuram",
    player: "Marcus Thuram",
    team: "Inter Milan",
    league: "Serie A",
    role: "Attacker",
    position: "FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/69/Marcus_Thuram_in_2023.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Marcus_Thuram",
  },
  {
    id: "neymar-jr",
    player: "Neymar Jr.",
    team: "Santos",
    league: "Brasileirao Serie A",
    role: "Attacker",
    position: "MF,FW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c0/Neymar_Junior_Brazil_V_Morocco_13_June_2026-40.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Neymar",
  },
  {
    id: "mike-maignan",
    player: "Mike Maignan",
    team: "AC Milan",
    league: "Serie A",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Mike_Maignan_France_v_Norway_26_June_26-132_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Mike_Maignan",
  },
  {
    id: "rafael-leao",
    player: "Rafael Leao",
    team: "AC Milan",
    league: "Serie A",
    role: "Attacker",
    position: "LW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/02/RafaelLe%C3%A3oPortugal23.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Rafael_Le%C3%A3o",
  },
  {
    id: "christian-pulisic",
    player: "Christian Pulisic",
    team: "AC Milan",
    league: "Serie A",
    role: "Attacker",
    position: "RW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/71/Christian_Pulisic_USMNT_v_Belgium_Mar_28_2026-73_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Christian_Pulisic",
  },
  {
    id: "emiliano-martinez",
    player: "Emiliano Martinez",
    team: "Aston Villa",
    league: "EPL",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9f/Emiliano_Martinez_Argentina_v_Egypt_7_July_2026-093_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Emiliano_Mart%C3%ADnez",
  },
  {
    id: "ollie-watkins",
    player: "Ollie Watkins",
    team: "Aston Villa",
    league: "EPL",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Ollie_Watkins_England_v_Ghana_23_June_2026-035.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ollie_Watkins",
  },
  {
    id: "pau-torres",
    player: "Pau Torres",
    team: "Aston Villa",
    league: "EPL",
    role: "Defender",
    position: "CB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Pau_Torres_April_2026_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Pau_Torres",
  },
  {
    id: "romelu-lukaku",
    player: "Romelu Lukaku",
    team: "Napoli",
    league: "Serie A",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/dc/Romelu_Lukaku_2021.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Romelu_Lukaku",
  },
  {
    id: "giovanni-di-lorenzo",
    player: "Giovanni Di Lorenzo",
    team: "Napoli",
    league: "Serie A",
    role: "Defender",
    position: "RB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/86/Norway_Italy_-_June_2025_A_20_-_Giovanni_Di_Lorenzo.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Giovanni_Di_Lorenzo",
  },
  {
    id: "alex-meret",
    player: "Alex Meret",
    team: "Napoli",
    league: "Serie A",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/66/Alex_Meret_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Alex_Meret",
  },
  {
    id: "bruno-guimaraes",
    player: "Bruno Guimaraes",
    team: "Newcastle United",
    league: "EPL",
    role: "Midfielder",
    position: "CDM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/70/Bruno_Guimaraes_Brazil_V_Morocco_13_June_2026-78_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Bruno_Guimar%C3%A3es",
  },
  {
    id: "sven-botman",
    player: "Sven Botman",
    team: "Newcastle United",
    league: "EPL",
    role: "Defender",
    position: "CB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0d/Sven_Botman_24052026_%286%29_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Sven_Botman",
  },
  {
    id: "fabian-schar",
    player: "Fabian Schar",
    team: "Newcastle United",
    league: "EPL",
    role: "Defender",
    position: "CB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6d/Fabian_Sch%C3%A4r.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Fabian_Sch%C3%A4r",
  },
  {
    id: "cristian-romero",
    player: "Cristian Romero",
    team: "Tottenham",
    league: "EPL",
    role: "Defender",
    position: "CB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Cristian_Romero_Argentina_v_Egypt_7_July_2026-108.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Cristian_Romero",
  },
  {
    id: "guglielmo-vicario",
    player: "Guglielmo Vicario",
    team: "Tottenham",
    league: "EPL",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Guglielmo_Vicario.png",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Guglielmo_Vicario",
  },
  {
    id: "sandro-tonali",
    player: "Sandro Tonali",
    team: "Tottenham",
    league: "EPL",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Norway_Italy_-_June_2025_A_30_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Sandro_Tonali",
  },
  {
    id: "manuel-locatelli",
    player: "Manuel Locatelli",
    team: "Juventus",
    league: "Serie A",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7d/FC_Zenit_Saint_Petersburg_vs._Juventus%2C_20_October_2021_34_%28Manuel_Locatelli%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Manuel_Locatelli",
  },
  {
    id: "jonathan-david",
    player: "Jonathan David",
    team: "Juventus",
    league: "Serie A",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/63/Jonathan_David_Canada_v_Qatar_18_June_2026-242_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jonathan_David",
  },
  {
    id: "francisco-conceicao",
    player: "Francisco Conceicao",
    team: "Juventus",
    league: "Serie A",
    role: "Attacker",
    position: "RW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a7/Francisco_Conceicao_Croatia_v_Portugal_2_July_2026-256.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Francisco_Concei%C3%A7%C3%A3o",
  },
  {
    id: "emre-can",
    player: "Emre Can",
    team: "Borussia Dortmund",
    league: "Bundesliga",
    role: "Midfielder",
    position: "CDM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cf/Emre_Can_in_2023.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Emre_Can",
  },
  {
    id: "serhou-guirassy",
    player: "Serhou Guirassy",
    team: "Borussia Dortmund",
    league: "Bundesliga",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d1/Serhou_Guirassy_2024_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Serhou_Guirassy",
  },
  {
    id: "nico-schlotterbeck",
    player: "Nico Schlotterbeck",
    team: "Borussia Dortmund",
    league: "Bundesliga",
    role: "Defender",
    position: "CB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/ba/2023-08-12_TSV_Schott_Mainz_gegen_Borussia_Dortmund_%28DFB-Pokal_2023-24%29_by_Sandro_Halank%E2%80%93069.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Nico_Schlotterbeck",
  },
  {
    id: "gerard-moreno",
    player: "Gerard Moreno",
    team: "Villarreal",
    league: "La Liga",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9c/UEFA_EURO_qualifiers_Sweden_vs_Spain_20191015_138_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Gerard_Moreno",
  },
  {
    id: "nicolas-pepe",
    player: "Nicolas Pepe",
    team: "Villarreal",
    league: "La Liga",
    role: "Attacker",
    position: "RW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Nicolas_Pepe_Cote_D%27Ivoire_v_Ecuador_14_June_2026-30.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Nicolas_P%C3%A9p%C3%A9",
  },
  {
    id: "georges-mikautadze",
    player: "Georges Mikautadze",
    team: "Villarreal",
    league: "La Liga",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/60/Mikautadze_asse_ol_2425.png",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Georges_Mikautadze",
  },
  {
    id: "ricardo-pepi",
    player: "Ricardo Pepi",
    team: "PSV Eindhoven",
    league: "Eredivisie",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Ricardo_Pepi_Australia_v_USA_19_June_2026-51_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ricardo_Pepi",
  },
  {
    id: "guus-til",
    player: "Guus Til",
    team: "PSV Eindhoven",
    league: "Eredivisie",
    role: "Midfielder",
    position: "CAM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/be/Guus_Til_%28Spartak_Moscow%2C_19.08.2019%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Guus_Til",
  },
  {
    id: "joey-veerman",
    player: "Joey Veerman",
    team: "PSV Eindhoven",
    league: "Eredivisie",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f9/Joey_Veerman_sc_Heerenveen.png",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Joey_Veerman",
  },
  {
    id: "ederson-fenerbahce",
    player: "Ederson",
    team: "Fenerbahce",
    league: "Turkish Super Lig",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/02/Ederson_Brazil_V_Morocco_13_June_2026-14_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ederson_(footballer,_born_1993)",
  },
  {
    id: "fred-fenerbahce",
    player: "Fred",
    team: "Fenerbahce",
    league: "Turkish Super Lig",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Fred_Brazil_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Fred_(footballer,_born_1993)",
  },
  {
    id: "talisca",
    player: "Talisca",
    team: "Fenerbahce",
    league: "Turkish Super Lig",
    role: "Attacker",
    position: "AM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Anderson_talisca-1527276212_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Anderson_Talisca",
  },
  {
    id: "callum-mcgregor",
    player: "Callum McGregor",
    team: "Celtic",
    league: "Scottish Premiership",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/11/Callum_McGregor_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Callum_McGregor",
  },
  {
    id: "kasper-schmeichel",
    player: "Kasper Schmeichel",
    team: "Celtic",
    league: "Scottish Premiership",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/95/Kasper_Schmeichel_Celtic-20240722_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Kasper_Schmeichel",
  },
  {
    id: "reo-hatate",
    player: "Reo Hatate",
    team: "Celtic",
    league: "Scottish Premiership",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8b/Celtic-20240722-037_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Reo_Hatate",
  },
  {
    id: "jhon-duran",
    player: "Jhon Duran",
    team: "Benfica",
    league: "Primeira Liga",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/74/Jhon_Dur%C3%A1n%2C_Esteghlal_FC_vs_Al-Nassr_FC_%28ACLElite%29%3B_3_Mar_2025.png",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jhon_Dur%C3%A1n",
  },
  {
    id: "vangelis-pavlidis",
    player: "Vangelis Pavlidis",
    team: "Benfica",
    league: "Primeira Liga",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9f/VangelisPavlidis.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Vangelis_Pavlidis",
  },
  {
    id: "fredrik-aursnes",
    player: "Fredrik Aursnes",
    team: "Benfica",
    league: "Primeira Liga",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Fredrik_Aursnes_France_v_Norway_26_June_26-148_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Fredrik_Aursnes",
  },
  {
    id: "diogo-costa",
    player: "Diogo Costa",
    team: "Porto",
    league: "Primeira Liga",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/45/Diogo_Costa_Croatia_v_Portugal_2_July_2026-188_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Diogo_Costa",
  },
  {
    id: "hans-vanaken",
    player: "Hans Vanaken",
    team: "Club Brugge",
    league: "Belgian Pro League",
    role: "Midfielder",
    position: "CAM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Hans_Vanaken_Lommel_United.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Hans_Vanaken",
  },
  {
    id: "yann-sommer",
    player: "Yann Sommer",
    team: "Club Brugge",
    league: "Belgian Pro League",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/16/Yann_Sommer_%281%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Yann_Sommer",
  },
  {
    id: "thomas-delaney",
    player: "Thomas Delaney",
    team: "F.C. Copenhagen",
    league: "Danish Superliga",
    role: "Midfielder",
    position: "CDM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c0/Delaney%2C_Thomas_Werder_17-18_WP_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Thomas_Delaney",
  },
  {
    id: "andreas-cornelius",
    player: "Andreas Cornelius",
    team: "F.C. Copenhagen",
    league: "Danish Superliga",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/88/Andreas_Cornelius_cropped.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Andreas_Cornelius",
  },
  {
    id: "jens-petter-hauge",
    player: "Jens Petter Hauge",
    team: "Bodo/Glimt",
    league: "Eliteserien",
    role: "Attacker",
    position: "LW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Jens_Petter_Hauge_France_v_Norway_26_June_26-016.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Jens_Petter_Hauge",
  },
  {
    id: "patrick-berg",
    player: "Patrick Berg",
    team: "Bodo/Glimt",
    league: "Eliteserien",
    role: "Midfielder",
    position: "CDM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Patrick_Berg_France_v_Norway_26_June_26-018.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Patrick_Berg",
  },
  {
    id: "hakon-evjen",
    player: "Hakon Evjen",
    team: "Bodo/Glimt",
    league: "Eliteserien",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/12/H%C3%A5kon_Evjen_2023.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/H%C3%A5kon_Evjen",
  },
  {
    id: "robin-olsen",
    player: "Robin Olsen",
    team: "Malmo FF",
    league: "Allsvenskan",
    role: "Goalkeeper",
    position: "GK",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/94/SWE-SWI_%288%29_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Robin_Olsen",
  },
  {
    id: "pontus-jansson",
    player: "Pontus Jansson",
    team: "Malmo FF",
    league: "Allsvenskan",
    role: "Defender",
    position: "CB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/47/Pontus_Jansson_%28Malm%C3%B6_FF%2C_2023%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Pontus_Jansson",
  },
  {
    id: "xherdan-shaqiri",
    player: "Xherdan Shaqiri",
    team: "FC Basel",
    league: "Swiss Super League",
    role: "Attacker",
    position: "AM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Xherdan_Shaqiri_2018.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Xherdan_Shaqiri",
  },
  {
    id: "james-tavernier",
    player: "James Tavernier",
    team: "Rangers",
    league: "Scottish Premiership",
    role: "Defender",
    position: "RB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/75/Tavernier_Rangers_Glasgow_2025.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/James_Tavernier",
  },
  {
    id: "nicolas-raskin",
    player: "Nicolas Raskin",
    team: "Rangers",
    league: "Scottish Premiership",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2b/Nicolas_Raskin_USMNT_v_Belgium_Mar_28_2026-14_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Nicolas_Raskin",
  },
  {
    id: "danylo-sikan",
    player: "Danylo Sikan",
    team: "Anderlecht",
    league: "Belgian Pro League",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/Shaktat_2020-2021_04_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Danylo_Sikan",
  },
  {
    id: "ludwig-augustinsson",
    player: "Ludwig Augustinsson",
    team: "Anderlecht",
    league: "Belgian Pro League",
    role: "Defender",
    position: "LB",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/08/UEFA_EURO_qualifiers_Sweden_vs_Romaina_20190323_Ludwig_Augustinsson_2_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Ludwig_Augustinsson",
  },
  {
    id: "oliver-antman",
    player: "Oliver Antman",
    team: "Anderlecht",
    league: "Belgian Pro League",
    role: "Attacker",
    position: "RW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1e/Oliver_Antman_%282022-06-03%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Oliver_Antman",
  },
  {
    id: "isco",
    player: "Isco",
    team: "Real Betis",
    league: "La Liga",
    role: "Midfielder",
    position: "AM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/32/Liver-RM_%285%29_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Isco",
  },
  {
    id: "antony",
    player: "Antony",
    team: "Real Betis",
    league: "La Liga",
    role: "Attacker",
    position: "RW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Antony_2022.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Antony_(footballer,_born_2000)",
  },
  {
    id: "ilkay-gundogan",
    player: "Ilkay Gundogan",
    team: "Galatasaray",
    league: "Turkish Super Lig",
    role: "Midfielder",
    position: "CM",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c7/20180602_FIFA_Friendly_Match_Austria_vs._Germany_%C4%B0lkay_G%C3%BCndo%C4%9Fan_850_0728.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/%C4%B0lkay_G%C3%BCndo%C4%9Fan",
  },
  {
    id: "leroy-sane",
    player: "Leroy Sane",
    team: "Galatasaray",
    league: "Turkish Super Lig",
    role: "Attacker",
    position: "LW",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0a/Leroy_Sane_Ecuador_v_Germany_25_June_2026-119_%28cropped%29.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Leroy_San%C3%A9",
  },
  {
    id: "victor-osimhen",
    player: "Victor Osimhen",
    team: "Galatasaray",
    league: "Turkish Super Lig",
    role: "Attacker",
    position: "ST",
    photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/Victor-osimhen-nigeria-2024-3-4.jpg",
    photoSourceName: "Wikipedia / Wikimedia Commons",
    photoSourceUrl: "https://en.wikipedia.org/wiki/Victor_Osimhen",
  },
];

const SUPPLEMENTAL_PROFILE_ROWS = [
  { season: "2025-26", league: "La Liga", Squad: "Barcelona", Player: "Lamine Yamal", Pos: "MF,FW", statType: "standard", MP: 28, Starts: 25, Min: 2218, "90s": 24.6, Gls: 16, Ast: 11, PublicProfileSource: "true" },
  { season: "2025-26", league: "EPL", Squad: "Man United", Player: "Bruno Fernandes", Pos: "MF", statType: "standard", MP: 32, Starts: 32, Min: 2799, "90s": 31.1, Gls: 8, Ast: 19, PublicProfileSource: "true" },
  { season: "2025-26", league: "La Liga", Squad: "Barcelona", Player: "Pedri", Pos: "MF", statType: "standard", MP: 26, Starts: 21, Min: 1901, "90s": 21.1, Gls: 2, Ast: 8, PublicProfileSource: "true" },
  { season: "2025-26", league: "La Liga", Squad: "Barcelona", Player: "Fermin Lopez", Pos: "MF", statType: "standard", MP: 28, Starts: 19, Min: 1662, "90s": 18.5, Gls: 6, Ast: 9, PublicProfileSource: "true" },
  { season: "2025-26", league: "La Liga", Squad: "Barcelona", Player: "Raphinha", Pos: "FW", statType: "standard", MP: 21, Starts: 15, Min: 1326, "90s": 14.7, Gls: 11, Ast: 3, PublicProfileSource: "true" },
  { season: "2025-26", league: "EPL", Squad: "Arsenal", Player: "David Raya", Pos: "GK", statType: "goalkeeping", MP: 36, Starts: 36, Min: 3240, "90s": 36, Saves: 60, PublicProfileSource: "true" },
  { season: "2025-26", league: "EPL", Squad: "Man City", Player: "Gianluigi Donnarumma", Pos: "GK", statType: "goalkeeping", MP: 32, Starts: 32, Min: 2880, "90s": 32, Saves: 74, PublicProfileSource: "true" },
  { season: "2025-26", league: "EPL", Squad: "Man United", Player: "Senne Lammens", Pos: "GK", statType: "goalkeeping", MP: 29, Starts: 29, Min: 2610, "90s": 29, Saves: 71, PublicProfileSource: "true" },
  { season: "2025-26", league: "La Liga", Squad: "Real Madrid", Player: "Thibaut Courtois", Pos: "GK", statType: "goalkeeping", MP: 31, Starts: 31, Min: 2790, "90s": 31, Saves: 70, PublicProfileSource: "true" },
  { season: "2025-26", league: "La Liga", Squad: "Atletico Madrid", Player: "Ademola Lookman", Pos: "FW,MF", statType: "standard", MP: 8, Starts: 6, Min: 495, "90s": 5.5, Gls: 3, Ast: 1, PublicProfileSource: "true" },
  { season: "2025-26", league: "Saudi Pro League", Squad: "Al-Nassr", Player: "Cristiano Ronaldo", Pos: "FW", statType: "standard", MP: 29, Starts: 29, Min: 2527, "90s": 28.1, Gls: 26, Ast: 2, PublicProfileSource: "true" },
  { season: "2025-26", league: "Saudi Pro League", Squad: "Al-Nassr", Player: "Cristiano Ronaldo", Pos: "FW", statType: "shooting", MP: 29, Starts: 29, Min: 2527, "90s": 28.1, Gls: 26, Sh: 171, SoT: 65, PublicProfileSource: "true" },
  { season: "2025-26", league: "MLS", Squad: "Inter Miami", Player: "Lionel Messi", Pos: "FW,MF", statType: "standard", MP: 13, Starts: 13, Min: 1170, "90s": 13, Gls: 13, Ast: 6, PublicProfileSource: "true" },
  { season: "2025-26", league: "MLS", Squad: "Inter Miami", Player: "Lionel Messi", Pos: "FW,MF", statType: "shooting", MP: 13, Starts: 13, Min: 1170, "90s": 13, Gls: 13, Sh: 81, SoT: 35, PublicProfileSource: "true" },
  { season: "2025-26", league: "Serie A", Squad: "Inter Milan", Player: "Marcus Thuram", Pos: "FW", statType: "standard", MP: 29, Starts: 29, Min: 1937, "90s": 21.26, Gls: 13, Ast: 6, PublicProfileSource: "true" },
  { season: "2025-26", league: "Serie A", Squad: "Inter Milan", Player: "Marcus Thuram", Pos: "FW", statType: "shooting", MP: 29, Starts: 29, Min: 1937, "90s": 21.26, Gls: 13, Sh: 74, SoT: 29, PublicProfileSource: "true" },
  { season: "2025-26", league: "Brasileirao Serie A", Squad: "Santos", Player: "Neymar Jr.", Pos: "MF,FW", statType: "standard", MP: 8, Starts: 8, Min: 686, "90s": 7.6, Gls: 4, Ast: 2, PublicProfileSource: "true" },
  { season: "2025-26", league: "Brasileirao Serie A", Squad: "Santos", Player: "Neymar Jr.", Pos: "MF,FW", statType: "shooting", MP: 8, Starts: 8, Min: 686, "90s": 7.6, Gls: 4, Sh: 21, SoT: 7, PublicProfileSource: "true" },
];

const INTERNATIONAL_PROFILE_BASELINES = {
  "erling-haaland": { team: "Norway", appearances: 49, goals: 55, updatedAt: "2026-03-31" },
  "kylian-mbappe": { team: "France", appearances: 96, goals: 56, updatedAt: "2026-03-29" },
  "vinicius-junior": { team: "Brazil", appearances: 47, goals: 8, updatedAt: "2026-04-01" },
  "lamine-yamal": { team: "Spain", appearances: 25, goals: 6, updatedAt: "2026-03-31" },
  "dominik-szoboszlai": { team: "Hungary", appearances: 63, goals: 17, updatedAt: "2026-03-31" },
  "harry-kane": { team: "England", appearances: 112, goals: 78, updatedAt: "2025-11-16" },
  "bukayo-saka": { team: "England", appearances: 48, goals: 14, updatedAt: "2025-11-17" },
  "bruno-fernandes": { team: "Portugal", appearances: 87, goals: 28, updatedAt: "2026-04-01" },
  "jude-bellingham": { team: "England", appearances: 46, goals: 6, updatedAt: "2025-11-17" },
  pedri: { team: "Spain", appearances: 40, goals: 5, updatedAt: "2026-03-31" },
  "jamal-musiala": { team: "Germany", appearances: 40, goals: 8, updatedAt: "2025-03-24" },
  "cole-palmer": { team: "England", appearances: 14, goals: 2, updatedAt: "2026-03-31" },
  "david-raya": { team: "Spain", appearances: 12, goals: 0, updatedAt: "2026-03-31" },
  "gianluigi-donnarumma": { team: "Italy", appearances: 81, goals: 0, updatedAt: "2026-03-31" },
  "jan-oblak": { team: "Slovenia", appearances: 82, goals: 0, updatedAt: "2025-11-16" },
  "thibaut-courtois": { team: "Belgium", appearances: 102, goals: 0, updatedAt: "2026-03-31" },
  "benjamin-sesko": { team: "Slovenia", appearances: 45, goals: 16, updatedAt: "2025-10-14" },
  "senne-lammens": { team: "Belgium", appearances: 2, goals: 0, updatedAt: "2026-03-28" },
  "matheus-cunha": { team: "Brazil", appearances: 21, goals: 1, updatedAt: "2026-05-03" },
  raphinha: { team: "Brazil", appearances: 37, goals: 11, updatedAt: "2026-03-27" },
  "fermin-lopez": { team: "Spain", appearances: 7, goals: 0, updatedAt: "2026-03-31" },
  "michael-olise": { team: "France", appearances: 15, goals: 4, updatedAt: "2026-03-30" },
  "ousmane-dembele": { team: "France", appearances: 58, goals: 7, updatedAt: "2026-03-26" },
  "desire-doue": { team: "France", appearances: 6, goals: 2, updatedAt: "2026-03-29" },
  "khvicha-kvaratskhelia": { team: "Georgia", appearances: 49, goals: 22, updatedAt: "2026-03-29" },
  "viktor-gyokeres": { team: "Sweden", appearances: 32, goals: 19, updatedAt: "2026-03-31" },
  "ademola-lookman": { team: "Nigeria", appearances: 43, goals: 11, updatedAt: "2026-03-31" },
  "phil-foden": { team: "England", appearances: 49, goals: 4, updatedAt: "2026-03-31" },
  "achraf-hakimi": { team: "Morocco", appearances: 95, goals: 11, updatedAt: "2026-03-31" },
  "cristiano-ronaldo": { team: "Portugal", appearances: 226, goals: 143, updatedAt: "2025-11-13" },
  "lionel-messi": { team: "Argentina", appearances: 198, goals: 116, updatedAt: "2026-04-01" },
  "marcus-thuram": { team: "France", appearances: 31, goals: 2, updatedAt: "2026-03-31" },
  "neymar-jr": { team: "Brazil", appearances: 128, goals: 79, updatedAt: "2026-03-31" },
};

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function integer(value) {
  return Math.round(numeric(value));
}

function readStore() {
  const data = readJsonWithFallback(PLAYER_PROFILE_STATS_PATH, SEEDED_PLAYER_PROFILE_STATS_PATH, null);
  if (!data) {
    return { updatedAt: "", entries: [] };
  }
  return { updatedAt: data.updatedAt || "", entries: Array.isArray(data.entries) ? data.entries : [] };
}

function writeStore(store) {
  writeJson(PLAYER_PROFILE_STATS_PATH, { ...store, updatedAt: new Date().toISOString() });
}

function profileById(profileId) {
  return PLAYER_PROFILES.find((profile) => profile.id === profileId);
}

function emptyTotals() {
  return { appearances: 0, starts: 0, minutes: 0, shots: 0, shotsOnTarget: 0, goals: 0, assists: 0, saves: 0 };
}

function totalsWithRates(totals) {
  const nineties = totals.minutes ? totals.minutes / 90 : totals.appearances;
  return {
    ...totals,
    nineties,
    goalsPer90: nineties ? totals.goals / nineties : 0,
    assistsPer90: nineties ? totals.assists / nineties : 0,
    shotsPer90: nineties ? totals.shots / nineties : 0,
    shotsOnTargetPer90: nineties ? totals.shotsOnTarget / nineties : 0,
    savesPer90: nineties ? totals.saves / nineties : 0,
  };
}

function combineTotals(...totalsList) {
  const totals = totalsList.reduce((sum, totals) => {
    sum.appearances += numeric(totals?.appearances);
    sum.starts += numeric(totals?.starts);
    sum.minutes += numeric(totals?.minutes);
    sum.shots += integer(totals?.shots);
    sum.shotsOnTarget += integer(totals?.shotsOnTarget);
    sum.goals += integer(totals?.goals);
    sum.assists += integer(totals?.assists);
    sum.saves += integer(totals?.saves);
    return sum;
  }, emptyTotals());
  return totalsWithRates(totals);
}

function totalsForEntries(entries) {
  const totals = entries.reduce(
    (sum, entry) => {
      sum.appearances += 1;
      sum.starts += entry.started ? 1 : 0;
      sum.minutes += numeric(entry.minutes);
      sum.shots += integer(entry.shots);
      sum.shotsOnTarget += integer(entry.shotsOnTarget);
      sum.goals += integer(entry.goals);
      sum.assists += integer(entry.assists);
      sum.saves += integer(entry.saves);
      return sum;
    },
    emptyTotals()
  );
  return totalsWithRates(totals);
}

function entriesForProfile(store, profileId, context = "club", season = "") {
  return store.entries
    .filter((entry) => entry.profileId === profileId && (entry.context || "club") === context)
    .filter((entry) => !season || entry.season === season)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function readImportedRows() {
  if (!fs.existsSync(IMPORTED_PLAYER_STATS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(IMPORTED_PLAYER_STATS_PATH, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(data.rows) ? data.rows : [];
}

function readWorldCupRows() {
  if (!fs.existsSync(WORLD_CUP_PLAYER_STATS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(WORLD_CUP_PLAYER_STATS_PATH, "utf8").replace(/^\uFEFF/, ""));
  return Array.isArray(data.rows) ? data.rows : [];
}

function readApiFootballRows() {
  if (!fs.existsSync(API_FOOTBALL_PLAYER_STATS_PATH)) return [];
  return readApiFootballPlayerStats().rows || [];
}

function supplementalProfileRows() {
  return SUPPLEMENTAL_PROFILE_ROWS.map((row) => ({ ...row }));
}

function recordProfileTotals(profileId, context = "club", season = "2025-26") {
  const profile = profileById(profileId);
  if (!profile) return totalsWithRates(emptyTotals());
  const store = readStore();
  const baselineTotals = importedBaselineForProfile(profile, season).totals;
  return combineTotals(baselineTotals, totalsForEntries(entriesForProfile(store, profileId, context, season)));
}

function importedBaselineForProfile(profile, season = "2025-26") {
  const { aggregatePlayers, normalizePlayerName } = require("./playerStats");
  const profilePlayer = normalizePlayerName(profile.player);
  const profileTeam = normalizeTeamName(profile.team);
  const importedPlayer = aggregatePlayers([...readImportedRows(), ...supplementalProfileRows(), ...readApiFootballRows()]).find(
    (player) =>
      player.season === season &&
      player.league === profile.league &&
      player.squad === profileTeam &&
      normalizePlayerName(player.player) === profilePlayer
  );

  if (!importedPlayer) {
    return {
      totals: totalsWithRates(emptyTotals()),
      source: "No imported screenshot baseline yet",
      sourceTypes: [],
      sourceLabels: [],
      hasBaseline: false,
    };
  }

  const totals = totalsWithRates({
    appearances: importedPlayer.appearances,
    starts: importedPlayer.starts,
    minutes: importedPlayer.minutes,
    goals: importedPlayer.goals,
    assists: importedPlayer.assists,
    shots: importedPlayer.shots,
    shotsOnTarget: importedPlayer.shotsOnTarget,
    saves: importedPlayer.saves,
  });
  const sourceTypes = importedPlayer.sourceTypes || [];
  const sourceLabels = importedPlayer.sourceLabels || [];
  return {
    totals,
    source: `${sourceLabels.join("+") || "FBref"} ${sourceTypes.join("+") || "stats"} baseline`,
    sourceTypes,
    sourceLabels,
    hasBaseline: true,
  };
}

function estimatedInternationalVolume(profile, baseline, clubTotals = emptyTotals()) {
  const appearances = numeric(baseline.appearances);
  const goals = integer(baseline.goals);
  const isGoalkeeper = profile.role === "Goalkeeper";
  const isDefender = profile.role === "Defender";
  const clubNineties = numeric(clubTotals.nineties);
  const clubAssistsPer90 = clubNineties ? numeric(clubTotals.assists) / clubNineties : 0;
  const clubShotsPer90 = clubNineties ? numeric(clubTotals.shots) / clubNineties : 0;
  const clubSotPer90 = clubNineties ? numeric(clubTotals.shotsOnTarget) / clubNineties : 0;
  const clubSavesPer90 = clubNineties ? numeric(clubTotals.saves) / clubNineties : 0;
  const goalRate = appearances ? goals / appearances : 0;
  const fallbackShotsPerCap = isGoalkeeper ? 0 : isDefender ? Math.max(0.35, goalRate * 3.2) : Math.max(1.2, goalRate * 4.6);
  const shotsPerCap = clubShotsPer90 > 0 ? clubShotsPer90 : fallbackShotsPerCap;
  const sotPerCap = clubSotPer90 > 0 ? clubSotPer90 : shotsPerCap * (isDefender ? 0.32 : 0.42);
  const assistsPerCap = isGoalkeeper ? 0 : Math.max(clubAssistsPer90, Math.max(0.03, goalRate * 0.42));

  return {
    assists: baseline.assists !== undefined ? integer(baseline.assists) : Math.round(assistsPerCap * appearances),
    shots: baseline.shots !== undefined ? integer(baseline.shots) : Math.round(shotsPerCap * appearances),
    shotsOnTarget: baseline.shotsOnTarget !== undefined ? integer(baseline.shotsOnTarget) : Math.max(goals, Math.round(sotPerCap * appearances)),
    saves: baseline.saves !== undefined ? integer(baseline.saves) : isGoalkeeper ? Math.round(Math.max(clubSavesPer90, 1.2) * appearances) : 0,
  };
}

function profileNameKey(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\bmbappe\b/g, "mbappe")
    .replace(/\bvinicius junior\b/g, "vinicius junior");
}

function worldCupBaselineForProfile(profile, nationalTeam) {
  if (!nationalTeam) return null;
  const targetPlayer = profileNameKey(profile.player);
  const targetTeam = normalizeTeamName(nationalTeam);
  const rows = readWorldCupRows().filter(
    (row) =>
      row.league === "International" &&
      normalizeTeamName(row.Squad) === targetTeam &&
      profileNameKey(row.Player) === targetPlayer
  );
  if (!rows.length) return null;

  const totals = totalsWithRates(
    rows.reduce(
      (sum, row) => {
        sum.appearances += numeric(row.MP);
        sum.starts += numeric(row.Starts);
        sum.minutes += numeric(row.Min) || numeric(row["90s"]) * 90;
        sum.goals += integer(row.Gls);
        sum.assists += integer(row.Ast);
        sum.saves += integer(row.Saves);
        return sum;
      },
      emptyTotals()
    )
  );
  return {
    totals,
    source: `FBref World Cup standard stats imported from 2018/2022 screenshots (${rows.map((row) => row.season).sort().join(", ")}). Shots, SOT, and saves stay at zero until World Cup shooting/goalkeeping screenshots are imported.`,
    sourceTypes: ["world-cup-standard"],
    sourceLabels: ["FBref screenshots"],
    hasBaseline: true,
    seasons: rows.map((row) => row.season).sort(),
  };
}

function internationalBaselineForProfile(profile, season = "2025-26") {
  const baseline = INTERNATIONAL_PROFILE_BASELINES[profile.id] || {};
  const worldCupBaseline = worldCupBaselineForProfile(profile, baseline.team);
  if (worldCupBaseline) {
    return {
      team: baseline.team || "",
      league: "International",
      competitionScope: "FIFA World Cup 2018/2022",
      totals: worldCupBaseline.totals,
      source: worldCupBaseline.source,
      sourceTypes: worldCupBaseline.sourceTypes,
      sourceLabels: worldCupBaseline.sourceLabels,
      hasBaseline: true,
      updatedAt: "2026-05-18",
    };
  }
  const clubBaseline = importedBaselineForProfile(profile, season);
  const volume = estimatedInternationalVolume(profile, baseline, clubBaseline.totals);
  const totals = totalsWithRates({
    appearances: baseline.appearances || 0,
    starts: 0,
    minutes: 0,
    goals: baseline.goals || 0,
    assists: volume.assists,
    shots: volume.shots,
    shotsOnTarget: volume.shotsOnTarget,
    saves: volume.saves,
  });
  return {
    team: baseline.team || "",
    league: "International",
    competitionScope: "Senior national team",
    totals,
    source: baseline.team
      ? `Wikipedia senior international caps/goals baseline, updated ${baseline.updatedAt || "unknown date"}. Assists, shots, SOT, saves, and per-90 volume are provisional estimates from the player's latest club/profile rates until match-level World Cup/Euros/friendly logs are imported.`
      : "No senior international baseline yet",
    sourceTypes: baseline.team ? ["caps-goals"] : [],
    sourceLabels: baseline.team ? ["Wikipedia"] : [],
    hasBaseline: Boolean(baseline.team),
    updatedAt: baseline.updatedAt || "",
  };
}

function listPlayerProfiles(options = {}) {
  const season = options.season || "2025-26";
  const store = readStore();
  return {
    updatedAt: store.updatedAt,
    profileCount: PLAYER_PROFILES.length,
    entryCount: store.entries.length,
    season,
    profiles: PLAYER_PROFILES.map((profile) => {
      const entries = entriesForProfile(store, profile.id, "club", season);
      const internationalEntries = entriesForProfile(store, profile.id, "international", season);
      const manualTotals = totalsForEntries(entries);
      const internationalManualTotals = totalsForEntries(internationalEntries);
      const importedBaseline = importedBaselineForProfile(profile, season);
      const internationalBaseline = internationalBaselineForProfile(profile, season);
      return {
        ...profile,
        team: normalizeTeamName(profile.team),
        totals: combineTotals(importedBaseline.totals, manualTotals),
        importedBaseline,
        manualTotals,
        latestEntries: entries.slice(0, 5),
        internationalProfile: {
          team: internationalBaseline.team,
          league: internationalBaseline.league,
          role: profile.role,
          position: profile.position,
          totals: combineTotals(internationalBaseline.totals, internationalManualTotals),
          importedBaseline: internationalBaseline,
          manualTotals: internationalManualTotals,
          latestEntries: internationalEntries.slice(0, 5),
        },
      };
    }),
  };
}

function addPlayerStatEntry(profileId, body = {}) {
  const profile = profileById(profileId);
  if (!profile) return null;
  const store = readStore();
  const entry = playerStatEntryFromBody(profile, body);
  store.entries.push(entry);
  writeStore(store);
  return entry;
}

function playerStatEntryFromBody(profile, body = {}, existing = {}) {
  return {
    ...existing,
    id: `player_stat_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    profileId: profile.id,
    context: body.context === "international" ? "international" : "club",
    player: profile.player,
    team: body.context === "international" ? INTERNATIONAL_PROFILE_BASELINES[profile.id]?.team || "" : normalizeTeamName(profile.team),
    league: body.context === "international" ? "International" : profile.league,
    role: profile.role,
    season: body.season || "2025-26",
    date: body.date || new Date().toISOString().slice(0, 10),
    opponent: String(body.opponent || "").trim(),
    venue: body.venue || "",
    started: Boolean(body.started),
    minutes: numeric(body.minutes),
    shots: integer(body.shots),
    shotsOnTarget: integer(body.shotsOnTarget),
    goals: integer(body.goals),
    assists: integer(body.assists),
    saves: profile.role === "Goalkeeper" ? integer(body.saves) : 0,
    notes: String(body.notes || "").trim(),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: existing.id ? new Date().toISOString() : existing.updatedAt,
  };
}

function updatePlayerStatEntry(profileId, entryId, body = {}) {
  const profile = profileById(profileId);
  if (!profile) return null;
  const store = readStore();
  const index = store.entries.findIndex((entry) => entry.id === entryId && entry.profileId === profile.id);
  if (index === -1) return null;
  const updated = {
    ...playerStatEntryFromBody(profile, body, store.entries[index]),
    id: store.entries[index].id,
  };
  store.entries[index] = updated;
  writeStore(store);
  return updated;
}

function manualPlayerRows() {
  const store = readStore();
  const rows = [];
  for (const profile of PLAYER_PROFILES) {
    const entries = entriesForProfile(store, profile.id, "club");
    if (!entries.length) continue;
    const totals = totalsForEntries(entries);
    const base = {
      season: "2025-26",
      league: profile.league,
      Squad: normalizeTeamName(profile.team),
      Player: profile.player,
      Pos: profile.position,
      MP: totals.appearances,
      Starts: totals.starts,
      Min: Math.round(totals.minutes),
      "90s": Number(totals.nineties.toFixed(1)),
      ManualProfileSource: "true",
    };
    rows.push({
      ...base,
      statType: "standard",
      Gls: totals.goals,
      Ast: totals.assists,
      "G+A": totals.goals + totals.assists,
    });
    rows.push({
      ...base,
      statType: "shooting",
      Gls: totals.goals,
      Sh: totals.shots,
      SoT: totals.shotsOnTarget,
    });
    if (profile.role === "Goalkeeper") {
      rows.push({
        ...base,
        statType: "goalkeeping",
        Saves: totals.saves,
      });
    }
  }
  return rows;
}

module.exports = {
  PLAYER_PROFILE_STATS_PATH,
  PLAYER_PROFILES,
  addPlayerStatEntry,
  listPlayerProfiles,
  manualPlayerRows,
  recordProfileTotals,
  supplementalProfileRows,
  updatePlayerStatEntry,
};
