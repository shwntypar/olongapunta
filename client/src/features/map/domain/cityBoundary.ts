// Which places count as "in Olongapo": inside the city's administrative
// boundary and outside the Subic Bay Freeport (the former naval base run by
// SBMA, which the city boundary partly includes). Outlines from
// OpenStreetMap, saved by scripts/fetch-boundaries.ts.

import * as turf from "@turf/turf";
import data from "./cityBoundary.json";

const OLONGAPO = turf.feature(data.olongapo as GeoJSON.MultiPolygon);
const FREEPORT = turf.feature(data.freeport as GeoJSON.MultiPolygon);

/**
 * True for a place in Olongapo City outside the Freeport. `addressCity` is
 * the place's own OSM addr:city: a shop on the city line (the boundary
 * runs along the National Highway at Barretto) whose address says
 * Olongapo is kept even if its point lands a few metres over the line.
 * Nothing inside the Freeport is kept, whatever its address says.
 */
export function isInOlongapoCity(lat: number, lon: number, addressCity?: string): boolean {
  const point = turf.point([lon, lat]);
  if (turf.booleanPointInPolygon(point, FREEPORT)) return false;
  return turf.booleanPointInPolygon(point, OLONGAPO) || /^\s*olongapo(\s+city)?\s*$/i.test(addressCity ?? "");
}
