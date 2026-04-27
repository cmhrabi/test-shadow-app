import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import L from "leaflet";
import {
  MAP_CENTER,
  MAP_DEFAULT_ZOOM,
} from "../lib/constants.js";
import { computeShadowPolygon, shadowLengthMeters } from "../lib/shadowGeometry.js";

const FOOTPRINT_STYLE = {
  color: "#5a5a60",
  weight: 0.8,
  fillColor: "#7a7a82",
  fillOpacity: 0.3,
};

const HIGHLIGHT_FOOTPRINT_STYLE = {
  color: "#d97706",
  weight: 2,
  fillColor: "#f59e0b",
  fillOpacity: 0.45,
};

const SHADOW_STYLE = {
  stroke: false,
  fillColor: "#14141e",
  fillOpacity: 0.45,
  interactive: false,
};

const HIDDEN_STYLE = { fillOpacity: 0, opacity: 0 };

function ringToLatLngs(ring) {
  return ring.map(([lng, lat]) => [lat, lng]);
}

function isCommerceCourtWest(b) {
  if (b.heightSource === "override" && /commerce court west/i.test(b.name)) return true;
  return /commerce\s+court\s+west/i.test(b.name);
}

const MapView = forwardRef(function MapView({ buildings }, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const footprintLayerRef = useRef(null);
  const shadowLayerRef = useRef(null);
  const footprintPolysRef = useRef(new Map()); // id -> L.Polygon
  const shadowPolysRef = useRef(new Map());

  // Initialise the map once on mount.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      preferCanvas: true,
      zoomSnap: 0.5,
    }).setView([MAP_CENTER.lat, MAP_CENTER.lng], MAP_DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    shadowLayerRef.current = L.layerGroup().addTo(map); // shadows under footprints
    footprintLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      shadowLayerRef.current = null;
      footprintLayerRef.current = null;
      footprintPolysRef.current.clear();
      shadowPolysRef.current.clear();
    };
  }, []);

  // (Re)build footprint polygons whenever the building list changes.
  useEffect(() => {
    if (!mapRef.current || !footprintLayerRef.current || !shadowLayerRef.current) return;
    if (!buildings) return;

    footprintLayerRef.current.clearLayers();
    shadowLayerRef.current.clearLayers();
    footprintPolysRef.current.clear();
    shadowPolysRef.current.clear();

    for (const b of buildings) {
      const latlngs = ringToLatLngs(b.footprint.coordinates[0]);
      const highlight = isCommerceCourtWest(b);
      const fp = L.polygon(latlngs, highlight ? HIGHLIGHT_FOOTPRINT_STYLE : FOOTPRINT_STYLE);
      fp.bindPopup(() => {
        const len = b._lastShadowLengthM ?? 0;
        return `<strong>${b.name}</strong><br/>Height: ${
          b.heightM ? `${b.heightM.toFixed(1)} m` : "unknown"
        } <em>(${b.heightSource})</em><br/>Shadow length: ${len.toFixed(1)} m`;
      });
      fp.addTo(footprintLayerRef.current);
      footprintPolysRef.current.set(b.id, fp);

      // Pre-create the shadow polygon (initially hidden); we'll setLatLngs as time advances.
      const sh = L.polygon([latlngs], SHADOW_STYLE);
      sh.setStyle(HIDDEN_STYLE);
      sh.addTo(shadowLayerRef.current);
      shadowPolysRef.current.set(b.id, sh);
    }
  }, [buildings]);

  useImperativeHandle(
    ref,
    () => ({
      // Imperative API used by App on every slider tick. No React re-renders.
      updateShadows(buildings, sunPos) {
        if (!buildings || !sunPos) return;
        const { azimuth, altitude } = sunPos;
        for (const b of buildings) {
          const sh = shadowPolysRef.current.get(b.id);
          if (!sh) continue;

          const polygon = computeShadowPolygon(b.footprint, b.heightM, azimuth, altitude);
          if (!polygon) {
            sh.setStyle(HIDDEN_STYLE);
            b._lastShadowLengthM = 0;
            continue;
          }

          const ring = polygon.geometry.coordinates[0];
          sh.setLatLngs([ringToLatLngs(ring)]);
          sh.setStyle(SHADOW_STYLE);
          b._lastShadowLengthM = shadowLengthMeters(b.heightM, altitude);
        }
      },
    }),
    []
  );

  return (
    <div className="map-wrap">
      <div id="map" ref={containerRef} />
      <div className="attribution">
        Buildings © OpenStreetMap • Sun via SunCalc • Geometry via Turf
      </div>
    </div>
  );
});

export default MapView;
