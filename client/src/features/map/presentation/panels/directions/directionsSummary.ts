// Numbers the directions panel shows for the selected option of each mode.

import { describeMixedRoute, rideChain } from "../../../application/martins/mixedRouteShape";
import { crossesZone, rideCount, rideKm, totalKm } from "../../../application/martins/routeMetrics";
import { mockRoutes } from "../../../domain/MockData";
import { tricycleZones } from "../../../domain/TricycleZoneData";
import type { RouteSummary } from "../../route-summary-card";
import type { DirectionsProps } from "../types";

/** A tricycle ride at least this long (km, all rides added up) shows the fuel-price note: the fare is a flat ₱30, and on longer rides drivers may ask for more. */
export const LONG_TRICYCLE_TRIP_KM = 2;

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

  if (mode === "mixed" || mode === "transit") {
    const trip = mixedFacts(props);
    if (!trip) return null;
    const transfer = trip.rides >= 2;
    return {
      durationMin: Math.round(trip.route.cost[0]),
      distanceKm: totalKm(trip.route).toFixed(1),
      fare: trip.fare,
      note: transfer ? `${trip.rides} rides` : "Direct",
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

/** The selected Mixed or Transit option: its rides, fare, and whether its tricycle riding is long enough for the fuel note. */
export function mixedFacts(props: DirectionsProps) {
  const route = props.mode === "transit" ? props.transitRoutes[props.activeTransitIdx] : props.mixedRoutes[props.activeMixedIdx];
  if (!route) return null;
  const shape = describeMixedRoute(route);
  const trikeRides = shape.rides.filter((r) => r.mode === "trike");
  const trikeKm = trikeRides.reduce((km, r) => km + r.km, 0);
  return {
    route,
    shape,
    fare: route.cost[1],
    rides: shape.rides.length,
    chain: rideChain(shape),
    trikeKm,
    trikeFare: trikeRides.reduce((sum, r) => sum + r.pesos, 0),
    isLongTrike: trikeKm >= LONG_TRICYCLE_TRIP_KM,
  };
}
