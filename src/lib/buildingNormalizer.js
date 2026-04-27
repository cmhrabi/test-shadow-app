import { DEFAULT_LEVEL_HEIGHT_M } from "./constants.js";
import { lookupOverride } from "./knownHeights.js";

// OSM convention: some buildings are tagged with height="1" as a placeholder when the
// real height is unknown. Reject anything implausibly small (<5m) so the levels fallback
// can do its job.
function parseHeightTag(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).trim().toLowerCase().replace(/m(eters)?$/, "").trim();
  const v = parseFloat(cleaned);
  return Number.isFinite(v) && v >= 5 ? v : null;
}

function parseLevelsTag(raw) {
  if (raw == null) return null;
  const v = parseFloat(String(raw).trim());
  return Number.isFinite(v) && v > 0 ? v : null;
}

function nameFromTags(tags = {}) {
  if (tags.name) return tags.name;
  if (tags["addr:housenumber"] && tags["addr:street"]) {
    return `${tags["addr:housenumber"]} ${tags["addr:street"]}`;
  }
  return "Unnamed building";
}

// Convert a raw Overpass `way` (with geometry array of {lat, lon}) into a closed GeoJSON ring.
function ringFromWayGeometry(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 3) return null;
  const ring = geometry.map((p) => [p.lon, p.lat]);
  const [first] = ring;
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  return ring;
}

// For relations, pick the largest outer-role member as the footprint. Good enough for Phase 1.
function ringFromRelation(relation) {
  if (!Array.isArray(relation.members)) return null;
  const outers = relation.members.filter((m) => m.type === "way" && m.role === "outer" && m.geometry);
  if (outers.length === 0) return null;
  let best = null;
  let bestSize = -1;
  for (const m of outers) {
    if (m.geometry.length > bestSize) {
      best = m;
      bestSize = m.geometry.length;
    }
  }
  return best ? ringFromWayGeometry(best.geometry) : null;
}

function resolveHeight(elementType, id, tags) {
  const tagH = parseHeightTag(tags?.height);
  if (tagH) return { heightM: tagH, heightSource: "tag:height" };

  const levels = parseLevelsTag(tags?.["building:levels"]);
  if (levels) return { heightM: levels * DEFAULT_LEVEL_HEIGHT_M, heightSource: "tag:levels" };

  const override = lookupOverride(elementType, id);
  if (override?.heightM) return { heightM: override.heightM, heightSource: "override" };

  return { heightM: 0, heightSource: "unknown" };
}

export function normalizeOverpassResponse(raw) {
  if (!raw || !Array.isArray(raw.elements)) return [];

  const buildings = [];
  for (const el of raw.elements) {
    let ring = null;
    if (el.type === "way") ring = ringFromWayGeometry(el.geometry);
    else if (el.type === "relation") ring = ringFromRelation(el);
    if (!ring) continue;

    const tags = el.tags || {};
    const { heightM, heightSource } = resolveHeight(el.type, el.id, tags);
    const overrideMeta = lookupOverride(el.type, el.id);
    const name = overrideMeta?.label ?? nameFromTags(tags);

    buildings.push({
      id: `${el.type}/${el.id}`,
      osmType: el.type,
      osmId: el.id,
      name,
      footprint: { type: "Polygon", coordinates: [ring] },
      heightM,
      heightSource,
      tags,
    });
  }

  return buildings;
}
