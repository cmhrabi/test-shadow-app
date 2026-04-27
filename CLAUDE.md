# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # production bundle to dist/
npm run preview      # serve the production bundle
npm test             # vitest run (single pass, CI mode)
npm run test:watch   # vitest watch mode
npx vitest run src/lib/shadowGeometry.test.js -t "solar noon"  # run a single test by name
```

There is no lint script configured.

## Architecture

This is a React + Vite single-page app that visualises building shadows around Commerce Court West, Toronto. The core data flow is one-way and split between **pure geometry** (testable, no React/Leaflet) and **imperative map updates** (React-driven but bypassing React for hot-path rendering).

### Data flow on every slider tick

1. `App.jsx` holds `(ymd, minutes)` state. `dateAndMinutesToUtc` (`src/lib/sunTime.js`) converts Toronto wall-clock time → UTC `Date` via `date-fns-tz`, so DST transitions don't shift sun positions.
2. `SunCalc.getPosition(utcDate, lat, lng)` produces `{ azimuth, altitude }` (radians, suncalc convention: south=0).
3. A `useEffect` calls `mapRef.current.updateShadows(buildings, sunPos)` — an **imperative** API exposed via `useImperativeHandle` on `MapView`. This intentionally avoids React re-renders for shadow polygon updates; only `setLatLngs`/`setStyle` is called on pre-created Leaflet polygons.

### Shadow geometry (pure)

`src/lib/shadowGeometry.js` is the only non-trivial math. It is React-free and Leaflet-free, and is the unit of testing. Two conventions to keep straight:

- **SunCalc azimuth**: radians from south, clockwise toward west (south=0, west=+π/2, east=−π/2).
- **Turf bearing**: degrees from north, clockwise.
- The shadow points opposite the sun, so `shadowBearingDeg(azFromSouthRad) = (azFromSouthDeg mod 360)` — derived in the comment in `shadowGeometry.js`. Tests in `shadowGeometry.test.js` lock down all four cardinal cases plus a real-suncalc round-trip.

Shadow shape is the **convex hull** of the footprint ring + the same ring projected by `height / tan(altitude)` metres along the shadow bearing. This over-fills L/U-shaped buildings and erases courtyards — acceptable for Phase 1; a TODO in the file flags edge-extrusion union as the future fix.

Two suppression thresholds: `MIN_SUN_ALTITUDE_RAD` (≈3°, otherwise shadows stretch for kilometres) and `MAX_SHADOW_LENGTH_M` cap.

### Building data

`src/hooks/useBuildingData.js` runs once on mount via `fetchBuildings` (`src/lib/overpassClient.js`):

1. Check `localStorage` cache (`ccw-shadow:overpass:v1`).
2. POST Overpass QL to each endpoint in `OVERPASS_ENDPOINTS` (`constants.js`) until one succeeds.
3. Fall back to bundled `public/buildings-fallback.json` if all live endpoints fail.

`normalizeOverpassResponse` (`src/lib/buildingNormalizer.js`) turns raw Overpass elements into `{ id, footprint, heightM, heightSource, ... }`. Height resolution order is **load-bearing** (the README documents it as a contract):

1. `tags.height` — but values <5 m are rejected (OSM uses `height=1` as a "real value unknown" placeholder).
2. `tags["building:levels"] × DEFAULT_LEVEL_HEIGHT_M` (3.5 m).
3. Manual override in `src/data/knownHeights.json`, keyed by `way/<id>` or `relation/<id>`. This is how Commerce Court West, Scotia Plaza, TD Canada Trust Tower, etc. get correct heights — they're missing or stubbed in OSM.
4. `heightM = 0`, `heightSource = "unknown"` → footprint draws but no shadow.

When adding a new override, use the OSM element's actual type+id and set both `heightM` and `label` so the popup matches.

### Map rendering

`MapView.jsx` mounts Leaflet once, then has two phases:

- A `useEffect` on `buildings` rebuilds **footprint polygons** (one per building) and **pre-creates hidden shadow polygons**.
- The imperative `updateShadows` repositions existing shadow polygons in place via `setLatLngs`. Do not destructure this into a React render path; the slider plays at ~30 sim-min/sec and re-creating layers per frame would jank.

Commerce Court West gets a highlight style (orange) — detection is by name regex against the resolved `b.name`, which uses the override `label` when present.

## Testing

Vitest runs in `node` environment (`vite.config.js`), so tests cannot touch Leaflet, the DOM, or `localStorage`. Keep tests in `src/**/*.test.js` and target the pure modules in `src/lib/`. The existing tests use a real `SunCalc` round-trip on the equinox and June 21 to validate the bearing convention end-to-end — when changing anything in `shadowGeometry.js`, those are the canaries.

## Time zone handling

All user-facing time is Toronto local. Never `new Date(yyyy, mm, dd, hh, mm)` directly — that uses the browser's local zone. Always go through `torontoLocalToUtc` / `dateAndMinutesToUtc` in `src/lib/sunTime.js`.
