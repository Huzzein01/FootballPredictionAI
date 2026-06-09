/**
 * scripts/fetchVenueWeather.js
 *
 * Phase 2 — Live weather integration.
 *
 * Fetches actual hourly temperature + humidity forecasts from Open-Meteo
 * (https://open-meteo.com) for every WC 2026 venue on every fixture date.
 * Open-Meteo is completely free, no API key required, 16-day forecast window.
 *
 * Saves  →  data/international/venue_weather_forecasts.json
 *
 * For fixtures beyond the 16-day Open-Meteo window (June 25-27), the script
 * falls back to historical June climate normals per venue so every match has
 * a heat-tier value regardless of forecast availability.
 *
 * Run:  node scripts/fetchVenueWeather.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const FIXTURES_PATH = path.join(__dirname, "..", "data", "international", "world_cup_2026_fixtures.json");
const OUT_PATH      = path.join(__dirname, "..", "data", "international", "venue_weather_forecasts.json");

// ── Venue metadata: lat/lon + timezone + indoor-AC flag ──────────────────────
const VENUE_META = {
  "Miami": {
    lat: 25.9580, lon: -80.2389,
    tz: "America/New_York",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "Hard Rock Stadium, Miami Gardens FL",
  },
  "New York": {
    lat: 40.8135, lon: -74.0745,
    tz: "America/New_York",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "MetLife Stadium, East Rutherford NJ",
  },
  "Boston": {
    lat: 42.0910, lon: -71.2643,
    tz: "America/New_York",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "Gillette Stadium, Foxborough MA",
  },
  "Philadelphia": {
    lat: 39.9008, lon: -75.1675,
    tz: "America/New_York",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "Lincoln Financial Field",
  },
  "Atlanta": {
    lat: 33.7554, lon: -84.4009,
    tz: "America/New_York",
    hasAC: true,  indoorTemp: 21,
    canopyReduction: 0,
    label: "Mercedes-Benz Stadium (fixed dome, A/C)",
  },
  "Toronto": {
    lat: 43.6333, lon: -79.4188,
    tz: "America/Toronto",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "BMO Field",
  },
  "Dallas": {
    lat: 32.7480, lon: -97.0930,
    tz: "America/Chicago",
    hasAC: true,  indoorTemp: 21,
    canopyReduction: 0,
    label: "AT&T Stadium, Arlington TX (retractable, A/C)",
  },
  "Houston": {
    lat: 29.6847, lon: -95.4107,
    tz: "America/Chicago",
    hasAC: true,  indoorTemp: 21,
    canopyReduction: 0,
    label: "NRG Stadium, Houston TX (retractable, A/C)",
  },
  "Kansas City": {
    lat: 39.0489, lon: -94.4839,
    tz: "America/Chicago",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "Arrowhead Stadium",
  },
  "Seattle": {
    lat: 47.5952, lon: -122.3317,
    tz: "America/Los_Angeles",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "Lumen Field",
  },
  "Los Angeles": {
    lat: 34.0139, lon: -118.2882,
    tz: "America/Los_Angeles",
    hasAC: true,  indoorTemp: null,
    canopyReduction: 4,
    label: "SoFi Stadium, Inglewood CA (translucent canopy)",
  },
  "San Francisco Bay Area": {
    lat: 37.4032, lon: -121.9697,
    tz: "America/Los_Angeles",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "Levi's Stadium, Santa Clara CA",
  },
  "Vancouver": {
    lat: 49.2768, lon: -123.1118,
    tz: "America/Vancouver",
    hasAC: false, indoorTemp: null,
    canopyReduction: 2,
    label: "BC Place, Vancouver",
  },
  "Guadalajara": {
    lat: 20.6879, lon: -103.4677,
    tz: "America/Mexico_City",
    hasAC: false, indoorTemp: null,
    canopyReduction: 2,
    label: "Estadio Akron, Zapopan (1,556 m altitude)",
  },
  "Mexico City": {
    lat: 19.3029, lon: -99.1505,
    tz: "America/Mexico_City",
    hasAC: false, indoorTemp: null,
    canopyReduction: 1,
    label: "Estadio Azteca (2,240 m altitude)",
  },
  "Monterrey": {
    lat: 25.6693, lon: -100.2539,
    tz: "America/Monterrey",
    hasAC: false, indoorTemp: null,
    canopyReduction: 0,
    label: "Estadio BBVA, Guadalupe NL",
  },
};

// ── Historical June climate normals (fallback for fixtures beyond forecast window)
// Values represent typical late-June conditions at kickoff time (~18:00 local).
const VENUE_CLIMATE_NORMALS = {
  "Miami":                   { tempC: 32, humidity: 78 },
  "New York":                { tempC: 27, humidity: 62 },
  "Boston":                  { tempC: 24, humidity: 65 },
  "Philadelphia":            { tempC: 28, humidity: 63 },
  "Atlanta":                 { tempC: 21, humidity: 50 }, // A/C — same as indoor
  "Toronto":                 { tempC: 23, humidity: 60 },
  "Dallas":                  { tempC: 21, humidity: 50 }, // A/C — same as indoor
  "Houston":                 { tempC: 21, humidity: 50 }, // A/C — same as indoor
  "Kansas City":             { tempC: 30, humidity: 65 },
  "Seattle":                 { tempC: 21, humidity: 58 },
  "Los Angeles":             { tempC: 25, humidity: 55 },
  "San Francisco Bay Area":  { tempC: 22, humidity: 60 },
  "Vancouver":               { tempC: 21, humidity: 62 },
  "Guadalajara":             { tempC: 27, humidity: 55 },
  "Mexico City":             { tempC: 22, humidity: 50 },
  "Monterrey":               { tempC: 35, humidity: 50 },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Convert temp °C → heat-index tier 1–5 ────────────────────────────────────
function tempToHeatTier(tempC) {
  if (tempC >= 32) return 5;
  if (tempC >= 28) return 4;
  if (tempC >= 24) return 3;
  if (tempC >= 20) return 2;
  return 1;
}

// WBGT-approximate humidity-weighted feel-temperature bump
function humidityBump(tempC, humPct) {
  if (tempC < 20 || !humPct) return 0;
  const excess = Math.max(0, humPct - 50) / 50;
  return Math.round(excess * (tempC - 18) * 0.15 * 10) / 10;
}

// ── Fetch forecast/archive from Open-Meteo ────────────────────────────────────
async function fetchOpenMeteo(lat, lon, tz, startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);

  // Determine if this is a historical range or forecast range.
  // If startDate is in the past, use archive API. If future (or today), use forecast.
  const base = startDate < today
    ? "https://archive-api.open-meteo.com/v1/era5"
    : "https://api.open-meteo.com/v1/forecast";

  const params = new URLSearchParams({
    latitude:         lat,
    longitude:        lon,
    hourly:           "temperature_2m,relativehumidity_2m,apparent_temperature",
    start_date:       startDate,
    end_date:         endDate,
    timezone:         tz,
    temperature_unit: "celsius",
  });

  const url = `${base}?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Open-Meteo ${res.status}: ${body.slice(0, 200)}`);
  }
  return await res.json();
}

// ── Extract kickoff-hour temperature from hourly arrays ───────────────────────
function tempAtHour(hourlyData, date, localHour) {
  const prefix = `${date}T${String(localHour).padStart(2, "0")}:00`;
  const idx = hourlyData.time.findIndex(t => t.startsWith(prefix));
  if (idx === -1) return null;
  return {
    temp:     hourlyData.temperature_2m[idx],
    humidity: hourlyData.relativehumidity_2m[idx],
    apparent: hourlyData.apparent_temperature[idx],
  };
}

// ── Build a record from climate normals (fallback for beyond-window fixtures) ─
function buildNormalRecord(city, date, kickoffHour, meta) {
  const normal = VENUE_CLIMATE_NORMALS[city];
  if (!normal) return null;

  const { tempC, humidity } = normal;
  const humBump       = humidityBump(tempC, humidity);
  const apparentTemp  = tempC + humBump; // approximate
  const effectiveTemp = Math.round((apparentTemp - meta.canopyReduction) * 10) / 10;

  return {
    city,
    date,
    kickoffHour,
    tempC,
    humidity,
    apparentTempC:   Math.round(apparentTemp * 10) / 10,
    humidityBump:    humBump,
    canopyReduction: meta.canopyReduction,
    effectiveTempC:  effectiveTemp,
    heatTier:        tempToHeatTier(effectiveTemp),
    source:          "climate-normal",
    fetchedDate:     new Date().toISOString().slice(0, 10),
    venue:           meta.label,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function build() {
  if (!fs.existsSync(FIXTURES_PATH)) {
    console.error("Fixtures file not found:", FIXTURES_PATH);
    process.exit(1);
  }

  const fixtureData = JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf8"));
  const fixtures = fixtureData.fixtures || [];

  // Load existing cache
  let existing = { byMatch: {} };
  if (fs.existsSync(OUT_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(OUT_PATH, "utf8")); }
    catch (_) { existing = { byMatch: {} }; }
  }

  // Calculate the maximum date Open-Meteo can forecast (today + 15 days)
  const todayStr = new Date().toISOString().slice(0, 10);
  const maxForecastDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  })();

  // Group fixtures by city
  const byCity = {};
  for (const f of fixtures) {
    (byCity[f.city] ??= []).push(f);
  }

  const allDates = fixtures.map(f => f.date).sort();
  console.log(`\nWC 2026 venue weather fetch`);
  console.log(`  Fixture range:      ${allDates[0]} → ${allDates[allDates.length - 1]}`);
  console.log(`  Forecast window:    ${todayStr} → ${maxForecastDate}`);
  console.log(`  Venues to process:  ${Object.keys(byCity).length}\n`);

  const byMatch = { ...existing.byMatch };
  let fetched = 0, normals = 0, skipped = 0, errors = 0;

  for (const [city, cityFixtures] of Object.entries(byCity)) {
    const meta = VENUE_META[city];
    if (!meta) {
      console.warn(`  ⚠️  No venue meta for "${city}" — skipping`);
      continue;
    }

    // ── Case 1: Indoor A/C venue — fixed temperature, no API call needed ──────
    if (meta.indoorTemp !== null) {
      const allFresh = cityFixtures.every(f => {
        const c = byMatch[f.matchNumber];
        return c?.fetchedDate === todayStr && c?.source === "indoor-ac-fixed";
      });
      if (allFresh) {
        console.log(`  ${city.padEnd(26)} ✓ indoor A/C cached (${cityFixtures.length} matches)`);
        skipped += cityFixtures.length;
        continue;
      }

      console.log(`  ${city.padEnd(26)} → indoor A/C (${meta.indoorTemp}°C fixed, ${cityFixtures.length} matches)`);
      for (const f of cityFixtures) {
        const hour = parseInt((f.kickoffLocal || "").match(/T(\d{2}):/)?.[1] ?? "18");
        byMatch[f.matchNumber] = {
          city,
          date:            f.date,
          kickoffHour:     hour,
          tempC:           meta.indoorTemp,
          humidity:        50,
          apparentTempC:   meta.indoorTemp,
          humidityBump:    0,
          canopyReduction: 0,
          effectiveTempC:  meta.indoorTemp,
          heatTier:        tempToHeatTier(meta.indoorTemp),
          source:          "indoor-ac-fixed",
          fetchedDate:     todayStr,
          venue:           meta.label,
        };
        fetched++;
      }
      continue;
    }

    // ── Case 2: Outdoor venue — split by forecast window ─────────────────────
    const inWindow      = cityFixtures.filter(f => f.date <= maxForecastDate);
    const beyondWindow  = cityFixtures.filter(f => f.date >  maxForecastDate);

    // Check if all in-window fixtures are already fresh
    const windowFresh = inWindow.every(f => {
      const c = byMatch[f.matchNumber];
      return c?.fetchedDate === todayStr && c?.source !== "climate-normal";
    });
    const normalsFresh = beyondWindow.every(f => {
      const c = byMatch[f.matchNumber];
      return c?.fetchedDate === todayStr && c?.source === "climate-normal";
    });

    if (windowFresh && normalsFresh) {
      console.log(`  ${city.padEnd(26)} ✓ all ${cityFixtures.length} matches cached (today)`);
      skipped += cityFixtures.length;
      continue;
    }

    // Fetch live data for in-window fixtures
    if (inWindow.length > 0) {
      const winDates  = inWindow.map(f => f.date).sort();
      const wsStart   = winDates[0];
      const wsEnd     = winDates[winDates.length - 1];

      process.stdout.write(`  ${city.padEnd(26)} → fetching ${wsStart}–${wsEnd} (${inWindow.length} matches) ... `);

      try {
        const data     = await fetchOpenMeteo(meta.lat, meta.lon, meta.tz, wsStart, wsEnd);
        const hourlyData = data.hourly;
        let matchCount = 0;

        for (const f of inWindow) {
          const hour    = parseInt((f.kickoffLocal || "").match(/T(\d{2}):/)?.[1] ?? "18");
          const reading = tempAtHour(hourlyData, f.date, hour);

          if (!reading) {
            console.warn(`\n    ⚠️  No data for ${city} on ${f.date} at ${hour}:00`);
            continue;
          }

          const humBump       = humidityBump(reading.temp, reading.humidity);
          const rawEff        = (reading.apparent ?? reading.temp) + humBump;
          const effectiveTemp = Math.round((rawEff - meta.canopyReduction) * 10) / 10;

          byMatch[f.matchNumber] = {
            city,
            date:            f.date,
            kickoffHour:     hour,
            tempC:           Math.round(reading.temp * 10) / 10,
            humidity:        reading.humidity,
            apparentTempC:   reading.apparent ? Math.round(reading.apparent * 10) / 10 : null,
            humidityBump:    humBump,
            canopyReduction: meta.canopyReduction,
            effectiveTempC:  effectiveTemp,
            heatTier:        tempToHeatTier(effectiveTemp),
            source:          wsStart < todayStr ? "open-meteo-archive" : "open-meteo-forecast",
            fetchedDate:     todayStr,
            venue:           meta.label,
          };
          matchCount++;
          fetched++;
        }

        // Show a sample result for this city
        const sample = byMatch[inWindow[0].matchNumber];
        console.log(`${matchCount} matches — ${sample?.date} ${sample?.kickoffHour}:00 → ${sample?.effectiveTempC}°C (tier ${sample?.heatTier})`);

      } catch (e) {
        console.log(`ERROR — ${e.message}`);
        errors += inWindow.length;
      }
    }

    // Fill beyond-window fixtures with climate normals
    if (beyondWindow.length > 0) {
      for (const f of beyondWindow) {
        if (byMatch[f.matchNumber]?.fetchedDate === todayStr && byMatch[f.matchNumber]?.source === "climate-normal") {
          skipped++;
          continue;
        }
        const hour   = parseInt((f.kickoffLocal || "").match(/T(\d{2}):/)?.[1] ?? "18");
        const record = buildNormalRecord(city, f.date, hour, meta);
        if (record) {
          byMatch[f.matchNumber] = record;
          normals++;
        }
      }
      if (beyondWindow.length > 0) {
        const norm = VENUE_CLIMATE_NORMALS[city];
        console.log(`  ${city.padEnd(26)} → climate normal ${beyondWindow.length} beyond-window match(es): ${norm?.tempC}°C / ${norm?.humidity}% hum`);
      }
    }

    await sleep(350);
  }

  // ── Write output ──────────────────────────────────────────────────────────
  const output = {
    _meta: {
      description:    "Per-fixture weather data for all WC 2026 venues. Live forecasts from Open-Meteo; climate normals used for fixtures beyond the 16-day window.",
      lastFetchedAt:  new Date().toISOString(),
      forecastSource: "https://api.open-meteo.com/v1/forecast",
      archiveSource:  "https://archive-api.open-meteo.com/v1/era5",
      maxForecastDate,
      fixtureCount:   Object.keys(byMatch).length,
      heatTierScale: {
        "1": "< 20 °C — mild/cool",
        "2": "20–23 °C — temperate",
        "3": "24–27 °C — warm",
        "4": "28–31 °C — hot",
        "5": "≥ 32 °C — extreme heat",
      },
      sourceTypes: {
        "open-meteo-forecast": "Live 16-day forecast — highest accuracy",
        "open-meteo-archive":  "ERA5 reanalysis archive — historical actual",
        "climate-normal":      "Historical June climate normal — fallback for fixtures beyond forecast window",
        "indoor-ac-fixed":     "Indoor climate-controlled venue — fixed 21°C regardless of outdoor conditions",
      },
      notes: [
        "effectiveTempC = apparentTemp + humidityBump − canopyReduction.",
        "Atlanta/Dallas/Houston are climate-controlled venues; effectiveTempC is always 21°C (tier 2).",
        "Los Angeles SoFi translucent canopy reduces effective temp by 4°C.",
        "Mexico City and Guadalajara altitude adjustments are applied in weatherService.js separately.",
        "Re-run daily to keep forecasts fresh — stale entries (prior fetched dates) are automatically refreshed.",
      ],
    },
    byMatch,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf8");
  console.log(`\n✅  Written → ${OUT_PATH}`);
  console.log(`   Live fetched: ${fetched}  |  Climate normals: ${normals}  |  Skipped (cached): ${skipped}  |  Errors: ${errors}`);

  // Print sample table
  const rows = Object.values(byMatch)
    .sort((a, b) => a.date.localeCompare(b.date) || a.kickoffHour - b.kickoffHour)
    .slice(0, 25);

  console.log("\nSample match weather (first 25 by date):");
  console.log("─".repeat(88));
  rows.forEach(r => {
    const src = r.source === "indoor-ac-fixed"
      ? "🏟 A/C  "
      : r.source === "climate-normal"
        ? "📊 norm "
        : r.source?.includes("archive")
          ? "📁 hist "
          : "☁ fcst ";
    const matchKey = Object.keys(byMatch).find(k => byMatch[k] === r) ?? "?";
    console.log(
      `  M${String(matchKey).padEnd(4)}` +
      `  ${(r.city ?? "").padEnd(24)}  ${r.date}  ${String(r.kickoffHour).padStart(2)}:00  ` +
      `${src}  ${String(r.effectiveTempC).padStart(5)}°C  tier ${r.heatTier}  💧${r.humidity ?? "?"}%`
    );
  });
}

build().catch(e => { console.error("Fatal:", e); process.exit(1); });
