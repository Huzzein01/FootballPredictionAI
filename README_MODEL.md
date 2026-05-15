# Football Prediction Model

This workspace contains a local football match predictor trained from the CSV files in:

`C:\Users\adebi\Downloads\Football data`

The model predicts full-time result from the home team's perspective:

- `H`: home win
- `D`: draw
- `A`: away win

## Why The Training Table Is Different From The Dataset

The Excel dataset includes matchday shots, shots on target, corners, goals, and cards for each completed match. Those are excellent historical signals, but they cannot be used directly to predict that same match because they are only known after kickoff.

So the model builds pre-match rolling features: points per game, goals for/against, shots, shots on target, corners, clean-sheet rate, last-five form, and available pre-match market odds using only information available before the fixture being predicted.

Current-season player features are now used when they have been imported from Thunderbit CSVs or the FBref screenshot/OCR pipeline. Missing player fields default to `0`, so clubs without imported player rows still produce predictions.

## Saved Project Data

The project keeps the training inputs and derived files inside this folder:

- `data/fbref/ocr`: OCR TSV output generated from the FBref screenshots provided in chat.
- `data/fbref/processed/fbref_player_stats.json`: normalized player-season rows used by model features and player prop parlays.
- `data/fbref/processed/fbref_player_stats.csv`: spreadsheet-friendly copy of the same player data.
- `data/screenshots_2025_26`: original screenshot files that were still available on local disk and copied into the project folder.
- `data/team_motives_2025_26.json`: manual motive notes for non-table incentives, such as Bruno Fernandes chasing an assist record.
- `data/live_league_context.json`: public standings snapshot used for points, qualification, title, European-place, and relegation calculations.

The attached screenshots from chat were processed into OCR and normalized player-stat files. Only one of the original screenshot PNGs was still present at the local OneDrive screenshot path when the copy step ran, so that original image is preserved in `data/screenshots_2025_26`; the processed OCR/data rows for the full screenshot set are preserved under `data/fbref`.

## FBref Player Stats

FBref blocked automated requests from this environment with `403 Forbidden`, so the project now supports two paths:

```powershell
npm run fetch:fbref
```

This tries to fetch FBref player-stat tables respectfully and writes any failures to:

`data/fbref/fetch_errors.json`

To generate the full download checklist without requesting every FBref page:

```powershell
node scripts/fetch_fbref_player_stats.js --manifestOnly=true
```

That writes:

`data/fbref/fbref_targets.csv`

If FBref blocks the request, download tables manually from FBref using `Share & Export` -> `Get table as CSV`, then save them in:

`data/fbref/raw`

Use filenames like:

```text
2025-2026_EPL_standard.csv
2025-2026_LaLiga_shooting.csv
2025-2026_Bundesliga_passing.csv
2025-2026_Ligue1_keepers.csv
```

Then run:

```powershell
npm run import:fbref
```

The importer writes:

- `data/fbref/processed/fbref_player_stats.json`
- `data/fbref/processed/fbref_player_stats.csv`

Those processed files feed the parlay builder's player legs, including shots, shots on target, goals, assists, and score-or-assist props. They also generate current-season team player features for the match model.

## League Motivation Model

The app does not assume a team is motivated just because of its name or rank. It calculates table incentives from points:

- Maximum possible points: `current points + games remaining * 3`.
- Title race: a club is marked as title-motivated only if it can still catch or pass the leader.
- Title secured: the leader is marked as title-secured only if no other club can catch its points total.
- Champions League secured: a club is marked secured only if the first club outside the Champions League line cannot catch it on points, with goal-difference cushion considered for tied-point scenarios.
- European-place race: clubs that can still reach or lose continental places receive pressure.
- Relegation pressure: clubs near the safety line are marked only when the remaining points math says relegation or escape is still live.
- Low-table-stakes or rotation risk: clubs with secured goals or no realistic table movement receive lower motivation for exact scores and some player props.

Manual motive overrides are separate from the points math. For example, Manchester United are treated as Champions League-secured rather than title-motivated, while Bruno Fernandes receives a record-chase motive because that incentive is player-specific and not visible from the table alone. Barcelona, Paris SG, and Bayern Munich have title-secured rotation risk layered on top of the calculated standings context.

## Draw Calibration

The prediction service now applies a draw-risk calibration after the model and motivation adjustment. This is designed for fixtures where a win/loss-only lean is too aggressive.

The calibration raises draw probability when these signals point to a close match:

- real public 1-X-2 market odds, especially tight home/away prices
- similar points-per-game and recent form
- similar Elo strength
- head-to-head draw tendency and close H2H goal difference
- similar table motivation, such as both clubs fighting for Champions League places
- rotation or low-stakes risk for one or both teams

This does not force a draw pick. It recalibrates the percentages so close fixtures show realistic draw risk. Example: Aston Villa vs Liverpool moved from a heavy Liverpool lean to a lower-confidence Liverpool lean with a much larger draw probability.

Refresh public standings with:

```powershell
npm run update:league-context
```

## Train

```powershell
npm run train
```

Outputs:

- `model/football_match_model.json`
- `model/training_rows.json`
- `model/tuning_results.json`

Current training policy:

- Train/tune seasons: `2020-21` through `2024-25`
- Holdout test season: partial `2025-26`
- Model type: softmax logistic regression
- Features: club form, match-stat rolling averages, clean-sheet rate, last-five form, pre-match odds, player goal/assist/shot/SOT strength, live table motivation, secured qualification flags, and manual record-motive fields
- Backtest feedback: settled match and parlay results are saved and queued for continuous retraining

Latest retrain artifacts:

- `model/football_match_model.json`
- `model/training_rows.json`
- `model/tuning_results.json`

Latest local retrain snapshot:

- Backtest feedback rows included: `4`
- Train accuracy: `53.8%`
- 2024-25 validation accuracy: `55.0%`
- 2025-26 holdout accuracy: `53.2%`
- Selected hyperparameters: `learningRate=0.05`, `l2=0.003`, `epochs=550`

## Predict

```powershell
npm run predict -- --league=EPL --home="Man United" --away="Chelsea"
```

You can also pass pre-match decimal odds when available:

```powershell
npm run predict -- --league=EPL --home="Man United" --away="Chelsea" --homeOdds=2.40 --drawOdds=3.50 --awayOdds=2.90
```

## Web App

```powershell
npm run start
```

Open:

`http://localhost:4173`

The web app supports:

- Single-match predictions
- Saving predictions into a backtest ledger
- Bulk fixture import
- Entering final scores after matches finish
- Automatic live backtest accuracy once results are settled
- A multi-leg parlay builder that combines model match picks with FBref-backed player props when imported FBref rows are available
- Hit, miss, and void backtesting for parlay legs
- Shared pick settlement across parlays when the same pick appears more than once
- Excluding already-played fixtures from newly generated parlays
- Motivation-aware score and player props using table stakes, home/away context, head-to-head context, recent form, and player-season stats
- Date sorting and draw-risk sorting on the fixture board
- Parlay mode selection: mixed player/team, team-only, or player-only
- Team-only parlays reserve result slots for high draw-risk fixtures instead of only selecting home/away winners

Bulk fixture rows use this format:

```csv
date,league,homeTeam,awayTeam,homeOdds,drawOdds,awayOdds
2026-05-17,EPL,Man United,Chelsea,2.40,3.50,2.90
```

League values used by the local data:

- `EPL`
- `La Liga`
- `Bundesliga`
- `Ligue 1`

## Optional Live Data

The predictor is usable offline today. Live providers are wired as optional adapters:

- football-data.org: set `FOOTBALL_DATA_API_KEY`
- API-Football/API-SPORTS: set `APISPORTS_KEY`
- TheSportsDB: set `THESPORTSDB_API_KEY`

Example:

```powershell
$env:FOOTBALL_DATA_API_KEY="your_key"
npm run predict -- --league=EPL --home="Man United" --away="Chelsea" --provider=footballData --competitionCode=PL
```

Public league standings are normalized into prediction features through `data/live_league_context.json`. Optional provider data can still be returned alongside predictions when API keys are available. Future upgrades can add injuries, confirmed lineups, and richer odds movement as additional features.
