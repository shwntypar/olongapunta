// The destinations the map shows: amenities from OpenStreetMap, plus the
// app's own tricycle stands and jeepney stops.

import { BLUE_ZONE_BOARDING_SPOTS, GREEN_ZONE_BOARDING_SPOTS, ORANGE_ZONE_BOARDING_SPOTS, RED_ZONE_BOARDING_SPOTS } from "../application/martins/zoneRules";
import { isInOlongapoCity } from "./cityBoundary";
import { mockRoutes } from "./MockData";
import { detailsSearchText, placeDetailsFromTags } from "./placeDetails";
import { disambiguateLocations, locationLabel, mergeDuplicatePlaces, nearbyPlaceLabel, nearestLocality } from "./placeLocation";
import type { Place } from "./types";

/** A zone's surveyed stands as places: "Blue Zone Stop 1", … */
function standPlaces(spots: [number, number][], zoneId: string, zoneName: string): Place[] {
  return spots.map(([lon, lat], i) => {
    const near = nearestLocality(lat, lon);
    return {
      id: `${zoneName.toLowerCase()}-boarding-${i}`,
      name: `${zoneName} Zone Stop ${i + 1}`,
      type: "tricycle_stand",
      zoneId,
      lat,
      lon,
      excludeModes: ["tricycle"],
      where: [`${zoneName} zone`, near && `near ${near.name}`].filter(Boolean).join(" · "),
    };
  });
}

/**
 * Field-surveyed tricycle stands (zoneRules.ts). Shared by the map markers,
 * the "Nearby Spots" list and the zone-grouped "Stops" tab. Tricycle mode is
 * excluded: routing a tricycle trip to its own stand isn't meaningful.
 */
export const TRICYCLE_STAND_PLACES: Place[] = [
  ...standPlaces(GREEN_ZONE_BOARDING_SPOTS, "toda-2", "Green"),
  ...standPlaces(BLUE_ZONE_BOARDING_SPOTS, "toda-3", "Blue"),
  ...standPlaces(ORANGE_ZONE_BOARDING_SPOTS, "toda-1", "Orange"),
  ...standPlaces(RED_ZONE_BOARDING_SPOTS, "toda-5", "Red"),
];

/** Each stand's label before any "by …" was added, so describing them again doesn't stack. */
const standBaseLabel = new Map<string | number, string>();

/**
 * Once the amenities have loaded, adds the closest named place to every
 * stand's label — "Orange zone · near Banicain · by Jollibee (40 m)" — so
 * stands in the same neighbourhood can be told apart. Updates the stand
 * objects in place: the map markers and lists hold these same objects.
 */
export function describeStandLocations(amenities: Place[]): void {
  for (const stand of TRICYCLE_STAND_PLACES) {
    if (!standBaseLabel.has(stand.id)) standBaseLabel.set(stand.id, stand.where ?? "");
    const base = standBaseLabel.get(stand.id)!;
    const by = nearbyPlaceLabel(stand.lat, stand.lon, amenities);
    stand.where = [base, by].filter(Boolean).join(" · ");
  }
}

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
    where: `${route.routeCode} ${route.routeName}`,
  }))
);

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  /** Ways and relations: their centre point (the query asks for `out center`). */
  center?: { lat: number; lon: number };
  nodes?: number[];
  tags?: Record<string, string>;
}

/**
 * Turns the /api/amenities (Overpass) response into places in Olongapo City
 * (not the SBMA Freeport — see cityBoundary.ts), with every
 * detail OSM has about each one (placeDetails.ts). Nodes are used as-is;
 * ways and relations (buildings and grounds drawn as outlines — often the
 * big places: schools, hospitals, malls) are placed at the centre Overpass
 * returns, or the average of their corner points if it's missing.
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
    } else if (el.center) {
      lat = el.center.lat;
      lon = el.center.lon;
    } else if (el.type === "way") {
      const corners = (el.nodes ?? []).map((id) => nodesById.get(id)).filter((n): n is OverpassElement => !!n);
      if (corners.length === 0) continue;
      lat = corners.reduce((sum, n) => sum + (n.lat ?? NaN), 0) / corners.length;
      lon = corners.reduce((sum, n) => sum + (n.lon ?? NaN), 0) / corners.length;
    }

    if (typeof lat !== "number" || typeof lon !== "number" || isNaN(lat) || isNaN(lon)) continue;
    if (!isInOlongapoCity(lat, lon, el.tags["addr:city"])) continue; // outside the city, or inside the SBMA Freeport
    const details = placeDetailsFromTags(el.tags, { type: el.type, id: el.id });
    places.push({
      // Node, way and relation ids are separate number spaces in OSM, so prefix ways/relations to keep ids unique.
      id: el.type === "node" ? el.id : `${el.type}-${el.id}`,
      name: el.tags.name || "Unnamed",
      type: el.tags.amenity || el.tags.shop || el.tags.tourism || "place",
      lat,
      lon,
      details,
      where: locationLabel(lat, lon, details),
    });
  }
  const unique = mergeDuplicatePlaces(places);
  disambiguateLocations(unique);
  return unique;
}

/**
 * Search-box match (case-insensitive): every word of the query must appear in
 * the place's name, type, location or details — so "jollibee barretto" finds
 * the Barretto branch. An empty query matches everything.
 */
/**
 * Search results in a useful order: places whose NAME contains every word
 * first (searching "city hall" puts Olongapo City Hall above the 7-Eleven
 * "by Olongapo City Hall"), then the rest, each in their original order.
 */
export function searchPlaces(places: Place[], query: string): Place[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = places.filter((p) => matchesSearch(p, query));
  if (words.length === 0) return matches;
  const byName = (p: Place) => words.every((w) => (p.name || "").toLowerCase().includes(w));
  return [...matches.filter(byName), ...matches.filter((p) => !byName(p))];
}

export function matchesSearch(place: Place, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [place.name, place.type?.replace(/_/g, " "), place.where, detailsSearchText(place.details)].join(" ").toLowerCase();
  return words.every((w) => text.includes(w));
}
