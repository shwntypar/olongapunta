// Drawing for one Mixed itinerary: tricycle and jeepney rides, with the walks
// between them.

import { describeMixedRoute, rideLabel, zoneShortName, type MixedRide } from "../../application/martins/mixedRouteShape";
import type { RouteResult } from "../../application/martins/types";
import { WALK_SPEED_KMH } from "../../application/martins/neighbors";
import { JEEPNEY_LINE_COLORS } from "../../domain/jeepneyColors";
import { serviceNote } from "../../domain/jeepneyService";
import type { DirectionsStep, LineGeometry } from "../../domain/types";
import { PILL, type PillSpec } from "../mapbox/routeMarkers";
import type { RouteDrawing } from "./types";

const TRIKE_COLOR = "#8b5cf6"; // same violet as Tricycle mode

const meters = (km: number) => Math.round(km * 1000);
const walkMinutes = (km: number) => Math.max(1, Math.round((km / WALK_SPEED_KMH) * 60));
const peso = (n: number) => `₱${n.toFixed(2)}`;

/** For sentences: "J-02 jeepney", "Green zone tricycle". */
function rideName(ride: MixedRide) {
  if (ride.mode === "jeep" && ride.line) return `${ride.line.routeCode} jeepney`;
  const zone = zoneShortName(ride.zoneId);
  return zone ? `${zone} zone tricycle` : "tricycle";
}

/** A change of ride with less walking than this is shown as one "Change here" pill — two pills that close overlap at the usual zoom. */
const MERGE_CHANGE_KM = 0.3;

function ridePills(rides: MixedRide[], geometries: LineGeometry[], finalWalkKm: number): PillSpec[] {
  const pills: PillSpec[] = [];
  rides.forEach((ride, i) => {
    const coords = geometries[i].coordinates;
    const start = coords[0];
    const end = coords[coords.length - 1];
    const icon = ride.mode === "jeep" ? "🚐" : "🧭";
    const style = ride.mode === "jeep" ? (i === 0 ? PILL.board : PILL.boardNext) : PILL.tricycle;

    if (i === 0) {
      pills.push({ coords: start, text: `${icon} Board ${rideLabel(ride)} (Walk ${meters(ride.approachWalkKm)}m)`, style });
    } else if (ride.approachWalkKm >= MERGE_CHANGE_KM) {
      pills.push({ coords: start, text: `${icon} Board next: ${rideLabel(ride)}`, style }); // the previous ride's "Get down" pill is far enough away
    } else {
      pills.push({ coords: start, text: `🔁 Change here → ${rideLabel(ride)} (Walk ${meters(ride.approachWalkKm)}m)`, style });
    }

    if (i === rides.length - 1) {
      pills.push({ coords: end, text: `🏁 Alight (Walk ${meters(finalWalkKm)}m to destination)`, style: PILL.arrive });
    } else if (rides[i + 1].approachWalkKm >= MERGE_CHANGE_KM) {
      pills.push({ coords: end, text: `🛑 Get down (Walk ${meters(rides[i + 1].approachWalkKm)}m to next)`, style: PILL.getDown });
    }
  });
  return pills;
}

/**
 * Where to wait for the jeepney — provincial ones at their terminal; others only once waiting areas are
 * known — plus the stop's own notes (a local rule, rush hour), which planMixedTrip.ts puts in boardNote.
 */
function waitingAreaNote(ride: MixedRide): string {
  const notes: string[] = [];
  if (ride.boardNote) notes.push(ride.boardNote);
  if (ride.line?.boardAtStart) {
    notes.push(`Provincial jeepney: board it at the start of its route (${ride.line.boardAtStart}) — it fills up there and seldom stops on the way.`);
  } else if (ride.waitingArea) {
    notes.push(`Wait at ${ride.waitingArea}.`);
  } else if (ride.waitingArea === null) {
    notes.push("No waiting shed here — jeepneys may pass full or not stop, so expect a longer wait.");
  }
  return notes.map((n) => ` ${n}`).join("");
}

function rideStep(ride: MixedRide, isFirst: boolean): DirectionsStep {
  const minutes = Math.round(ride.minutes);
  const fare = `${peso(ride.pesos)}${ride.crossesZone ? " incl. zone-crossing fee" : ""}`;
  let what: string;
  if (ride.mode === "jeep" && ride.line) {
    const verb = isFirst ? "Ride" : "Board";
    what = `${verb} the ${ride.line.routeCode} (${ride.line.colorCode} Jeep) heading towards ${ride.line.heading} (${minutes} min incl. wait) — ${fare}.${serviceNote(ride.line.colorCode, ride.line.waitMinutes)}${waitingAreaNote(ride)}`;
  } else {
    what = `${isFirst ? "Ride a" : "Board a"} ${rideName(ride)} (${minutes} min incl. wait) — ${fare}.`;
  }
  return { maneuver: { instruction: `${isFirst ? "BOARD" : "TRANSFER"}: ${what}` }, distance: 0 };
}

const walkStep = (km: number, to: string): DirectionsStep => ({
  maneuver: { instruction: `Walk ${meters(km)} m (about ${walkMinutes(km)} min) to ${to}.` },
  distance: 0,
});

function mixedSteps(route: RouteResult, rides: MixedRide[], finalWalkKm: number): DirectionsStep[] {
  const steps: DirectionsStep[] = [];
  rides.forEach((ride, i) => {
    if (ride.approachWalkKm >= 0.01) steps.push(walkStep(ride.approachWalkKm, i === 0 ? `board the ${rideName(ride)}` : `the ${rideName(ride)}`));
    steps.push(rideStep(ride, i === 0));
    const isLast = i === rides.length - 1;
    steps.push({ maneuver: { instruction: `ALIGHT: Get off here${isLast ? "" : ` and change to the ${rideName(rides[i + 1])}`}.` }, distance: 0 });
  });
  if (finalWalkKm >= 0.01) steps.push(walkStep(finalWalkKm, "your destination"));
  steps.push({ maneuver: { instruction: `Total: ${route.cost[0].toFixed(1)} min · ${peso(route.cost[1])}` }, distance: 0 });
  return steps;
}

/** Builds the drawing for a mixed itinerary. */
export function buildMixedDrawing(route: RouteResult): RouteDrawing {
  const shape = describeMixedRoute(route);
  // Jeepney rides already follow the roads: the mixed graph is built on road-snapped routes (domain/routeGeometry.ts).
  const geometries: LineGeometry[] = shape.rides.map((ride) => ({ type: "LineString", coordinates: ride.coordinates }));

  return {
    lines: shape.rides.map((ride, i) => ({
      geometry: geometries[i],
      color: ride.mode === "jeep" && ride.line ? JEEPNEY_LINE_COLORS[ride.line.colorCode] ?? "#000" : TRIKE_COLOR,
    })),
    walks: shape.walkGeometries,
    pills: ridePills(shape.rides, geometries, shape.finalWalkKm),
    steps: mixedSteps(route, shape.rides, shape.finalWalkKm),
  };
}
