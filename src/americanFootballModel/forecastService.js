"use strict";

// Skeleton forecast board — mirrors the role of src/baseballModel/forecastService.js,
// but returns an explicit "not trained" status instead of predictions until a
// model exists at model/american_football_forecast_model.json.

function buildForecastBoard() {
  return {
    sport: "americanFootball",
    league: "NFL",
    trained: false,
    predictions: [],
    summary: { totalPredictions: 0 },
    message: "The American Football model has not been trained yet. Import schedules and settled results, build a training dataset (see schema.js), then train a model before this board can generate forecasts.",
  };
}

module.exports = { buildForecastBoard };
