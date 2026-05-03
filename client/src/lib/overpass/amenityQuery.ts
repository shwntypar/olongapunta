/**
 * Overpass QL: amenities + shops in bbox (Olongapo-area example bbox).
 * Keep [timeout:…] high enough; public Overpass is often slow (504s).
 */
export const AMENITY_OVERPASS_QUERY = `
[out:json][timeout:90];
(
  node["amenity"](14.80,120.25,14.85,120.30);
  way["amenity"](14.80,120.25,14.85,120.30);
  node["shop"](14.80,120.25,14.85,120.30);
  way["shop"](14.80,120.25,14.85,120.30);
);
out body;
>;
out skel qt;
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
