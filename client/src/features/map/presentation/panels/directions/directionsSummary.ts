// Numbers the directions panel shows for the selected option of each mode.

import { crossesZone, rideCount, rideKm, totalKm } from "../../../application/martins/routeMetrics";
import { mockRoutes } from "../../../domain/MockData";
import { tricycleZones } from "../../../domain/TricycleZoneData";
import type { TransitCandidate } from "../../../domain/types";
import type { RouteSummary } from "../../route-summary-card";
import type { DirectionsProps } from "../types";

/** A tricycle ride at least this long (km, all rides added up) shows the fuel-price note: the fare is a flat ₱30, and on longer rides drivers may ask for more. */
export const LONG_TRICYCLE_TRIP_KM = 2;

/** One fare per jeepney ride. */
export const transitFare = (plan: TransitCandidate) => plan.jeepney.baseFare + (plan.transfer ? plan.transfer.jeepney.baseFare : 0);

/**
 * Jeepney travel time shown to the commuter. A rough estimate, not a timed
 * model: 4 minutes per point of the matcher's score (ride km + 3 × walk km,
 * + 0.5 for a transfer).
 */
export const transitMinutes = (plan: TransitCandidate) => Math.round(plan.score * 4);

/** Fare charged at a "BOARD:" / "TRANSFER" step, read from the step text or the route it names. */
export function fareForStep(instruction: string): string {
  // An explicit peso amount (tricycle steps carry their real fare) always wins.
  const explicit = instruction.match(/₱(\d+(?:\.\d+)?)/);
  if (explicit) return `₱${parseFloat(explicit[1]).toFixed(2)}`;

  const code = instruction.match(/Ride the ([\w-]+)|Board the ([\w-]+)/);
  const routeCode = code?.[1] ?? code?.[2];
  const jeepney = mockRoutes.find((r) => r.routeCode === routeCode);
  if (jeepney) return `₱${jeepney.baseFare.toFixed(2)}`;
  const zone = tricycleZones.find((z) => z.code === routeCode);
  if (zone) return `₱${zone.baseFare.toFixed(2)}`;
  return "₱13.00";
}

/** The selected tricycle option's fare, ride details and whether to show the fuel note. */
export function tricycleFacts(props: DirectionsProps) {
  const route = props.tricycleRoutes[props.activeTricycleIdx];
  if (!route) return null;
  const ridden = rideKm(route);
  return {
    route,
    fare: route.cost[1],
    rides: rideCount(route),
    crossesZone: crossesZone(route),
    rideKm: ridden,
    isLong: ridden >= LONG_TRICYCLE_TRIP_KM,
  };
}

/** The summary card's contents for the current mode and selected option. */
export function buildSummary(props: DirectionsProps): RouteSummary | null {
  const { mode } = props;

  if (mode === "transit") {
    const plan = props.transitCandidates[props.activeTransitIdx];
    if (!plan) return null;
    return {
      durationMin: transitMinutes(plan),
      fare: transitFare(plan),
      note: plan.transfer ? "1 transfer" : "Direct",
      noteKind: plan.transfer ? "transfer" : "direct",
    };
  }

  if (mode === "tricycle") {
    const route = props.tricycleRoutes[props.activeTricycleIdx];
    if (!route) return null;
    const transfer = rideCount(route) >= 2;
    return {
      durationMin: Math.round(route.cost[0]),
      distanceKm: totalKm(route).toFixed(1),
      fare: route.cost[1],
      note: transfer ? "1 transfer" : "Direct",
      noteKind: transfer ? "transfer" : "direct",
    };
  }

  const road = props.roadRoutes[props.activeRoadIdx];
  if (!road) return null;
  return {
    durationMin: Math.round((road.duration ?? 0) / 60),
    distanceKm: (road.distance / 1000).toFixed(1),
    note: props.roadRoutes.length > 1 ? `Route ${props.activeRoadIdx + 1} of ${props.roadRoutes.length}` : undefined,
    noteKind: "alternate",
  };
}
