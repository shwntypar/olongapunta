// Turns a mixed itinerary's legs into rides (tricycle or jeepney) and walks —
// what the map draws and the directions panel lists.

import { tricycleZones } from "../../domain/TricycleZoneData";
import type { LineGeometry } from "../../domain/types";
import { getDistanceMeters } from "../geo";
import type { JeepLine, RouteResult } from "./types";

export interface MixedRide {
  mode: "trike" | "jeep";
  /** Jeepney rides: the route direction. */
  line?: JeepLine;
  /** Tricycle rides: the TODA zone it was boarded in. */
  zoneId?: string;
  /** Jeepney rides, when waiting areas are known: the one boarded at, or null if boarding away from one. */
  waitingArea?: string | null;
  /** Jeepney rides: a local boarding note for where it's boarded ("In Cabalan, take the J-06…"). */
  boardNote?: string;
  coordinates: number[][];
  startCoords: number[];
  endCoords: number[];
  /** Walking right before boarding, in km. */
  approachWalkKm: number;
  /** Wait + ride time. */
  minutes: number;
  pesos: number;
  km: number;
  crossesZone: boolean;
}

export interface MixedRouteShape {
  rides: MixedRide[];
  walkGeometries: LineGeometry[];
  /** Walking after the last ride, to the destination, in km. */
  finalWalkKm: number;
  walkKm: number;
}

const lengthKm = (coords: number[][]) => {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += getDistanceMeters(coords[i - 1], coords[i]);
  return m / 1000;
};

export function describeMixedRoute(route: RouteResult): MixedRouteShape {
  const rides: MixedRide[] = [];
  const walkGeometries: LineGeometry[] = [];
  let current: MixedRide | null = null;
  let walkedKm = 0;
  let walkKm = 0;

  for (const leg of route.legs) {
    if (leg.transition === "board-trike" || leg.transition === "board-jeep") {
      current = {
        mode: leg.transition === "board-jeep" ? "jeep" : "trike",
        zoneId: leg.zone,
        waitingArea: leg.waitingArea,
        boardNote: leg.boardNote,
        coordinates: [],
        startCoords: [],
        endCoords: [],
        approachWalkKm: walkedKm,
        minutes: leg.minutes,
        pesos: leg.pesos,
        km: 0,
        crossesZone: false,
      };
      rides.push(current);
      walkedKm = 0;
      continue;
    }
    if (leg.transition === "alight") {
      current = null;
      continue;
    }
    if (current && leg.mode !== "walk") {
      current.minutes += leg.minutes;
      current.pesos += leg.pesos;
      current.line ??= leg.line;
      current.crossesZone ||= leg.transition === "trike-cross";
      current.coordinates.push(...(current.coordinates.length ? leg.coordinates.slice(1) : leg.coordinates));
      current.km += lengthKm(leg.coordinates);
      continue;
    }
    if (leg.mode === "walk" && leg.coordinates.length >= 2) {
      walkGeometries.push({ type: "LineString", coordinates: leg.coordinates });
      const k = lengthKm(leg.coordinates);
      walkedKm += k;
      walkKm += k;
    }
  }

  // A ride that never moved (board and straight off) has nothing to draw.
  const moved = rides.filter((r) => r.coordinates.length >= 2);
  for (const r of moved) {
    r.startCoords = r.coordinates[0];
    r.endCoords = r.coordinates[r.coordinates.length - 1];
  }
  return { rides: moved, walkGeometries, finalWalkKm: walkedKm, walkKm };
}

/** "Light Blue" for toda-4 — the zone's colour name, as riders know it. */
export function zoneShortName(zoneId?: string): string | null {
  const zone = tricycleZones.find((z) => z.id === zoneId);
  return zone ? zone.name.replace(/ Tricycle Zone$/i, "") : null;
}

/** "Yellow" for YELLOW. */
const colourName = (color: string) => color.charAt(0) + color.slice(1).toLowerCase();

/**
 * Short label for one ride: "Yellow J-01", "Green trike", or "Tricycle" if the zone is unknown. Jeepneys
 * carry their colour: riders go by it, and some codes are shared (J-01 is Yellow, Green and Brown).
 */
export function rideLabel(ride: MixedRide): string {
  if (ride.mode === "jeep" && ride.line) return `${colourName(ride.line.colorCode)} ${ride.line.routeCode}`;
  const zone = zoneShortName(ride.zoneId);
  return zone ? `${zone} trike` : "Tricycle";
}

/** "Light Blue trike → Orange J-02 → Green trike" */
export const rideChain = (shape: MixedRouteShape) => shape.rides.map(rideLabel).join(" → ");

/**
 * rideChain for a list of options, adding where each jeepney is headed when two options would
 * otherwise read the same — e.g. the two J-09s: "Blue J-09 to Castillejos", "Blue J-09 to San Marcelino".
 */
export function distinctRideChains(shapes: MixedRouteShape[]): string[] {
  const unique = (labels: string[], i: number) => labels.indexOf(labels[i]) === labels.lastIndexOf(labels[i]);
  const describe = (shape: MixedRouteShape, jeep: (ride: MixedRide, line: NonNullable<MixedRide["line"]>) => string) =>
    shape.rides.map((ride) => (ride.mode === "jeep" && ride.line ? jeep(ride, ride.line) : rideLabel(ride))).join(" → ");
  const plain = shapes.map(rideChain);
  const headed = shapes.map((shape) => describe(shape, (ride, line) => `${rideLabel(ride)} to ${line.heading}`));
  // Same code and same heading (both J-09s come in "to Olongapo"): say where each starts instead.
  const started = shapes.map((shape) => describe(shape, (ride, line) => `${rideLabel(ride)} from ${line.from}`));
  return shapes.map((_, i) => (unique(plain, i) ? plain[i] : unique(headed, i) ? headed[i] : started[i]));
}
