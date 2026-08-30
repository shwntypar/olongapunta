/**
 * Overpass QL: drivable roads inside a bbox, excluding motorway/trunk/primary
 * (and their link ramps) — the classes a real tricycle wouldn't use. Used to
 * build a small in-zone road graph so tricycle routes are constrained to
 * roads that actually exist inside a zone, instead of asking an external
 * routing engine that has no notion of the zone boundary.
 */
export function buildRoadOverpassQuery(bbox: [minLon: number, minLat: number, maxLon: number, maxLat: number]): string {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  // Overpass bbox order is (south, west, north, east)
  return `
[out:json][timeout:25];
(
  way["highway"~"^(residential|unclassified|living_street|service|tertiary|tertiary_link|secondary|secondary_link)$"](${minLat}, ${minLon}, ${maxLat}, ${maxLon});
);
out body;
>;
out skel qt;
  `.trim();
}
