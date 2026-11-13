// Drawing for one tricycle (Martins) itinerary.

import { describeTricycleRoute } from "../../application/martins/routeShape";
import type { RouteResult } from "../../application/martins/types";
import type { DirectionsStep } from "../../domain/types";
import { PILL, type PillSpec } from "../mapbox/routeMarkers";
import type { RouteDrawing } from "./types";

const RIDE_COLOR = "#8b5cf6"; // violet — distinct from every jeepney route colour

const meters = (km: number) => Math.round(km * 1000);

function ridePills(route: RouteResult): PillSpec[] {
  const { rides, finalWalkKm } = describeTricycleRoute(route);

  return rides.flatMap((ride, i) => {
    const isFirst = i === 0;
    const isLast = i === rides.length - 1;
    const board: PillSpec = {
      coords: ride.startCoords,
      text: isFirst ? `🧭 Board tricycle (Walk ${meters(ride.approachWalkKm)}m)` : "🧭 Board next tricycle",
      style: PILL.tricycle,
    };
    const alight: PillSpec = isLast
      ? { coords: ride.endCoords, text: `🏁 Alight (Walk ${meters(finalWalkKm)}m to destination)`, style: PILL.arrive }
      : { coords: ride.endCoords, text: `🛑 Get down (Walk ${meters(rides[i + 1].approachWalkKm)}m to next)`, style: PILL.getDown };
    return [board, alight];
  });
}

/**
 * Collapses consecutive same-mode legs into readable phases ("Walk (5 min).",
 * "BOARD: Ride a tricycle…"). The graph has no street names, so this is a
 * phase summary rather than turn-by-turn.
 */
function tricycleSteps(route: RouteResult): DirectionsStep[] {
  const steps: DirectionsStep[] = [];
  let i = 0;
  while (i < route.legs.length) {
    const mode = route.legs[i].mode;
    let minutes = 0;
    let pesos = 0;
    let crossed = false;
    while (i < route.legs.length && route.legs[i].mode === mode) {
      minutes += route.legs[i].minutes;
      pesos += route.legs[i].pesos;
      if (route.legs[i].transition === "trike-cross") crossed = true;
      i++;
    }
    if (mode === "walk") {
      steps.push({ maneuver: { instruction: `Walk (${Math.round(minutes)} min).` }, distance: 0 });
    } else if (mode === "trike") {
      const crossingNote = crossed ? " incl. zone-crossing fee" : "";
      steps.push({ maneuver: { instruction: `BOARD: Ride a tricycle (${Math.round(minutes)} min) — ₱${pesos.toFixed(2)}${crossingNote}.` }, distance: 0 });
    }
  }
  steps.push({ maneuver: { instruction: `Total: ${route.cost[0].toFixed(1)} min · ₱${route.cost[1].toFixed(2)}` }, distance: 0 });
  return steps;
}

export function buildTricycleDrawing(route: RouteResult): RouteDrawing {
  const shape = describeTricycleRoute(route);
  return {
    lines: shape.rideGeometries.map((geometry) => ({ geometry, color: RIDE_COLOR })),
    walks: shape.walkGeometries,
    pills: ridePills(route),
    steps: tricycleSteps(route),
  };
}
