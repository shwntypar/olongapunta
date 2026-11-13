// The destinations the map shows: amenities from OpenStreetMap, plus the
// app's own tricycle stands and jeepney stops.

import { GREEN_ZONE_BOARDING_SPOTS } from "../application/martins/zoneRules";
import { mockRoutes } from "./MockData";
import type { Place } from "./types";

/**
 * Field-surveyed Green-zone tricycle stands. Shared by the map markers, the
 * "Nearby Spots" list and the zone-grouped "Stops" tab. Tricycle mode is
 * excluded: routing a tricycle trip to its own stand isn't meaningful.
 */
export const TRICYCLE_STAND_PLACES: Place[] = GREEN_ZONE_BOARDING_SPOTS.map(([lon, lat], i) => ({
  id: `green-boarding-${i}`,
  name: `Green Zone Stop ${i + 1}`,
  type: "tricycle_stand",
  zoneId: "toda-2",
  lat,
  lon,
  excludeModes: ["tricycle"],
}));

/**
 * Jeepney stops, from each route's own stops[] list. Transit mode is excluded:
 * you'd just walk to a jeepney stop. Hidden unless SHOW_JEEPNEY_STOPS (config.ts).
 */
export const JEEPNEY_STOP_PLACES: Place[] = mockRoutes.flatMap((route) =>
  route.stops.map((stop, i) => ({
    id: `${route.id}-stop-${stop.order ?? i}`,
    name: stop.name,
    type: "jeepney_stop",
    routeId: route.id,
    lat: stop.lat,
    lon: stop.lng,
    excludeModes: ["transit"],
  }))
);

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
}

/**
 * Turns the /api/amenities (Overpass) response into places. Nodes are used
 * as-is; ways (buildings drawn as outlines) are placed at the average of
 * their corner points.
 */
export function parseAmenities(data: { elements: OverpassElement[] }): Place[] {
  const nodesById = new Map<number, OverpassElement>();
  for (const el of data.elements) if (el.type === "node") nodesById.set(el.id, el);

  const places: Place[] = [];
  for (const el of data.elements) {
    if (!el.tags) continue;

    let lat: number | undefined;
    let lon: number | undefined;
    if (el.type === "node") {
      lat = el.lat;
      lon = el.lon;
    } else if (el.type === "way") {
      const corners = (el.nodes ?? []).map((id) => nodesById.get(id)).filter((n): n is OverpassElement => !!n);
      if (corners.length === 0) continue;
      lat = corners.reduce((sum, n) => sum + (n.lat ?? NaN), 0) / corners.length;
      lon = corners.reduce((sum, n) => sum + (n.lon ?? NaN), 0) / corners.length;
    }

    if (typeof lat !== "number" || typeof lon !== "number" || isNaN(lat) || isNaN(lon)) continue;
    places.push({ id: el.id, name: el.tags.name || "Unnamed", type: el.tags.amenity || el.tags.shop, lat, lon });
  }
  return places;
}

/** Search-box match on a place's name or type (case-insensitive). An empty query matches everything. */
export function matchesSearch(place: Place, query: string): boolean {
  if (!query) return true;
  const term = query.toLowerCase();
  return (place.name || "").toLowerCase().includes(term) || (place.type || "").toLowerCase().includes(term);
}
