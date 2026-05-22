# Live Data Options

## Recommended path

Use ESPN's public soccer JSON endpoints for low-friction standings, fixtures, scores, and team metadata, then layer a paid odds provider for bookmaker lines.

## Current integration

- `src/espnFixtureService.js` now calls ESPN's public scoreboard/event feed for EPL, La Liga, Bundesliga, Ligue 1, and Serie A.
- `/api/fixture-predictions` refreshes ESPN fixtures before rebuilding the prediction board.
- `/api/fixtures/espn-refresh` can force a manual ESPN fixture refresh.
- ESPN fixtures are merged into `data/remaining_fixtures_2025_26_with_odds.csv` without overwriting existing public odds.
- The last ESPN pull is cached in `data/live_espn_fixtures.json` for auditability.

## Candidates

- ESPN public soccer endpoints
  - Useful for scoreboards, schedules, standings, teams, and crest metadata.
  - Already compatible with the model's current public-standings approach.
  - Example scoreboard shape: `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard`.
  - Limitation: not an official paid SLA product, and bookmaker odds coverage can be incomplete.

- The Odds API
  - Useful for public bookmaker odds, including soccer `h2h` and outright markets where supported.
  - Docs expose sports discovery, odds, scores, events, historical odds, and event-odds endpoints.
  - Good fit for missing-odds repair because the model can query by sport key and date window.
  - Limitation: requires an API key and quota planning.

- API-Football / API-Sports
  - Useful for fixtures, standings, lineups, team/player stats, odds, injuries, and historical coverage.
  - Best fit if the project needs one structured vendor for live football operations.
  - Limitation: requires paid plan review for the exact leagues, World Cup, UEFA competitions, and odds markets needed.

## Integration note

The safest architecture is a scheduled `liveDataProvider` layer that writes normalized snapshots into `data/live_*` JSON. Prediction services should read those snapshots instead of calling external APIs during every render, so presentations stay fast and repeatable.
