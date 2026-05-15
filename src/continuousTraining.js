const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const STATUS_PATH = path.join(process.cwd(), "model", "continuous_training_status.json");
let retrainTimer = null;
let retrainRunning = false;
let pendingReason = "";

function writeStatus(status) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(
    STATUS_PATH,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        ...status,
      },
      null,
      2
    )
  );
}

function runRetrain(reason) {
  if (retrainRunning) {
    pendingReason = reason || pendingReason;
    return;
  }

  retrainRunning = true;
  const command = process.execPath;
  const trainScript = path.join(process.cwd(), "src", "train_model.js");
  writeStatus({ status: "RUNNING", reason });

  const child = spawn(command, [trainScript], {
    cwd: process.cwd(),
    stdio: "pipe",
    windowsHide: true,
  });

  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.on("error", (error) => {
    retrainRunning = false;
    writeStatus({
      status: "FAILED",
      reason,
      code: error.code || "SPAWN_ERROR",
      stdout: stdout.slice(-4000),
      stderr: `${stderr}\n${error.stack || error.message}`.slice(-4000),
    });
  });

  child.on("close", (code) => {
    if (!retrainRunning) return;
    retrainRunning = false;
    writeStatus({
      status: code === 0 ? "COMPLETED" : "FAILED",
      reason,
      code,
      stdout: stdout.slice(-4000),
      stderr: stderr.slice(-4000),
    });

    if (pendingReason) {
      const nextReason = pendingReason;
      pendingReason = "";
      scheduleRetrain(nextReason);
    }
  });
}

function scheduleRetrain(reason = "backtest-feedback") {
  pendingReason = reason;
  if (retrainTimer) clearTimeout(retrainTimer);
  retrainTimer = setTimeout(() => {
    const nextReason = pendingReason || reason;
    pendingReason = "";
    runRetrain(nextReason);
  }, 1500);
}

function readTrainingStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    return { status: "IDLE", updatedAt: "", reason: "" };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, "utf8"));
}

module.exports = {
  readTrainingStatus,
  scheduleRetrain,
};
