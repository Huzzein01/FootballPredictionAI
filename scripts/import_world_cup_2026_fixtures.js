const fs = require("fs");
const path = require("path");

const OUT_PATH = path.join(process.cwd(), "data", "international", "world_cup_2026_fixtures.json");
const FIFA_MATCHES_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=200&idCompetition=17&idSeason=285023";

function text(value) {
  if (Array.isArray(value)) {
    return value.find((item) => /^en/i.test(item.Locale || ""))?.Description || value[0]?.Description || "";
  }
  return "";
}

function team(match, side) {
  const source = match[side] || {};
  const name = text(source.TeamName) || source.ShortClubName || source.Abbreviation || "";
  return {
    name,
    code: source.Abbreviation || source.IdCountry || "",
    countryCode: source.IdCountry || source.Abbreviation || "",
    placeholder: side === "Home" ? match.PlaceHolderA || "" : match.PlaceHolderB || "",
    flagUrl: source.PictureUrl ? source.PictureUrl.replace("{format}", "sq").replace("{size}", "4") : "",
  };
}

function groupLetter(groupName) {
  const match = String(groupName || "").match(/Group\s+([A-L])/i);
  return match ? match[1].toUpperCase() : "";
}

async function main() {
  const response = await fetch(FIFA_MATCHES_URL, { headers: { "user-agent": "FootballPredictionAI fixture importer" } });
  if (!response.ok) throw new Error(`FIFA schedule fetch failed: ${response.status}`);
  const payload = await response.json();
  const fixtures = (payload.Results || [])
    .filter((match) => text(match.StageName) === "First Stage")
    .sort((a, b) => Number(a.MatchNumber || 0) - Number(b.MatchNumber || 0))
    .map((match) => {
      const groupName = text(match.GroupName);
      const home = team(match, "Home");
      const away = team(match, "Away");
      const stadium = match.Stadium || {};
      return {
        matchNumber: Number(match.MatchNumber),
        idMatch: match.IdMatch || "",
        date: String(match.LocalDate || match.Date || "").slice(0, 10),
        kickoffUtc: match.Date || "",
        kickoffLocal: match.LocalDate || "",
        timeDefined: Boolean(match.TimeDefined),
        stage: text(match.StageName),
        group: groupName,
        groupLetter: groupLetter(groupName),
        league: "World Cup 2026",
        season: "2026 World Cup",
        homeTeam: home.name,
        awayTeam: away.name,
        homeCode: home.code,
        awayCode: away.code,
        homePlaceholder: home.placeholder,
        awayPlaceholder: away.placeholder,
        homeFlagUrl: home.flagUrl,
        awayFlagUrl: away.flagUrl,
        venue: text(stadium.Name),
        city: text(stadium.CityName),
        hostCountry: stadium.IdCountry || "",
      };
    });

  if (fixtures.length !== 72) {
    throw new Error(`Expected 72 group-stage fixtures, imported ${fixtures.length}`);
  }

  const groups = {};
  for (const fixture of fixtures) {
    groups[fixture.groupLetter] ||= new Set();
    groups[fixture.groupLetter].add(fixture.homeTeam);
    groups[fixture.groupLetter].add(fixture.awayTeam);
  }

  const data = {
    importedAt: new Date().toISOString(),
    competition: "FIFA World Cup 2026",
    season: "2026 World Cup",
    phase: "Group stage",
    source: {
      name: "FIFA public matches API",
      url: FIFA_MATCHES_URL,
      sourceDocument: "FWC26 Match Schedule_v17_10042026_EN.pdf",
      sourceDocumentDate: "2026-04-10",
    },
    focusPolicy: "International mode treats every World Cup 2026 group-stage team as in-scope.",
    groupCount: Object.keys(groups).length,
    fixtureCount: fixtures.length,
    teams: [...new Set(fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam]))].sort(),
    groups: Object.fromEntries(Object.entries(groups).map(([group, teams]) => [group, [...teams].sort()])),
    fixtures,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2));
  console.log(`Imported ${fixtures.length} World Cup 2026 group-stage fixtures to ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
