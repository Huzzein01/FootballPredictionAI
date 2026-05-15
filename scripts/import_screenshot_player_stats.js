const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCREENSHOT_DIR = "C:\\Users\\adebi\\OneDrive\\Pictures\\Screenshots";
const TESSERACT = "C:\\Program Files\\Tesseract-OCR\\tesseract.exe";
const PROCESSED_DIR = path.join(process.cwd(), "data", "fbref", "processed");
const JSON_PATH = path.join(PROCESSED_DIR, "fbref_player_stats.json");
const CSV_PATH = path.join(PROCESSED_DIR, "fbref_player_stats.csv");
const OCR_DIR = path.join(process.cwd(), "data", "fbref", "ocr");

const SEASON = "2025-26";
const FBREF_SEASON = "2025-2026";

const TEAMS = [
  { squad: "Barcelona", league: "La Liga", patterns: [/barcelona/i] },
  { squad: "Man United", league: "EPL", patterns: [/manchester united/i] },
  { squad: "Real Madrid", league: "La Liga", patterns: [/real madrid/i] },
  { squad: "Man City", league: "EPL", patterns: [/manchester city/i] },
  { squad: "Chelsea", league: "EPL", patterns: [/chelsea/i] },
  { squad: "Liverpool", league: "EPL", patterns: [/liverpool/i] },
  { squad: "Tottenham", league: "EPL", patterns: [/tottenham hotspur/i, /tottenham/i] },
  { squad: "Bayern Munich", league: "Bundesliga", patterns: [/bayern munich/i] },
  { squad: "Paris SG", league: "Ligue 1", patterns: [/paris saint.?germain/i, /paris sg/i] },
  { squad: "Ath Madrid", league: "La Liga", patterns: [/atl[eé]tico madrid/i, /atletico madrid/i] },
  { squad: "Arsenal", league: "EPL", patterns: [/arsenal/i] },
];

const COLUMN_RANGES = {
  standard: {
    player: [0.0, 0.132],
    pos: [0.19, 0.232],
    mp: [0.278, 0.314],
    starts: [0.314, 0.358],
    min: [0.358, 0.436],
    nineties: [0.436, 0.466],
    goals: [0.466, 0.499],
    assists: [0.499, 0.534],
    pk: [0.616, 0.649],
    pkatt: [0.649, 0.689],
    crdy: [0.689, 0.725],
    crdr: [0.725, 0.752],
  },
  shooting: {
    player: [0.0, 0.166],
    pos: [0.24, 0.292],
    nineties: [0.366, 0.405],
    goals: [0.405, 0.442],
    shots: [0.442, 0.482],
    shotsOnTarget: [0.482, 0.522],
    pk: [0.83, 0.868],
    pkatt: [0.868, 0.918],
  },
  goalkeeping: {
    player: [0.0, 0.16],
    mp: [0.25, 0.29],
    starts: [0.29, 0.34],
    min: [0.34, 0.405],
    nineties: [0.405, 0.44],
    ga: [0.44, 0.48],
    ga90: [0.48, 0.525],
    sota: [0.525, 0.575],
    saves: [0.575, 0.625],
    savePct: [0.625, 0.675],
    cs: [0.80, 0.835],
    csPct: [0.835, 0.88],
  },
};

function parseTsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split("\t");
  return lines
    .map((line) => {
      const cells = line.split("\t");
      return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    })
    .filter((row) => row.text !== undefined);
}

function loadExistingRows() {
  if (!fs.existsSync(JSON_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
  return Array.isArray(data.rows) ? data.rows.filter((row) => String(row.ScreenshotSource).toLowerCase() !== "true") : [];
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))];
  fs.writeFileSync(CSV_PATH, lines.join("\n"));
}

function cleanWord(text) {
  return String(text || "")
    .replace(/[|[\]{}]/g, "")
    .replace(/[^\p{L}\p{N}\-'.À-ž ]/gu, "")
    .trim();
}

function cleanPlayerName(text) {
  return text
    .replace(/\b[Pp]aver\b/g, "")
    .replace(/\bPlayer\b/gi, "")
    .replace(/\bNation\b/gi, "")
    .replace(/\bMatches\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(text, options = {}) {
  let value = String(text || "")
    .replace(/,/g, "")
    .replace(/[|[\]()]/g, "")
    .replace(/[Oo]/g, "0")
    .replace(/[^\d.+-]/g, "");
  if (!value || value === "." || value === "-") return "";
  const match = value.match(/[+-]?\d+(?:\.\d+)?/);
  if (!match) return "";
  value = match[0];
  if (options.decimalTenths && !value.includes(".") && /^\d{2,3}$/.test(value)) {
    value = `${value.slice(0, -1)}.${value.slice(-1)}`;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function numericTokensAfterAge(text) {
  const normalized = String(text || "").replace(/,/g, "");
  const ageMatch = normalized.match(/\b\d{2}-\d{3}\b/);
  if (!ageMatch) return [];
  return [...normalized.slice(ageMatch.index + ageMatch[0].length).matchAll(/[+-]?\d+(?:\.\d+)?/g)].map((match) => match[0]);
}

function ninetiesFromMinutes(minValue, fallbackToken) {
  const min = parseNumber(minValue);
  if (min !== "" && min > 0) return Number((min / 90).toFixed(1));
  return parseNumber(fallbackToken, { decimalTenths: true });
}

function parseStandardPerformance(tokens) {
  const values = tokens.map((token) => parseNumber(token));
  let gls = values[0];
  let ast = values[1];
  let offset = 0;
  const combined = String(tokens[0] || "").replace(/[^\d]/g, "");
  const next = values[1];

  if (gls > 60 && Number.isFinite(next)) {
    for (let split = 1; split < combined.length; split += 1) {
      const left = Number(combined.slice(0, split));
      const right = Number(combined.slice(split));
      if (left <= 60 && right <= 50 && left + right === next) {
        gls = left;
        ast = right;
        offset = -1;
        break;
      }
    }
  }

  if (gls >= 20 && gls % 10 === 0 && Number.isFinite(ast) && Number.isFinite(values[2])) {
    const firstDigit = Number(String(gls)[0]);
    if (firstDigit + ast === values[2]) gls = firstDigit;
  }

  return {
    gls,
    ast,
    pk: values[4 + offset],
    pkatt: values[5 + offset],
    crdy: values[6 + offset],
    crdr: values[7 + offset],
  };
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
      conf: Number(row.conf),
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
    .sort((a, b) => Math.min(...a.map((w) => w.top)) - Math.min(...b.map((w) => w.top)));
}

function classifyFromText(text) {
  const compact = text.replace(/\s+/g, " ");
  let tableType = null;
  if (/scores\s*&\s*fixtures/i.test(compact)) tableType = "fixtures";
  else if (/shooting/i.test(compact)) tableType = "shooting";
  else if (/goalkeeping/i.test(compact)) tableType = "goalkeeping";
  else if (/standard stats/i.test(compact)) tableType = "standard";
  else if (/miscellaneous stats|tklw|pkwon|pkcon|\bfls\b|\bfld\b/i.test(compact)) tableType = "misc";
  else if (/playing time|praying.? ?tine|mn\/mp|mn\/start|unsub|team success|compl/i.test(compact)) tableType = "playingTime";

  const team = TEAMS.find((candidate) => candidate.patterns.some((pattern) => pattern.test(compact)));
  return { tableType, team };
}

function cellText(words, width, range) {
  const [start, end] = range;
  return words
    .filter((word) => {
      const center = (word.left + word.width / 2) / width;
      return center >= start && center < end;
    })
    .map((word) => cleanWord(word.text))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function parsePlayerLine(words, width, context, sourceFile) {
  const ranges = COLUMN_RANGES[context.tableType];
  if (!ranges) return null;
  const lineText = words.map((word) => word.text).join(" ");
  if (!/matches/i.test(lineText)) return null;
  if (/squad total|opponent total|player|nation|playing time|performance|per 90/i.test(lineText)) return null;

  const player = cleanPlayerName(cellText(words, width, ranges.player));
  if (!player || player.length < 3 || /\d/.test(player)) return null;
  const sequence = numericTokensAfterAge(lineText);

  const base = {
    season: SEASON,
    fbrefSeason: FBREF_SEASON,
    league: context.team.league,
    sourceFile,
    Player: player,
    Squad: context.team.squad,
    ScreenshotSource: "true",
  };

  if (context.tableType === "standard") {
    const min = parseNumber(sequence[2] ?? cellText(words, width, ranges.min));
    const perf = parseStandardPerformance(sequence.slice(4));
    return {
      ...base,
      statType: "standard",
      Pos: cellText(words, width, ranges.pos),
      MP: parseNumber(sequence[0] ?? cellText(words, width, ranges.mp)),
      Starts: parseNumber(sequence[1] ?? cellText(words, width, ranges.starts)),
      Min: min,
      "90s": ninetiesFromMinutes(min, sequence[3] ?? cellText(words, width, ranges.nineties)),
      Gls: perf.gls ?? parseNumber(cellText(words, width, ranges.goals)),
      Ast: perf.ast ?? parseNumber(cellText(words, width, ranges.assists)),
      PK: perf.pk ?? parseNumber(cellText(words, width, ranges.pk)),
      PKatt: perf.pkatt ?? parseNumber(cellText(words, width, ranges.pkatt)),
      CrdY: perf.crdy ?? parseNumber(cellText(words, width, ranges.crdy)),
      CrdR: perf.crdr ?? parseNumber(cellText(words, width, ranges.crdr)),
    };
  }

  if (context.tableType === "shooting") {
    return {
      ...base,
      statType: "shooting",
      Pos: cellText(words, width, ranges.pos),
      "90s": parseNumber(sequence[0] ?? cellText(words, width, ranges.nineties), { decimalTenths: true }),
      Gls: parseNumber(sequence[1] ?? cellText(words, width, ranges.goals)),
      Sh: parseNumber(sequence[2] ?? cellText(words, width, ranges.shots)),
      SoT: parseNumber(sequence[3] ?? cellText(words, width, ranges.shotsOnTarget)),
      PK: parseNumber(sequence[9] ?? cellText(words, width, ranges.pk)),
      PKatt: parseNumber(sequence[10] ?? cellText(words, width, ranges.pkatt)),
    };
  }

  if (context.tableType === "goalkeeping") {
    const min = parseNumber(sequence[2] ?? cellText(words, width, ranges.min));
    return {
      ...base,
      statType: "goalkeeping",
      Pos: "GK",
      MP: parseNumber(sequence[0] ?? cellText(words, width, ranges.mp)),
      Starts: parseNumber(sequence[1] ?? cellText(words, width, ranges.starts)),
      Min: min,
      "90s": ninetiesFromMinutes(min, sequence[3] ?? cellText(words, width, ranges.nineties)),
      GA: parseNumber(sequence[4] ?? cellText(words, width, ranges.ga)),
      GA90: parseNumber(sequence[5] ?? cellText(words, width, ranges.ga90)),
      SoTA: parseNumber(sequence[6] ?? cellText(words, width, ranges.sota)),
      Saves: parseNumber(sequence[7] ?? cellText(words, width, ranges.saves)),
      "Save%": parseNumber(sequence[8] ?? cellText(words, width, ranges.savePct)),
      CS: parseNumber(sequence[12] ?? cellText(words, width, ranges.cs)),
      "CS%": parseNumber(sequence[13] ?? cellText(words, width, ranges.csPct)),
    };
  }

  return null;
}

function rowKey(row) {
  return [row.season, row.league, row.Squad, row.Player, row.statType, row.sourceFile].join("||").toLowerCase();
}

function validImportedRow(row) {
  if (!row || !row.Player || !row.Squad || !row.statType) return false;
  if (row["90s"] !== "" && row["90s"] > 50) return false;
  if (row.statType === "standard") {
    if (row.Gls !== "" && row.Gls > 60) return false;
    if (row.Ast !== "" && row.Ast > 50) return false;
    return row.Gls !== "" || row.Ast !== "" || row["90s"] !== "";
  }
  if (row.statType === "shooting") {
    if (row.Sh !== "" && row.Sh > 250) return false;
    if (row.SoT !== "" && row.SoT > 120) return false;
    return row.Sh !== "" || row.SoT !== "";
  }
  if (row.statType === "goalkeeping") return row.GA !== "" || row.Saves !== "";
  return false;
}

function screenshotFiles() {
  const provided = process.argv.slice(2);
  if (provided.length) return provided.map((file) => path.resolve(file));
  return fs
    .readdirSync(SCREENSHOT_DIR)
    .filter((file) => /^Screenshot 2026-05-14 .*\.png$/i.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(SCREENSHOT_DIR, file));
}

function main() {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  fs.mkdirSync(OCR_DIR, { recursive: true });

  const imported = [];
  const summary = {};
  let context = null;

  for (const file of screenshotFiles()) {
    const sourceFile = path.basename(file);
    const tsv = execFileSync(TESSERACT, [file, "stdout", "--psm", "6", "-l", "eng", "tsv"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    fs.writeFileSync(path.join(OCR_DIR, `${sourceFile}.tsv`), tsv);
    const rows = parseTsv(tsv);
    const page = rows.find((row) => row.level === "1");
    const width = Number(page?.width || 1);
    const groups = lineGroups(rows);
    const allText = groups.map((group) => group.map((word) => word.text).join(" ")).join(" ");
    const classified = classifyFromText(allText);

    if (classified.tableType || classified.team) {
      context = {
        tableType: classified.tableType || context?.tableType,
        team: classified.team || context?.team,
      };
    }

    if (!context?.team || !["standard", "shooting", "goalkeeping"].includes(context.tableType)) continue;

    let fileRows = 0;
    for (const group of groups) {
      const row = parsePlayerLine(group, width, context, sourceFile);
      if (!validImportedRow(row)) continue;
      imported.push(row);
      fileRows += 1;
    }

    if (fileRows) {
      const key = `${context.team.squad}|${context.tableType}`;
      summary[key] = (summary[key] || 0) + fileRows;
    }
  }

  const screenshotStandardSquads = new Set(imported.filter((row) => row.statType === "standard").map((row) => row.Squad));
  const existingRows = loadExistingRows().filter(
    (row) => !(String(row.ThunderbitSource).toLowerCase() === "true" && screenshotStandardSquads.has(row.Squad))
  );
  const combined = [...existingRows, ...imported];
  const seen = new Set();
  const rows = combined.filter((row) => {
    const key = rowKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(JSON_PATH, JSON.stringify({ importedAt: new Date().toISOString(), rows }, null, 2));
  writeCsv(rows);

  console.log(`Imported ${imported.length} screenshot player-stat rows.`);
  console.log(`Processed player-stat rows now available: ${rows.length}`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`JSON: ${JSON_PATH}`);
  console.log(`CSV: ${CSV_PATH}`);
  console.log(`OCR TSV directory: ${OCR_DIR}`);
}

main();
