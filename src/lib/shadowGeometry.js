import * as turf from "@turf/turf";
import { MAX_SHADOW_LENGTH_M, MIN_SUN_ALTITUDE_RAD } from "./constants.js";

// SunCalc.getPosition returns azimuth in radians measured from south, clockwise toward west:
//   south = 0, west = +π/2, north = ±π, east = -π/2 (or +3π/2). May be negative.
// Turf.destination expects bearing in degrees from north, clockwise.
//
// Sun bearing from north = (azFromSouthDeg + 180).
// Shadow points opposite the sun = sunBearingFromNorth + 180 = azFromSouthDeg + 360 ≡ azFromSouthDeg (mod 360).
export function shadowBearingDeg(sunAzimuthRad) {
  const fromSouthDeg = (sunAzimuthRad * 180) / Math.PI;
  return ((fromSouthDeg % 360) + 360) % 360;
}

export function shadowLengthMeters(heightM, sunAltitudeRad) {
  if (sunAltitudeRad < MIN_SUN_ALTITUDE_RAD || heightM <= 0) return 0;
  const raw = heightM / Math.tan(sunAltitudeRad);
  return Math.min(raw, MAX_SHADOW_LENGTH_M);
}

// footprint: GeoJSON Polygon (coords in [lng, lat]).
// Returns a GeoJSON Feature<Polygon> for the projected shadow on the ground, or null when
// the sun is below the threshold or the building has no usable height.
//
// TODO: edge-extrusion union — convex hull is correct only for convex footprints; L- and U-
// shapes get over-filled and interior courtyards are erased. Acceptable for Phase 1.
export function computeShadowPolygon(footprint, heightM, sunAzimuthRad, sunAltitudeRad) {
  if (sunAltitudeRad < MIN_SUN_ALTITUDE_RAD || heightM <= 0) return null;
  const lengthM = shadowLengthMeters(heightM, sunAltitudeRad);
  if (lengthM <= 0) return null;
  const bearing = shadowBearingDeg(sunAzimuthRad);
  const ring = footprint.coordinates[0];
  const projected = ring.map(([lng, lat]) => {
    const d = turf.destination([lng, lat], lengthM / 1000, bearing, { units: "kilometers" });
    return d.geometry.coordinates;
  });
  const fc = turf.featureCollection([
    ...ring.map((c) => turf.point(c)),
    ...projected.map((c) => turf.point(c)),
  ]);
  return turf.convex(fc);
}
