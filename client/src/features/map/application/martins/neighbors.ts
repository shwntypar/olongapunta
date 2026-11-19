import { RUSH_HOUR_FULL_AFTER_KM, RUSH_HOUR_FULL_EXTRA_MINUTES } from "../../domain/jeepneyService";
import { JeepLine, JeepRideEdge, MartinsEdge, MartinsGraph, MartinsNode, RouteState, Transition } from "./types";
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
// Flagging down a passing tricycle away from any stand (zones with
// flagDownOffStand): no queue of tricycles waiting, so a longer expected wait
// than at a stand. Placeholder — tune with field data.
export const FLAG_DOWN_WAIT_MINUTES = 6;
// Jeepneys (mixed graph only). Placeholders like the tricycle ones above:
// average speed including stops along the way, and the wait to flag one down.
export const JEEP_SPEED_KMH = 15;
export const JEEP_BOARD_WAIT_MINUTES = 5;

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
  /** Mixed graph only (jeepneyLayer.ts): the route direction each jeepney stop belongs to. */
  jeepStops?: Map<string, JeepLine>;
  /** Mixed graph only: from a stop, the ride to the next stop of the same direction. */
  jeepRides?: Map<string, JeepRideEdge>;
  /** Mixed graph only: routes not running right now (outside their service hours) — no boarding them. Set per search. */
  closedRoutes?: Set<string>;
  /** Mixed graph only: no tricycle boarding (Transit mode searches jeepneys and walking only). Set per search. */
  tricyclesOff?: boolean;
  /** Mixed graph only: expected wait at each jeepney stop, when it differs from its line's (away from a waiting area). */
  jeepStopWait?: Map<string, number>;
  /** Mixed graph only: the waiting area a stop is at, or null if it isn't at one (only filled when waiting areas are known). */
  jeepStopArea?: Map<string, string | null>;
  /** Mixed graph only: stops where the jeepney passing can't be boarded (an outbound provincial jeepney past its terminal, a local rule). */
  jeepNoBoard?: Set<string>;
  /** Mixed graph only: a note for riders boarding at this stop (domain/jeepneyAreaRules.ts — e.g. "In Cabalan, take the J-06…"). */
  jeepStopNote?: Map<string, string>;
  /** Mixed graph only: km from the start of its route direction to each stop. */
  jeepStopAlongKm?: Map<string, number>;
  /** Mixed graph only: it's rush hour — jeepneys are often full past RUSH_HOUR_FULL_AFTER_KM. Set per search. */
  rushHour?: boolean;
}

/** Rush hour: the extra wait at this stop because the jeepneys passing are often full (0 if not). */
export function rushHourExtraMinutes(graph: LoadedGraph, stopId: string): number {
  if (!graph.rushHour) return 0;
  return (graph.jeepStopAlongKm?.get(stopId) ?? 0) > RUSH_HOUR_FULL_AFTER_KM ? RUSH_HOUR_FULL_EXTRA_MINUTES : 0;
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
  transition: Exclude<Transition, "start">;
}

const walkState = (node: string): RouteState => ({ node, mode: "walk", homeZone: null, crossed: false, entered: "" });

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
        state: walkState(edge.to),
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
    if (currentNode.zoneId && !graph.tricyclesOff) {
      const rule = getZoneRule(currentNode.zoneId);
      const isTerminal = rule.terminals?.includes(state.node) ?? false;
      // Stand-only zones: board at a stand — or, with flagDownOffStand, flag one down on a through road (longer wait).
      const flagDown =
        !!rule.boardOnlyAtTerminals &&
        !isTerminal &&
        (rule.flagDownOffStand === "anywhere" || (rule.flagDownOffStand === "through-roads" && graph.boardableNodes.has(state.node)));
      const canBoardHere = rule.boardOnlyAtTerminals
        ? isTerminal || flagDown
        : !rule.boardOnMainRoadOnly || graph.boardableNodes.has(state.node);
      if (canBoardHere) {
        const fare = getZoneFare(currentNode.zoneId);
        const boardMinutes = isTerminal
          ? Math.max(0, BOARD_WAIT_MINUTES - TERMINAL_BOARD_DISCOUNT_MINUTES)
          : flagDown
            ? FLAG_DOWN_WAIT_MINUTES
            : BOARD_WAIT_MINUTES;
        options.push({
          state: { node: state.node, mode: "trike", homeZone: currentNode.zoneId, crossed: false, entered: "" },
          minutes: boardMinutes,
          pesos: fare.baseFare,
          edge: null,
          transition: "board-trike",
        });
      }
    }

    // Jeepney stop (mixed graph only): flag down a jeepney of this stop's direction.
    const line = graph.jeepStops?.get(state.node);
    if (line && !graph.closedRoutes?.has(line.routeId) && !graph.jeepNoBoard?.has(state.node)) {
      options.push({
        state: { ...walkState(state.node), mode: "jeep" },
        minutes: (graph.jeepStopWait?.get(state.node) ?? line.waitMinutes) + rushHourExtraMinutes(graph, state.node),
        pesos: line.fare,
        edge: null,
        transition: "board-jeep",
      });
    }

    return options;
  }

  if (state.mode === "jeep") return jeepNeighbors(graph, state);

  // state.mode === "trike"
  options.push({
    state: walkState(state.node),
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
    if (edge.walkOnly) continue; // footpath to a jeepney stop, not a road
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
      // A zone's mainRoadPenalty override (e.g. Green/Blue's 1x — "don't
      // avoid it, it's the normal route") is a judgment about THAT zone's
      // own roads specifically. It must not also apply to untagged/neutral
      // roads far outside the zone's polygon, or a ride starting in a zone
      // with a permissive override would freely take any main road all the
      // way to an unrelated destination instead of being soft-steered off
      // it like every other zone. Only a road actually tagged as the home
      // zone gets the zone's own override; untagged roads always use the
      // generic default.
      const homePenalty = edgeZone === homeZone ? (homeRule?.mainRoadPenalty ?? MAIN_ROAD_PENALTY) : MAIN_ROAD_PENALTY;
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

    const enteredZones = state.entered ? state.entered.split(",") : [];
    const firstEntry = !enteredZones.includes(edgeZone);
    options.push({
      state: {
        ...state,
        node: edge.to,
        crossed: true,
        entered: firstEntry ? [...enteredZones, edgeZone].sort().join(",") : state.entered,
      },
      minutes: edge.trikeMinutes * (edge.isMainRoad ? foreignPenalty : 1),
      // The crossing fee is charged once for each zone the ride crosses into
      // (fare schedule: +₱20 per zone crossing), on top of any per-km rate.
      pesos: distanceFare + (firstEntry ? homeRule.crossFee : 0),
      edge,
      transition: "trike-cross",
    });
  }

  return options;
}

/** On a jeepney: get off here, or stay on to the next stop of the same direction. */
/**
 * On a jeepney, `crossed` means "has ridden at least one stretch" (boarding sets it false). Getting off is
 * only possible after that: otherwise a "must ride" search could board and alight at the same stop — a
 * 5-minute wait and a fare for no ride — and that empty "ride" would crowd the real ones out.
 */
function jeepNeighbors(graph: LoadedGraph, state: RouteState): NeighborOption[] {
  const options: NeighborOption[] = state.crossed ? [{ state: walkState(state.node), minutes: 0, pesos: 0, edge: null, transition: "alight" }] : [];
  const ride = graph.jeepRides?.get(state.node);
  if (ride) {
    options.push({ state: { ...state, node: ride.to, crossed: true }, minutes: ride.minutes, pesos: 0, edge: ride, transition: "jeep-ride" });
  }
  return options;
}
