# Baseball model foundation

This is a standalone MLB pregame pipeline. It does not share Football training
data, does not call a database on import, and never accepts post-first-pitch
information in a prediction snapshot.

## Required pregame inputs

- scheduled first pitch and capture timestamp;
- expected starters, projected lineups, bullpen workload/rest and team form;
- ballpark run factor, weather, travel and rest;
- a settled final score only in the separate training-row result, never in the
  pregame snapshot.

## Training and validation

The pipeline selects a ridge penalty using expanding chronological folds for
separate home- and away-run models. It reports validation MAE for each target.
This replaces the reference repository's ambiguous Ridge/LinearRegression
implementation with an explicit selection decision.

## Markets

Expected runs are converted to moneyline, total and run-line probabilities via
count-distribution simulation. A normalized two-way market price can be blended
only after the model prediction exists. The market blend weight is a parameter
to calibrate against an out-of-time holdout, not a hard-coded claim of edge.

## Running a local train

```sh
node scripts/train_baseball_model.js data/baseball_training_rows.json
node --test test/baseballModel.test.js
```
