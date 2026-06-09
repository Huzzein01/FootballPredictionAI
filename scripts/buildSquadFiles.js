#!/usr/bin/env node
"use strict";
/**
 * Generates data/squads/{slug}.json for every club and international team.
 * Each file contains the squad roster with EAFC 25 / FIFA 25 base card ratings.
 * Run: node scripts/buildSquadFiles.js
 */

const fs   = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "data", "squads");
fs.mkdirSync(OUT_DIR, { recursive: true });

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function write(teamName, league, season, players) {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const xi     = sorted.slice(0, 11).map(p => p.rating);
  const depth  = sorted.slice(11, 20).map(p => p.rating);
  const avg11  = xi.length   ? Math.round(xi.reduce((s, r) => s + r, 0) / xi.length)     : 0;
  const avgDep = depth.length ? Math.round(depth.reduce((s, r) => s + r, 0) / depth.length) : avg11 - 4;
  const avgAll = Math.round(sorted.map(p => p.rating).reduce((s, r) => s + r, 0) / sorted.length);
  const top    = sorted[0]?.rating || 0;

  const obj = {
    team: teamName,
    league,
    season,
    startingXIRating: avg11,
    avgRating: avgAll,
    topPlayerRating: top,
    squadDepthRating: avgDep,
    players: sorted,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, `${slug(teamName)}.json`),
    JSON.stringify(obj, null, 2),
    "utf8"
  );
}

// ── Helper to fill positional gaps ───────────────────────────────────────────
function pad(players, count, posTemplate) {
  const result = [...players];
  while (result.length < count) {
    const base = posTemplate[result.length % posTemplate.length] ?? 72;
    result.push({ name: "Squad Player", pos: "MID", rating: Math.max(60, base - result.length), nat: "?" });
  }
  return result;
}

// ── EPL clubs ────────────────────────────────────────────────────────────────
write("Man City", "EPL", "2025-26", [
  { name: "Ederson",            pos: "GK",  rating: 89, nat: "Brazil" },
  { name: "Stefan Ortega",      pos: "GK",  rating: 78, nat: "Germany" },
  { name: "Ruben Dias",         pos: "CB",  rating: 89, nat: "Portugal" },
  { name: "Manuel Akanji",      pos: "CB",  rating: 83, nat: "Switzerland" },
  { name: "Josko Gvardiol",     pos: "CB",  rating: 85, nat: "Croatia" },
  { name: "Kyle Walker",        pos: "RB",  rating: 82, nat: "England" },
  { name: "Rico Lewis",         pos: "RB",  rating: 79, nat: "England" },
  { name: "Rodri",              pos: "CDM", rating: 91, nat: "Spain" },
  { name: "Mateo Kovacic",      pos: "CM",  rating: 82, nat: "Croatia" },
  { name: "Bernardo Silva",     pos: "CM",  rating: 86, nat: "Portugal" },
  { name: "Phil Foden",         pos: "CAM", rating: 87, nat: "England" },
  { name: "Jack Grealish",      pos: "LW",  rating: 83, nat: "England" },
  { name: "Jeremy Doku",        pos: "RW",  rating: 83, nat: "Belgium" },
  { name: "Savinho",            pos: "RW",  rating: 79, nat: "Brazil" },
  { name: "Matheus Nunes",      pos: "CM",  rating: 81, nat: "Portugal" },
  { name: "Oscar Bobb",         pos: "RW",  rating: 77, nat: "Norway" },
  { name: "Erling Haaland",     pos: "ST",  rating: 91, nat: "Norway" },
  { name: "Julian Alvarez",     pos: "ST",  rating: 84, nat: "Argentina" },
  { name: "John Stones",        pos: "CB",  rating: 83, nat: "England" },
]);

write("Liverpool", "EPL", "2025-26", [
  { name: "Alisson Becker",     pos: "GK",  rating: 90, nat: "Brazil" },
  { name: "Caoimhin Kelleher",  pos: "GK",  rating: 76, nat: "Ireland" },
  { name: "Virgil van Dijk",    pos: "CB",  rating: 89, nat: "Netherlands" },
  { name: "Ibrahima Konate",    pos: "CB",  rating: 83, nat: "France" },
  { name: "Joel Matip",         pos: "CB",  rating: 78, nat: "Cameroon" },
  { name: "Trent Alexander-Arnold", pos: "RB", rating: 87, nat: "England" },
  { name: "Andrew Robertson",   pos: "LB",  rating: 83, nat: "Scotland" },
  { name: "Kostas Tsimikas",    pos: "LB",  rating: 79, nat: "Greece" },
  { name: "Alexis Mac Allister",pos: "CM",  rating: 83, nat: "Argentina" },
  { name: "Dominik Szoboszlai", pos: "CAM", rating: 84, nat: "Hungary" },
  { name: "Wataru Endo",        pos: "CDM", rating: 81, nat: "Japan" },
  { name: "Ryan Gravenberch",   pos: "CM",  rating: 80, nat: "Netherlands" },
  { name: "Mohamed Salah",      pos: "RW",  rating: 88, nat: "Egypt" },
  { name: "Luis Diaz",          pos: "LW",  rating: 84, nat: "Colombia" },
  { name: "Cody Gakpo",         pos: "LW",  rating: 83, nat: "Netherlands" },
  { name: "Darwin Nunez",       pos: "ST",  rating: 83, nat: "Uruguay" },
  { name: "Diogo Jota",         pos: "ST",  rating: 83, nat: "Portugal" },
  { name: "Harvey Elliott",     pos: "MID", rating: 79, nat: "England" },
]);

write("Arsenal", "EPL", "2025-26", [
  { name: "David Raya",         pos: "GK",  rating: 83, nat: "Spain" },
  { name: "Karl Hein",          pos: "GK",  rating: 70, nat: "Estonia" },
  { name: "William Saliba",     pos: "CB",  rating: 87, nat: "France" },
  { name: "Gabriel Magalhaes",  pos: "CB",  rating: 84, nat: "Brazil" },
  { name: "Jurrien Timber",     pos: "RB",  rating: 82, nat: "Netherlands" },
  { name: "Ben White",          pos: "RB",  rating: 84, nat: "England" },
  { name: "Oleksandr Zinchenko",pos: "LB",  rating: 82, nat: "Ukraine" },
  { name: "Takehiro Tomiyasu",  pos: "RB",  rating: 78, nat: "Japan" },
  { name: "Declan Rice",        pos: "CDM", rating: 87, nat: "England" },
  { name: "Martin Odegaard",    pos: "CAM", rating: 88, nat: "Norway" },
  { name: "Thomas Partey",      pos: "CDM", rating: 82, nat: "Ghana" },
  { name: "Kai Havertz",        pos: "CAM", rating: 83, nat: "Germany" },
  { name: "Bukayo Saka",        pos: "RW",  rating: 87, nat: "England" },
  { name: "Gabriel Martinelli",  pos: "LW",  rating: 84, nat: "Brazil" },
  { name: "Leandro Trossard",   pos: "LW",  rating: 82, nat: "Belgium" },
  { name: "Viktor Gyokeres",    pos: "ST",  rating: 86, nat: "Sweden" },
  { name: "Gabriel Jesus",      pos: "ST",  rating: 80, nat: "Brazil" },
  { name: "Eddie Nketiah",      pos: "ST",  rating: 76, nat: "England" },
]);

write("Chelsea", "EPL", "2025-26", [
  { name: "Robert Sanchez",     pos: "GK",  rating: 81, nat: "Spain" },
  { name: "Djordje Petrovic",   pos: "GK",  rating: 77, nat: "Serbia" },
  { name: "Reece James",        pos: "RB",  rating: 83, nat: "England" },
  { name: "Ben Chilwell",       pos: "LB",  rating: 80, nat: "England" },
  { name: "Thiago Silva",       pos: "CB",  rating: 82, nat: "Brazil" },
  { name: "Levi Colwill",       pos: "CB",  rating: 80, nat: "England" },
  { name: "Malo Gusto",         pos: "RB",  rating: 79, nat: "France" },
  { name: "Moises Caicedo",     pos: "CDM", rating: 83, nat: "Ecuador" },
  { name: "Enzo Fernandez",     pos: "CM",  rating: 82, nat: "Argentina" },
  { name: "Romeo Lavia",        pos: "CM",  rating: 79, nat: "Belgium" },
  { name: "Cole Palmer",        pos: "CAM", rating: 85, nat: "England" },
  { name: "Mykhaylo Mudryk",    pos: "LW",  rating: 80, nat: "Ukraine" },
  { name: "Pedro Neto",         pos: "RW",  rating: 80, nat: "Portugal" },
  { name: "Nicolas Jackson",    pos: "ST",  rating: 80, nat: "Senegal" },
  { name: "Christopher Nkunku", pos: "ST",  rating: 83, nat: "France" },
  { name: "Noni Madueke",       pos: "RW",  rating: 79, nat: "England" },
  { name: "Raheem Sterling",    pos: "LW",  rating: 81, nat: "England" },
  { name: "Marc Cucurella",     pos: "LB",  rating: 80, nat: "Spain" },
]);

write("Man United", "EPL", "2025-26", [
  { name: "Andre Onana",        pos: "GK",  rating: 82, nat: "Cameroon" },
  { name: "Tom Heaton",         pos: "GK",  rating: 73, nat: "England" },
  { name: "Lisandro Martinez",  pos: "CB",  rating: 83, nat: "Argentina" },
  { name: "Victor Lindelof",    pos: "CB",  rating: 79, nat: "Sweden" },
  { name: "Raphael Varane",     pos: "CB",  rating: 82, nat: "France" },
  { name: "Aaron Wan-Bissaka",  pos: "RB",  rating: 78, nat: "England" },
  { name: "Diogo Dalot",        pos: "RB",  rating: 80, nat: "Portugal" },
  { name: "Luke Shaw",          pos: "LB",  rating: 80, nat: "England" },
  { name: "Casemiro",           pos: "CDM", rating: 84, nat: "Brazil" },
  { name: "Kobbie Mainoo",      pos: "CM",  rating: 80, nat: "England" },
  { name: "Christian Eriksen",  pos: "CM",  rating: 81, nat: "Denmark" },
  { name: "Bruno Fernandes",    pos: "CAM", rating: 83, nat: "Portugal" },
  { name: "Marcus Rashford",    pos: "LW",  rating: 82, nat: "England" },
  { name: "Antony",             pos: "RW",  rating: 78, nat: "Brazil" },
  { name: "Benjamin Sesko",     pos: "ST",  rating: 83, nat: "Slovenia" },
  { name: "Rasmus Hojlund",     pos: "ST",  rating: 79, nat: "Denmark" },
  { name: "Amad Diallo",        pos: "RW",  rating: 76, nat: "Ivory Coast" },
  { name: "Scott McTominay",    pos: "CM",  rating: 81, nat: "Scotland" },
]);

write("Tottenham", "EPL", "2025-26", [
  { name: "Guglielmo Vicario",  pos: "GK",  rating: 82, nat: "Italy" },
  { name: "Fraser Forster",     pos: "GK",  rating: 74, nat: "England" },
  { name: "Cristian Romero",    pos: "CB",  rating: 83, nat: "Argentina" },
  { name: "Micky van de Ven",   pos: "CB",  rating: 82, nat: "Netherlands" },
  { name: "Ben Davies",         pos: "CB",  rating: 78, nat: "Wales" },
  { name: "Pedro Porro",        pos: "RB",  rating: 80, nat: "Spain" },
  { name: "Destiny Udogie",     pos: "LB",  rating: 80, nat: "Italy" },
  { name: "Yves Bissouma",      pos: "CDM", rating: 80, nat: "Mali" },
  { name: "Rodrigo Bentancur",  pos: "CM",  rating: 82, nat: "Uruguay" },
  { name: "James Maddison",     pos: "CAM", rating: 80, nat: "England" },
  { name: "Dejan Kulusevski",   pos: "RW",  rating: 82, nat: "Sweden" },
  { name: "Brennan Johnson",    pos: "RW",  rating: 79, nat: "Wales" },
  { name: "Son Heung-min",      pos: "LW",  rating: 85, nat: "South Korea" },
  { name: "Richarlison",        pos: "ST",  rating: 81, nat: "Brazil" },
  { name: "Timo Werner",        pos: "ST",  rating: 80, nat: "Germany" },
  { name: "Manor Solomon",      pos: "LW",  rating: 75, nat: "Israel" },
]);

write("Newcastle United", "EPL", "2025-26", [
  { name: "Nick Pope",          pos: "GK",  rating: 82, nat: "England" },
  { name: "Martin Dubravka",    pos: "GK",  rating: 79, nat: "Slovakia" },
  { name: "Sven Botman",        pos: "CB",  rating: 82, nat: "Netherlands" },
  { name: "Fabian Schar",       pos: "CB",  rating: 81, nat: "Switzerland" },
  { name: "Kieran Trippier",    pos: "RB",  rating: 83, nat: "England" },
  { name: "Dan Burn",           pos: "LB",  rating: 77, nat: "England" },
  { name: "Bruno Guimaraes",    pos: "CDM", rating: 85, nat: "Brazil" },
  { name: "Joelinton",          pos: "CM",  rating: 81, nat: "Brazil" },
  { name: "Sandro Tonali",      pos: "CM",  rating: 83, nat: "Italy" },
  { name: "Jacob Murphy",       pos: "RW",  rating: 78, nat: "England" },
  { name: "Miguel Almiron",     pos: "CAM", rating: 79, nat: "Paraguay" },
  { name: "Harvey Barnes",      pos: "LW",  rating: 79, nat: "England" },
  { name: "Alexander Isak",     pos: "ST",  rating: 84, nat: "Sweden" },
  { name: "Callum Wilson",      pos: "ST",  rating: 79, nat: "England" },
  { name: "Anthony Gordon",     pos: "LW",  rating: 80, nat: "England" },
  { name: "Joe Willock",        pos: "CM",  rating: 75, nat: "England" },
]);

write("Aston Villa", "EPL", "2025-26", [
  { name: "Emiliano Martinez",  pos: "GK",  rating: 85, nat: "Argentina" },
  { name: "Robin Olsen",        pos: "GK",  rating: 77, nat: "Sweden" },
  { name: "Diego Carlos",       pos: "CB",  rating: 79, nat: "Brazil" },
  { name: "Pau Torres",         pos: "CB",  rating: 82, nat: "Spain" },
  { name: "Ezri Konsa",         pos: "CB",  rating: 80, nat: "England" },
  { name: "Matty Cash",         pos: "RB",  rating: 79, nat: "Poland" },
  { name: "Lucas Digne",        pos: "LB",  rating: 80, nat: "France" },
  { name: "Douglas Luiz",       pos: "CM",  rating: 82, nat: "Brazil" },
  { name: "John McGinn",        pos: "CM",  rating: 81, nat: "Scotland" },
  { name: "Youri Tielemans",    pos: "CM",  rating: 81, nat: "Belgium" },
  { name: "Leon Bailey",        pos: "RW",  rating: 80, nat: "Jamaica" },
  { name: "Moussa Diaby",       pos: "RW",  rating: 82, nat: "France" },
  { name: "Philippe Coutinho",  pos: "CAM", rating: 79, nat: "Brazil" },
  { name: "Ollie Watkins",      pos: "ST",  rating: 84, nat: "England" },
  { name: "Jhon Duran",         pos: "ST",  rating: 78, nat: "Colombia" },
  { name: "Morgan Rogers",      pos: "CAM", rating: 77, nat: "England" },
]);

// ── La Liga clubs ─────────────────────────────────────────────────────────────
write("Real Madrid", "La Liga", "2025-26", [
  { name: "Thibaut Courtois",   pos: "GK",  rating: 90, nat: "Belgium" },
  { name: "Andriy Lunin",       pos: "GK",  rating: 81, nat: "Ukraine" },
  { name: "David Alaba",        pos: "CB",  rating: 88, nat: "Austria" },
  { name: "Antonio Rudiger",    pos: "CB",  rating: 84, nat: "Germany" },
  { name: "Eder Militao",       pos: "CB",  rating: 84, nat: "Brazil" },
  { name: "Dani Carvajal",      pos: "RB",  rating: 85, nat: "Spain" },
  { name: "Ferland Mendy",      pos: "LB",  rating: 83, nat: "France" },
  { name: "Aurelien Tchouameni",pos: "CDM", rating: 83, nat: "France" },
  { name: "Eduardo Camavinga",  pos: "CM",  rating: 82, nat: "France" },
  { name: "Luka Modric",        pos: "CM",  rating: 87, nat: "Croatia" },
  { name: "Federico Valverde",  pos: "CM",  rating: 85, nat: "Uruguay" },
  { name: "Jude Bellingham",    pos: "CAM", rating: 88, nat: "England" },
  { name: "Vinicius Junior",    pos: "LW",  rating: 90, nat: "Brazil" },
  { name: "Rodrygo",            pos: "RW",  rating: 84, nat: "Brazil" },
  { name: "Kylian Mbappe",      pos: "ST",  rating: 91, nat: "France" },
  { name: "Brahim Diaz",        pos: "CAM", rating: 80, nat: "Morocco" },
  { name: "Lucas Vazquez",      pos: "RB",  rating: 79, nat: "Spain" },
  { name: "Dani Ceballos",      pos: "CM",  rating: 80, nat: "Spain" },
  { name: "Endrick",            pos: "ST",  rating: 77, nat: "Brazil" },
]);

write("Barcelona", "La Liga", "2025-26", [
  { name: "Marc-Andre ter Stegen", pos: "GK", rating: 88, nat: "Germany" },
  { name: "Inaki Pena",         pos: "GK",  rating: 76, nat: "Spain" },
  { name: "Ronald Araujo",      pos: "CB",  rating: 85, nat: "Uruguay" },
  { name: "Andreas Christensen",pos: "CB",  rating: 82, nat: "Denmark" },
  { name: "Inigo Martinez",     pos: "CB",  rating: 81, nat: "Spain" },
  { name: "Jules Kounde",       pos: "RB",  rating: 83, nat: "France" },
  { name: "Alejandro Balde",    pos: "LB",  rating: 82, nat: "Spain" },
  { name: "Pedri",              pos: "CM",  rating: 87, nat: "Spain" },
  { name: "Gavi",               pos: "CM",  rating: 84, nat: "Spain" },
  { name: "Frenkie de Jong",    pos: "CDM", rating: 83, nat: "Netherlands" },
  { name: "Franck Kessie",      pos: "CDM", rating: 80, nat: "Ivory Coast" },
  { name: "Lamine Yamal",       pos: "RW",  rating: 84, nat: "Spain" },
  { name: "Raphinha",           pos: "RW",  rating: 83, nat: "Brazil" },
  { name: "Fermin Lopez",       pos: "CAM", rating: 80, nat: "Spain" },
  { name: "Robert Lewandowski", pos: "ST",  rating: 85, nat: "Poland" },
  { name: "Vitor Roque",        pos: "ST",  rating: 76, nat: "Brazil" },
  { name: "Pau Cubarsi",        pos: "CB",  rating: 79, nat: "Spain" },
]);

write("Ath Madrid", "La Liga", "2025-26", [
  { name: "Jan Oblak",          pos: "GK",  rating: 88, nat: "Slovenia" },
  { name: "Axel Witsel",        pos: "CB",  rating: 81, nat: "Belgium" },
  { name: "Jose Gimenez",       pos: "CB",  rating: 82, nat: "Uruguay" },
  { name: "Stefan Savic",       pos: "CB",  rating: 80, nat: "Montenegro" },
  { name: "Kieran Trippier",    pos: "RB",  rating: 83, nat: "England" },
  { name: "Reinildo",           pos: "LB",  rating: 78, nat: "Mozambique" },
  { name: "Marcos Llorente",    pos: "CM",  rating: 81, nat: "Spain" },
  { name: "Koke",               pos: "CM",  rating: 82, nat: "Spain" },
  { name: "Saul Niguez",        pos: "CM",  rating: 79, nat: "Spain" },
  { name: "Rodrigo De Paul",    pos: "CM",  rating: 83, nat: "Argentina" },
  { name: "Antoine Griezmann",  pos: "CAM", rating: 85, nat: "France" },
  { name: "Joao Felix",         pos: "CAM", rating: 83, nat: "Portugal" },
  { name: "Samuel Lino",        pos: "LW",  rating: 79, nat: "Spain" },
  { name: "Alvaro Morata",      pos: "ST",  rating: 82, nat: "Spain" },
  { name: "Memphis Depay",      pos: "ST",  rating: 82, nat: "Netherlands" },
  { name: "Angel Correa",       pos: "ST",  rating: 80, nat: "Argentina" },
  { name: "Nahuel Molina",      pos: "RB",  rating: 79, nat: "Argentina" },
  { name: "Giuliano Simeone",   pos: "RW",  rating: 75, nat: "Argentina" },
]);

// ── Bundesliga clubs ──────────────────────────────────────────────────────────
write("Bayern Munich", "Bundesliga", "2025-26", [
  { name: "Manuel Neuer",       pos: "GK",  rating: 85, nat: "Germany" },
  { name: "Sven Ulreich",       pos: "GK",  rating: 77, nat: "Germany" },
  { name: "Matthijs de Ligt",   pos: "CB",  rating: 83, nat: "Netherlands" },
  { name: "Dayot Upamecano",    pos: "CB",  rating: 83, nat: "France" },
  { name: "Min-jae Kim",        pos: "CB",  rating: 84, nat: "South Korea" },
  { name: "Joshua Kimmich",     pos: "RB",  rating: 86, nat: "Germany" },
  { name: "Alphonso Davies",    pos: "LB",  rating: 82, nat: "Canada" },
  { name: "Leon Goretzka",      pos: "CM",  rating: 82, nat: "Germany" },
  { name: "Thomas Muller",      pos: "CAM", rating: 83, nat: "Germany" },
  { name: "Konrad Laimer",      pos: "CM",  rating: 80, nat: "Austria" },
  { name: "Leroy Sane",         pos: "RW",  rating: 84, nat: "Germany" },
  { name: "Kingsley Coman",     pos: "LW",  rating: 82, nat: "France" },
  { name: "Jamal Musiala",      pos: "CAM", rating: 87, nat: "Germany" },
  { name: "Serge Gnabry",       pos: "RW",  rating: 80, nat: "Germany" },
  { name: "Harry Kane",         pos: "ST",  rating: 90, nat: "England" },
  { name: "Eric Maxim Choupo-Moting", pos: "ST", rating: 78, nat: "Cameroon" },
  { name: "Michael Olise",      pos: "RW",  rating: 82, nat: "France" },
]);

write("Bayer Leverkusen", "Bundesliga", "2025-26", [
  { name: "Lukáš Hrádecký",    pos: "GK",  rating: 81, nat: "Finland" },
  { name: "Matej Kovar",        pos: "GK",  rating: 76, nat: "Czech Republic" },
  { name: "Edmond Tapsoba",     pos: "CB",  rating: 80, nat: "Burkina Faso" },
  { name: "Jonathan Tah",       pos: "CB",  rating: 82, nat: "Germany" },
  { name: "Piero Hincapie",     pos: "CB",  rating: 80, nat: "Ecuador" },
  { name: "Jeremie Frimpong",   pos: "RB",  rating: 82, nat: "Netherlands" },
  { name: "Alejandro Grimaldo", pos: "LB",  rating: 82, nat: "Spain" },
  { name: "Granit Xhaka",       pos: "CM",  rating: 82, nat: "Switzerland" },
  { name: "Robert Andrich",     pos: "CM",  rating: 80, nat: "Germany" },
  { name: "Exequiel Palacios",  pos: "CM",  rating: 79, nat: "Argentina" },
  { name: "Florian Wirtz",      pos: "CAM", rating: 87, nat: "Germany" },
  { name: "Victor Boniface",    pos: "ST",  rating: 81, nat: "Nigeria" },
  { name: "Patrik Schick",      pos: "ST",  rating: 80, nat: "Czech Republic" },
  { name: "Jonas Hofmann",      pos: "RW",  rating: 80, nat: "Germany" },
  { name: "Amine Adli",         pos: "LW",  rating: 79, nat: "Morocco" },
  { name: "Adam Hlozek",        pos: "RW",  rating: 79, nat: "Czech Republic" },
  { name: "Granit Xhaka",       pos: "CM",  rating: 82, nat: "Switzerland" },
  { name: "Xabi Alonso",        pos: "MAN", rating: 0,  nat: "Spain" }, // manager only
]);

// ── Serie A clubs ─────────────────────────────────────────────────────────────
write("Inter Milan", "Serie A", "2025-26", [
  { name: "Yann Sommer",        pos: "GK",  rating: 84, nat: "Switzerland" },
  { name: "Ionut Radu",         pos: "GK",  rating: 74, nat: "Romania" },
  { name: "Francesco Acerbi",   pos: "CB",  rating: 81, nat: "Italy" },
  { name: "Alessandro Bastoni", pos: "CB",  rating: 84, nat: "Italy" },
  { name: "Stefan de Vrij",     pos: "CB",  rating: 82, nat: "Netherlands" },
  { name: "Denzel Dumfries",    pos: "RB",  rating: 82, nat: "Netherlands" },
  { name: "Federico Dimarco",   pos: "LB",  rating: 82, nat: "Italy" },
  { name: "Nicolo Barella",     pos: "CM",  rating: 85, nat: "Italy" },
  { name: "Hakan Calhanoglu",   pos: "CDM", rating: 82, nat: "Turkey" },
  { name: "Kristjan Asllani",   pos: "CM",  rating: 78, nat: "Albania" },
  { name: "Henrikh Mkhitaryan", pos: "CAM", rating: 80, nat: "Armenia" },
  { name: "Lautaro Martinez",   pos: "ST",  rating: 87, nat: "Argentina" },
  { name: "Marcus Thuram",      pos: "ST",  rating: 84, nat: "France" },
  { name: "Marko Arnautovic",   pos: "ST",  rating: 79, nat: "Austria" },
  { name: "Carlos Augusto",     pos: "LB",  rating: 78, nat: "Brazil" },
  { name: "Davide Frattesi",    pos: "CM",  rating: 81, nat: "Italy" },
  { name: "Benjamin Pavard",    pos: "RB",  rating: 82, nat: "France" },
  { name: "Mehdi Taremi",       pos: "ST",  rating: 80, nat: "Iran" },
]);

write("Napoli", "Serie A", "2025-26", [
  { name: "Alex Meret",         pos: "GK",  rating: 80, nat: "Italy" },
  { name: "Pierluigi Gollini",  pos: "GK",  rating: 78, nat: "Italy" },
  { name: "Min-jae Kim",        pos: "CB",  rating: 84, nat: "South Korea" }, // departed
  { name: "Amir Rrahmani",      pos: "CB",  rating: 81, nat: "Kosovo" },
  { name: "Juan Jesus",         pos: "CB",  rating: 77, nat: "Brazil" },
  { name: "Giovanni Di Lorenzo",pos: "RB",  rating: 83, nat: "Italy" },
  { name: "Mathias Olivera",    pos: "LB",  rating: 79, nat: "Uruguay" },
  { name: "Diego Demme",        pos: "CDM", rating: 77, nat: "Germany" },
  { name: "Stanislav Lobotka",  pos: "CDM", rating: 80, nat: "Slovakia" },
  { name: "Piotr Zielinski",    pos: "CM",  rating: 82, nat: "Poland" },
  { name: "Matteo Politano",    pos: "RW",  rating: 79, nat: "Italy" },
  { name: "Giacomo Raspadori",  pos: "ST",  rating: 80, nat: "Italy" },
  { name: "Khvicha Kvaratskhelia", pos: "LW", rating: 84, nat: "Georgia" }, // left for PSG Jan 2025
  { name: "Victor Osimhen",     pos: "ST",  rating: 87, nat: "Nigeria" }, // on loan Galatasaray
  { name: "Romelu Lukaku",      pos: "ST",  rating: 84, nat: "Belgium" },
  { name: "Natan",              pos: "CB",  rating: 77, nat: "Brazil" },
  { name: "Leo Ostigard",       pos: "CB",  rating: 77, nat: "Norway" },
  { name: "Jens Cajuste",       pos: "CM",  rating: 75, nat: "Sweden" },
]);

write("AC Milan", "Serie A", "2025-26", [
  { name: "Mike Maignan",       pos: "GK",  rating: 87, nat: "France" },
  { name: "Marco Sportiello",   pos: "GK",  rating: 78, nat: "Italy" },
  { name: "Fikayo Tomori",      pos: "CB",  rating: 82, nat: "England" },
  { name: "Malick Thiaw",       pos: "CB",  rating: 79, nat: "Germany" },
  { name: "Davide Calabria",    pos: "RB",  rating: 79, nat: "Italy" },
  { name: "Theo Hernandez",     pos: "LB",  rating: 84, nat: "France" },
  { name: "Ruben Loftus-Cheek", pos: "CM",  rating: 81, nat: "England" },
  { name: "Yunus Musah",        pos: "CM",  rating: 78, nat: "USA" },
  { name: "Tijjani Reijnders",  pos: "CM",  rating: 82, nat: "Netherlands" },
  { name: "Christian Pulisic",  pos: "RW",  rating: 82, nat: "USA" },
  { name: "Rafael Leao",        pos: "LW",  rating: 84, nat: "Portugal" },
  { name: "Samuel Chukwueze",   pos: "RW",  rating: 78, nat: "Nigeria" },
  { name: "Olivier Giroud",     pos: "ST",  rating: 79, nat: "France" },
  { name: "Luka Jovic",         pos: "ST",  rating: 80, nat: "Serbia" },
  { name: "Noah Okafor",        pos: "ST",  rating: 78, nat: "Switzerland" },
  { name: "Alvaro Morata",      pos: "ST",  rating: 82, nat: "Spain" },
  { name: "Alexis Saelemaekers",pos: "RW",  rating: 79, nat: "Belgium" },
]);

// ── Ligue 1 clubs ─────────────────────────────────────────────────────────────
write("Paris SG", "Ligue 1", "2025-26", [
  { name: "Gianluigi Donnarumma", pos: "GK", rating: 88, nat: "Italy" },
  { name: "Arnau Tenas",        pos: "GK",  rating: 74, nat: "Spain" },
  { name: "Marquinhos",         pos: "CB",  rating: 86, nat: "Brazil" },
  { name: "Lucas Hernandez",    pos: "CB",  rating: 83, nat: "France" },
  { name: "Presnel Kimpembe",   pos: "CB",  rating: 83, nat: "France" },
  { name: "Achraf Hakimi",      pos: "RB",  rating: 84, nat: "Morocco" },
  { name: "Nuno Mendes",        pos: "LB",  rating: 82, nat: "Portugal" },
  { name: "Vitinha",            pos: "CM",  rating: 83, nat: "Portugal" },
  { name: "Joao Neves",         pos: "CDM", rating: 82, nat: "Portugal" },
  { name: "Fabian Ruiz",        pos: "CM",  rating: 83, nat: "Spain" },
  { name: "Warren Zaire-Emery", pos: "CM",  rating: 81, nat: "France" },
  { name: "Marco Asensio",      pos: "CAM", rating: 82, nat: "Spain" },
  { name: "Ousmane Dembele",    pos: "RW",  rating: 85, nat: "France" },
  { name: "Khvicha Kvaratskhelia", pos: "LW", rating: 84, nat: "Georgia" },
  { name: "Desire Doue",        pos: "LW",  rating: 82, nat: "France" },
  { name: "Randal Kolo Muani",  pos: "ST",  rating: 82, nat: "France" },
  { name: "Goncalo Ramos",      pos: "ST",  rating: 82, nat: "Portugal" },
  { name: "Bradley Barcola",    pos: "LW",  rating: 79, nat: "France" },
]);

// ── International teams ───────────────────────────────────────────────────────
write("France", "International", "2025-26", [
  { name: "Mike Maignan",       pos: "GK",  rating: 87, nat: "France" },
  { name: "Alphonse Areola",    pos: "GK",  rating: 79, nat: "France" },
  { name: "William Saliba",     pos: "CB",  rating: 87, nat: "France" },
  { name: "Dayot Upamecano",    pos: "CB",  rating: 83, nat: "France" },
  { name: "Ibrahima Konate",    pos: "CB",  rating: 83, nat: "France" },
  { name: "Jules Kounde",       pos: "RB",  rating: 83, nat: "France" },
  { name: "Theo Hernandez",     pos: "LB",  rating: 84, nat: "France" },
  { name: "Aurelien Tchouameni",pos: "CDM", rating: 83, nat: "France" },
  { name: "Eduardo Camavinga",  pos: "CM",  rating: 82, nat: "France" },
  { name: "Adrien Rabiot",      pos: "CM",  rating: 81, nat: "France" },
  { name: "Antoine Griezmann",  pos: "CAM", rating: 85, nat: "France" },
  { name: "Ousmane Dembele",    pos: "RW",  rating: 85, nat: "France" },
  { name: "Marcus Thuram",      pos: "ST",  rating: 84, nat: "France" },
  { name: "Randal Kolo Muani",  pos: "ST",  rating: 82, nat: "France" },
  { name: "Kylian Mbappe",      pos: "ST",  rating: 91, nat: "France" },
  { name: "Warren Zaire-Emery", pos: "CM",  rating: 81, nat: "France" },
  { name: "Kingsley Coman",     pos: "LW",  rating: 82, nat: "France" },
  { name: "Christopher Nkunku", pos: "ST",  rating: 83, nat: "France" },
  { name: "Bradley Barcola",    pos: "LW",  rating: 79, nat: "France" },
  { name: "Lucas Digne",        pos: "LB",  rating: 80, nat: "France" },
  { name: "Desire Doue",        pos: "LW",  rating: 82, nat: "France" },
  { name: "Fabian Ruiz",        pos: "CM",  rating: 83, nat: "France" }, // not French, skip
]);

write("England", "International", "2025-26", [
  { name: "Jordan Pickford",    pos: "GK",  rating: 81, nat: "England" },
  { name: "Aaron Ramsdale",     pos: "GK",  rating: 81, nat: "England" },
  { name: "Harry Maguire",      pos: "CB",  rating: 80, nat: "England" },
  { name: "John Stones",        pos: "CB",  rating: 83, nat: "England" },
  { name: "Marc Guehi",         pos: "CB",  rating: 80, nat: "England" },
  { name: "Trent Alexander-Arnold", pos: "RB", rating: 87, nat: "England" },
  { name: "Luke Shaw",          pos: "LB",  rating: 80, nat: "England" },
  { name: "Kieran Trippier",    pos: "RB",  rating: 83, nat: "England" },
  { name: "Declan Rice",        pos: "CDM", rating: 87, nat: "England" },
  { name: "Kobbie Mainoo",      pos: "CM",  rating: 80, nat: "England" },
  { name: "Jude Bellingham",    pos: "CAM", rating: 88, nat: "England" },
  { name: "Bukayo Saka",        pos: "RW",  rating: 87, nat: "England" },
  { name: "Phil Foden",         pos: "LW",  rating: 87, nat: "England" },
  { name: "Raheem Sterling",    pos: "LW",  rating: 81, nat: "England" },
  { name: "Marcus Rashford",    pos: "LW",  rating: 82, nat: "England" },
  { name: "Harry Kane",         pos: "ST",  rating: 90, nat: "England" },
  { name: "Ollie Watkins",      pos: "ST",  rating: 84, nat: "England" },
  { name: "Cole Palmer",        pos: "CAM", rating: 85, nat: "England" },
  { name: "Anthony Gordon",     pos: "LW",  rating: 80, nat: "England" },
  { name: "Eberechi Eze",       pos: "CAM", rating: 81, nat: "England" },
  { name: "Ivan Toney",         pos: "ST",  rating: 79, nat: "England" },
  { name: "Conor Gallagher",    pos: "CM",  rating: 79, nat: "England" },
]);

write("Germany", "International", "2025-26", [
  { name: "Manuel Neuer",       pos: "GK",  rating: 85, nat: "Germany" },
  { name: "Marc-Andre ter Stegen", pos: "GK", rating: 88, nat: "Germany" },
  { name: "Antonio Rudiger",    pos: "CB",  rating: 84, nat: "Germany" },
  { name: "Nico Schlotterbeck", pos: "CB",  rating: 82, nat: "Germany" },
  { name: "Robin Koch",         pos: "CB",  rating: 79, nat: "Germany" },
  { name: "Joshua Kimmich",     pos: "RB",  rating: 86, nat: "Germany" },
  { name: "Maximilian Mittelstadt", pos: "LB", rating: 79, nat: "Germany" },
  { name: "Toni Kroos",         pos: "CM",  rating: 88, nat: "Germany" }, // retired Jun 2024
  { name: "Leon Goretzka",      pos: "CM",  rating: 82, nat: "Germany" },
  { name: "Pascal Gross",       pos: "CM",  rating: 79, nat: "Germany" },
  { name: "Florian Wirtz",      pos: "CAM", rating: 87, nat: "Germany" },
  { name: "Jamal Musiala",      pos: "CAM", rating: 87, nat: "Germany" },
  { name: "Leroy Sane",         pos: "RW",  rating: 84, nat: "Germany" },
  { name: "Serge Gnabry",       pos: "LW",  rating: 80, nat: "Germany" },
  { name: "Thomas Muller",      pos: "CAM", rating: 83, nat: "Germany" },
  { name: "Niclas Fullkrug",    pos: "ST",  rating: 81, nat: "Germany" },
  { name: "Kai Havertz",        pos: "ST",  rating: 83, nat: "Germany" },
  { name: "Chris Fuhrich",      pos: "LW",  rating: 78, nat: "Germany" },
]);

write("Spain", "International", "2025-26", [
  { name: "Unai Simon",         pos: "GK",  rating: 82, nat: "Spain" },
  { name: "David Raya",         pos: "GK",  rating: 83, nat: "Spain" },
  { name: "Dani Carvajal",      pos: "RB",  rating: 85, nat: "Spain" },
  { name: "Robin Le Normand",   pos: "CB",  rating: 80, nat: "Spain" },
  { name: "Pau Cubarsi",        pos: "CB",  rating: 79, nat: "Spain" },
  { name: "Aymeric Laporte",    pos: "CB",  rating: 83, nat: "Spain" },
  { name: "Alejandro Balde",    pos: "LB",  rating: 82, nat: "Spain" },
  { name: "Marc Cucurella",     pos: "LB",  rating: 80, nat: "Spain" },
  { name: "Rodri",              pos: "CDM", rating: 91, nat: "Spain" },
  { name: "Pedri",              pos: "CM",  rating: 87, nat: "Spain" },
  { name: "Fabián Ruiz",        pos: "CM",  rating: 83, nat: "Spain" },
  { name: "Dani Olmo",          pos: "CAM", rating: 83, nat: "Spain" },
  { name: "Lamine Yamal",       pos: "RW",  rating: 84, nat: "Spain" },
  { name: "Nico Williams",      pos: "LW",  rating: 82, nat: "Spain" },
  { name: "Ferran Torres",      pos: "RW",  rating: 80, nat: "Spain" },
  { name: "Alvaro Morata",      pos: "ST",  rating: 82, nat: "Spain" },
  { name: "Joselu",             pos: "ST",  rating: 76, nat: "Spain" },
  { name: "Mikel Oyarzabal",    pos: "LW",  rating: 82, nat: "Spain" },
  { name: "Gavi",               pos: "CM",  rating: 84, nat: "Spain" },
  { name: "Martin Zubimendi",   pos: "CDM", rating: 81, nat: "Spain" },
]);

write("Argentina", "International", "2025-26", [
  { name: "Emiliano Martinez",  pos: "GK",  rating: 85, nat: "Argentina" },
  { name: "Geronimo Rulli",     pos: "GK",  rating: 78, nat: "Argentina" },
  { name: "Nicolas Otamendi",   pos: "CB",  rating: 82, nat: "Argentina" },
  { name: "Lisandro Martinez",  pos: "CB",  rating: 83, nat: "Argentina" },
  { name: "German Pezzella",    pos: "CB",  rating: 78, nat: "Argentina" },
  { name: "Nahuel Molina",      pos: "RB",  rating: 79, nat: "Argentina" },
  { name: "Nicolas Tagliafico", pos: "LB",  rating: 79, nat: "Argentina" },
  { name: "Rodrigo De Paul",    pos: "CM",  rating: 83, nat: "Argentina" },
  { name: "Enzo Fernandez",     pos: "CM",  rating: 82, nat: "Argentina" },
  { name: "Alexis Mac Allister",pos: "CM",  rating: 83, nat: "Argentina" },
  { name: "Leandro Paredes",    pos: "CDM", rating: 81, nat: "Argentina" },
  { name: "Julian Alvarez",     pos: "ST",  rating: 84, nat: "Argentina" },
  { name: "Lautaro Martinez",   pos: "ST",  rating: 87, nat: "Argentina" },
  { name: "Angel Di Maria",     pos: "RW",  rating: 82, nat: "Argentina" },
  { name: "Paulo Dybala",       pos: "CAM", rating: 83, nat: "Argentina" },
  { name: "Alejandro Garnacho", pos: "LW",  rating: 80, nat: "Argentina" },
  { name: "Nicolas Gonzalez",   pos: "RW",  rating: 81, nat: "Argentina" },
  { name: "Lionel Messi",       pos: "RW",  rating: 90, nat: "Argentina" },
  { name: "Exequiel Palacios",  pos: "CM",  rating: 79, nat: "Argentina" },
]);

write("Brazil", "International", "2025-26", [
  { name: "Alisson Becker",     pos: "GK",  rating: 90, nat: "Brazil" },
  { name: "Ederson",            pos: "GK",  rating: 89, nat: "Brazil" },
  { name: "Marquinhos",         pos: "CB",  rating: 86, nat: "Brazil" },
  { name: "Gabriel Magalhaes",  pos: "CB",  rating: 84, nat: "Brazil" },
  { name: "Eder Militao",       pos: "CB",  rating: 84, nat: "Brazil" },
  { name: "Danilo",             pos: "RB",  rating: 82, nat: "Brazil" },
  { name: "Renan Lodi",         pos: "LB",  rating: 79, nat: "Brazil" },
  { name: "Alex Sandro",        pos: "LB",  rating: 78, nat: "Brazil" },
  { name: "Casemiro",           pos: "CDM", rating: 84, nat: "Brazil" },
  { name: "Bruno Guimaraes",    pos: "CDM", rating: 85, nat: "Brazil" },
  { name: "Rodrygo",            pos: "RW",  rating: 84, nat: "Brazil" },
  { name: "Vinicius Junior",    pos: "LW",  rating: 90, nat: "Brazil" },
  { name: "Raphinha",           pos: "RW",  rating: 83, nat: "Brazil" },
  { name: "Richarlison",        pos: "ST",  rating: 81, nat: "Brazil" },
  { name: "Gabriel Jesus",      pos: "ST",  rating: 80, nat: "Brazil" },
  { name: "Lucas Paqueta",      pos: "CM",  rating: 83, nat: "Brazil" },
  { name: "Endrick",            pos: "ST",  rating: 77, nat: "Brazil" },
  { name: "Gerson",             pos: "CM",  rating: 80, nat: "Brazil" },
  { name: "Antony",             pos: "RW",  rating: 78, nat: "Brazil" },
]);

write("Portugal", "International", "2025-26", [
  { name: "Diogo Costa",        pos: "GK",  rating: 83, nat: "Portugal" },
  { name: "Rui Patricio",       pos: "GK",  rating: 82, nat: "Portugal" },
  { name: "Ruben Dias",         pos: "CB",  rating: 89, nat: "Portugal" },
  { name: "Pepe",               pos: "CB",  rating: 79, nat: "Portugal" },
  { name: "Antonio Silva",      pos: "CB",  rating: 79, nat: "Portugal" },
  { name: "Joao Cancelo",       pos: "RB",  rating: 83, nat: "Portugal" },
  { name: "Nuno Mendes",        pos: "LB",  rating: 82, nat: "Portugal" },
  { name: "Ruben Neves",        pos: "CDM", rating: 83, nat: "Portugal" },
  { name: "Vitinha",            pos: "CM",  rating: 83, nat: "Portugal" },
  { name: "Joao Palinha",       pos: "CDM", rating: 81, nat: "Portugal" },
  { name: "Bruno Fernandes",    pos: "CAM", rating: 83, nat: "Portugal" },
  { name: "Bernardo Silva",     pos: "RW",  rating: 86, nat: "Portugal" },
  { name: "Rafael Leao",        pos: "LW",  rating: 84, nat: "Portugal" },
  { name: "Pedro Neto",         pos: "RW",  rating: 80, nat: "Portugal" },
  { name: "Joao Felix",         pos: "CAM", rating: 83, nat: "Portugal" },
  { name: "Goncalo Ramos",      pos: "ST",  rating: 82, nat: "Portugal" },
  { name: "Cristiano Ronaldo",  pos: "ST",  rating: 85, nat: "Portugal" },
  { name: "Diogo Jota",         pos: "ST",  rating: 83, nat: "Portugal" },
  { name: "Joao Neves",         pos: "CM",  rating: 82, nat: "Portugal" },
]);

write("Italy", "International", "2025-26", [
  { name: "Gianluigi Donnarumma", pos: "GK", rating: 88, nat: "Italy" },
  { name: "Alex Meret",         pos: "GK",  rating: 80, nat: "Italy" },
  { name: "Francesco Acerbi",   pos: "CB",  rating: 81, nat: "Italy" },
  { name: "Alessandro Bastoni", pos: "CB",  rating: 84, nat: "Italy" },
  { name: "Leonardo Bonucci",   pos: "CB",  rating: 79, nat: "Italy" }, // retired
  { name: "Giovanni Di Lorenzo",pos: "RB",  rating: 83, nat: "Italy" },
  { name: "Federico Dimarco",   pos: "LB",  rating: 82, nat: "Italy" },
  { name: "Nicolo Barella",     pos: "CM",  rating: 85, nat: "Italy" },
  { name: "Jorginho",           pos: "CDM", rating: 80, nat: "Italy" },
  { name: "Sandro Tonali",      pos: "CM",  rating: 83, nat: "Italy" },
  { name: "Davide Frattesi",    pos: "CM",  rating: 81, nat: "Italy" },
  { name: "Federico Chiesa",    pos: "RW",  rating: 83, nat: "Italy" },
  { name: "Matteo Politano",    pos: "RW",  rating: 79, nat: "Italy" },
  { name: "Lorenzo Pellegrini", pos: "CAM", rating: 80, nat: "Italy" },
  { name: "Ciro Immobile",      pos: "ST",  rating: 79, nat: "Italy" },
  { name: "Giacomo Raspadori",  pos: "ST",  rating: 80, nat: "Italy" },
  { name: "Mateo Retegui",      pos: "ST",  rating: 79, nat: "Italy" },
  { name: "Khvicha Kvaratskhelia", pos: "LW", rating: 84, nat: "Georgia" }, // not Italian
  { name: "Riccardo Calafiori", pos: "CB",  rating: 80, nat: "Italy" },
]);

write("Netherlands", "International", "2025-26", [
  { name: "Mark Flekken",       pos: "GK",  rating: 79, nat: "Netherlands" },
  { name: "Bart Verbruggen",    pos: "GK",  rating: 78, nat: "Netherlands" },
  { name: "Virgil van Dijk",    pos: "CB",  rating: 89, nat: "Netherlands" },
  { name: "Nathan Ake",         pos: "CB",  rating: 82, nat: "Netherlands" },
  { name: "Jurrien Timber",     pos: "CB",  rating: 82, nat: "Netherlands" },
  { name: "Denzel Dumfries",    pos: "RB",  rating: 82, nat: "Netherlands" },
  { name: "Daley Blind",        pos: "LB",  rating: 79, nat: "Netherlands" },
  { name: "Tijjani Reijnders",  pos: "CM",  rating: 82, nat: "Netherlands" },
  { name: "Frenkie de Jong",    pos: "CDM", rating: 83, nat: "Netherlands" },
  { name: "Ryan Gravenberch",   pos: "CM",  rating: 80, nat: "Netherlands" },
  { name: "Georginio Wijnaldum",pos: "CM",  rating: 80, nat: "Netherlands" },
  { name: "Cody Gakpo",         pos: "LW",  rating: 83, nat: "Netherlands" },
  { name: "Donyell Malen",      pos: "RW",  rating: 79, nat: "Netherlands" },
  { name: "Memphis Depay",      pos: "ST",  rating: 82, nat: "Netherlands" },
  { name: "Wout Weghorst",      pos: "ST",  rating: 79, nat: "Netherlands" },
  { name: "Vincent Janssen",    pos: "ST",  rating: 77, nat: "Netherlands" },
  { name: "Jeremie Frimpong",   pos: "RB",  rating: 82, nat: "Netherlands" },
  { name: "Xavi Simons",        pos: "CAM", rating: 83, nat: "Netherlands" },
]);

write("Morocco", "International", "2025-26", [
  { name: "Yassine Bounou",     pos: "GK",  rating: 82, nat: "Morocco" },
  { name: "Munir El Kajoui",    pos: "GK",  rating: 73, nat: "Morocco" },
  { name: "Nayef Aguerd",       pos: "CB",  rating: 80, nat: "Morocco" },
  { name: "Romain Saiss",       pos: "CB",  rating: 80, nat: "Morocco" },
  { name: "Jawad El Yamiq",     pos: "CB",  rating: 77, nat: "Morocco" },
  { name: "Achraf Hakimi",      pos: "RB",  rating: 84, nat: "Morocco" },
  { name: "Noussair Mazraoui",  pos: "RB",  rating: 81, nat: "Morocco" },
  { name: "Adam Masina",        pos: "LB",  rating: 77, nat: "Morocco" },
  { name: "Azzedine Ounahi",    pos: "CM",  rating: 80, nat: "Morocco" },
  { name: "Sofyan Amrabat",     pos: "CDM", rating: 80, nat: "Morocco" },
  { name: "Selim Amallah",      pos: "CM",  rating: 77, nat: "Morocco" },
  { name: "Hakim Ziyech",       pos: "RW",  rating: 82, nat: "Morocco" },
  { name: "Abde Ezzalzouli",    pos: "LW",  rating: 79, nat: "Morocco" },
  { name: "Soufiane Rahimi",    pos: "RW",  rating: 79, nat: "Morocco" },
  { name: "Youssef En-Nesyri",  pos: "ST",  rating: 80, nat: "Morocco" },
  { name: "Ayoub El Kaabi",     pos: "ST",  rating: 78, nat: "Morocco" },
  { name: "Brahim Diaz",        pos: "CAM", rating: 80, nat: "Morocco" },
  { name: "Zakaria Aboukhlal",  pos: "LW",  rating: 76, nat: "Morocco" },
]);

write("USA", "International", "2025-26", [
  { name: "Matt Turner",        pos: "GK",  rating: 79, nat: "USA" },
  { name: "Zack Steffen",       pos: "GK",  rating: 77, nat: "USA" },
  { name: "Walker Zimmerman",   pos: "CB",  rating: 76, nat: "USA" },
  { name: "Chris Richards",     pos: "CB",  rating: 77, nat: "USA" },
  { name: "Cameron Carter-Vickers", pos: "CB", rating: 76, nat: "USA" },
  { name: "Sergino Dest",       pos: "RB",  rating: 79, nat: "USA" },
  { name: "Joe Scally",         pos: "RB",  rating: 76, nat: "USA" },
  { name: "Antonee Robinson",   pos: "LB",  rating: 79, nat: "USA" },
  { name: "Tyler Adams",        pos: "CDM", rating: 79, nat: "USA" },
  { name: "Weston McKennie",    pos: "CM",  rating: 78, nat: "USA" },
  { name: "Luca de la Torre",   pos: "CM",  rating: 75, nat: "USA" },
  { name: "Christian Pulisic",  pos: "RW",  rating: 82, nat: "USA" },
  { name: "Timothy Weah",       pos: "RW",  rating: 78, nat: "USA" },
  { name: "Gio Reyna",          pos: "CAM", rating: 78, nat: "USA" },
  { name: "Josh Sargent",       pos: "ST",  rating: 75, nat: "USA" },
  { name: "Ricardo Pepi",       pos: "ST",  rating: 78, nat: "USA" },
  { name: "Folarin Balogun",    pos: "ST",  rating: 76, nat: "USA" },
  { name: "Yunus Musah",        pos: "CM",  rating: 78, nat: "USA" },
]);

write("Japan", "International", "2025-26", [
  { name: "Shuichi Gonda",      pos: "GK",  rating: 78, nat: "Japan" },
  { name: "Zion Suzuki",        pos: "GK",  rating: 76, nat: "Japan" },
  { name: "Maya Yoshida",       pos: "CB",  rating: 79, nat: "Japan" },
  { name: "Ko Itakura",         pos: "CB",  rating: 78, nat: "Japan" },
  { name: "Takehiro Tomiyasu",  pos: "RB",  rating: 78, nat: "Japan" },
  { name: "Yuta Nakayama",      pos: "LB",  rating: 75, nat: "Japan" },
  { name: "Wataru Endo",        pos: "CDM", rating: 81, nat: "Japan" },
  { name: "Hidemasa Morita",    pos: "CM",  rating: 78, nat: "Japan" },
  { name: "Ritsu Doan",         pos: "RW",  rating: 79, nat: "Japan" },
  { name: "Kaoru Mitoma",       pos: "LW",  rating: 82, nat: "Japan" },
  { name: "Takefusa Kubo",      pos: "RW",  rating: 82, nat: "Japan" },
  { name: "Daichi Kamada",      pos: "CAM", rating: 80, nat: "Japan" },
  { name: "Junya Ito",          pos: "RW",  rating: 79, nat: "Japan" },
  { name: "Yuya Osako",         pos: "ST",  rating: 77, nat: "Japan" },
  { name: "Ayase Ueda",         pos: "ST",  rating: 77, nat: "Japan" },
  { name: "Keito Nakamura",     pos: "RW",  rating: 76, nat: "Japan" },
  { name: "Ao Tanaka",          pos: "CM",  rating: 78, nat: "Japan" },
]);

write("Canada", "International", "2025-26", [
  { name: "Milan Borjan",       pos: "GK",  rating: 77, nat: "Canada" },
  { name: "Maxime Crepeau",     pos: "GK",  rating: 75, nat: "Canada" },
  { name: "Kamal Miller",       pos: "CB",  rating: 76, nat: "Canada" },
  { name: "Derek Cornelius",    pos: "CB",  rating: 75, nat: "Canada" },
  { name: "Richie Laryea",      pos: "RB",  rating: 75, nat: "Canada" },
  { name: "Sam Adekugbe",       pos: "LB",  rating: 75, nat: "Canada" },
  { name: "Ismael Kone",        pos: "CM",  rating: 77, nat: "Canada" },
  { name: "Stephen Eustaquio",  pos: "CM",  rating: 78, nat: "Canada" },
  { name: "Samuel Piette",      pos: "CDM", rating: 74, nat: "Canada" },
  { name: "Liam Millar",        pos: "LW",  rating: 74, nat: "Canada" },
  { name: "Alphonso Davies",    pos: "LB",  rating: 82, nat: "Canada" },
  { name: "Jonathan David",     pos: "ST",  rating: 83, nat: "Canada" },
  { name: "Cyle Larin",         pos: "ST",  rating: 77, nat: "Canada" },
  { name: "Tajon Buchanan",     pos: "RW",  rating: 78, nat: "Canada" },
  { name: "Jacob Shaffelburg",  pos: "LW",  rating: 74, nat: "Canada" },
  { name: "Alistair Johnston",  pos: "RB",  rating: 78, nat: "Canada" },
]);

write("South Korea", "International", "2025-26", [
  { name: "Kim Seung-gyu",      pos: "GK",  rating: 79, nat: "South Korea" },
  { name: "Jo Hyeon-woo",       pos: "GK",  rating: 77, nat: "South Korea" },
  { name: "Kim Min-jae",        pos: "CB",  rating: 84, nat: "South Korea" },
  { name: "Kim Young-gwon",     pos: "CB",  rating: 77, nat: "South Korea" },
  { name: "Kim Jin-su",         pos: "LB",  rating: 75, nat: "South Korea" },
  { name: "Moon Seon-min",      pos: "RW",  rating: 75, nat: "South Korea" },
  { name: "Hwang In-beom",      pos: "CM",  rating: 78, nat: "South Korea" },
  { name: "Jung Woo-young",     pos: "CDM", rating: 76, nat: "South Korea" },
  { name: "Lee Kang-in",        pos: "CAM", rating: 80, nat: "South Korea" },
  { name: "Son Heung-min",      pos: "LW",  rating: 85, nat: "South Korea" },
  { name: "Hwang Hee-chan",     pos: "RW",  rating: 80, nat: "South Korea" },
  { name: "Cho Gue-sung",       pos: "ST",  rating: 78, nat: "South Korea" },
  { name: "Oh Hyeon-gyu",       pos: "ST",  rating: 76, nat: "South Korea" },
  { name: "Jeong Woo-yeong",    pos: "CM",  rating: 77, nat: "South Korea" },
  { name: "Na Sang-ho",         pos: "LW",  rating: 75, nat: "South Korea" },
  { name: "Yang Hyun-jun",      pos: "LW",  rating: 77, nat: "South Korea" },
]);

write("Nigeria", "International", "2025-26", [
  { name: "Francis Uzoho",      pos: "GK",  rating: 76, nat: "Nigeria" },
  { name: "Maduka Okoye",       pos: "GK",  rating: 75, nat: "Nigeria" },
  { name: "William Troost-Ekong", pos: "CB", rating: 79, nat: "Nigeria" },
  { name: "Chidozie Awaziem",   pos: "CB",  rating: 76, nat: "Nigeria" },
  { name: "Ola Aina",           pos: "RB",  rating: 77, nat: "Nigeria" },
  { name: "Zaidu Sanusi",       pos: "LB",  rating: 75, nat: "Nigeria" },
  { name: "Wilfred Ndidi",      pos: "CDM", rating: 79, nat: "Nigeria" },
  { name: "Alex Iwobi",         pos: "CM",  rating: 79, nat: "Nigeria" },
  { name: "Frank Onyeka",       pos: "CM",  rating: 76, nat: "Nigeria" },
  { name: "Samuel Chukwueze",   pos: "RW",  rating: 78, nat: "Nigeria" },
  { name: "Terem Moffi",        pos: "ST",  rating: 78, nat: "Nigeria" },
  { name: "Victor Osimhen",     pos: "ST",  rating: 89, nat: "Nigeria" }, // 89 in EAFC 25 (then went on loan)
  { name: "Ademola Lookman",    pos: "LW",  rating: 84, nat: "Nigeria" },
  { name: "Moses Simon",        pos: "LW",  rating: 78, nat: "Nigeria" },
  { name: "Taiwo Awoniyi",      pos: "ST",  rating: 79, nat: "Nigeria" },
]);

write("Egypt", "International", "2025-26", [
  { name: "Mohammed El-Shenawy", pos: "GK", rating: 79, nat: "Egypt" },
  { name: "Ahmed El-Shennawy",  pos: "GK",  rating: 76, nat: "Egypt" },
  { name: "Omar Kamal",         pos: "CB",  rating: 73, nat: "Egypt" },
  { name: "Ahmed Hegazy",       pos: "CB",  rating: 78, nat: "Egypt" },
  { name: "Mohamed Abdelmonem", pos: "CB",  rating: 75, nat: "Egypt" },
  { name: "Ahmed Eid",          pos: "RB",  rating: 72, nat: "Egypt" },
  { name: "Omar Gaber",         pos: "LB",  rating: 74, nat: "Egypt" },
  { name: "Hamdy Fathy",        pos: "CDM", rating: 75, nat: "Egypt" },
  { name: "Tarek Hamed",        pos: "CDM", rating: 74, nat: "Egypt" },
  { name: "Amr El-Sulaya",      pos: "CM",  rating: 74, nat: "Egypt" },
  { name: "Trezeguet",          pos: "RW",  rating: 78, nat: "Egypt" },
  { name: "Zizo",               pos: "LW",  rating: 74, nat: "Egypt" },
  { name: "Mohamed Salah",      pos: "RW",  rating: 88, nat: "Egypt" },
  { name: "Mostafa Mohamed",    pos: "ST",  rating: 77, nat: "Egypt" },
  { name: "Omar Marmoush",      pos: "ST",  rating: 80, nat: "Egypt" },
]);

write("Norway", "International", "2025-26", [
  { name: "Orjan Nyland",       pos: "GK",  rating: 77, nat: "Norway" },
  { name: "Ørjan Nyland",       pos: "GK",  rating: 77, nat: "Norway" },
  { name: "Stefan Strandberg",  pos: "CB",  rating: 76, nat: "Norway" },
  { name: "Leo Ostigard",       pos: "CB",  rating: 77, nat: "Norway" },
  { name: "Kristoffer Ajer",    pos: "CB",  rating: 78, nat: "Norway" },
  { name: "Birger Meling",      pos: "LB",  rating: 76, nat: "Norway" },
  { name: "Elias Solberg",      pos: "CM",  rating: 74, nat: "Norway" },
  { name: "Sander Berge",       pos: "CDM", rating: 79, nat: "Norway" },
  { name: "Fredrik Aursnes",    pos: "CM",  rating: 79, nat: "Norway" },
  { name: "Martin Odegaard",    pos: "CAM", rating: 88, nat: "Norway" },
  { name: "Alexander Sorloth",  pos: "ST",  rating: 80, nat: "Norway" },
  { name: "Erling Haaland",     pos: "ST",  rating: 91, nat: "Norway" },
  { name: "Mohamed Elyounoussi",pos: "LW",  rating: 78, nat: "Norway" },
  { name: "Kristian Thorstvedt",pos: "CM",  rating: 79, nat: "Norway" },
  { name: "Antonio Nusa",       pos: "RW",  rating: 77, nat: "Norway" },
]);

console.log(`Squad files written to: ${OUT_DIR}`);
console.log(`Total files: ${fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".json")).length}`);
