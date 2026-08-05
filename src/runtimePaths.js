const fs = require("fs");
const os = require("os");
const path = require("path");

function isReadOnlyRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function repoDataPath(...segments) {
  return path.join(process.cwd(), "data", ...segments);
}

function mutableDataPath(...segments) {
  if (!isReadOnlyRuntime()) return repoDataPath(...segments);
  return path.join(os.tmpdir(), "football-prediction-ai", "data", ...segments);
}

function repoModelPath(...segments) {
  return path.join(process.cwd(), "model", ...segments);
}

function mutableModelPath(...segments) {
  if (!isReadOnlyRuntime()) return repoModelPath(...segments);
  return path.join(os.tmpdir(), "football-prediction-ai", "model", ...segments);
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonWithFallback(primaryPath, fallbackPath, fallbackValue = null) {
  for (const filePath of [primaryPath, fallbackPath]) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    } catch {
      // Try the next path.
    }
  }
  return fallbackValue;
}

// Windows occasionally throws a transient "UNKNOWN" fs error on writeFileSync
// right after network I/O (observed with real-time antivirus scanning); a
// brief synchronous backoff clears it without masking a genuine failure. Keep
// `attempts`/`delayMs` modest for call sites that run inside the live server's
// request/timer loop — the backoff blocks Node's single thread, so a long one
// here would stall in-flight requests, unlike a one-off offline CLI script.
function writeFileRetrying(filePath, contents, attempts = 20, delayMs = 1000) {
  ensureParent(filePath);
  for (let attempt = 1; ; attempt += 1) {
    try {
      fs.writeFileSync(filePath, contents);
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      const until = Date.now() + delayMs;
      while (Date.now() < until) { /* synchronous backoff */ }
    }
  }
}

function writeJson(filePath, value) {
  writeFileRetrying(filePath, JSON.stringify(value, null, 2), 5, 100);
}

function writeFileIfWritable(filePath, contents) {
  if (isReadOnlyRuntime()) return false;
  writeFileRetrying(filePath, contents, 5, 100);
  return true;
}

module.exports = {
  ensureParent,
  isReadOnlyRuntime,
  mutableDataPath,
  mutableModelPath,
  readJsonWithFallback,
  repoDataPath,
  repoModelPath,
  writeFileIfWritable,
  writeFileRetrying,
  writeJson,
};
