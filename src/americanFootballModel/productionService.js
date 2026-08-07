"use strict";

// Skeleton production entry points — mirrors the create/settle prediction
// shape of src/baseballModel/productionService.js so a real implementation
// can drop in later without changing the server route contract.

function createPrediction() {
  return { accepted: false, status: 501, reason: "American Football prediction pipeline is not implemented yet." };
}

function settlePrediction() {
  throw new Error("American Football prediction settlement is not implemented yet.");
}

module.exports = { createPrediction, settlePrediction };
