import { describe, it, expect } from "vitest";
import SunCalc from "suncalc";
import {
  shadowBearingDeg,
  shadowLengthMeters,
  computeShadowPolygon,
} from "./shadowGeometry.js";
import { MAP_CENTER } from "./constants.js";

const TORONTO = MAP_CENTER;

// Build a tiny square footprint (~10m sides) centered on a coordinate, in [lng, lat] order.
function squareFootprint(lat, lng, halfSideDeg = 0.00005) {
  const ring = [
    [lng - halfSideDeg, lat - halfSideDeg],
    [lng + halfSideDeg, lat - halfSideDeg],
    [lng + halfSideDeg, lat + halfSideDeg],
    [lng - halfSideDeg, lat + halfSideDeg],
    [lng - halfSideDeg, lat - halfSideDeg],
  ];
  return { type: "Polygon", coordinates: [ring] };
}

describe("shadowBearingDeg", () => {
  it("sun due south (azimuth 0) → shadow bearing due north (0°)", () => {
    expect(shadowBearingDeg(0)).toBeCloseTo(0, 5);
  });

  it("sun in the west (azimuth +π/2) → shadow points east (90°)", () => {
    expect(shadowBearingDeg(Math.PI / 2)).toBeCloseTo(90, 5);
  });

  it("sun in the east (azimuth -π/2) → shadow points west (270°)", () => {
    expect(shadowBearingDeg(-Math.PI / 2)).toBeCloseTo(270, 5);
  });

  it("normalises to [0, 360)", () => {
    const v = shadowBearingDeg(2 * Math.PI + 0.1);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(360);
  });
});

describe("shadowLengthMeters", () => {
  it("sun at 45° → shadow length equals height", () => {
    const len = shadowLengthMeters(100, Math.PI / 4);
    expect(len).toBeCloseTo(100, 3);
  });

  it("sun below threshold → 0", () => {
    expect(shadowLengthMeters(100, 0.01)).toBe(0);
  });

  it("very low sun → capped at MAX_SHADOW_LENGTH_M", () => {
    const len = shadowLengthMeters(100, 0.06); // just above threshold
    expect(len).toBeLessThanOrEqual(5000);
  });
});

describe("computeShadowPolygon", () => {
  it("returns null at night", () => {
    const fp = squareFootprint(TORONTO.lat, TORONTO.lng);
    const result = computeShadowPolygon(fp, 100, 0, -0.5);
    expect(result).toBeNull();
  });

  it("returns null for zero-height buildings", () => {
    const fp = squareFootprint(TORONTO.lat, TORONTO.lng);
    const result = computeShadowPolygon(fp, 0, 0, Math.PI / 4);
    expect(result).toBeNull();
  });

  it("solar noon equinox in Toronto: shadow points due north", () => {
    // Use SunCalc's own solar-noon calculation to dodge equation-of-time ambiguity.
    const seed = new Date(Date.UTC(2026, 2, 20, 12, 0));
    const times = SunCalc.getTimes(seed, TORONTO.lat, TORONTO.lng);
    const sun = SunCalc.getPosition(times.solarNoon, TORONTO.lat, TORONTO.lng);
    expect(sun.altitude).toBeGreaterThan(0);
    // At suncalc's solar-noon approximation the sun is within ~0.5° of due south.
    expect(Math.abs(sun.azimuth)).toBeLessThan(0.02);

    const bearing = shadowBearingDeg(sun.azimuth);
    // Shadow points within 1° of due north (0 or 360).
    const norm = bearing > 180 ? bearing - 360 : bearing;
    expect(Math.abs(norm)).toBeLessThan(1.5);
  });

  it("late afternoon June 21 in Toronto: shadow points generally east-northeast", () => {
    // June 21 2026, 4 PM EDT = 20:00 UTC.
    const date = new Date(Date.UTC(2026, 5, 21, 20, 0));
    const sun = SunCalc.getPosition(date, TORONTO.lat, TORONTO.lng);
    expect(sun.altitude).toBeGreaterThan(0);
    // Sun should be in the western half (positive azimuth in suncalc convention).
    expect(sun.azimuth).toBeGreaterThan(0);

    const bearing = shadowBearingDeg(sun.azimuth);
    // Shadow falls ENE: bearing in roughly [40, 110].
    expect(bearing).toBeGreaterThan(30);
    expect(bearing).toBeLessThan(120);
  });

  it("produces a polygon larger than the footprint when sun is up", () => {
    const fp = squareFootprint(TORONTO.lat, TORONTO.lng, 0.0001);
    const result = computeShadowPolygon(fp, 50, 0, Math.PI / 4); // sun at 45° due south
    expect(result).not.toBeNull();
    expect(result.geometry.type).toBe("Polygon");
    expect(result.geometry.coordinates[0].length).toBeGreaterThanOrEqual(4);
  });
});
