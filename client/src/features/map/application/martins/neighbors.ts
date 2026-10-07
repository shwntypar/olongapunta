import { MartinsEdge, MartinsGraph, MartinsNode, RouteState } from "./types";
import { getZoneFare, getZoneRule } from "./zoneRules";

// Tunable constants (placeholders — tune with field data per the thesis doc's
// own performance/evaluation notes).
export const WALK_SPEED_KMH = 4.5;
export const BOARD_WAIT_MINUTES = 3;
export const MAIN_ROAD_PENALTY = 5;
export const MAX_RIDE_KM = 2.5;
// A real terminal (ZoneRuleConfig.terminals) has trikes already waiting —
// less flag-down wait than hailing one off a random side street — so
// boarding there is modeled as a little faster. This is deliberately a
// soft nudge, not a requirement: it only matters when the search would
// otherwise be indifferent between a terminal and some other boardable
// spot (e.g. under a flat included-km fare, see TricycleZoneData.ts),
// where it tips the tie toward the real, known stand instead of an
// arbitrary point that happens to cost the same.
export const TERMINAL_BOARD_DISCOUNT_MINUTES = 1;

export interface LoadedGraph {
  nodes: Map<string, MartinsNode>;
  /** Directed adjacency — each undirected edge is represented in both directions. */
  adjacency: Map<string, MartinsEdge[]>;
  /**
   * Node ids that touch at least one boardable (trunk/primary/secondary/
   * tertiary) edge — see boardOnMainRoadOnly. Deliberately broader than
   * "main road" (isMainRoad, trunk/primary only) so a zone corner far from
   * the one trunk road isn't left with no legal boarding point at all.
   */
  boardableNodes: Set<string>;
}

export function loadGraph(raw: MartinsGraph): LoadedGraph {
  const nodes = new Map(raw.nodes.map((n) => [n.id, n] as const));
  const adjacency = new Map<string, MartinsEdge[]>();
  const boardableNodes = new Set<string>();

  const addDirected = (edge: MartinsEdge) => {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)!.push(edge);
  };

  for (const e of raw.edges) {
    addDirected(e);
    addDirected({ ...e, from: e.to, to: e.from, coordinates: [...e.coordinates].reverse() });
    if (e.boardable) {
      boardableNodes.add(e.from);
      boardableNodes.add(e.to);
    }
  }

  return { nodes, adjacency, boardableNodes };
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
 *
 * `rideKm` is how far the CURRENT ride has already gone (0 if walking, or
 * just boarded) — not part of RouteState, see Label.rideKm. It caps how
 * much further a single continuous ride may extend: real tricycles work a
 * local radius, not an entire zone polygon's full span, however large that
 * polygon happens to be mapped.
 */
export function neighbors(graph: LoadedGraph, state: RouteState, rideKm = 0): NeighborOption[] {
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

    // Board a trike, only possible standing inside a zone — gated by
    // whichever boarding rule that zone's rule actually has: real known
    // terminals (boardOnlyAtTerminals) take priority when set, since field
    // data beats the inferred boardOnMainRoadOnly heuristic.
    if (currentNode.zoneId) {
      const rule = getZoneRule(currentNode.zoneId);
      const isTerminal = rule.terminals?.includes(state.node) ?? false;
      const canBoardHere = rule.boardOnlyAtTerminals
        ? isTerminal
        : !rule.boardOnMainRoadOnly || graph.boardableNodes.has(state.node);
      if (canBoardHere) {
        const fare = getZoneFare(currentNode.zoneId);
        const boardMinutes = isTerminal
          ? Math.max(0, BOARD_WAIT_MINUTES - TERMINAL_BOARD_DISCOUNT_MINUTES)
          : BOARD_WAIT_MINUTES;
        options.push({
          state: { node: state.node, mode: "trike", homeZone: currentNode.zoneId, crossed: false },
          minutes: boardMinutes,
          pesos: fare.baseFare,
          edge: null,
          transition: "board-trike",
        });
      }
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
  // One meter runs for the whole continuous ride, billed at the boarding
  // TODA's per-km rate throughout — not just for the distance inside its
  // own polygon. Previously this was 0: a ride only ever cost its flat
  // flagdown fee no matter how far it went, which both undercharged long
  // rides and hid "hop to a second trike" as a cheaper alternative, since
  // nothing made distance actually cost anything.
  const homeFare = homeZone ? getZoneFare(homeZone) : null;
  const homeFarePerKm = homeFare?.farePerKm ?? 0;
  const includedKm = homeFare?.includedKm ?? 0;

  const maxRideKm = homeRule?.maxRideKm ?? MAX_RIDE_KM;

  for (const edge of outEdges) {
    if (rideKm + edge.distanceKm > maxRideKm) continue; // too far for one continuous ride — must alight and re-board

    const edgeZone = edge.zoneId;
    // baseFare already covers the first includedKm of this ride — only the
    // portion of THIS edge that falls beyond that allowance adds anything,
    // same as a real driver charging flat for a typical short hop and only
    // tacking on extra once the ride runs unusually long.
    const rideKmAfter = rideKm + edge.distanceKm;
    const billableKm = Math.max(0, rideKmAfter - includedKm) - Math.max(0, rideKm - includedKm);
    const distanceFare = billableKm * homeFarePerKm;

    if (edgeZone === null || edgeZone === homeZone) {
      // Home-zone road, or a road outside every mapped zone (treated as
      // neutral territory a trike can freely transit without a fee).
      if (edgeZone !== null && homeRule && !homeRule.mainRoadAllowed && edge.isMainRoad) continue; // hard block
      const homePenalty = homeRule?.mainRoadPenalty ?? MAIN_ROAD_PENALTY;
      options.push({
        state: { ...state, node: edge.to },
        minutes: edge.trikeMinutes * (edge.isMainRoad ? homePenalty : 1),
        pesos: distanceFare,
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
    const foreignPenalty = foreignRule.mainRoadPenalty ?? MAIN_ROAD_PENALTY;

    options.push({
      state: { ...state, node: edge.to, crossed: true },
      minutes: edge.trikeMinutes * (edge.isMainRoad ? foreignPenalty : 1),
      // The one-time surcharge is the rider's home TODA charging for letting
      // them roam, on top of the same per-km rate that keeps accruing.
      pesos: distanceFare + (state.crossed ? 0 : homeRule.crossFee),
      edge,
      transition: "trike-cross",
    });
  }

  return options;
}
