# FootballPredictionAI

FootballPredictionAI is a local football prediction and parlay backtesting app. It forecasts fixtures using historical club data, imported FBref/player stats, public odds, form, head-to-head context, and league-table motivation such as title races, European qualification, relegation pressure, and rotation risk.

## Features

- Fixture prediction board with public odds when available
- League-table motivation model based on points and games remaining
- Multi-leg parlay generator with player props and team-score legs
- Hit, miss, and void backtesting
- Played-match tracking and accuracy summaries
- Continuous retraining from settled backtest feedback
- Dark, light, and adaptive UI modes

## Run Locally

```powershell
npm install
npm run start
```

Open:

```text
http://localhost:4173
```

## Useful Commands

```powershell
npm run update:league-context
npm run train
npm run import:screenshots
npm run import:fbref
```

More implementation notes are in `README_MODEL.md`.
