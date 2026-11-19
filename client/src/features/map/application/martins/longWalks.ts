// Transit: "if a jeepney can take you there and it isn't that near, take the
// jeepney". The search optimises time and fare, so walking 1.2 km to a
// provincial jeepney's terminal (16 min, ₱0) beats riding another jeepney
// there (≈17 min, ₱13) and a hop like "Yellow → Brown" never shows. Riders
// would rather pay the ₱13 than walk that far in the heat, so a long walk —
// to the first jeepney, between two, or from the last one — is replaced by a
// ride when one does the same stretch about as fast.

import type { LoadedGraph } from "./neighbors";
import { findParetoRoutes } from "./routeResult";
import { ridesSomething, walkingKm } from "./curation";
import type { RouteLeg, RouteResult } from "./types";

/** A walk longer than this is worth replacing with a jeepney ride. */
export const LONG_WALK_KM = 0.5;
/** The ride may take at most this many minutes longer than the walk it replaces (time first, fare second)… */
export const HOP_MAX_EXTRA_MIN = 3;
/** …and must spare at least this much of it. */
export const HOP_MIN_WALK_SAVED_KM = 0.3;

const jeepRoutes = (legs: RouteLeg[]) => new Set(legs.flatMap((l) => (l.line ? [l.line.routeId] : [])));
const costOf = (legs: RouteLeg[]): [number, number] => [legs.reduce((m, l) => m + l.minutes, 0), legs.reduce((p, l) => p + l.pesos, 0)];

/** [start, end) leg ranges of the trip's walks (consecutive "walk" legs). */
function walks(legs: RouteLeg[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (let i = 0; i < legs.length; i++) {
    if (legs[i].transition !== "walk") continue;
    let j = i;
    while (j < legs.length && legs[j].transition === "walk") j++;
    ranges.push([i, j]);
    i = j;
  }
  return ranges;
}

/**
 * `route` with each long walk replaced by the fastest jeepney ride over the same stretch that is at most
 * HOP_MAX_EXTRA_MIN slower and spares HOP_MIN_WALK_SAVED_KM of walking — or `route` unchanged.
 * The ride never reuses a jeepney the trip already takes. Searches `graph` as configured by the caller.
 */
export function rideInsteadOfLongWalks(graph: LoadedGraph, route: RouteResult): RouteResult {
  let legs = route.legs;
  // Last walk first, so the earlier ranges stay valid as legs are spliced in.
  for (const [start, end] of walks(legs).reverse()) {
    const stretch: RouteResult = { cost: costOf(legs.slice(start, end)), legs: legs.slice(start, end) };
    const km = walkingKm(stretch);
    if (km <= LONG_WALK_KM) continue;
    const used = jeepRoutes(legs);
    const ride = findParetoRoutes(graph, legs[start].fromNode, legs[end - 1].toNode, { requireRide: true })
      .filter((r) => ridesSomething(r) && ![...jeepRoutes(r.legs)].some((id) => used.has(id)))
      .filter((r) => r.cost[0] <= stretch.cost[0] + HOP_MAX_EXTRA_MIN && walkingKm(r) <= km - HOP_MIN_WALK_SAVED_KM)
      .sort((a, b) => a.cost[0] - b.cost[0] || a.cost[1] - b.cost[1])[0];
    if (ride) legs = [...legs.slice(0, start), ...ride.legs, ...legs.slice(end)];
  }
  return legs === route.legs ? route : { cost: costOf(legs), legs };
}

/**
 * For dropUnnecessaryTransfers: an option with an extra ride is worth showing next to `fewerRides` when
 * that one walks a long way (over LONG_WALK_KM) and the extra ride spares HOP_MIN_WALK_SAVED_KM of it for at
 * most HOP_MAX_EXTRA_MIN more — the same trade rideInsteadOfLongWalks makes.
 */
export function sparesLongWalk(route: RouteResult, fewerRides: RouteResult): boolean {
  const walked = walkingKm(fewerRides);
  return walked > LONG_WALK_KM && walkingKm(route) <= walked - HOP_MIN_WALK_SAVED_KM && route.cost[0] <= fewerRides.cost[0] + HOP_MAX_EXTRA_MIN;
}
