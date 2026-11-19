// The search runs between graph nodes: the node nearest the rider's pin and
// the node nearest the destination. When either point is off the network (a
// building set back from the road, a pin past the last mapped street), the
// trip used to end at that node — the drawn walk stopped short of the pin and
// the walk wasn't counted. These add the missing stretch as a walking leg at
// each end, counted in the trip's time.

import { getDistanceMeters } from "../geo";
import { WALK_SPEED_KMH } from "./neighbors";
import type { MartinsNode, RouteLeg, RouteResult } from "./types";

/** Straight line × this ≈ the walk (the same street factor as walking.ts). */
const STREET_DETOUR = 1.3;
/** Shorter gaps than this aren't worth a leg. */
const MIN_GAP_KM = 0.005;

function endWalk(from: number[], to: number[], fromNode: string, toNode: string): RouteLeg | null {
  const km = getDistanceMeters(from, to) / 1000;
  if (km < MIN_GAP_KM) return null;
  return {
    mode: "walk",
    transition: "walk",
    minutes: ((km * STREET_DETOUR) / WALK_SPEED_KMH) * 60,
    pesos: 0,
    fromNode,
    toNode,
    coordinates: [from as [number, number], to as [number, number]],
  };
}

/** Minutes the two end stretches add to any trip between these points (for "walk the whole way" too). */
export function endWalkMinutes(origin: number[], start: MartinsNode, destination: number[], goal: MartinsNode): number {
  const legs = [endWalk(origin, [start.lon, start.lat], "origin", start.id), endWalk([goal.lon, goal.lat], destination, goal.id, "destination")];
  return legs.reduce((m, leg) => m + (leg?.minutes ?? 0), 0);
}

/**
 * The route with a walking leg from the pin to where it starts and from where it ends to the destination.
 * Measured from the route's own first and last points: a built option (a tricycle out to the jeepney,
 * comboBuilder.ts) can start at a different node than the search's `start`.
 */
export function withEndWalks(route: RouteResult, origin: number[], start: MartinsNode, destination: number[], goal: MartinsNode): RouteResult {
  const firstLeg = route.legs[0];
  const lastLeg = route.legs[route.legs.length - 1];
  const from = firstLeg?.coordinates[0] ?? [start.lon, start.lat];
  const to = lastLeg?.coordinates[lastLeg.coordinates.length - 1] ?? [goal.lon, goal.lat];
  const first = endWalk(origin, from, "origin", firstLeg?.fromNode ?? start.id);
  const last = endWalk(to, destination, lastLeg?.toNode ?? goal.id, "destination");
  const legs = [...(first ? [first] : []), ...route.legs, ...(last ? [last] : [])];
  return { cost: [route.cost[0] + (first?.minutes ?? 0) + (last?.minutes ?? 0), route.cost[1]], legs };
}
