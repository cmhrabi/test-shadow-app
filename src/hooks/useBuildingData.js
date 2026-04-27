import { useEffect, useState } from "react";
import { fetchBuildings } from "../lib/overpassClient.js";
import { normalizeOverpassResponse } from "../lib/buildingNormalizer.js";

export function useBuildingData() {
  const [state, setState] = useState({ status: "loading", buildings: null, source: null, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchBuildings()
      .then(({ data, source }) => {
        if (cancelled) return;
        const buildings = normalizeOverpassResponse(data);
        setState({ status: "ready", buildings, source, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: "error", buildings: null, source: null, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
