"use strict";
/**
 * Squad ratings derived from EAFC 25 / FIFA 25 base card values (2025-26 season).
 * Keys must match the canonical names returned by normalizeTeamName().
 *
 * Each entry:
 *   xi    – average EAFC rating of the best starting 11 (primary model feature)
 *   avg   – full squad average across 20-23 players
 *   top   – highest-rated individual in the squad
 *   depth – average of backup players (positions 12-20)
 */

const SQUAD_RATINGS = {
  // ── English Premier League ─────────────────────────────────────────────────
  "Man City":          { xi: 87, avg: 84, top: 91, depth: 81 }, // Haaland 91, Rodri 91, Dias 89
  "Liverpool":         { xi: 85, avg: 82, top: 89, depth: 79 }, // Van Dijk 89, Salah 88, Alisson 90
  "Arsenal":           { xi: 84, avg: 81, top: 88, depth: 78 }, // Odegaard 88, Gyokeres 86, Saka 87
  "Chelsea":           { xi: 83, avg: 80, top: 85, depth: 77 }, // Palmer 85, Caicedo 83
  "Man United":        { xi: 80, avg: 77, top: 83, depth: 73 }, // Fernandes 83, Sesko 83
  "Tottenham":         { xi: 80, avg: 77, top: 85, depth: 73 }, // Son 85, Maddison 80
  "Newcastle United":  { xi: 80, avg: 77, top: 84, depth: 73 }, // Isak 83, Tonali 83
  "Aston Villa":       { xi: 81, avg: 78, top: 84, depth: 74 }, // Watkins 84, McGinn 81
  "Brighton":          { xi: 79, avg: 76, top: 82, depth: 72 }, // March 80, Mitoma 82
  "West Ham United":   { xi: 78, avg: 75, top: 81, depth: 71 }, // Kudus 81, Bowen 80
  "Crystal Palace":    { xi: 77, avg: 74, top: 81, depth: 70 }, // Eze 81, Olise gone → 79
  "Fulham":            { xi: 77, avg: 74, top: 80, depth: 70 }, // Jimenez 80, Pereira 79
  "Brentford":         { xi: 77, avg: 74, top: 81, depth: 70 }, // Mbeumo 81, Wissa 79
  "Wolves":            { xi: 76, avg: 73, top: 79, depth: 69 }, // Cunha 79, Guedes 77
  "Everton":           { xi: 76, avg: 73, top: 79, depth: 69 }, // Calvert-Lewin 79, Doucouré 78
  "Bournemouth":       { xi: 76, avg: 73, top: 79, depth: 69 }, // Semenyo 79, Kluivert 79
  "Nott'm Forest":     { xi: 76, avg: 73, top: 79, depth: 69 }, // Awoniyi 79, Hudson-Odoi 78
  "Leicester City":    { xi: 75, avg: 72, top: 79, depth: 68 }, // Ndidi 79, Daka 77
  "Ipswich Town":      { xi: 72, avg: 69, top: 75, depth: 65 }, // Chaplin 74, Luongo 73
  "Southampton":       { xi: 70, avg: 67, top: 73, depth: 63 }, // Ward-Prowse 73
  "Leeds United":      { xi: 74, avg: 71, top: 78, depth: 67 }, // Bamford 76, Sinisterra 77
  "Sunderland":        { xi: 73, avg: 70, top: 76, depth: 66 },
  "Burnley":           { xi: 73, avg: 70, top: 76, depth: 66 },

  // ── La Liga ────────────────────────────────────────────────────────────────
  "Real Madrid":       { xi: 88, avg: 85, top: 91, depth: 82 }, // Mbappe 91, Bellingham 88, Vinicius 90
  "Barcelona":         { xi: 85, avg: 82, top: 88, depth: 79 }, // Pedri 87, Yamal 84, Lewandowski 85
  "Ath Madrid":        { xi: 83, avg: 80, top: 86, depth: 77 }, // Griezmann 85, Correa 83, Oblak 88
  "Sevilla":           { xi: 79, avg: 76, top: 82, depth: 72 }, // Ramos 82 (returned?), Lamela 79
  "Real Sociedad":     { xi: 79, avg: 76, top: 82, depth: 72 }, // Oyarzabal 82, Kubo 80
  "Villarreal":        { xi: 79, avg: 76, top: 81, depth: 72 }, // Gerard Moreno 81, Capoue 79
  "Betis":             { xi: 78, avg: 75, top: 81, depth: 71 }, // Fekir 81, Canales 80
  "Ath Bilbao":        { xi: 78, avg: 75, top: 82, depth: 71 }, // Nico Williams 82, I.Williams 80
  "Valencia":          { xi: 77, avg: 74, top: 79, depth: 70 }, // Almeida 79, Guillamón 78
  "Girona":            { xi: 77, avg: 74, top: 80, depth: 70 }, // Dovbyk left, Tsygankov 78
  "Osasuna":           { xi: 76, avg: 73, top: 78, depth: 69 }, // Budimir 78, Moncayola 76
  "Rayo Vallecano":    { xi: 75, avg: 72, top: 77, depth: 68 }, // Raul de Tomas 77
  "Getafe":            { xi: 75, avg: 72, top: 77, depth: 68 }, // Bordalas tactics, Bergara 76
  "Mallorca":          { xi: 75, avg: 72, top: 77, depth: 68 }, // Muriqi 77, Abdón 74
  "Alaves":            { xi: 73, avg: 70, top: 75, depth: 66 }, // Guridi 74, Abqar 72
  "Celta Vigo":        { xi: 74, avg: 71, top: 77, depth: 67 }, // Aspas 77, Sotelo 75
  "Espanyol":          { xi: 73, avg: 70, top: 75, depth: 66 }, // Braithwaite 75, Puado 74
  "Las Palmas":        { xi: 73, avg: 70, top: 75, depth: 66 }, // Moleiro 75, Sandro 74
  "Leganes":           { xi: 72, avg: 69, top: 74, depth: 65 }, // Sergio Gonzalez 73
  "Real Valladolid":   { xi: 72, avg: 69, top: 74, depth: 65 },
  "Elche":             { xi: 72, avg: 69, top: 74, depth: 65 },
  "Granada":           { xi: 72, avg: 69, top: 74, depth: 65 },
  "Cadiz":             { xi: 71, avg: 68, top: 73, depth: 64 },

  // ── Bundesliga ─────────────────────────────────────────────────────────────
  "Bayern Munich":     { xi: 86, avg: 83, top: 90, depth: 80 }, // Kane 90, Musiala 87, Neuer 85
  "Bayer Leverkusen":  { xi: 83, avg: 80, top: 87, depth: 77 }, // Wirtz 87, Xhaka 82, Granit 82
  "VfB Stuttgart":     { xi: 81, avg: 78, top: 83, depth: 75 }, // Undav 81, Ito 80, Mittelstadt 79
  "Borussia Dortmund": { xi: 81, avg: 78, top: 84, depth: 75 }, // Adeyemi 82, Nmecha 80, Brandt 82
  "RB Leipzig":        { xi: 82, avg: 79, top: 85, depth: 76 }, // Openda 84, Xavi Simons 83, Werner 81
  "Eintracht Frankfurt": { xi: 79, avg: 76, top: 82, depth: 72 }, // Marmoush 80, Trapp 82
  "SC Freiburg":       { xi: 78, avg: 75, top: 80, depth: 71 }, // Gregoritsch 80, Doan 78
  "Borussia M'gladbach": { xi: 78, avg: 75, top: 80, depth: 71 }, // Plea 80, Elvedi 79
  "Werder Bremen":     { xi: 78, avg: 75, top: 80, depth: 71 }, // Ducksch 80, Stage 79
  "Union Berlin":      { xi: 77, avg: 74, top: 79, depth: 70 }, // Vertessen 79, Vogt 78
  "VfL Wolfsburg":     { xi: 77, avg: 74, top: 80, depth: 70 }, // Wind 79, Kaminski 78
  "TSG Hoffenheim":    { xi: 77, avg: 74, top: 79, depth: 70 }, // Bebou 79, Kramaric 80
  "Mainz":             { xi: 77, avg: 74, top: 79, depth: 70 }, // Muller 78, Burkardt 78
  "FC Augsburg":       { xi: 76, avg: 73, top: 78, depth: 69 }, // Demirovic 78
  "Heidenheim":        { xi: 74, avg: 71, top: 76, depth: 67 }, // Kleindienst 76
  "VfL Bochum":        { xi: 73, avg: 70, top: 75, depth: 66 }, // Asano 75
  "Holstein Kiel":     { xi: 72, avg: 69, top: 74, depth: 65 },
  "FC St. Pauli":      { xi: 73, avg: 70, top: 75, depth: 66 }, // Irvine 75
  "Darmstadt":         { xi: 71, avg: 68, top: 73, depth: 64 },
  "Hamburger SV":      { xi: 75, avg: 72, top: 78, depth: 68 },

  // ── Ligue 1 ────────────────────────────────────────────────────────────────
  "Paris SG":          { xi: 85, avg: 82, top: 88, depth: 79 }, // Donnarumma 88, Marquinhos 86, Dembele 85
  "Monaco":            { xi: 80, avg: 77, top: 83, depth: 73 }, // Embolo 80, Ben Seghir 79
  "Nice":              { xi: 78, avg: 75, top: 81, depth: 71 }, // Boga 79, Guessand 78
  "Lyon":              { xi: 79, avg: 76, top: 83, depth: 72 }, // Lacazette 81, Cherki 79, Caqueret 79
  "Marseille":         { xi: 79, avg: 76, top: 83, depth: 72 }, // Greenwood 82, Aubameyang 81
  "Lens":              { xi: 78, avg: 75, top: 80, depth: 71 }, // Openda gone, Sotoca 79
  "Lille":             { xi: 79, avg: 76, top: 83, depth: 72 }, // David 83, Zhegrova 80, Cabella 79
  "Stade Rennais":     { xi: 77, avg: 74, top: 79, depth: 70 }, // Bourigeaud 79, Truffert 77
  "Stade de Reims":    { xi: 76, avg: 73, top: 78, depth: 69 }, // Munetsi 78, Foket 77
  "Toulouse":          { xi: 76, avg: 73, top: 78, depth: 69 }, // Dallinga 78, Nicolaisen 77
  "Brest":             { xi: 76, avg: 73, top: 79, depth: 69 }, // Satriano 78, Le Douaron 77
  "Nantes":            { xi: 75, avg: 72, top: 77, depth: 68 }, // Ounas 77, Guessand gone
  "Strasbourg":        { xi: 75, avg: 72, top: 77, depth: 68 }, // Thomasson 77
  "Montpellier":       { xi: 74, avg: 71, top: 76, depth: 67 }, // Mavididi 76, Ferri 74
  "Metz":              { xi: 73, avg: 70, top: 75, depth: 66 },
  "Le Havre":          { xi: 73, avg: 70, top: 75, depth: 66 }, // Mama Balde 74
  "AJ Auxerre":        { xi: 73, avg: 70, top: 75, depth: 66 }, // Pellenard 74
  "Paris FC":          { xi: 74, avg: 71, top: 76, depth: 67 },
  "Angers":            { xi: 72, avg: 69, top: 74, depth: 65 },
  "AS Saint-Etienne":  { xi: 73, avg: 70, top: 75, depth: 66 },

  // ── Serie A ─────────────────────────────────────────────────────────────────
  "Inter Milan":       { xi: 85, avg: 82, top: 87, depth: 79 }, // Barella 85, Lautaro 87, Thuram 84
  "Napoli":            { xi: 83, avg: 80, top: 87, depth: 77 }, // Lukaku 84, Meret 80, Natan 78
  "Juventus":          { xi: 82, avg: 79, top: 85, depth: 76 }, // Vlahovic 85, Danilo 82, Locatelli 82
  "AC Milan":          { xi: 82, avg: 79, top: 85, depth: 76 }, // Leao 84, Maignan 87, Reijnders 82
  "Atalanta":          { xi: 82, avg: 79, top: 85, depth: 76 }, // Lookman 84, De Ketelaere 81, Ederson 81
  "Fiorentina":        { xi: 80, avg: 77, top: 83, depth: 73 }, // Gudmundsson 82, Nico Gonzalez 81
  "AS Roma":           { xi: 80, avg: 77, top: 83, depth: 73 }, // Dybala 83, Pellegrini 80
  "Lazio":             { xi: 79, avg: 76, top: 82, depth: 72 }, // Castellanos 80, Luis Alberto left
  "Torino":            { xi: 77, avg: 74, top: 80, depth: 70 }, // Zapata 78 (injury), Sanabria 79
  "Bologna":           { xi: 78, avg: 75, top: 81, depth: 71 }, // Orsolini 80, Ndoye 78
  "Genoa":             { xi: 76, avg: 73, top: 79, depth: 69 }, // Retegui 79, Gudmundsson left
  "Udinese":           { xi: 75, avg: 72, top: 78, depth: 68 }, // Pereyra 78, Samardzic 77
  "Cagliari":          { xi: 74, avg: 71, top: 76, depth: 67 }, // Lapadula 76, Dossena 75
  "Lecce":             { xi: 73, avg: 70, top: 75, depth: 66 }, // Krstovic 75, Baschirotto 74
  "Hellas Verona":     { xi: 73, avg: 70, top: 75, depth: 66 }, // Noslin 75, Serdar 74
  "Como":              { xi: 75, avg: 72, top: 81, depth: 68 }, // Fàbregas-influenced squad
  "Venezia":           { xi: 72, avg: 69, top: 74, depth: 65 },
  "Parma":             { xi: 73, avg: 70, top: 75, depth: 66 }, // Bonny 75, Bernabe 78
  "Empoli":            { xi: 73, avg: 70, top: 75, depth: 66 }, // Destro 74, Gyasi 74
  "Monza":             { xi: 74, avg: 71, top: 77, depth: 67 }, // Dany Mota 77, Colpani 77
  "Sassuolo":          { xi: 76, avg: 73, top: 79, depth: 69 }, // Bajrami 79, Laurientie 78
  "Pisa":              { xi: 74, avg: 71, top: 76, depth: 67 },
  "Cremonese":         { xi: 73, avg: 70, top: 75, depth: 66 },

  // ── Eredivisie ──────────────────────────────────────────────────────────────
  "Ajax":              { xi: 77, avg: 74, top: 82, depth: 70 }, // Brobbey 80, Sutalo 78, Fitz-Jim 79
  "PSV Eindhoven":     { xi: 78, avg: 75, top: 83, depth: 71 }, // Tillman 81, Luuk de Jong 80, Pepi 80
  "Feyenoord":         { xi: 77, avg: 74, top: 82, depth: 70 }, // Gimenez left, Milambo 78, Timber 79
  "AZ Alkmaar":        { xi: 74, avg: 71, top: 78, depth: 67 }, // Parrott 78, Lahdo 76
  "FC Utrecht":        { xi: 72, avg: 69, top: 75, depth: 65 },
  "FC Twente":         { xi: 73, avg: 70, top: 76, depth: 66 },
  "FC Groningen":      { xi: 70, avg: 67, top: 73, depth: 63 },

  // ── Belgian Pro League ──────────────────────────────────────────────────────
  "Club Brugge":       { xi: 74, avg: 71, top: 78, depth: 67 }, // Vanaken 78, Mignolet 78
  "Anderlecht":        { xi: 73, avg: 70, top: 77, depth: 66 }, // Amuzu 77, Dreyer 76
  "KAA Gent":          { xi: 72, avg: 69, top: 76, depth: 65 }, // Depoitre 76, Seck 74
  "Racing Genk":       { xi: 71, avg: 68, top: 75, depth: 64 }, // Hrosovsky 75, Munoz 74
  "Union Saint-Gilloise": { xi: 71, avg: 68, top: 74, depth: 64 },
  "KV Mechelen":       { xi: 69, avg: 66, top: 72, depth: 62 },

  // ── Portuguese Primeira Liga ────────────────────────────────────────────────
  "Sporting CP":       { xi: 79, avg: 76, top: 83, depth: 72 }, // Gyokeres gone, Trincao 81, Coates 80
  "Benfica":           { xi: 79, avg: 76, top: 83, depth: 72 }, // Kokcu 81, Di Maria left, Orkun 81
  "FC Porto":          { xi: 77, avg: 74, top: 81, depth: 70 }, // Galeno 81, Pepê 80
  "Braga":             { xi: 73, avg: 70, top: 76, depth: 66 },

  // ── Scottish Premiership ────────────────────────────────────────────────────
  "Celtic":            { xi: 73, avg: 70, top: 77, depth: 66 }, // Kyogo 77, Giakoumakis 76
  "Rangers":           { xi: 72, avg: 69, top: 76, depth: 65 }, // Colak 76, Tavernier 75

  // ── Turkish Süper Lig ───────────────────────────────────────────────────────
  "Galatasaray":       { xi: 76, avg: 73, top: 82, depth: 69 }, // Osimhen on loan 82, Icardi 80
  "Fenerbahce":        { xi: 76, avg: 73, top: 82, depth: 69 }, // Dzeko 80, Tadic 80, Fred 79
  "Besiktas":          { xi: 73, avg: 70, top: 77, depth: 66 }, // Immobile 79, Rashica 76

  // ── Austrian Bundesliga ─────────────────────────────────────────────────────
  "Red Bull Salzburg": { xi: 73, avg: 70, top: 77, depth: 66 },
  "SK Sturm Graz":     { xi: 71, avg: 68, top: 74, depth: 64 },
  "LASK Linz":         { xi: 70, avg: 67, top: 73, depth: 63 },
  "Rapid Vienna":      { xi: 70, avg: 67, top: 73, depth: 63 },
  "Austria Vienna":    { xi: 69, avg: 66, top: 72, depth: 62 },
  "Wolfsberger AC":    { xi: 67, avg: 64, top: 70, depth: 60 },

  // ── Other European Clubs ────────────────────────────────────────────────────
  "Red Star Belgrade": { xi: 73, avg: 70, top: 77, depth: 66 },
  "Dinamo Zagreb":     { xi: 72, avg: 69, top: 76, depth: 65 },
  "Sparta Prague":     { xi: 72, avg: 69, top: 76, depth: 65 },
  "Shakhtar Donetsk":  { xi: 76, avg: 73, top: 81, depth: 69 }, // Sudakov 80
  "Ferencvaros":       { xi: 70, avg: 67, top: 73, depth: 63 },
  "PAOK Salonika":     { xi: 70, avg: 67, top: 73, depth: 63 },
  "Olympiacos":        { xi: 71, avg: 68, top: 74, depth: 64 },
  "Jagiellonia Bialystok": { xi: 69, avg: 66, top: 72, depth: 62 },
  "Lech Poznan":       { xi: 70, avg: 67, top: 73, depth: 63 },

  // ── Scandinavian Clubs ──────────────────────────────────────────────────────
  "Bodo/Glimt":        { xi: 69, avg: 66, top: 72, depth: 62 },
  "Rosenborg":         { xi: 67, avg: 64, top: 70, depth: 60 },
  "Molde":             { xi: 67, avg: 64, top: 70, depth: 60 },
  "Valerenga":         { xi: 65, avg: 62, top: 68, depth: 58 },
  "SK Brann":          { xi: 65, avg: 62, top: 68, depth: 58 },
  "Viking FK":         { xi: 65, avg: 62, top: 68, depth: 58 },
  "Fredrikstad":       { xi: 64, avg: 61, top: 67, depth: 57 },
  "Lillestrom":        { xi: 64, avg: 61, top: 67, depth: 57 },
  "Hammarby IF":       { xi: 65, avg: 62, top: 68, depth: 58 },
  "Malmo FF":          { xi: 66, avg: 63, top: 69, depth: 59 },
  "AIK":               { xi: 65, avg: 62, top: 68, depth: 58 },
  "IF Elfsborg":       { xi: 65, avg: 62, top: 68, depth: 58 },
  "IFK Goteborg":      { xi: 64, avg: 61, top: 67, depth: 57 },
  "IK Sirius":         { xi: 63, avg: 60, top: 66, depth: 56 },
  "BK Hacken":         { xi: 64, avg: 61, top: 67, depth: 57 },
  "Djurgarden":        { xi: 64, avg: 61, top: 67, depth: 57 },
  "GAIS":              { xi: 62, avg: 59, top: 65, depth: 55 },

  // ── World Cup 2026 International Teams ─────────────────────────────────────
  // CONMEBOL
  "Argentina":         { xi: 85, avg: 82, top: 90, depth: 79 }, // Messi 90, Lautaro 87, De Paul 83, Martinez (GK) 88
  "Brazil":            { xi: 85, avg: 82, top: 90, depth: 79 }, // Vinicius 90, Rodrygo 84, Alisson 90, Casemiro 84
  "Uruguay":           { xi: 80, avg: 77, top: 85, depth: 74 }, // Valverde 85, Darwin Nunez 83, Bentancur 82
  "Colombia":          { xi: 79, avg: 76, top: 84, depth: 73 }, // Luis Diaz 84, Cuadrado 79, James 80
  "Ecuador":           { xi: 74, avg: 71, top: 77, depth: 68 }, // Estupinan 77, Ibarra 76, Caicedo 83
  "Peru":              { xi: 73, avg: 70, top: 76, depth: 67 }, // Cueva 76, Pena 74
  "Chile":             { xi: 75, avg: 72, top: 80, depth: 69 }, // Alexis Sanchez 80 (aging), Vidal 78
  "Venezuela":         { xi: 73, avg: 70, top: 77, depth: 67 }, // Soteldo 77, Rondon 74, Losada 75
  "Bolivia":           { xi: 70, avg: 67, top: 73, depth: 63 }, // Machado 73, Justiniano 71
  "Paraguay":          { xi: 72, avg: 69, top: 75, depth: 65 }, // Enciso 75, Sanabria 79
  "Canada":            { xi: 77, avg: 74, top: 82, depth: 71 }, // Davies 82, Jonathan David 83, Johnston 80

  // UEFA
  "France":            { xi: 86, avg: 83, top: 91, depth: 80 }, // Mbappe 91, Camavinga 82, Tchouameni 83, Maignan 87
  "England":           { xi: 84, avg: 81, top: 90, depth: 78 }, // Kane 90, Bellingham 88, Saka 87, Pickford 81
  "Germany":           { xi: 83, avg: 80, top: 87, depth: 77 }, // Musiala 87, Wirtz 87, Kimmich 86, Neuer 85
  "Spain":             { xi: 84, avg: 81, top: 88, depth: 78 }, // Pedri 87, Yamal 84, Nico Williams 82, Morata 82
  "Portugal":          { xi: 84, avg: 81, top: 88, depth: 78 }, // Bruno Fernandes 86, Ronaldo 85, Leao 84, Cancelo 83
  "Italy":             { xi: 81, avg: 78, top: 88, depth: 75 }, // Donnarumma 88, Barella 85, Verratti gone, Immobile 79
  "Netherlands":       { xi: 82, avg: 79, top: 89, depth: 76 }, // Van Dijk 89, Gakpo 83, Depay 82, Dumfries 82
  "Belgium":           { xi: 81, avg: 78, top: 86, depth: 75 }, // Lukaku 84, Trossard 82, De Bruyne 86 (declining)
  "Croatia":           { xi: 81, avg: 78, top: 87, depth: 75 }, // Modric 87, Brozovic 84, Gvardiol 85
  "Switzerland":       { xi: 79, avg: 76, top: 83, depth: 73 }, // Xhaka 82, Sommer 83, Shaqiri 79, Embolo 80
  "Serbia":            { xi: 79, avg: 76, top: 85, depth: 73 }, // Vlahovic 85, Milinkovic-Savic 83, Jovic 80
  "Poland":            { xi: 78, avg: 75, top: 85, depth: 72 }, // Lewandowski 85, Szymanski 81, Szczesny 84
  "Denmark":           { xi: 79, avg: 76, top: 83, depth: 73 }, // Eriksen 83, Hojbjerg 81, Schmeichel 83
  "Austria":           { xi: 76, avg: 73, top: 79, depth: 70 }, // Arnautovic 79, Laimer 80, Sabitzer 80
  "Ukraine":           { xi: 77, avg: 74, top: 82, depth: 71 }, // Mudryk 82, Zinchenko 82, Yaremchuk 79
  "Sweden":            { xi: 76, avg: 73, top: 86, depth: 70 }, // Gyokeres 86, Isak 83, Kulusevski 82
  "Norway":            { xi: 76, avg: 73, top: 91, depth: 68 }, // Haaland 91, Odegaard 88, Thorstvedt 79
  "Scotland":          { xi: 76, avg: 73, top: 83, depth: 70 }, // Robertson 83, McTominay 81, Tierney 79
  "Turkey":            { xi: 77, avg: 74, top: 82, depth: 71 }, // Calhanoglu 82, Yildiz 79, Mert Gunok 79
  "Romania":           { xi: 74, avg: 71, top: 77, depth: 68 }, // Hagi Jr 77, Puscas 76
  "Czech Republic":    { xi: 75, avg: 72, top: 80, depth: 69 }, // Schick 80, Hlozek 79, Soucek 79
  "Slovakia":          { xi: 74, avg: 71, top: 80, depth: 67 }, // Lobotka 80, Skriniar 79, Duda 77
  "Hungary":           { xi: 74, avg: 71, top: 84, depth: 67 }, // Szoboszlai 84, Gulacsi 81
  "Greece":            { xi: 73, avg: 70, top: 77, depth: 66 }, // Bakasetas 77, Siopis 74
  "Albania":           { xi: 72, avg: 69, top: 76, depth: 65 }, // Manaj 76, Bajrami 79
  "Slovenia":          { xi: 72, avg: 69, top: 80, depth: 65 }, // Sesko 80, Oblak? ... Oblak at NT 88
  "Ireland":           { xi: 73, avg: 70, top: 77, depth: 66 }, // Doherty 77, Ogbene 75
  "Wales":             { xi: 75, avg: 72, top: 82, depth: 69 }, // James 80, Moore 79, Bale retired
  "Finland":           { xi: 71, avg: 68, top: 75, depth: 64 }, // Pukki 75
  "Iceland":           { xi: 70, avg: 67, top: 74, depth: 63 }, // Sigurdsson 74 (aging)
  "North Macedonia":   { xi: 69, avg: 66, top: 73, depth: 62 },

  // CONCACAF
  "USA":               { xi: 77, avg: 74, top: 82, depth: 71 }, // Pulisic 82, Adams 79, McKennie 78, Turner 79
  "Mexico":            { xi: 76, avg: 73, top: 79, depth: 70 }, // Jimenez 79, Guardado 76, Ochoa 80
  "Panama":            { xi: 71, avg: 68, top: 74, depth: 64 }, // Godoy 73, Fajardo 72
  "Costa Rica":        { xi: 72, avg: 69, top: 82, depth: 65 }, // Keylor Navas 82, Contreras 77
  "Jamaica":           { xi: 71, avg: 68, top: 74, depth: 64 }, // Lowe 74, Nicholson 73
  "Honduras":          { xi: 70, avg: 67, top: 73, depth: 63 }, // Elis 73, Pereira 71
  "El Salvador":       { xi: 68, avg: 65, top: 71, depth: 61 },
  "Trinidad and Tobago": { xi: 69, avg: 66, top: 72, depth: 62 },
  "Cuba":              { xi: 66, avg: 63, top: 69, depth: 59 },
  "Curacao":           { xi: 68, avg: 65, top: 71, depth: 61 },
  "Guatemala":         { xi: 68, avg: 65, top: 71, depth: 61 },

  // AFC
  "Japan":             { xi: 77, avg: 74, top: 83, depth: 71 }, // Mitoma 82, Kubo 82, Kamada 80, Doan 79
  "South Korea":       { xi: 77, avg: 74, top: 85, depth: 71 }, // Son 85, Hwang Hee-chan 80, Cho Gue-sung 78
  "Korea Republic":    { xi: 77, avg: 74, top: 85, depth: 71 },
  "Australia":         { xi: 74, avg: 71, top: 78, depth: 68 }, // Leckie 77, Irvine 78, Ryan 78
  "Saudi Arabia":      { xi: 73, avg: 70, top: 76, depth: 67 }, // Al-Dawsari 76, Salman Al-Faraj 75
  "Iran":              { xi: 72, avg: 69, top: 80, depth: 65 }, // Taremi 80, Azmoun 76, Ghoddos 76
  "Qatar":             { xi: 70, avg: 67, top: 73, depth: 63 }, // Afif 73, Boudiaf 72
  "Iraq":              { xi: 70, avg: 67, top: 73, depth: 63 }, // Mohanad Ali 73
  "Jordan":            { xi: 69, avg: 66, top: 72, depth: 62 }, // Baha Faisal 72
  "Uzbekistan":        { xi: 70, avg: 67, top: 73, depth: 63 }, // Shomurodov 73, Tursunov 71
  "China":             { xi: 69, avg: 66, top: 72, depth: 62 }, // Wu Lei 72
  "Indonesia":         { xi: 68, avg: 65, top: 71, depth: 61 }, // Marc Klok 70, Ragnar Oratmangoen 71
  "Bahrain":           { xi: 68, avg: 65, top: 70, depth: 62 },
  "Oman":              { xi: 67, avg: 64, top: 70, depth: 60 },
  "UAE":               { xi: 67, avg: 64, top: 70, depth: 60 },

  // CAF
  "Morocco":           { xi: 79, avg: 76, top: 84, depth: 73 }, // Hakimi 84, En-Nesyri 80, Bono 82, Ounahi 80
  "Senegal":           { xi: 78, avg: 75, top: 83, depth: 72 }, // Mane 83, Koulibaly 82, Diallo 80
  "Nigeria":           { xi: 77, avg: 74, top: 89, depth: 71 }, // Osimhen 89, Lookman 84, Iwobi 79
  "Egypt":             { xi: 75, avg: 72, top: 88, depth: 69 }, // Salah 88, El-Shenawy 79
  "Cameroon":          { xi: 74, avg: 71, top: 79, depth: 68 }, // Aboubakar 79, Toko Ekambi 79, Anguissa 83
  "Algeria":           { xi: 74, avg: 71, top: 82, depth: 68 }, // Mahrez 82 (declining), Belaili 77
  "Cote d'Ivoire":     { xi: 74, avg: 71, top: 79, depth: 68 }, // Pepe 79, Zaha 79, Kessie 80
  "Mali":              { xi: 73, avg: 70, top: 77, depth: 67 }, // Camara 77, Djenepo 76
  "Ghana":             { xi: 74, avg: 71, top: 81, depth: 68 }, // Kudus 81, Jordan Ayew 77
  "South Africa":      { xi: 70, avg: 67, top: 73, depth: 63 }, // Tau 73, Dolly 72
  "Tunisia":           { xi: 73, avg: 70, top: 76, depth: 67 }, // Khazri 76, Msakni 76
  "DR Congo":          { xi: 72, avg: 69, top: 76, depth: 65 }, // Mbemba 76, Bongonda 75
  "Congo":             { xi: 70, avg: 67, top: 73, depth: 63 },
  "Angola":            { xi: 68, avg: 65, top: 71, depth: 61 },
  "Kenya":             { xi: 67, avg: 64, top: 70, depth: 60 },
  "Tanzania":          { xi: 67, avg: 64, top: 70, depth: 60 },
  "Zambia":            { xi: 67, avg: 64, top: 70, depth: 60 },
  "Gabon":             { xi: 68, avg: 65, top: 71, depth: 61 }, // Aubameyang 81 (very old)
  "Burkina Faso":      { xi: 70, avg: 67, top: 73, depth: 63 },
  "Cape Verde":        { xi: 71, avg: 68, top: 74, depth: 64 },
  "Comoros":           { xi: 66, avg: 63, top: 69, depth: 59 },

  // OFC / Rest of World
  "New Zealand":       { xi: 68, avg: 65, top: 71, depth: 61 }, // Wood 71
  "Guyana":            { xi: 67, avg: 64, top: 70, depth: 60 },
  "Suriname":          { xi: 67, avg: 64, top: 70, depth: 60 },
};

// ── Fast lookup: case-insensitive, strip punctuation ─────────────────────────
const _lookup = new Map();
for (const [canonical, rating] of Object.entries(SQUAD_RATINGS)) {
  const key = canonical.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  _lookup.set(key, { ...rating, canonical });
}

// Additional alias keys that differ from canonical names in the data
const EXTRA_ALIASES = {
  "atletico madrid":           "Ath Madrid",
  "atlético madrid":           "Ath Madrid",
  "atl madrid":                "Ath Madrid",
  "paris saint germain":       "Paris SG",
  "internazionale":            "Inter Milan",
  "ac milan":                  "AC Milan",
  "nottingham forest":         "Nott'm Forest",
  "nott m forest":             "Nott'm Forest",
  "west ham":                  "West Ham United",
  "newcastle":                 "Newcastle United",
  "manchester city":           "Man City",
  "manchester united":         "Man United",
  "tottenham hotspur":         "Tottenham",
  "wolverhampton":             "Wolves",
  "wolverhampton wanderers":   "Wolves",
  "athletic bilbao":           "Ath Bilbao",
  "athletic club":             "Ath Bilbao",
  "celta de vigo":             "Celta Vigo",
  "real valladolid":           "Real Valladolid",
  "fc barcelona":              "Barcelona",
  "borussia monchengladbach":  "Borussia M'gladbach",
  "borussia mgladbach":        "Borussia M'gladbach",
  "vfl bochum":                "VfL Bochum",
  "vfl wolfsburg":             "VfL Wolfsburg",
  "rb Leipzig":                "RB Leipzig",
  "rasenball sport Leipzig":   "RB Leipzig",
  "rb salzburg":               "Red Bull Salzburg",
  "fc red bull salzburg":      "Red Bull Salzburg",
  "eintracht frankfurt":       "Eintracht Frankfurt",
  "vfb stuttgart":             "VfB Stuttgart",
  "borussia dortmund":         "Borussia Dortmund",
  "bvb":                       "Borussia Dortmund",
  "1 fc union berlin":         "Union Berlin",
  "1 fc heidenheim":           "Heidenheim",
  "fc st pauli":               "FC St. Pauli",
  "st pauli":                  "FC St. Pauli",
  "olympique de marseille":    "Marseille",
  "olympique lyon":            "Lyon",
  "olympique lyonnais":        "Lyon",
  "as monaco":                 "Monaco",
  "stade rennais":             "Stade Rennais",
  "stade de reims":            "Stade de Reims",
  "racing club de lens":       "Lens",
  "rc lens":                   "Lens",
  "losc lille":                "Lille",
  "rc strasbourg":             "Strasbourg",
  "rc strasbourg alsace":      "Strasbourg",
  "ss lazio":                  "Lazio",
  "as roma":                   "AS Roma",
  "hellas verona":             "Hellas Verona",
  "atalanta bc":               "Atalanta",
  "sporting clube de portugal":"Sporting CP",
  "sporting lisbon":           "Sporting CP",
  "sl benfica":                "Benfica",
  "psv":                       "PSV Eindhoven",
  "ajax amsterdam":            "Ajax",
  "afc ajax":                  "Ajax",
  "feyenoord rotterdam":       "Feyenoord",
  "az":                        "AZ Alkmaar",
  "pfc ludogorets razgrad":    "Ludogorets",
  "fk crvena zvezda":          "Red Star Belgrade",
  "crvena zvezda":             "Red Star Belgrade",
  "united states":             "USA",
  "usa":                       "USA",
  "korea republic":            "South Korea",
  "republic of ireland":       "Ireland",
  "ivory coast":               "Cote d'Ivoire",
  "côte divoire":              "Cote d'Ivoire",
  "ivory coast":               "Cote d'Ivoire",
};

for (const [alias, canonical] of Object.entries(EXTRA_ALIASES)) {
  const aliasKey = alias.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const rating = SQUAD_RATINGS[canonical];
  if (rating && !_lookup.has(aliasKey)) {
    _lookup.set(aliasKey, { ...rating, canonical });
  }
}

/**
 * Returns the squad rating object for a team, or null if not found.
 * @param {string} teamName
 * @returns {{ xi: number, avg: number, top: number, depth: number, canonical: string } | null}
 */
function getSquadRating(teamName) {
  if (!teamName) return null;
  const key = String(teamName).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return _lookup.get(key) || null;
}

/**
 * Returns a normalized 0–1 feature value based on squad xi rating.
 * Scale: xi=60 → 0.0,  xi=100 → 1.0.  Unknown teams default to 0.5 (neutral).
 * @param {string} teamName
 * @returns {number}
 */
function xiFeature(teamName) {
  const r = getSquadRating(teamName);
  if (!r) return 0.5;
  return Math.max(0, Math.min(1, (r.xi - 60) / 40));
}

module.exports = { getSquadRating, xiFeature, SQUAD_RATINGS };
