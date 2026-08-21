"use strict";

// Generic periodic retraining orchestrator for baseball/basketball/American
// football, mirroring src/continuousTraining.js's spawn-and-track pattern
// (kept as a separate module rather than generalizing that one, so this
// never risks changing football's own retraining behavior). Training is
// CPU-heavy (ridge regression + chronological cross-validation), so it runs
// as a detached child process rather than blocking the server's event loop,
// same reasoning football's version already applies.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { isReadOnlyRuntime, mutableModelPath } = require("../runtimePaths");

const SCRIPTS = {
  baseball: path.join(process.cwd(), "scripts", "auto_train_baseball_model.js"),
  basketball: path.join(process.cwd(), "scripts", "train_basketball_model.js"),
  "american-football": path.join(process.cwd(), "scripts", "train_american_football_model.js"),
};

const running = new Set();

function statusPath(sport) {
  return mutableModelPath(`${sport.replace(/-/g, "_")}_continuous_training_status.json`);
}

function writeStatus(sport, status) {
  const filePath = statusPath(sport);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ sport, updatedAt: new Date().toISOString(), ...status }, null, 2));
}

function readStatus(sport) {
  const filePath = statusPath(sport);
  if (!fs.existsSync(filePath)) return { sport, status: "IDLE", updatedAt: "" };
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return { sport, status: "IDLE", updatedAt: "" };
  }
}

function retrain(sport, reason = "scheduled") {
  return new Promise((resolve) => {
    const script = SCRIPTS[sport];
    if (!script) return resolve({ sport, status: "SKIPPED", reason: "no training script configured" });
    if (isReadOnlyRuntime()) {
      writeStatus(sport, { status: "SKIPPED", reason, code: "READ_ONLY_RUNTIME" });
      return resolve(readStatus(sport));
    }
    if (running.has(sport)) {
      return resolve({ sport, status: "ALREADY_RUNNING" });
    }
    running.add(sport);
    writeStatus(sport, { status: "RUNNING", reason });
    const child = spawn(process.execPath, [script], { cwd: process.cwd(), stdio: "pipe", windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => {
      running.delete(sport);
      writeStatus(sport, { status: "FAILED", reason, code: error.code || "SPAWN_ERROR", stdout: stdout.slice(-4000), stderr: `${stderr}\n${error.stack || error.message}`.slice(-4000) });
      resolve(readStatus(sport));
    });
    child.on("close", (code) => {
      running.delete(sport);
      let result = null;
      try { result = JSON.parse(stdout.trim()); } catch { /* training script prints diagnostics elsewhere, not JSON */ }
      writeStatus(sport, { status: code === 0 ? "COMPLETED" : "FAILED", reason, code, promoted: result?.promoted ?? null, candidateMae: result?.candidateMae ?? null, liveMae: result?.liveMae ?? null, rows: result?.rows ?? null, stdout: stdout.slice(-4000), stderr: stderr.slice(-4000) });
      resolve(readStatus(sport));
    });
  });
}

async function retrainAll(reason = "scheduled") {
  const sports = Object.keys(SCRIPTS);
  const results = [];
  for (const sport of sports) results.push(await retrain(sport, reason));
  return results;
}

module.exports = { retrain, retrainAll, readStatus };
