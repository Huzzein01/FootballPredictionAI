const fs = require("fs");
const path = require("path");
const { ensureParent, mutableDataPath, repoDataPath } = require("./runtimePaths");

const TABLE = process.env.SUPABASE_JSON_TABLE || "app_kv";
const HYDRATE_TTL_MS = Number(process.env.SUPABASE_HYDRATE_TTL_SECONDS || 60) * 1000;

const KNOWN_STORES = {
  backtests: { key: "data/backtests.json", path: mutableDataPath("backtests.json"), fallbackPath: repoDataPath("backtests.json") },
  parlayBacktests: { key: "data/parlay_backtests.json", path: mutableDataPath("parlay_backtests.json"), fallbackPath: repoDataPath("parlay_backtests.json") },
  playerProfiles: { key: "data/player_profile_updates.json", path: mutableDataPath("player_profile_updates.json"), fallbackPath: repoDataPath("player_profile_updates.json") },
  teamProfiles: { key: "data/team_profile_updates.json", path: mutableDataPath("team_profile_updates.json"), fallbackPath: repoDataPath("team_profile_updates.json") },
  liveEspnFixtures: { key: "data/live_espn_fixtures.json", path: mutableDataPath("live_espn_fixtures.json"), fallbackPath: repoDataPath("live_espn_fixtures.json") },
  liveEspnResults: { key: "data/live_espn_results.json", path: mutableDataPath("live_espn_results.json"), fallbackPath: repoDataPath("live_espn_results.json") },
  liveLeagueContext: { key: "data/live_league_context.json", path: mutableDataPath("live_league_context.json"), fallbackPath: repoDataPath("live_league_context.json") },
  liveOdds: { key: "data/live_odds_snapshot.json", path: mutableDataPath("live_odds_snapshot.json"), fallbackPath: repoDataPath("live_odds_snapshot.json") },
  apiFootballPlayerStats: { key: "data/api_football/player_stats.json", path: mutableDataPath("api_football", "player_stats.json"), fallbackPath: repoDataPath("api_football", "player_stats.json") },
};

let lastHydratedAt = 0;
let lastHydrateSummary = null;

function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    "";
  return { url: url.replace(/\/$/, ""), key };
}

function isSupabaseConfigured() {
  const { url, key } = config();
  return Boolean(url && key);
}

function encodedKey(key) {
  return encodeURIComponent(key).replaceAll(".", "%2E").replaceAll("/", "%2F");
}

async function supabaseRequest(method, query, body = null, prefer = "") {
  const { url, key } = config();
  if (!url || !key) throw new Error("Supabase storage is not configured");
  const response = await fetch(`${url}/rest/v1/${TABLE}${query}`, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...(prefer ? { prefer } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase ${method} ${TABLE} failed: ${response.status} ${text}`.trim());
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function readJsonRecord(store) {
  const rows = await supabaseRequest("GET", `?select=value&key=eq.${encodedKey(store.key)}&limit=1`);
  return Array.isArray(rows) && rows.length ? rows[0].value : null;
}

async function writeJsonRecord(store, value) {
  await supabaseRequest(
    "POST",
    "",
    { key: store.key, value, updated_at: new Date().toISOString() },
    "resolution=merge-duplicates"
  );
}

function readLocalJson(store) {
  for (const filePath of [store.path, store.fallbackPath]) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
    } catch {
      // Try the next source.
    }
  }
  return null;
}

function writeLocalJson(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

async function hydrateKnownStoresOnce({ force = false } = {}) {
  if (!isSupabaseConfigured()) {
    lastHydrateSummary = { configured: false, hydrated: 0, skipped: Object.keys(KNOWN_STORES).length, errors: [] };
    return lastHydrateSummary;
  }
  if (!force && lastHydratedAt && Date.now() - lastHydratedAt < HYDRATE_TTL_MS) {
    return { ...lastHydrateSummary, cached: true };
  }

  const summary = { configured: true, table: TABLE, hydrated: 0, skipped: 0, errors: [] };
  for (const [name, store] of Object.entries(KNOWN_STORES)) {
    try {
      const remote = await readJsonRecord(store);
      if (remote === null || remote === undefined) {
        summary.skipped += 1;
        continue;
      }
      writeLocalJson(store.path, remote);
      summary.hydrated += 1;
    } catch (error) {
      summary.errors.push({ store: name, message: error.message });
    }
  }
  lastHydratedAt = Date.now();
  lastHydrateSummary = summary;
  return summary;
}

async function persistKnownStores(names = Object.keys(KNOWN_STORES)) {
  if (!isSupabaseConfigured()) return { configured: false, persisted: 0, skipped: names.length, errors: [] };
  const summary = { configured: true, table: TABLE, persisted: 0, skipped: 0, errors: [] };
  for (const name of names) {
    const store = KNOWN_STORES[name];
    if (!store) {
      summary.skipped += 1;
      continue;
    }
    try {
      const value = readLocalJson(store);
      if (value === null) {
        summary.skipped += 1;
        continue;
      }
      await writeJsonRecord(store, value);
      summary.persisted += 1;
    } catch (error) {
      summary.errors.push({ store: name, message: error.message });
    }
  }
  return summary;
}

async function storageStatus() {
  const status = {
    configured: isSupabaseConfigured(),
    table: TABLE,
    stores: Object.entries(KNOWN_STORES).map(([name, store]) => ({
      name,
      key: store.key,
      localExists: fs.existsSync(store.path),
      fallbackExists: Boolean(store.fallbackPath && fs.existsSync(store.fallbackPath)),
    })),
    lastHydratedAt: lastHydratedAt ? new Date(lastHydratedAt).toISOString() : "",
    lastHydrateSummary,
  };
  if (!status.configured) return status;
  try {
    const rows = await supabaseRequest("GET", "?select=key,updated_at&order=key.asc");
    status.remoteRows = Array.isArray(rows) ? rows.length : 0;
    status.remoteKeys = Array.isArray(rows) ? rows.map((row) => ({ key: row.key, updatedAt: row.updated_at || "" })) : [];
  } catch (error) {
    status.error = error.message;
  }
  return status;
}

module.exports = {
  KNOWN_STORES,
  hydrateKnownStoresOnce,
  isSupabaseConfigured,
  persistKnownStores,
  storageStatus,
};
