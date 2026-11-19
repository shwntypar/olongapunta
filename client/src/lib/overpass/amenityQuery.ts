/**
 * Overpass QL: amenities + shops in bbox (Olongapo-area example bbox).
 * Keep [timeout:…] high enough; public Overpass is often slow (504s).
 */
export const AMENITY_OVERPASS_QUERY = `
[out:json][timeout:25];
(
  // One box around all of Olongapo City (its OSM boundary spans
  // 14.806–14.921 N, 120.233–120.418 E). The box also takes in part of
  // the SBMA Freeport; the app drops anything outside the city or inside
  // the Freeport using the real boundaries (features/map/domain/cityBoundary.ts).
  nwr["amenity"~"hospital|school|bank|restaurant|cafe|townhall|police|pharmacy|food|lodge"](14.80, 120.23, 14.93, 120.42);
  nwr["shop"](14.80, 120.23, 14.93, 120.42);
);
out center;
  `.trim();

/** Public instances (try in order). Main is often overloaded → 502/504 from upstream. */
export const OVERPASS_INTERPRETER_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

/** OSM / Overpass expect a real User-Agent; missing or generic ones may get blocked. */
export const OVERPASS_USER_AGENT =
  "Olongapunta/1.0 (map amenities; +https://www.openstreetmap.org/copyright)";
