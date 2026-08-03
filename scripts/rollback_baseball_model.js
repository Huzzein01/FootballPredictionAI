"use strict";
const path = require("path"); const { rollbackModel } = require("../src/baseballModel/modelRegistry"); const id = process.argv[2]; if (!id) throw new Error("Usage: node scripts/rollback_baseball_model.js <registry-id>"); console.log(JSON.stringify(rollbackModel({ id, registryDir: path.join("data", "baseball", "model_registry") }), null, 2));
