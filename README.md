# Commerce Court West Shadow Scrubber — Phase 1 Prototype

A single-page web app that visualises building shadows in downtown Toronto for any
time of day on any date. The map is centred on Commerce Court West (43.6487,
-79.3795) and renders the projected ground shadow of every OSM building within
~500 m, updated in real time as you scrub a slider.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm test         # vitest — shadow geometry unit tests
```

## How it works

- **Buildings** come from a one-time Overpass API query (cached in `localStorage`).
  If every public Overpass mirror is unreachable, the app falls back to the
  bundled snapshot at `public/buildings-fallback.json`.
- **Sun position** comes from `suncalc` evaluated at the centre coordinate.
- **Shadow geometry** is the convex hull of each footprint plus the same vertices
  projected along the sun-opposite bearing by `height / tan(altitude)` metres,
  using `@turf/turf` for great-circle math.
- **Time zone** handling goes through `date-fns-tz` with `America/Toronto`, so DST
  transitions don't shift sun positions by an hour.

The pure math lives in `src/lib/shadowGeometry.js` (zero React, zero Leaflet) and
is unit-tested in the same directory.

## Heights

Per-building height is resolved in this order:

1. `tags.height` from OSM (small placeholder values <5 m are rejected — common
   "height=1" stub).
2. `tags["building:levels"] × 3.5 m`.
3. The hand-curated override table at `src/data/knownHeights.json`. Currently
   covers Commerce Court West, Scotia Plaza, TD Canada Trust Tower, the St.
   Regis, EY Tower, and L Tower — all of which have missing or stub height tags
   in OSM.
4. Skip shadow rendering. Footprint still draws in muted grey.

## Validation

Unit tests verify the bearing convention (sun-due-south → shadow due north,
sun-west → shadow east, etc.), shadow length at known altitudes, and a
real-suncalc round-trip at solar noon on the equinox.

In the browser, the success criterion is that on June 21 at 4 PM EDT, Commerce
Court West's shadow falls east-northeast across the Bay/Wellington block —
matching real-world reference imagery.

## Known limitations

- Shadows are projected onto a flat ground plane. Real shadows fall partly on
  neighbouring rooftops; the prototype ignores that.
- Convex-hull approximation slightly over-estimates shadow area for L- and
  U-shaped footprints and erases interior courtyards. Acceptable for downtown
  Toronto's mostly rectangular towers; revisit with edge-extrusion union later.
- Buildings with no `height`, no `building:levels`, and no override entry
  render no shadow — only the muted footprint.
- Below ~3° solar altitude shadows are suppressed (otherwise they'd stretch for
  kilometres and saturate the map).
- DST handling assumes the browser's IANA timezone database is current.

## Out of scope (Phase 1)

- "Is this patio in sun right now?" point-in-polygon checks.
- Shadows falling on building roofs vs. ground.
- Diffuse / reflected light.
- Cities other than Toronto.
