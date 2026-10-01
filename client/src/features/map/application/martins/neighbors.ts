import { MartinsEdge, MartinsGraph, MartinsNode, RouteState } from "./types";
import { getZoneRule } from "./zoneRules";

// Tunable constants (placeholders — tune with field data per the thesis doc's
// own performance/evaluation notes).
export const WALK_SPEED_KMH = 4.5;
export const BOARD_WAIT_MINUTES = 3;
export const MAIN_ROAD_PENALTY = 5;

export interface LoadedGraph {
  nodes: Map<string, MartinsNode>;
  /** Directed adjacency — each undirected edge is represented in both directions. */
  adjacency: Map<string, MartinsEdge[]>;
}

export function loadGraph(raw: MartinsGraph): LoadedGraph {
  const nodes = new Map(raw.nodes.map((n) => [n.id, n] as const));
  const adjacency = new Map<string, MartinsEdge[]>();

  const addDirected = (edge: MartinsEdge) => {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge);
  };

  for (const e of raw.edges) {
    addDirected(e);
    addDirected({ ...e, from: e.to, to: e.from, coordinates: [...e.coordinates].reverse() });
  }

  return { nodes, adjacency };
}

export interface NeighborOption {
  state: RouteState;
  minutes: number;
  pesos: number;
  edge: MartinsEdge | null;
  transition: "walk" | "board-trike" | "trike-home" | "trike-cross" | "alight";
}

/**
 * Returns every legal transition out of `state`, with its own [minutes, pesos]
 * cost — the transition-rules table from the thesis doc, section 6.
 */
export function neighbors(graph: LoadedGraph, state: RouteState): NeighborOption[] {
  const options: NeighborOption[] = [];
  const currentNode = graph.nodes.get(state.node);
  if (!currentNode) return options;

  const outEdges = graph.adjacency.get(state.node) ?? [];

  if (state.mode === "walk") {
    for (const edge of outEdges) {
      if (!edge.walkable) continue;
      options.push({
        state: { node: edge.to, mode: "walk", homeZone: null, crossed: false },
        minutes: (edge.distanceKm / WALK_SPEED_KMH) * 60,
        pesos: 0,
        edge,
        transition: "walk",
      });
    }

    // Board a trike, only possible standing inside a zone.
    if (currentNode.zoneId) {
      const rule = getZoneRule(currentNode.zoneId);
      options.push({
        state: { node: state.node, mode: "trike", homeZone: currentNode.zoneId, crossed: false },
        minutes: BOARD_WAIT_MINUTES,
        pesos: rule.baseFare,
        edge: null,
        transition: "board-trike",
      });
    }

    // Jeepney boarding/riding is intentionally not modeled yet — the thesis
    // doc's own open items list "Add jeepney routes and stops to the graph"
    // as not yet done. This graph only has road edges for walk/trike so far.

    return options;
  }

  // state.mode === "trike"
  options.push({
    state: { node: state.node, mode: "walk", homeZone: null, crossed: false },
    minutes: 0,
    pesos: 0,
    edge: null,
    transition: "alight",
  });

  const homeZone = state.homeZone;
  const homeRule = homeZone ? getZoneRule(homeZone) : null;

  for (const edge of outEdges) {
    const edgeZone = edge.zoneId;

    if (edgeZone === null || edgeZone === homeZone) {
      // Home-zone road, or a road outside every mapped zone (treated as
      // neutral territory a trike can freely transit without a fee).
      if (edgeZone !== null && homeRule && !homeRule.mainRoadAllowed && edge.isMainRoad) continue; // hard block
      options.push({
        state: { ...state, node: edge.to },
        minutes: edge.trikeMinutes * (edge.isMainRoad ? MAIN_ROAD_PENALTY : 1),
        pesos: 0,
        edge,
        transition: "trike-home",
      });
      continue;
    }

    // A different, zoned road — only legal if homeZone's TODA has a crossing
    // agreement with it. Anything else is "never" (simply not a neighbor).
    if (!homeZone || !homeRule?.crossTo.includes(edgeZone)) continue;

    const foreignRule = getZoneRule(edgeZone);
    if (!foreignRule.mainRoadAllowed && edge.isMainRoad) continue; // the zone being entered governs its own roads

    options.push({
      state: { ...state, node: edge.to, crossed: true },
      minutes: edge.trikeMinutes * (edge.isMainRoad ? MAIN_ROAD_PENALTY : 1),
      // The one-time surcharge is the rider's home TODA charging for letting
      // them roam — so it's homeRule's fee, charged once per ride.
      pesos: state.crossed ? 0 : homeRule.crossFee,
      edge,
      transition: "trike-cross",
    });
  }

  return options;
}
