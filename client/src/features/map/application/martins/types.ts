// =====================================================
// 🧭 MARTINS' ALGORITHM — SHARED TYPES
// =====================================================
// The tricycle routing engine: a state-expanded, zone-constrained road graph
// searched with Martins' multi-criteria (time, fare) label-setting algorithm,
// built against a precomputed graph.json so no network call happens during a
// search. Module map:
//
//   graph.json           road graph, built offline by scripts/build-martins-graph.ts
//   zoneRules.ts         per-zone rules: crossing agreements, fees, boarding points
//   neighbors.ts         every legal move from a state, with its (minutes, pesos) cost
//   martins.ts           the algorithm: returns the Pareto-optimal labels
//   routeResult.ts       labels → itineraries (findParetoRoutes)
//   curation.ts          which of those itineraries to show (display only)
//   planTricycleTrip.ts  what the app calls: coordinates in, options out
//   jeepneyLayer.ts      adds jeepney stops, rides and transfer walks to a copy of the graph
//   planMixedTrip.ts     tricycle + jeepney + walking in one search ("Mixed" mode)
//   routeMetrics.ts, routeShape.ts   facts and map shapes of one itinerary

import type { JeepneyColor } from "../../domain/MockData";

export type TravelLegMode = "walk" | "jeep" | "trike";

/** How a label was reached. The jeep transitions only occur in the mixed graph (jeepneyLayer.ts). */
export type Transition = "start" | "walk" | "board-trike" | "trike-home" | "trike-cross" | "board-jeep" | "jeep-ride" | "alight";

// ---- Precomputed graph (output of scripts/build-martins-graph.ts) ----

export interface MartinsNode {
  id: string;
  lon: number;
  lat: number;
  /** Zone containing this node, or null if it's outside every mapped zone. */
  zoneId: string | null;
}

export interface MartinsEdge {
  from: string;
  to: string;
  /** Road distance in km — used to derive walk time at runtime. */
  distanceKm: number;
  /** Precomputed trike travel time at baseline trike speed (see BUILD config). */
  trikeMinutes: number;
  /** OSM highway class was trunk/primary (or a manual override) — tricycles should prefer to avoid these. */
  isMainRoad: boolean;
  /**
   * OSM highway class is trunk/primary/secondary/tertiary — any real
   * through-road, where tricycles actually stand/queue for passengers.
   * Deliberately broader than isMainRoad: using isMainRoad alone for
   * boardOnMainRoadOnly left zone corners with no trunk/primary road
   * nearby stranded (1km+ walk to board), even though a closer secondary/
   * tertiary street realistically has tricycle traffic too.
   */
  boardable: boolean;
  /** Zone containing this edge's midpoint, or null if outside every mapped zone. */
  zoneId: string | null;
  /** All road edges are assumed walkable (sidewalks along the road). */
  walkable: boolean;
  /** Full-resolution geometry for rendering this leg later, [lon, lat][]. */
  coordinates: [number, number][];
  /**
   * A footpath link added by jeepneyLayer.ts (jeepney stop ↔ road, or stop ↔
   * stop for a transfer). Walkers use it; tricycles never ride it.
   */
  walkOnly?: boolean;
}

/** The jeepney route direction a stop or ride edge belongs to (jeepneyLayer.ts). */
export interface JeepLine {
  /** JeepneyRoute.id */
  routeId: string;
  /** Which way along the route: its digitized path ("fwd") or the return path ("rev"). */
  direction: "fwd" | "rev";
  routeCode: string;
  colorCode: JeepneyColor;
  /** e.g. "SM Olongapo Downtown" — where this direction is heading. */
  heading: string;
  /** Where this direction starts ("Castillejos" for "Castillejos to Olongapo"), to tell apart two lines with the same code and heading. */
  from: string;
  /** Fare paid once per boarding. */
  fare: number;
  /** Expected wait to board (jeepney/serviceRules.ts — longer for colours with few units). */
  waitMinutes: number;
  /**
   * Provincial routes leaving the city: they fill up at their terminal and
   * seldom stop on the way, so they can only be boarded near the start —
   * this names that terminal ("Palengke"). Unset for every other direction.
   */
  boardAtStart?: string;
}

/** One ride edge between two consecutive stops of the same direction. */
export interface JeepRideEdge extends MartinsEdge {
  line: JeepLine;
  minutes: number;
}

export interface MartinsGraph {
  generatedAt: string;
  bbox: [number, number, number, number];
  nodes: MartinsNode[];
  edges: MartinsEdge[]; // undirected — stored once, adjacency built both ways at load time
}

// ---- Zone rules config (see zoneRules.ts — currently placeholder data) ----

export interface ZoneRuleConfig {
  /** Other zone ids this zone's tricycles may legally cross into. */
  crossTo: string[];
  /** One-time surcharge (pesos) for crossing into a zone listed in crossTo. */
  crossFee: number;
  /** If false, a trike may never use a main-road edge inside this zone (hard rule). */
  mainRoadAllowed: boolean;
  /**
   * Soft cost multiplier applied to a main-road edge's trike minutes inside
   * this zone (only relevant when mainRoadAllowed is true). Defaults to
   * MAIN_ROAD_PENALTY (neighbors.ts) when omitted — i.e. "allowed, but
   * prefer side streets." Set to 1 for a zone where the main road is simply
   * the normal/expected tricycle route (e.g. the only road to a bridge).
   */
  mainRoadPenalty?: number;
  /**
   * If true, a trike can only be boarded at a node that touches a main-road
   * edge — reflects real tricycles waiting at stands/terminals on main
   * roads rather than idling at every side-street corner. Defaults to false
   * (board anywhere in the zone) when omitted.
   */
  boardOnMainRoadOnly?: boolean;
  /**
   * If true, a trike can ONLY be boarded at a node listed in `terminals` —
   * real, known waiting spots, not an inferred rule like
   * boardOnMainRoadOnly. Takes priority over boardOnMainRoadOnly when both
   * are set. Field data beats the road-class heuristic: several real
   * waiting spots turned out to be on plain side streets, not through
   * roads, which boardOnMainRoadOnly would have wrongly excluded.
   */
  boardOnlyAtTerminals?: boolean;
  /**
   * With boardOnlyAtTerminals: a rider away from every stand may still flag
   * down a passing tricycle, at the longer FLAG_DOWN_WAIT_MINUTES wait instead
   * of a stand's short one — on through roads only ("through-roads", the
   * `boardable` nodes) or on any street in the zone ("anywhere"). The search
   * then trades walking to a stand against waiting where you are, instead of
   * walking half a kilometre to the nearest stand. Unset = boarding only at
   * the stands (the original rule).
   */
  flagDownOffStand?: "through-roads" | "anywhere";
  /**
   * Maximum distance (km) a single continuous ride may cover before the
   * trike refuses to go further — real TODA tricycles operate a local
   * radius, not the full span of a zone's mapped polygon. Defaults to
   * MAX_RIDE_KM (neighbors.ts) when omitted. A rider who needs to go
   * further must alight and board again (a fresh, separately-priced ride),
   * same as crossing into another zone.
   */
  maxRideKm?: number;
  /** Optional known terminal node ids for this zone. */
  terminals?: string[];
}

export type ZoneRules = Record<string, ZoneRuleConfig>;

// ---- Search state + label (Martins' algorithm) ----

export interface RouteState {
  node: string;
  mode: TravelLegMode;
  /** The TODA zone a trike leg was boarded in — fixed for the whole trike leg. */
  homeZone: string | null;
  /** Whether this ride's one-time cross-zone surcharge has already been paid. */
  crossed: boolean;
  /**
   * Other zones this ride has entered, sorted and comma-joined ("" if none).
   * The fare schedule charges the crossing fee for EACH zone crossed into, so
   * a ride that goes Orange → Green → Blue pays it twice — a single
   * `crossed` flag could only charge it once.
   */
  entered: string;
}

/** On a jeepney, "just boarded here" and "rode in to here" are different states (only the second can get off — neighbors.ts). */
export const stateKey = (s: RouteState): string => `${s.node}|${s.mode}|${s.homeZone ?? ""}|${s.entered}${s.mode === "jeep" && s.crossed ? "|rode" : ""}`;

/** [minutes, pesos] — lower is better in both. */
export type Cost = [number, number];

export interface Label {
  cost: Cost;
  state: RouteState;
  prev: Label | null;
  /** The edge taken to reach this label, or null for virtual board/alight transitions. */
  edge: MartinsEdge | null;
  /** The kind of transition taken to reach this label — useful for turn-by-turn / fare breakdown. */
  transition: Transition;
  /**
   * Distance (km) covered since the current ride was boarded — resets to 0
   * on board-trike/alight. Deliberately NOT part of RouteState/stateKey: it
   * only gates how far neighbors() will let a ride continue, it doesn't
   * need its own dominance dimension (that would blow up the state space).
   */
  rideKm: number;
  dead?: boolean;
}

export interface RouteLeg {
  mode: TravelLegMode;
  minutes: number;
  pesos: number;
  transition: Label["transition"];
  fromNode: string;
  toNode: string;
  coordinates: [number, number][];
  /** Jeepney ride legs: the route direction ridden. */
  line?: JeepLine;
  /** Mixed plans only (planMixedTrip.ts): the TODA zone a tricycle was boarded in, on board-trike legs. */
  zone?: string;
  /**
   * Mixed plans only, board-jeep legs, when waiting areas are known
   * (domain/jeepneyWaitingAreas.ts): the waiting area boarded at, or null
   * when boarding away from one (longer wait).
   */
  waitingArea?: string | null;
  /** Mixed plans only, board-jeep legs: a local boarding note for this stop (domain/jeepneyAreaRules.ts). */
  boardNote?: string;
}

export interface RouteResult {
  cost: Cost;
  legs: RouteLeg[];
}
