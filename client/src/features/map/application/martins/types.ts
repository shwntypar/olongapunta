// =====================================================
// 🧭 MARTINS' ALGORITHM — SHARED TYPES
// =====================================================
// This module is a standalone, parallel routing engine (see README context
// in the thesis handoff doc). It does not touch the live Overpass-based
// tricycle/jeepney routing in getTricycleRoute.ts / zoneRoadGraph.ts — those
// keep working as-is. This is the state-expanded, zone-constrained
// multi-modal graph + Pareto router described there, built against a
// precomputed graph.json instead of live network calls during search.

export type TravelLegMode = "walk" | "jeep" | "trike";

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
  /** Zone containing this edge's midpoint, or null if outside every mapped zone. */
  zoneId: string | null;
  /** All road edges are assumed walkable (sidewalks along the road). */
  walkable: boolean;
  /** Full-resolution geometry for rendering this leg later, [lon, lat][]. */
  coordinates: [number, number][];
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
  /** Flagdown fare (pesos) for boarding a trike in this zone. */
  baseFare: number;
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
}

export const stateKey = (s: RouteState): string => `${s.node}|${s.mode}|${s.homeZone ?? ""}|${s.crossed}`;

/** [minutes, pesos] — lower is better in both. */
export type Cost = [number, number];

export interface Label {
  cost: Cost;
  state: RouteState;
  prev: Label | null;
  /** The edge taken to reach this label, or null for virtual board/alight transitions. */
  edge: MartinsEdge | null;
  /** The kind of transition taken to reach this label — useful for turn-by-turn / fare breakdown. */
  transition: "start" | "walk" | "board-trike" | "trike-home" | "trike-cross" | "alight";
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
}

export interface RouteResult {
  cost: Cost;
  legs: RouteLeg[];
}
