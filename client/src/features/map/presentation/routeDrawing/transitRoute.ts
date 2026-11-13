// Drawing for one jeepney itinerary (a direct ride, or two rides with a transfer).

import * as turf from "@turf/turf";
import { fetchSnappedJeepneyPath, fetchWalkingLeg } from "../../application/mapboxDirections";
import { JEEPNEY_LINE_COLORS } from "../../domain/jeepneyColors";
import type { DirectionsRoute, LineGeometry, TransitCandidate, TransitLeg } from "../../domain/types";
import { PILL } from "../mapbox/routeMarkers";
import type { RouteDrawing } from "./types";

interface Ride {
  board: number[];
  drop: number[];
  geometry: LineGeometry;
}

/**
 * The ridden part of a jeepney leg, re-cut from the road-snapped route line
 * so it follows real streets. boardNear/dropNear are where the commuter
 * boards and alights. Falls back to the matcher's raw (hand-digitized) slice
 * if snapping fails.
 */
async function snapRide(leg: TransitLeg, boardNear: number[], dropNear: number[], label: string): Promise<Ride> {
  const fallback: Ride = { board: leg.boardingCoords, drop: leg.dropoffCoords, geometry: leg.slicedGeometry };
  const snapped = await fetchSnappedJeepneyPath(leg.activePathCoords, label);
  if (!snapped) return fallback;

  try {
    const line = turf.lineString(snapped.coordinates);
    const board = turf.nearestPointOnLine(line, turf.point(boardNear));
    const drop = turf.nearestPointOnLine(line, turf.point(dropNear));
    return { board: board.geometry.coordinates, drop: drop.geometry.coordinates, geometry: turf.lineSlice(board, drop, line).geometry };
  } catch (error) {
    console.warn(`[${label}] Snapped ride could not be cut; using the raw digitized slice.`, error);
    return fallback;
  }
}

const walkMeters = (walk: DirectionsRoute) => Math.round(walk.distance);
const rideColor = (leg: TransitLeg) => JEEPNEY_LINE_COLORS[leg.jeepney.colorCode] || "#000";
const boardStep = (leg: TransitLeg, prefix: "BOARD" | "TRANSFER", verb: string) => ({
  maneuver: { instruction: `${prefix}: ${verb} the ${leg.jeepney.routeCode} (${leg.jeepney.colorCode} Jeep) heading towards ${leg.headingTowards}.` },
  distance: 0,
});
const alightStep = (text: string) => ({ maneuver: { instruction: `ALIGHT: ${text}` }, distance: 0 });

async function directRideDrawing(leg: TransitCandidate, origin: number[], destination: number[]): Promise<RouteDrawing> {
  const ride = await snapRide(leg, origin, destination, `active:${leg.jeepney.routeCode}`);
  const [walkIn, walkOut] = await Promise.all([
    fetchWalkingLeg(origin, ride.board, `board:${leg.jeepney.routeCode}`),
    fetchWalkingLeg(ride.drop, destination, `alight:${leg.jeepney.routeCode}`),
  ]);

  return {
    lines: [{ geometry: ride.geometry, color: rideColor(leg) }],
    walks: [walkIn.geometry, walkOut.geometry],
    pills: [
      { coords: ride.board, text: `🚐 Board ${leg.jeepney.routeCode} (Walk ${walkMeters(walkIn)}m)`, style: PILL.board },
      { coords: ride.drop, text: `🏁 Alight (Walk ${walkMeters(walkOut)}m to destination)`, style: PILL.arrive },
    ],
    steps: [
      ...walkIn.legs[0].steps,
      boardStep(leg, "BOARD", "Ride"),
      alightStep("Get off here and continue on foot."),
      ...walkOut.legs[0].steps,
    ],
  };
}

async function transferDrawing(first: TransitCandidate, second: TransitLeg, origin: number[], destination: number[]): Promise<RouteDrawing> {
  const [ride1, ride2] = await Promise.all([
    snapRide(first, origin, first.dropoffCoords, `active-leg1:${first.jeepney.routeCode}`),
    snapRide(second, second.boardingCoords, destination, `active-leg2:${second.jeepney.routeCode}`),
  ]);
  const [walkIn, walkBetween, walkOut] = await Promise.all([
    fetchWalkingLeg(origin, ride1.board, `board:${first.jeepney.routeCode}`),
    fetchWalkingLeg(ride1.drop, ride2.board, `transfer:${first.jeepney.routeCode}-${second.jeepney.routeCode}`),
    fetchWalkingLeg(ride2.drop, destination, `alight:${second.jeepney.routeCode}`),
  ]);

  return {
    lines: [
      { geometry: ride1.geometry, color: rideColor(first) },
      { geometry: ride2.geometry, color: rideColor(second) },
    ],
    walks: [walkIn.geometry, walkBetween.geometry, walkOut.geometry],
    pills: [
      { coords: ride1.board, text: `🚐 Board ${first.jeepney.routeCode} (Walk ${walkMeters(walkIn)}m)`, style: PILL.board },
      { coords: ride1.drop, text: `🛑 Get Down (Walk ${walkMeters(walkBetween)}m to next)`, style: PILL.getDown },
      { coords: ride2.board, text: `🚐 Board Next (${second.jeepney.routeCode})`, style: PILL.boardNext },
      { coords: ride2.drop, text: `🏁 Alight (Walk ${walkMeters(walkOut)}m to destination)`, style: PILL.arrive },
    ],
    steps: [
      ...walkIn.legs[0].steps,
      boardStep(first, "BOARD", "Ride"),
      alightStep("Get off here and walk to the next jeepney."),
      ...walkBetween.legs[0].steps,
      boardStep(second, "TRANSFER", "Board"),
      alightStep("Get off here and continue on foot."),
      ...walkOut.legs[0].steps,
    ],
  };
}

/** Builds the drawing for a jeepney itinerary. Fetches road-snapped rides and walking legs from Mapbox. */
export function buildTransitDrawing(plan: TransitCandidate, origin: number[], destination: number[]): Promise<RouteDrawing> {
  return plan.transfer ? transferDrawing(plan, plan.transfer, origin, destination) : directRideDrawing(plan, origin, destination);
}
