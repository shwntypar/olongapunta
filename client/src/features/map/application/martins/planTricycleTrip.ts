// The app's entry point into the Martins engine: "give me tricycle options
// for this trip". Everything the UI needs is decided here.

import rawGraph from "./graph.json";
import { curateParetoRoutes, requiresTricycle, selectDirectAndTransfer } from "./curation";
import { loadGraph } from "./neighbors";
import { findParetoRoutes } from "./routeResult";
import { nearestNode } from "./snapToNode";
import type { MartinsGraph, RouteResult } from "./types";

// Built once at module load — graph.json is several MB, no reason to re-parse
// it or rebuild the adjacency map on every route request.
const GRAPH = loadGraph(rawGraph as unknown as MartinsGraph);
const NODES = [...GRAPH.nodes.values()];

export interface TricycleTripPlan {
  /** Options to show, fastest first: the Direct ride and, when one exists, a Transfer. Empty if no tricycle can serve the trip. */
  routes: RouteResult[];
  /**
   * Walking alone was at least as good as every tricycle option, so the
   * routes above come from the "must ride at least once" fallback search.
   */
  walkBeatsTricycle: boolean;
  /** Whole-trip walking time in minutes when walkBeatsTricycle, otherwise null. */
  walkMinutes: number | null;
}

export const NO_TRICYCLE_PLAN: TricycleTripPlan = { routes: [], walkBeatsTricycle: false, walkMinutes: null };

/** Tricycle options between two [lon, lat] points. Synchronous: the graph is precomputed. */
export function planTricycleTrip(origin: number[], destination: number[]): TricycleTripPlan {
  const startNode = nearestNode(NODES, origin as [number, number]);
  const goalNode = nearestNode(NODES, destination as [number, number]);
  if (!startNode || !goalNode) return NO_TRICYCLE_PLAN;

  const paretoRoutes = findParetoRoutes(GRAPH, startNode.id, goalNode.id);
  let tricycleRoutes = paretoRoutes.filter(requiresTricycle);
  const walkBeatsTricycle = paretoRoutes.length > 0 && tricycleRoutes.length === 0;

  // Short trips: walking (₱0) can be as fast as any tricycle, which leaves no
  // tricycle in the Pareto set at all. Riders still take tricycles for short
  // hops (heat, bags), so fall back to a search that must board at least once
  // and show its fastest options, with a note in the sidebar.
  if (walkBeatsTricycle) {
    tricycleRoutes = findParetoRoutes(GRAPH, startNode.id, goalNode.id, { requireRide: true }).filter(requiresTricycle);
  }

  return {
    routes: selectDirectAndTransfer(curateParetoRoutes(tricycleRoutes)),
    walkBeatsTricycle,
    walkMinutes: walkBeatsTricycle ? Math.round(paretoRoutes[0].cost[0]) : null,
  };
}
