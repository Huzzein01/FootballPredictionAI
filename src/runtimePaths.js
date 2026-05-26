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

function writeJson(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function writeFileIfWritable(filePath, contents) {
  if (isReadOnlyRuntime()) return false;
  ensureParent(filePath);
  fs.writeFileSync(filePath, contents);
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
  writeJson,
};
