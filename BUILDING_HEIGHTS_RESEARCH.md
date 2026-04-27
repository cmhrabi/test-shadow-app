# Building height data sources — research notes

## Problem

In low-density areas (e.g. College & Dovercourt, Toronto), many buildings have no shadow because OSM lacks `height` and `building:levels` tags for typical low-rise residential. Current resolution chain in `src/lib/buildingNormalizer.js`:

1. `tags.height` (rejected if <5m — OSM placeholder guard)
2. `tags["building:levels"] × 3.5m`
3. Manual override in `src/data/knownHeights.json` (downtown landmarks only)
4. `heightM = 0` → no shadow

Steps 1–3 miss most non-landmark buildings outside downtown.

## Recommendation

**City of Toronto 3D Massing dataset.** Best fit for any building inside Toronto city limits.

- Free, OGL-Toronto licence (commercial use allowed, attribution requested)
- Refreshed 2025-12-05, on annual cadence
- Covers every building in the City of Toronto
- Each polygon has explicit `EleZ` height in metres, derived from the city's own LIDAR + planning data
- Sub-metre accuracy on landmark buildings; low-single-digit-metre accuracy on block-modelled residential
- WGS84 already (matches Leaflet pipeline)

**Direct download (2025 Shapefile, ~81 MB):**
`https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/387b2e3b-2a76-4199-8b3b-0b7d22e2ec10/resource/667237d6-4d3c-4cf3-8cb7-e91c48d59375/download/3dmassingshapefile_2025_wgs84.zip`

**Open Data portal page:**
`https://open.toronto.ca/dataset/3d-massing/`

This single source plausibly removes the need for `knownHeights.json` and the Overpass `building:levels` fallback inside Toronto.

## Integration plan

1. Download `3dmassingshapefile_2025_wgs84.zip`.
2. Convert to GeoJSON: `ogr2ogr -f GeoJSON output.geojson input.shp`.
3. Simplify with `mapshaper -simplify 10%` to get from ~80 MB down to ~10 MB.
4. Drop the simplified GeoJSON into `public/toronto-3d-massing.json`.
5. New module `src/lib/torontoMassing.js`:
   - Loads the asset on first call
   - Builds a spatial index with `flatbush` (or `rbush`) keyed by polygon centroid
   - Exposes `getHeightForFootprint(footprint)` — looks up the nearest massing polygon to the footprint centroid and returns its `EleZ`
6. Insert as resolution step **2.5** in `resolveHeight()` (`src/lib/buildingNormalizer.js:54`), between `building:levels` and `knownHeights.json`. Use `heightSource: "toronto-3d-massing"`.
7. Verify, then likely retire most of `knownHeights.json` (3D Massing has Commerce Court, Scotia Plaza, etc. modelled accurately).

### Gotchas

- The download has both Shapefile and Multipatch resources — use the **Shapefile** ZIP, not Multipatch (multipatch is 3D geometry, harder to handle).
- Annual refresh, so brand-new construction lags 1–12 months.
- The 3D Massing footprints won't perfectly align with OSM Overpass footprints — that's why the resolver should look up by **footprint centroid → nearest massing polygon** rather than expecting an exact polygon match.
- Attribution required: "Contains information licensed under the Open Government Licence – Toronto."

## Alternatives considered

### Microsoft Global ML Building Footprints — Canada-wide fallback
- Feb 2026 release ships heights for ~225M buildings globally, ODbL licence, ML-derived from Maxar/Vexcel imagery, ~1–3 m mean error.
- Distributed as quadkey-sharded GeoJSON on Azure / Planetary Computer STAC.
- Useful if the app expands beyond Toronto. Height coverage in Canada is partial in the 2026 drop. Polygons are MS-derived (not OSM), so we'd be doing nearest-polygon lookup against our existing footprints.
- GitHub: `https://github.com/microsoft/GlobalMLBuildingFootprints`

### Overture Maps Buildings
- Aggregates OSM + Microsoft + Esri + Google into one schema with `height` and `num_floors` fields and stable GERS IDs.
- Distributed as Parquet on S3/Azure — needs a server-side step (DuckDB) or pre-baked extract. Not browser-friendly.
- Height fill is "more complete in the US than the rest of the world." Not better than Toronto 3D Massing for our case.
- Docs: `https://docs.overturemaps.org/guides/buildings/`

### NRCan HRDEM (LIDAR DSM/DTM)
- Full GTA coverage from 2023–2024 LIDAR flights at 1 m. Free, OGL-Canada.
- In principle: `height = mean(DSM − DTM)` over each footprint = ~1 m accuracy.
- Practicality: poor for a small web app. Tiles are 50×50 km GeoTIFFs, hundreds of MB each. Building this pipeline effectively recreates what Toronto already publishes.
- Only worth it if we need coverage outside Toronto.
- Page: `https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995`

### Ontario Digital Surface/Terrain Model
- Provincial-scope 1 m LIDAR DSM/DTM. Same verdict as HRDEM.
- Page: `https://geohub.lio.gov.on.ca/maps/mnrf::ontario-digital-surface-model-lidar-derived/about`

## Skipped

- **Google Photorealistic 3D Tiles** — ToS explicitly prohibits extracting heights/measurements/geometry.
- **Google Open Buildings (2.5D Temporal)** — Africa / South Asia / SE Asia / LatAm only. No Canada coverage.
- **OSM Buildings tile API / Cesium OSM Buildings / Mapbox 3D Buildings** — all surface OSM `height` / `building:levels` data, same input we already use. (Note: this needs more verification — Mapbox's newer Standard style may enrich heights beyond raw OSM. Not investigated thoroughly.)
- **NASA SRTM / ESA WorldCover / Statistics Canada** — none contain per-building heights at useful resolution.
- **Inferring height from satellite shadow length / streetview ML** — interesting research, way too much engineering for this app.

## Sources

- [3D Massing — City of Toronto Open Data Portal](https://open.toronto.ca/dataset/3d-massing/)
- [Toronto 3D Massing — TMU GMDC](https://library.torontomu.ca/gmdc/2015/01/20/toronto3dmassing/)
- [microsoft/GlobalMLBuildingFootprints](https://github.com/microsoft/GlobalMLBuildingFootprints)
- [Microsoft 2026 GlobalMLBuildingFootprints update — Spatialists](https://spatialists.ch/posts/2026/02/10-microsoft-2026-globalmlbuildingfootprints-update-examined/)
- [Overture Maps Buildings overview](https://docs.overturemaps.org/guides/buildings/)
- [HRDEM CanElevation Series](https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995)
- [Ontario Digital Surface Model](https://geohub.lio.gov.on.ca/maps/mnrf::ontario-digital-surface-model-lidar-derived/about)
