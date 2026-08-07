"use strict";

// Skeleton for the eventual trained model pipeline (feature vector -> score
// prediction -> win probability), mirroring src/baseballModel/pipeline.js.
// Left unimplemented until a training dataset (schema.js) and a regression
// or simulation approach are chosen.

function trainAmericanFootballModel(/* rows */) {
  throw new Error("American Football model training is not implemented yet.");
}

function predictAmericanFootballGame(/* model, snapshot */) {
  throw new Error("American Football model training/prediction is not implemented yet.");
}

module.exports = { trainAmericanFootballModel, predictAmericanFootballGame };
