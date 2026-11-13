// Turns a tricycle itinerary's leg-by-leg list into the shapes the map draws:
// ride lines, walking lines, and where each ride starts and ends.

import * as turf from "@turf/turf";
import type { LineGeometry } from "../../domain/types";
import type { RouteResult } from "./types";

/** One continuous tricycle ride. */
export interface TricycleRide {
  startCoords: number[];
  endCoords: number[];
  /** Walking distance covered right before boarding this ride, in km. */
  approachWalkKm: number;
}

export interface TricycleRouteShape {
  rideGeometries: LineGeometry[];
  walkGeometries: LineGeometry[];
  rides: TricycleRide[];
  /** Walking left after the last ride, to the actual destination, in km. */
  finalWalkKm: number;
}

export function describeTricycleRoute(route: RouteResult): TricycleRouteShape {
  const rideGeometries: LineGeometry[] = [];
  const walkGeometries: LineGeometry[] = [];
  const rides: TricycleRide[] = [];

  // Every "board-trike" transition starts a new ride — tracked explicitly (not
  // just inferred from a walk leg in between) so a zero-distance re-board
  // (alight and immediately get on a different trike at the same spot) still
  // shows as two distinct rides, not one.
  let startsNewRide = true;
  let walkedSinceLastRideKm = 0;

  for (const leg of route.legs) {
    if (leg.transition === "board-trike") {
      startsNewRide = true;
      continue; // virtual, same-node transition — no geometry
    }
    // alight is also virtual; other legs need real geometry to draw or anchor a marker to.
    if (leg.coordinates.length < 2) continue;

    if (leg.mode === "trike") {
      rideGeometries.push({ type: "LineString", coordinates: leg.coordinates });
      const endCoords = leg.coordinates[leg.coordinates.length - 1];
      if (startsNewRide) {
        rides.push({ startCoords: leg.coordinates[0], endCoords, approachWalkKm: walkedSinceLastRideKm });
        walkedSinceLastRideKm = 0;
        startsNewRide = false;
      } else {
        rides[rides.length - 1].endCoords = endCoords;
      }
    } else if (leg.mode === "walk") {
      walkGeometries.push({ type: "LineString", coordinates: leg.coordinates });
      for (let i = 1; i < leg.coordinates.length; i++) {
        walkedSinceLastRideKm += turf.distance(turf.point(leg.coordinates[i - 1]), turf.point(leg.coordinates[i]));
      }
    }
  }

  return { rideGeometries, walkGeometries, rides, finalWalkKm: walkedSinceLastRideKm };
}
