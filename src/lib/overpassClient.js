import {
  MAP_CENTER,
  RADIUS_METERS,
  OVERPASS_ENDPOINTS,
} from "./constants.js";

const CACHE_KEY = "ccw-shadow:overpass:v2";
const FALLBACK_URL = "/buildings-fallback.json";

function buildQuery() {
  const { lat, lng } = MAP_CENTER;
  return `[out:json][timeout:25];
( way["building"](around:${RADIUS_METERS}, ${lat}, ${lng});
  relation["building"](around:${RADIUS_METERS}, ${lat}, ${lng}); );
out geom;`;
}

async function postOverpass(endpoint, query) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`${endpoint} responded ${res.status}`);
  return res.json();
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Quota exceeded or storage disabled; ignore — runtime data still works.
  }
}

export async function fetchBuildings({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return { data: cached.data, source: "cache" };
  }

  const query = buildQuery();
  const errors = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const data = await postOverpass(endpoint, query);
      writeCache(data);
      return { data, source: endpoint };
    } catch (err) {
      errors.push(`${endpoint}: ${err.message}`);
    }
  }

  // All live endpoints failed — fall back to bundled static snapshot.
  try {
    const res = await fetch(FALLBACK_URL);
    if (res.ok) {
      const data = await res.json();
      return { data, source: "fallback-static" };
    }
  } catch (err) {
    errors.push(`static fallback: ${err.message}`);
  }

  throw new Error("All Overpass sources failed:\n" + errors.join("\n"));
}
