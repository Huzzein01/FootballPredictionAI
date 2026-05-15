const { predictMatch } = require("./predictionService");
const { getLiveContext } = require("./liveData");

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function main() {
  const league = arg("league", "EPL");
  const home = arg("home");
  const away = arg("away");
  const provider = arg("provider");

  if (!home || !away) {
    console.error("Usage: node src/predict.js --league=EPL --home=\"Man United\" --away=\"Chelsea\" [--provider=footballData]");
    process.exit(1);
  }

  const output = predictMatch({
    league,
    season: arg("season", "2025-26"),
    homeTeam: home,
    awayTeam: away,
    homeOdds: arg("homeOdds"),
    drawOdds: arg("drawOdds"),
    awayOdds: arg("awayOdds"),
  });

  if (provider) {
    try {
      output.liveContext = await getLiveContext({
        provider,
        competitionCode: arg("competitionCode"),
        teamId: arg("teamId"),
        fixtureId: arg("fixtureId"),
        season: arg("season"),
      });
    } catch (error) {
      output.liveContextError = error.message;
    }
  }

  console.log(JSON.stringify(output, null, 2));
}

main();
