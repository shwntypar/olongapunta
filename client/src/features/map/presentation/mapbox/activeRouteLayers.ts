// The route being shown right now: coloured ride lines plus grey dots for
// walking legs. One line layer and one dot layer, reused for every mode.

import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import type { LineGeometry } from "../../domain/types";

const LINE_SOURCE = "active-route";
const LINE_LAYER = "active-route-layer";
const DOT_SOURCE = "active-route-walk-dots";
const DOT_LAYER = "active-route-walk-dots-layer";
/** Walking legs render as dots this far apart (Google Maps style), so they never read as a ride. */
const WALK_DOT_SPACING_M = 14;

export interface RouteLine {
  geometry: LineGeometry;
  color: string;
}

/** Draws the ride lines (replacing whatever was shown). An empty list hides the layer. */
export function showRouteLines(map: mapboxgl.Map, lines: RouteLine[]) {
  const data = {
    type: "FeatureCollection" as const,
    features: lines.map((line) => ({
      type: "Feature" as const,
      properties: { color: line.color, dashArray: [1, 0] },
      geometry: line.geometry,
    })),
  };
  const visibility = lines.length > 0 ? "visible" : "none";

  const source = map.getSource(LINE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    map.setPaintProperty(LINE_LAYER, "line-color", ["get", "color"]);
    map.setPaintProperty(LINE_LAYER, "line-dasharray", ["get", "dashArray"]);
    map.setLayoutProperty(LINE_LAYER, "visibility", visibility);
    return;
  }

  map.addSource(LINE_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: LINE_LAYER,
    type: "line",
    source: LINE_SOURCE,
    layout: { "line-join": "round", "line-cap": "round", visibility },
    paint: { "line-color": ["get", "color"], "line-width": 6, "line-opacity": 0.9, "line-dasharray": ["get", "dashArray"] },
  });
}

export function hideRouteLines(map: mapboxgl.Map) {
  if (map.getLayer(LINE_LAYER)) map.setLayoutProperty(LINE_LAYER, "visibility", "none");
}

function walkDots(geometries: LineGeometry[]) {
  const points: ReturnType<typeof turf.point>[] = [];
  const stepKm = WALK_DOT_SPACING_M / 1000;

  for (const geometry of geometries) {
    const coords = geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    try {
      const line = turf.lineString(coords);
      const lengthKm = turf.length(line, { units: "kilometers" });
      if (lengthKm <= stepKm) {
        points.push(turf.point(coords[0]), turf.point(coords[coords.length - 1]));
        continue;
      }
      for (let d = 0; d <= lengthKm; d += stepKm) points.push(turf.along(line, d, { units: "kilometers" }));
    } catch {
      coords.forEach((c) => points.push(turf.point(c)));
    }
  }

  return turf.featureCollection(points);
}

/** Draws walking legs as dots (replacing whatever was shown). */
export function showWalkDots(map: mapboxgl.Map, geometries: LineGeometry[]) {
  const data = walkDots(geometries);
  const source = map.getSource(DOT_SOURCE) as mapboxgl.GeoJSONSource | undefined;

  if (source) {
    source.setData(data);
    map.setLayoutProperty(DOT_LAYER, "visibility", "visible");
    return;
  }

  map.addSource(DOT_SOURCE, { type: "geojson", data });
  map.addLayer({
    id: DOT_LAYER,
    type: "circle",
    source: DOT_SOURCE,
    paint: { "circle-radius": 3, "circle-color": "#9ca3af", "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 },
  });
}

export function setWalkDotsVisible(map: mapboxgl.Map, visible: boolean) {
  if (map.getLayer(DOT_LAYER)) map.setLayoutProperty(DOT_LAYER, "visibility", visible ? "visible" : "none");
}

/** Hides the whole active route (lines and walking dots). */
export function hideActiveRoute(map: mapboxgl.Map) {
  hideRouteLines(map);
  setWalkDotsVisible(map, false);
}
