// Builds the "jeepney for the main stretch, tricycle for the part it doesn't
// reach" itinerary — or the reverse, a tricycle out to the jeepney — from the
// best jeepney-only option the Mixed search found.
//
// Why build it: Mixed shows Pareto-optimal options, and a jeepney + tricycle
// trip (₱13 + ₱30) is often beaten on both time and price by a single
// tricycle, so the search alone would never offer it. Riders still choose it
// (the jeepney covers most of the way), so it's offered as its own option
// when the tricycle really replaces a long walk at one end.
//
//   last stretch:  jeepney option up to where it gets off → walk to the street
//                  → tricycle (short road-graph search) → destination
//   first stretch: origin → tricycle → walk to the stop → jeepney option from boarding on

import { COMBO_MIN_WALK_SAVED_KM as COMBO_MIN_WALK_REPLACED_KM } from "./curation";
import { WALK_SPEED_KMH, type LoadedGraph } from "./neighbors";
import { ROAD_GRAPH, ROAD_NODES } from "./roadGraph";
import { findParetoRoutes } from "./routeResult";
import { nearestNode } from "./snapToNode";
import type { MartinsEdge, RouteLeg, RouteResult } from "./types";

/** The whole trip may be at most this much slower than the jeepney-only option (the tricycle must replace COMBO_MIN_WALK_SAVED_KM of walking). */
export const COMBO_MAX_EXTRA_MIN = 5;

const legKm = (leg: RouteLeg) => {
  let km = 0;
  for (let i = 1; i < leg.coordinates.length; i++) {
    const [a, b] = [leg.coordinates[i - 1], leg.coordinates[i]];
    const dx = (b[0] - a[0]) * 111.32 * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
    const dy = (b[1] - a[1]) * 110.574;
    km += Math.sqrt(dx * dx + dy * dy);
  }
  return km;
};
const walkKmOf = (legs: RouteLeg[]) => legs.filter((l) => l.mode === "walk").reduce((km, l) => km + legKm(l), 0);
const costOf = (legs: RouteLeg[]): [number, number] => [legs.reduce((m, l) => m + l.minutes, 0), legs.reduce((p, l) => p + l.pesos, 0)];
const usesJeep = (r: RouteResult) => r.legs.some((l) => l.transition === "board-jeep");
const usesTrike = (r: RouteResult) => r.legs.some((l) => l.transition === "board-trike");

/** The footpath link from a jeepney stop to its road node (jeepneyLayer.ts adds one per stop on the road network). */
function stopToRoad(graph: LoadedGraph, stopId: string): MartinsEdge | null {
  return (graph.adjacency.get(stopId) ?? []).find((e) => e.walkOnly && ROAD_GRAPH.nodes.has(e.to)) ?? null;
}

const linkLeg = (edge: MartinsEdge, reverse: boolean): RouteLeg => ({
  mode: "walk",
  transition: "walk",
  minutes: (edge.distanceKm / WALK_SPEED_KMH) * 60,
  pesos: 0,
  fromNode: reverse ? edge.to : edge.from,
  toNode: reverse ? edge.from : edge.to,
  coordinates: reverse ? [...edge.coordinates].reverse() : edge.coordinates,
});

/** Fastest tricycle trip (must ride) between two road nodes, or null. */
function fastestTricycle(fromRoadNode: string, toRoadNode: string): RouteResult | null {
  if (fromRoadNode === toRoadNode) return null;
  return findParetoRoutes(ROAD_GRAPH, fromRoadNode, toRoadNode, { requireRide: true }).find(usesTrike) ?? null;
}

/** Jeepney option, then a tricycle from where it gets off. */
function lastStretch(graph: LoadedGraph, jeep: RouteResult, destination: number[]): RouteResult | null {
  const alightAt = jeep.legs.findLastIndex((l) => l.transition === "alight");
  if (alightAt < 0 || walkKmOf(jeep.legs.slice(alightAt + 1)) < COMBO_MIN_WALK_REPLACED_KM) return null;
  const link = stopToRoad(graph, jeep.legs[alightAt].toNode);
  const goal = nearestNode(ROAD_NODES, destination as [number, number]);
  const trike = link && goal && fastestTricycle(link.to, goal.id);
  if (!link || !trike) return null;
  const legs = [...jeep.legs.slice(0, alightAt + 1), linkLeg(link, false), ...trike.legs];
  return { cost: costOf(legs), legs };
}

/** A tricycle to where the jeepney option boards, then that jeepney option. */
function firstStretch(graph: LoadedGraph, jeep: RouteResult, origin: number[]): RouteResult | null {
  const boardAt = jeep.legs.findIndex((l) => l.transition === "board-jeep");
  if (boardAt < 0 || walkKmOf(jeep.legs.slice(0, boardAt)) < COMBO_MIN_WALK_REPLACED_KM) return null;
  const link = stopToRoad(graph, jeep.legs[boardAt].fromNode);
  const start = nearestNode(ROAD_NODES, origin as [number, number]);
  const trike = link && start && fastestTricycle(start.id, link.to);
  if (!link || !trike) return null;
  const legs = [...trike.legs, linkLeg(link, true), ...jeep.legs.slice(boardAt)];
  return { cost: costOf(legs), legs };
}

/**
 * The better of "jeepney, then a tricycle" and "tricycle, then the jeepney",
 * built on the fastest jeepney-only option in `routes` — or null if neither
 * end has a long enough walk to replace, or the result is too slow.
 */
export function buildRemoteCombo(graph: LoadedGraph, routes: RouteResult[], origin: number[], destination: number[]): RouteResult | null {
  const jeep = routes.filter((r) => usesJeep(r) && !usesTrike(r)).sort((a, b) => a.cost[0] - b.cost[0])[0];
  if (!jeep) return null;
  const jeepWalkKm = walkKmOf(jeep.legs);
  const options = [lastStretch(graph, jeep, destination), firstStretch(graph, jeep, origin)].filter(
    (c): c is RouteResult => !!c && jeepWalkKm - walkKmOf(c.legs) >= COMBO_MIN_WALK_REPLACED_KM && c.cost[0] <= jeep.cost[0] + COMBO_MAX_EXTRA_MIN
  );
  return options.sort((a, b) => a.cost[0] - b.cost[0])[0] ?? null;
}

/**
 * Far trips (planMixedTrip.ts): the jeepney itinerary `jeep` with a single tricycle instead of the walk
 * to where it boards and/or from where it lets off — "Green trike to the terminal, then the Brown jeepney".
 * Each end is replaced only when it walks at least COMBO_MIN_WALK_SAVED_KM and the trip stays within
 * COMBO_MAX_EXTRA_MIN of the jeepney-only one. Returns `jeep` itself when neither end qualifies.
 */
export function withTricycleFeeders(graph: LoadedGraph, jeep: RouteResult, origin: number[], destination: number[]): RouteResult {
  let best = jeep;
  for (const build of [(r: RouteResult) => firstStretch(graph, r, origin), (r: RouteResult) => lastStretch(graph, r, destination)]) {
    const fed = build(best);
    if (fed && fed.cost[0] <= jeep.cost[0] + COMBO_MAX_EXTRA_MIN) best = fed;
  }
  return best;
}
