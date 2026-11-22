// The app's entry point for Mixed mode: one Martins search over the road graph
// plus the jeepney layer, so an itinerary can hop between tricycles and
// jeepneys (e.g. tricycle to the highway, jeepney downtown, walk the rest).

import rawGraph from "./graph.json";
import walkStreets from "./walkStreets.json";
import { mockRoutes } from "../../domain/MockData";
import { closedRouteIds, isRushHour } from "../jeepney/serviceRules";
import { FALLBACK_ROUTES, PROVINCIAL_ROUTE_IDS } from "../../domain/jeepneyAreaRules";
import { hasLimitedService } from "../../domain/jeepneyService";
import { getDistanceMeters } from "../geo";
import { buildRemoteCombo, withTricycleFeeders } from "./comboBuilder";
import { endWalkMinutes, withEndWalks } from "./endWalks";
import { curateMixedRoutes, dropUnnecessaryTransfers, MIXED_MAX_WALK_KM, ridesSomething, walkingKm } from "./curation";
import { buildMixedGraph } from "./jeepneyLayer";
import { rideInsteadOfLongWalks, sparesLongWalk } from "./longWalks";
import { rushHourExtraMinutes, type LoadedGraph } from "./neighbors";
import type { WalkStreetsData } from "./walkStreets";
import { findParetoRoutes } from "./routeResult";
import { nearestNode } from "./snapToNode";
import type { MartinsGraph, MartinsNode, RouteResult } from "./types";

/**
 * Every route is in the graph, provincial ones included: who can board them
 * where is up to the area rules (domain/jeepneyAreaRules.ts — outbound only
 * at the terminal, in Cabalan only the J-06), so Mixed can use the Brown and
 * White jeepneys to Cabalan like Transit does.
 */
export const MIXED_JEEPNEY_ROUTES = mockRoutes;

/**
 * Mixed, trips at least this far (straight line): no tricycle hopping across
 * the city. A tricycle only takes the rider to where the jeepney boards (or
 * from where it lets off) — "Green trike to the terminal, then the Brown jeepney".
 */
export const FAR_TRIP_KM = 3;

// Built on first use, not at import: the tricycle-only modes never need it.
let mixed: { graph: LoadedGraph; nodes: MartinsNode[] } | null = null;

export function mixedGraph() {
  if (!mixed) {
    const { graph } = buildMixedGraph(rawGraph as unknown as MartinsGraph, MIXED_JEEPNEY_ROUTES, walkStreets as WalkStreetsData);
    mixed = { graph, nodes: [...graph.nodes.values()] };
  }
  return mixed;
}

/**
 * Transit only — when walking beats every jeepney, a jeepney is still offered
 * if it is at most this much slower than walking… (riders take one for the heat)
 */
const ABOUT_AS_FAST_MIN = 3;
/** …and cuts the walking by at least this share. Otherwise the panel suggests walking or a tricycle. */
const MIN_WALK_CUT = 1 / 3;

/** Transit alternatives: at most this many minutes slower than the best option… */
const ALTERNATIVE_MAX_EXTRA_MIN = 10;
/** …from at most this many extra searches… */
const MAX_ALTERNATIVES = 2;
/** …and at most this many options shown in all. */
const MAX_OPTIONS = 3;

const jeepRouteIds = (route: RouteResult) => route.legs.flatMap((l) => (l.line ? [l.line.routeId] : []));
const chainKey = (route: RouteResult) => [...new Set(jeepRouteIds(route))].join(">");

/** Options this close in time count as a tie for dominance (withoutDominated)… */
const NEAR_TIE_MIN = 1;
/** …and options this close in time (and equal in fare) are ordered by how dependable their jeepneys are. */
const DEPENDABLE_TIE_MIN = 3;

/** Lower is more dependable: a city route before a provincial one (they fill up at the terminal), an all-day colour before one with limited hours or units (the White's last trip is around 8 PM). */
function unreliability(route: RouteResult) {
  const lines = new Map(route.legs.flatMap((l) => (l.line ? [[l.line.routeId, l.line] as const] : [])));
  return [...lines.values()].reduce((sum, line) => sum + (PROVINCIAL_ROUTE_IDS.has(line.routeId) ? 1 : 0) + (hasLimitedService(line.colorCode) ? 1 : 0), 0);
}

/** Far Mixed trips: drop an option another one beats on both time (by more than a near tie) and fare. */
const withoutDominated = (routes: RouteResult[]) =>
  routes.filter((r) => !routes.some((o) => o !== r && o.cost[0] < r.cost[0] - NEAR_TIE_MIN && o.cost[1] <= r.cost[1]));

/** Fastest first, cheaper first on equal time — but within DEPENDABLE_TIE_MIN at the same fare, the more dependable jeepneys first. */
function byDependability(a: RouteResult, b: RouteResult) {
  if (Math.abs(a.cost[0] - b.cost[0]) <= DEPENDABLE_TIE_MIN && a.cost[1] === b.cost[1]) {
    const d = unreliability(a) - unreliability(b);
    if (d !== 0) return d;
  }
  return a.cost[0] - b.cost[0] || a.cost[1] - b.cost[1];
}

/** Sorted (byDependability), one option per jeepney chain (two options can end up the same after rideInsteadOfLongWalks). */
const uniqueChains = (routes: RouteResult[]) => [...routes].sort(byDependability).filter((r, i, all) => all.findIndex((o) => chainKey(o) === chainKey(r)) === i);

/**
 * The search keeps one best trip per fare level, so two different jeepneys
 * that both cost ₱13 and take about as long collapse into one. Transit riders
 * want to see both ("J-03 or J-05"), so: search again with the best trip's
 * route(s) taken out, up to MAX_ALTERNATIVES times, and keep results within
 * ALTERNATIVE_MAX_EXTRA_MIN of the best. Restores graph.closedRoutes after.
 */
function withAlternativeRoutes(graph: LoadedGraph, start: string, goal: string, routes: RouteResult[], mustRide: boolean, maxWalkKm: number): RouteResult[] {
  const best = routes[0];
  if (!best) return routes;
  const closedBefore = graph.closedRoutes;
  const excluded = new Set(closedBefore);
  const found = [...routes];
  for (let k = 0; k < MAX_ALTERNATIVES; k++) {
    for (const r of found) for (const id of jeepRouteIds(r)) excluded.add(id);
    graph.closedRoutes = excluded;
    // Every option of the new search, not just its fastest: a direct jeepney is what a feeder tricycle
    // (comboBuilder.ts) or a hop (longWalks.ts) builds on, even when a transfer beats it.
    const next = findParetoRoutes(graph, start, goal, mustRide ? { requireRide: true } : undefined)
      .filter(ridesSomething)
      .filter((r) => walkingKm(r) <= maxWalkKm && r.cost[0] <= best.cost[0] + ALTERNATIVE_MAX_EXTRA_MIN)
      .filter((r) => !found.some((f) => chainKey(f) === chainKey(r)));
    if (next.length === 0) break;
    found.push(...next);
  }
  graph.closedRoutes = closedBefore;
  return found.sort(byDependability);
}

export interface MixedTripOptions {
  /** false: jeepneys and walking only — what the Transit tab shows. Default true. */
  tricycles?: boolean;
}

export interface MixedTripPlan {
  /** Options to show, fastest first. Empty if nothing but walking reaches the destination. */
  routes: RouteResult[];
  /** Walking alone beat every ride, so the routes come from the "must ride at least once" search. */
  walkBeatsRiding: boolean;
  /** Minutes to walk the whole way (the plain-walking option the search always finds), or null if unknown. */
  walkMinutes: number | null;
}

export const NO_MIXED_PLAN: MixedTripPlan = { routes: [], walkBeatsRiding: false, walkMinutes: null };

/**
 * Mixed tricycle/jeepney options between two [lon, lat] points. Synchronous.
 * `at`: routes outside their service hours at that time can't be boarded
 * (null = ignore service hours).
 */
export function planMixedTrip(origin: number[], destination: number[], at: Date | null = null, options: MixedTripOptions = {}): MixedTripPlan {
  const tricycles = options.tricycles ?? true;
  const { graph, nodes } = mixedGraph();
  const startNode = nearestNode(nodes, origin as [number, number]);
  const goalNode = nearestNode(nodes, destination as [number, number]);
  if (!startNode || !goalNode) return NO_MIXED_PLAN;

  const baseClosed = closedRouteIds(MIXED_JEEPNEY_ROUTES, at);
  graph.rushHour = isRushHour(at);

  /**
   * The whole plan with these routes out of service, in one of three styles:
   *   mixed    one search over tricycles + jeepneys (+ the built remote combo)
   *   transit  jeepneys only; long walks become jeepney hops (longWalks.ts)
   *   feeder   jeepneys only, then a tricycle instead of a long walk at either end (far Mixed trips)
   */
  const planWith = (closed: Set<string>, style: "mixed" | "transit" | "feeder") => {
    graph.closedRoutes = closed;
    graph.tricyclesOff = style !== "mixed";
    const paretoRoutes = findParetoRoutes(graph, startNode.id, goalNode.id);
    let rideRoutes = paretoRoutes.filter(ridesSomething);
    const walkBeatsRiding = paretoRoutes.length > 0 && rideRoutes.length === 0;
    if (walkBeatsRiding) {
      rideRoutes = findParetoRoutes(graph, startNode.id, goalNode.id, { requireRide: true }).filter(ridesSomething);
    }

    // Jeepney + tricycle for a remote end, even when a single tricycle beats it on time and price.
    const built = style === "mixed" ? buildRemoteCombo(graph, rideRoutes, origin, destination) : null;
    let routes = curateMixedRoutes(rideRoutes, 3, built);
    const walkOnly = paretoRoutes.find((r) => !ridesSomething(r));
    if (style !== "mixed") {
      // A feeder tricycle will replace the long walks, so they don't rule an option out yet.
      routes = withAlternativeRoutes(graph, startNode.id, goalNode.id, routes, walkBeatsRiding, style === "feeder" ? Infinity : MIXED_MAX_WALK_KM);
      // Alternatives come from separate searches, so the "an extra ride must save time" rule runs again over all
      // of them — an extra ride that spares a long walk counts too (time over fare, longWalks.ts).
      routes = dropUnnecessaryTransfers(routes, sparesLongWalk);
      // Time over fare: a long walk becomes a ride when one is about as fast — a tricycle at the ends of a
      // far Mixed trip (comboBuilder.ts), otherwise another jeepney (longWalks.ts). Done after the transfer
      // rule, which would otherwise drop the extra ride again.
      if (style === "feeder") routes = routes.map((r) => withTricycleFeeders(graph, r, origin, destination));
      routes = uniqueChains(routes.map((r) => rideInsteadOfLongWalks(graph, r)));
      if (style === "feeder") routes = withoutDominated(routes);
      // Never a long walk to a jeepney, and when walking wins only a jeepney that's about as fast and
      // spares a good part of the walk.
      routes = routes.filter((r) => walkingKm(r) <= MIXED_MAX_WALK_KM);
      if (walkBeatsRiding && walkOnly) {
        routes = routes.filter((r) => r.cost[0] <= walkOnly.cost[0] + ABOUT_AS_FAST_MIN && walkingKm(r) <= walkingKm(walkOnly) * (1 - MIN_WALK_CUT));
      }
      routes = routes.slice(0, MAX_OPTIONS);
    }
    return { routes, walkBeatsRiding, walkOnly };
  };

  // Fallback routes (domain/jeepneyAreaRules.ts — Cream only when the common jeepneys can't do the trip):
  // plan without them first; bring them back only if that finds nothing to ride.
  const fallbackIds = FALLBACK_ROUTES.flatMap((rule) => rule.routes).filter((id) => !baseClosed.has(id));
  const planWithFallbacks = (style: "mixed" | "transit" | "feeder") => {
    const planned = planWith(new Set([...baseClosed, ...fallbackIds]), style);
    return fallbackIds.length > 0 && planned.routes.length === 0 ? planWith(new Set(baseClosed), style) : planned;
  };

  // A far Mixed trip rides jeepneys for the distance, with a tricycle only to and from them; if no jeepney
  // can do it, the ordinary Mixed search (tricycle hops included) is all there is.
  const far = tricycles && getDistanceMeters(origin, destination) / 1000 >= FAR_TRIP_KM;
  let result = planWithFallbacks(!tricycles ? "transit" : far ? "feeder" : "mixed");
  if (far && result.routes.length === 0) result = planWithFallbacks("mixed");
  graph.tricyclesOff = !tricycles;

  // Say which zone's tricycle each ride is ("Light Blue trike → J-02"), whether each jeepney is boarded at a
  // proper waiting area (only when those are known), and any local boarding note ("In Cabalan, take the J-06…").
  for (const leg of result.routes.flatMap((r) => r.legs)) {
    if (leg.transition === "board-trike") leg.zone = graph.nodes.get(leg.toNode)?.zoneId ?? undefined;
    if (leg.transition === "board-jeep" && graph.jeepStopArea) leg.waitingArea = graph.jeepStopArea.get(leg.fromNode) ?? null;
    if (leg.transition === "board-jeep") {
      const notes = [graph.jeepStopNote?.get(leg.fromNode)];
      const rush = rushHourExtraMinutes(graph, leg.fromNode);
      if (rush > 0) notes.push(`Rush hour: jeepneys passing here are often full — the time allows ~${rush} min to let one pass.`);
      leg.boardNote = notes.filter(Boolean).join(" ") || undefined;
    }
  }

  // The stretches between the pins and the network (endWalks.ts).
  const routes = result.routes.map((r) => withEndWalks(r, origin, startNode, destination, goalNode));
  const ends = endWalkMinutes(origin, startNode, destination, goalNode);
  return {
    routes,
    walkBeatsRiding: result.walkBeatsRiding,
    walkMinutes: result.walkOnly ? Math.round(result.walkOnly.cost[0] + ends) : null,
  };
}
