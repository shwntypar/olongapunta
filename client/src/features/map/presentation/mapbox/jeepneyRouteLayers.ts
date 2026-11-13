// The always-on jeepney network: one line layer per route direction.

import mapboxgl from "mapbox-gl";
import { fetchSnappedJeepneyPath } from "../../application/mapboxDirections";
import { JEEPNEY_LINE_COLORS } from "../../domain/jeepneyColors";
import { mockRoutes, type JeepneyRoute } from "../../domain/MockData";

export type RouteDirectionKey = "fwd" | "rev";

/** Layer id for one direction of one route, e.g. "route-layer-route-3-fwd". The sidebar's direction ids use the same "<routeId>-<fwd|rev>" form. */
const layerId = (routeId: string, direction: RouteDirectionKey) => `route-layer-${routeId}-${direction}`;
const sourceId = (routeId: string, direction: RouteDirectionKey) => `route-source-${routeId}-${direction}`;

/** The digitized path for one direction. The return direction falls back to the forward path reversed. */
export function directionPath(route: JeepneyRoute, direction: RouteDirectionKey): [number, number][] | null {
  if (!route.path || route.path.length < 2) return null;
  return direction === "fwd" ? route.path : route.returnPath || [...route.path].reverse();
}

async function drawDirection(map: mapboxgl.Map, route: JeepneyRoute, direction: RouteDirectionKey) {
  const path = directionPath(route, direction);
  if (!path) return;

  try {
    const label = `line-${direction}:${route.routeCode}`;
    const snapped = await fetchSnappedJeepneyPath(path, label);
    if (!snapped) console.warn(`[${label}] Rendering raw hand-drawn path — it will cut corners on some roads.`);
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: snapped ?? { type: "LineString" as const, coordinates: path },
    };

    const source = map.getSource(sourceId(route.id, direction)) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(sourceId(route.id, direction), { type: "geojson", data });
    map.addLayer({
      id: layerId(route.id, direction),
      type: "line",
      source: sourceId(route.id, direction),
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": JEEPNEY_LINE_COLORS[route.colorCode] || "#000000", "line-width": 6, "line-opacity": 1.0, "line-blur": 3 },
    });
  } catch (error) {
    console.error(error);
  }
}

/** Draws both directions of every jeepney route, snapped to roads. */
export function drawAllJeepneyRoutes(map: mapboxgl.Map) {
  for (const route of mockRoutes) {
    void drawDirection(map, route, "fwd");
    void drawDirection(map, route, "rev");
  }
}

function forEachLayer(map: mapboxgl.Map, apply: (id: string, route: JeepneyRoute, direction: RouteDirectionKey) => void) {
  for (const route of mockRoutes) {
    for (const direction of ["fwd", "rev"] as const) {
      const id = layerId(route.id, direction);
      if (map.getLayer(id)) apply(id, route, direction);
    }
  }
}

/**
 * Shows the routes in visibleRouteIds and hides the rest. When one direction
 * is isolated ("<routeId>-fwd"), it stays bright and every other line fades.
 */
export function showJeepneyRoutes(map: mapboxgl.Map, visibleRouteIds: string[], isolatedDirectionId: string | null) {
  forEachLayer(map, (id, route, direction) => {
    map.setLayoutProperty(id, "visibility", visibleRouteIds.includes(route.id) ? "visible" : "none");
    const isFocused = !isolatedDirectionId || isolatedDirectionId === `${route.id}-${direction}`;
    map.setPaintProperty(id, "line-opacity", isFocused ? 1.0 : 0.15);
  });
}

/** Hides the whole jeepney network (while a trip is being routed). */
export function hideJeepneyRoutes(map: mapboxgl.Map) {
  forEachLayer(map, (id) => map.setLayoutProperty(id, "visibility", "none"));
}
