/**
 * Overpass QL: amenities + shops in bbox (Olongapo-area example bbox).
 * Keep [timeout:…] high enough; public Overpass is often slow (504s).
 */
export const AMENITY_OVERPASS_QUERY = `
[out:json][timeout:25];
(
  // Area 1: Olongapo City (excluding the core SBMA/Freeport zone)
  // We set the longitude start at 120.285 to avoid the SBMA area
  nwr["amenity"~"hospital|school|bank|restaurant|cafe|townhall|police|pharmacy|food|lodge"](14.78, 120.285, 14.88, 120.35);
  nwr["shop"](14.78, 120.285, 14.88, 120.35);

  // Area 2: North/East Olongapo (Cabalan areas)
  nwr["amenity"~"hospital|school|bank|restaurant|cafe|townhall|police|pharmacy|food"](14.80, 120.24, 14.88, 120.285);
  nwr["shop"](14.80, 120.24, 14.88, 120.285);
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
