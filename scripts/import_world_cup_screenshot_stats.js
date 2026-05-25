const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR || path.join(process.cwd(), "data", "screenshots_2025_26");
const TESSERACT = process.env.TESSERACT_PATH || "tesseract";
const PROCESSED_DIR = path.join(process.cwd(), "data", "international", "processed");
const OCR_DIR = path.join(process.cwd(), "data", "international", "ocr");
const PLAYER_JSON_PATH = path.join(PROCESSED_DIR, "world_cup_player_stats.json");
const PLAYER_CSV_PATH = path.join(PROCESSED_DIR, "world_cup_player_stats.csv");
const SQUAD_JSON_PATH = path.join(PROCESSED_DIR, "world_cup_squad_stats.json");
const SQUAD_CSV_PATH = path.join(PROCESSED_DIR, "world_cup_squad_stats.csv");

const COUNTRY_PATTERNS = [
  ["Argentina", /argentina|argent[il]na/i],
  ["Australia", /australia/i],
  ["Belgium", /belgium|belglum/i],
  ["Brazil", /brazil|brasil/i],
  ["Cameroon", /cameroon|camer[co]on/i],
  ["Canada", /canada|conada/i],
  ["Colombia", /colombia/i],
  ["Costa Rica", /costa\s*rica|coste\s*rica/i],
  ["Croatia", /croatia/i],
  ["Denmark", /denmark/i],
  ["Ecuador", /ecuador/i],
  ["Egypt", /egypt/i],
  ["England", /england/i],
  ["France", /france/i],
  ["Germany", /germany/i],
  ["Ghana", /\bghana\b|\bhana\b/i],
  ["Iceland", /iceland/i],
  ["IR Iran", /ir\s*iran|iran/i],
  ["Japan", /japan/i],
  ["Korea Republic", /korea\s*republic|korea/i],
  ["Mexico", /mexico/i],
  ["Morocco", /morocco/i],
  ["Netherlands", /netherlands/i],
  ["Nigeria", /nigeria/i],
  ["Panama", /panama/i],
  ["Peru", /\bperu\b/i],
  ["Poland", /poland/i],
  ["Portugal", /portugal/i],
  ["Qatar", /qatar/i],
  ["Russia", /russia/i],
  ["Saudi Arabia", /saudi|seudi|arabia/i],
  ["Senegal", /senegal|seneoal/i],
  ["Serbia", /serbia/i],
  ["Spain", /spain/i],
  ["Sweden", /sweden/i],
  ["Switzerland", /switzerland|suitzer/i],
  ["Tunisia", /tunisia|tunisie|tunisla/i],
  ["United States", /united\s*states|states/i],
  ["Uruguay", /uruguay/i],
  ["Wales", /wales/i],
];

const PROFILE_CORRECTIONS = [
  { season: "2022 World Cup", Player: "Kylian Mbappe", Squad: "France", MP: 7, Starts: 6, Min: 598, "90s": 6.6, Gls: 8, Ast: 2, PK: 2, PKatt: 2, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Lionel Messi", Squad: "Argentina", MP: 7, Starts: 7, Min: 690, "90s": 7.7, Gls: 7, Ast: 3, PK: 4, PKatt: 5, CrdY: 1, CrdR: 0 },
  { season: "2022 World Cup", Player: "Cristiano Ronaldo", Squad: "Portugal", MP: 5, Starts: 3, Min: 290, "90s": 3.2, Gls: 1, Ast: 0, PK: 1, PKatt: 1, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Ousmane Dembele", Squad: "France", MP: 7, Starts: 6, Min: 433, "90s": 4.8, Gls: 0, Ast: 2, PK: 0, PKatt: 0, CrdY: 1, CrdR: 0 },
  { season: "2022 World Cup", Player: "Raphinha", Squad: "Brazil", MP: 5, Starts: 4, Min: 315, "90s": 3.5, Gls: 0, Ast: 1, PK: 0, PKatt: 0, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Phil Foden", Squad: "England", MP: 4, Starts: 3, Min: 258, "90s": 2.9, Gls: 1, Ast: 2, PK: 0, PKatt: 0, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Harry Kane", Squad: "England", MP: 5, Starts: 5, Min: 402, "90s": 4.5, Gls: 2, Ast: 3, PK: 1, PKatt: 2, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Bukayo Saka", Squad: "England", MP: 4, Starts: 4, Min: 288, "90s": 3.2, Gls: 3, Ast: 0, PK: 0, PKatt: 0, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Achraf Hakimi", Squad: "Morocco", MP: 7, Starts: 7, Min: 631, "90s": 7.0, Gls: 0, Ast: 1, PK: 0, PKatt: 0, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Jamal Musiala", Squad: "Germany", MP: 3, Starts: 3, Min: 258, "90s": 2.9, Gls: 0, Ast: 1, PK: 0, PKatt: 0, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Bruno Fernandes", Squad: "Portugal", MP: 4, Starts: 4, Min: 356, "90s": 4.0, Gls: 2, Ast: 3, PK: 1, PKatt: 1, CrdY: 1, CrdR: 0 },
  { season: "2022 World Cup", Player: "Pedri", Squad: "Spain", MP: 4, Starts: 4, Min: 356, "90s": 4.0, Gls: 0, Ast: 0, PK: 0, PKatt: 0, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Vinicius Junior", Squad: "Brazil", MP: 4, Starts: 4, Min: 299, "90s": 3.3, Gls: 1, Ast: 2, PK: 0, PKatt: 0, CrdY: 0, CrdR: 0 },
  { season: "2022 World Cup", Player: "Neymar", Squad: "Brazil", MP: 3, Starts: 3, Min: 279, "90s": 3.1, Gls: 2, Ast: 0, PK: 1, PKatt: 1, CrdY: 1, CrdR: 0 },
  { season: "2018 World Cup", Player: "Kylian Mbappe", Squad: "France", MP: 7, Starts: 6, Min: 532, "90s": 5.9, Gls: 4, Ast: 0, PK: 0, PKatt: 0, CrdY: 2, CrdR: 0 },
  { season: "2018 World Cup", Player: "Cristiano Ronaldo", Squad: "Portugal", MP: 4, Starts: 4, Min: 360, "90s": 4.0, Gls: 4, Ast: 0, PK: 1, PKatt: 2, CrdY: 0, CrdR: 0 },
  { season: "2018 World Cup", Player: "Lionel Messi", Squad: "Argentina", MP: 4, Starts: 4, Min: 360, "90s": 4.0, Gls: 1, Ast: 2, PK: 0, PKatt: 1, CrdY: 0, CrdR: 0 },
  { season: "2018 World Cup", Player: "Ousmane Dembele", Squad: "France", MP: 4, Starts: 2, Min: 165, "90s": 1.8, Gls: 0, Ast: 0, PK: 0, PKatt: 0, CrdY: 0, CrdR: 0 },
  { season: "2018 World Cup", Player: "Achraf Hakimi", Squad: "Morocco", MP: 3, Starts: 3, Min: 270, "90s": 3.0, Gls: 0, Ast: 0, PK: 0, PKatt: 0, CrdY: 1, CrdR: 0 },
  { season: "2018 World Cup", Player: "Harry Kane", Squad: "England", MP: 6, Starts: 6, Min: 572, "90s": 6.4, Gls: 6, Ast: 0, PK: 3, PKatt: 3, CrdY: 0, CrdR: 0 },
];

function screenshotFiles() {
  const provided = process.argv.slice(2);
  if (provided.length) return provided.map((file) => path.resolve(file));
  return fs
    .readdirSync(SCREENSHOT_DIR)
    .filter((file) => /^Screenshot 2026-05-18 (145|150)\d{3}\.png$/i.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(SCREENSHOT_DIR, file));
}

function parseTsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split("\t");
  return lines.map((line) => {
    const cells = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function lineGroups(rows) {
  const words = rows
    .filter((row) => row.level === "5" && row.text && Number(row.conf) > -1)
    .map((row) => ({
      text: row.text,
      left: Number(row.left),
      top: Number(row.top),
      width: Number(row.width),
      height: Number(row.height),
      block: row.block_num,
      par: row.par_num,
      line: row.line_num,
    }));
  const grouped = new Map();
  for (const word of words) {
    const key = `${word.block}|${word.par}|${word.line}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(word);
  }
  return [...grouped.values()]
    .map((group) => group.sort((a, b) => a.left - b.left))
    .sort((a, b) => Math.min(...a.map((word) => word.top)) - Math.min(...b.map((word) => word.top)));
}

function cleanText(value) {
  return String(value || "")
    .replace(/[|[\]{}]/g, " ")
    .replace(/[^\p{L}\p{N}\-'.À-ž ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value, { nineties = false } = {}) {
  const match = String(value ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return 0;
  let text = match[0];
  if (nineties && !text.includes(".") && /^\d{2}$/.test(text)) text = `${text[0]}.${text[1]}`;
  if (nineties && !text.includes(".") && /^\d{1}$/.test(text)) text = `${text}.0`;
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function ninetiesFrom(value, minutes) {
  const n = parseNumber(value, { nineties: true });
  if (n > 0 && n < 15) return n;
  return minutes ? Number((minutes / 90).toFixed(1)) : n;
}

function seasonForFile(file) {
  return path.basename(file).includes("145") ? { season: "2022 World Cup", fbrefSeason: "2022" } : { season: "2018 World Cup", fbrefSeason: "2018" };
}

function findCountry(text) {
  const clean = cleanText(text);
  for (const [country, pattern] of COUNTRY_PATTERNS) {
    const match = clean.match(pattern);
    if (match) return { country, index: match.index };
  }
  return null;
}

function numericTokens(text) {
  return [...String(text || "").replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((match) => match[0]);
}

function tokensAfterBirth(tokens) {
  const birthIndex = tokens.findLastIndex((token) => {
    const value = Number(token);
    return Number.isInteger(value) && value >= 1970 && value <= 2005;
  });
  return birthIndex >= 0 ? tokens.slice(birthIndex + 1) : tokens;
}

function normalizePlayingTokens(tokens) {
  const t = [...tokens];
  while (t.length && Number(t[0]) > 50) t.shift();
  if (t.length >= 4 && /^\d{4}$/.test(String(t[1])) && Number(t[1]) > 1000) {
    const joined = String(t[1]);
    t.splice(1, 1, joined[0], joined.slice(1));
  }
  if (t.length >= 4 && /^\d{3,4}$/.test(String(t[2])) && Number(t[2]) > 900) {
    const joined = String(t[2]);
    t.splice(2, 1, joined.slice(0, -3) || "0", joined.slice(-3));
  }
  return t;
}

function playerNameFromLine(lineText, countryMatch) {
  const withoutRank = cleanText(lineText).replace(/^\D*\d+\s+/, "");
  const beforeCountry = countryMatch ? withoutRank.slice(0, countryMatch.index).trim() : withoutRank;
  const positionMatch = beforeCountry.match(/^(.+?)\s+(?:GK|DF|MF|FW|[DGFMR]{1,2},[DGFMR]{1,2}|D[RE]?MF|FW,MF|MF,FW|DF,MF|MF,DF|oF|Me|Mr)\b/i);
  return cleanText(positionMatch ? positionMatch[1] : beforeCountry).replace(/\b(Player|Matches|Paver)\b/gi, "").trim();
}

function parsePlayerLine(words, seasonInfo, sourceFile) {
  const lineText = words.map((word) => word.text).join(" ");
  if (!/matches/i.test(lineText) || /player|standard|per90|performance|playing time/i.test(lineText)) return null;
  const countryMatch = findCountry(lineText);
  if (!countryMatch) return null;
  const player = playerNameFromLine(lineText, countryMatch);
  if (!player || player.length < 3 || /\d/.test(player)) return null;

  let tail = normalizePlayingTokens(tokensAfterBirth(numericTokens(lineText)));
  if (tail.length > 17) tail = tail.slice(-17);
  if (tail.length < 12) return null;

  const mp = parseNumber(tail[0]);
  const starts = parseNumber(tail[1]);
  const rawMinutes = parseNumber(tail[2]);
  const nineties = ninetiesFrom(tail[3], rawMinutes);
  const minutes = rawMinutes >= 30 ? rawMinutes : Math.round(nineties * 90);
  const goals = parseNumber(tail[4]);
  const assists = parseNumber(tail[5]);
  const pk = parseNumber(tail[8]);
  const pkatt = parseNumber(tail[9]);
  const crdy = parseNumber(tail[10]);
  const crdr = parseNumber(tail[11]);

  if (!mp && !minutes && !goals && !assists) return null;
  return {
    season: seasonInfo.season,
    fbrefSeason: seasonInfo.fbrefSeason,
    league: "International",
    sourceFile,
    Player: player,
    Squad: countryMatch.country,
    statType: "standard",
    Pos: "",
    MP: mp,
    Starts: starts,
    Min: minutes,
    "90s": nineties,
    Gls: goals,
    Ast: assists,
    "G+A": goals + assists,
    PK: pk,
    PKatt: pkatt,
    CrdY: crdy,
    CrdR: crdr,
    WorldCupScreenshotSource: "true",
  };
}

function parseSquadLine(words, seasonInfo, sourceFile) {
  const lineText = words.map((word) => word.text).join(" ");
  if (/squad|playing time|performance|per 90|opponent|glossary/i.test(lineText)) return null;
  const countryMatch = findCountry(lineText);
  if (!countryMatch) return null;
  let tail = numericTokens(lineText);
  if (tail.length > 20) tail = tail.slice(-20);
  if (tail.length < 14) return null;

  const playerCount = parseNumber(tail[0]);
  const avgAge = parseNumber(tail[1], { nineties: true });
  const possession = parseNumber(tail[2], { nineties: true });
  const mp = parseNumber(tail[3]);
  const starts = parseNumber(tail[4]);
  const minutes = parseNumber(tail[5]);
  const nineties = ninetiesFrom(tail[6], minutes);
  const goals = parseNumber(tail[7]);
  const assists = parseNumber(tail[8]);
  if (!playerCount || !mp) return null;

  return {
    season: seasonInfo.season,
    fbrefSeason: seasonInfo.fbrefSeason,
    league: "International",
    sourceFile,
    Squad: countryMatch.country,
    playerCount,
    avgAge,
    possession,
    MP: mp,
    Starts: starts,
    Min: minutes,
    "90s": nineties,
    Gls: goals,
    Ast: assists,
    "G+A": goals + assists,
    PK: parseNumber(tail[11]),
    PKatt: parseNumber(tail[12]),
    CrdY: parseNumber(tail[13]),
    CrdR: parseNumber(tail[14]),
    WorldCupScreenshotSource: "true",
  };
}

function rowKey(row) {
  return [row.season, row.league, row.Squad, row.Player || "squad", row.statType || "squad"].join("||").toLowerCase();
}

function normalizedKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function correctionKey(row) {
  return [row.season, normalizedKey(row.Squad), normalizedKey(row.Player)].join("||");
}

function applyProfileCorrections(rows) {
  const correctionKeys = new Set(PROFILE_CORRECTIONS.map(correctionKey));
  const filtered = rows.filter((row) => !correctionKeys.has(correctionKey(row)));
  const corrections = PROFILE_CORRECTIONS.map((row) => ({
    ...row,
    fbrefSeason: row.season.startsWith("2022") ? "2022" : "2018",
    league: "International",
    sourceFile: "FBref screenshot manual verification",
    statType: "standard",
    Pos: "",
    "G+A": Number(row.Gls || 0) + Number(row.Ast || 0),
    WorldCupScreenshotSource: "true",
    ManualVerification: "true",
  }));
  return [...filtered, ...corrections];
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))];
  fs.writeFileSync(filePath, lines.join("\n"));
}

function main() {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  fs.mkdirSync(OCR_DIR, { recursive: true });

  const playerRows = [];
  const squadRows = [];
  for (const file of screenshotFiles()) {
    const sourceFile = path.basename(file);
    const seasonInfo = seasonForFile(file);
    const tsv = execFileSync(TESSERACT, [file, "stdout", "--psm", "6", "-l", "eng", "tsv"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    fs.writeFileSync(path.join(OCR_DIR, `${sourceFile}.tsv`), tsv);
    const groups = lineGroups(parseTsv(tsv));
    const pageText = groups.map((group) => group.map((word) => word.text).join(" ")).join(" ");
    const isSquad = /squad standard stats/i.test(pageText);
    const isPlayer = /player standard stats/i.test(pageText) || !isSquad;
    for (const group of groups) {
      const row = isSquad ? parseSquadLine(group, seasonInfo, sourceFile) : isPlayer ? parsePlayerLine(group, seasonInfo, sourceFile) : null;
      if (!row) continue;
      (isSquad ? squadRows : playerRows).push(row);
    }
  }

  const correctedPlayerRows = applyProfileCorrections(playerRows);
  const uniquePlayers = correctedPlayerRows.filter((row, index, rows) => rows.findIndex((candidate) => rowKey(candidate) === rowKey(row)) === index);
  const uniqueSquads = squadRows.filter((row, index, rows) => rows.findIndex((candidate) => rowKey(candidate) === rowKey(row)) === index);
  fs.writeFileSync(PLAYER_JSON_PATH, JSON.stringify({ importedAt: new Date().toISOString(), rows: uniquePlayers }, null, 2));
  fs.writeFileSync(SQUAD_JSON_PATH, JSON.stringify({ importedAt: new Date().toISOString(), rows: uniqueSquads }, null, 2));
  writeCsv(PLAYER_CSV_PATH, uniquePlayers);
  writeCsv(SQUAD_CSV_PATH, uniqueSquads);

  const bySeason = (rows) =>
    rows.reduce((summary, row) => {
      summary[row.season] = (summary[row.season] || 0) + 1;
      return summary;
    }, {});
  console.log(`Imported ${uniquePlayers.length} World Cup player standard rows.`);
  console.log(`Imported ${uniqueSquads.length} World Cup squad standard rows.`);
  console.log(JSON.stringify({ playerRows: bySeason(uniquePlayers), squadRows: bySeason(uniqueSquads) }, null, 2));
  console.log(`Player JSON: ${PLAYER_JSON_PATH}`);
  console.log(`Squad JSON: ${SQUAD_JSON_PATH}`);
}

main();
