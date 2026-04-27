import overrides from "../data/knownHeights.json";

// Lookup is keyed by "way/<id>" or "relation/<id>" — same scheme OSM uses.
export function lookupOverride(elementType, id) {
  const key = `${elementType}/${id}`;
  return overrides[key] ?? null;
}

export function listOverrides() {
  return overrides;
}
