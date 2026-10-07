import * as turf from '@turf/turf';
import { TricycleZone } from '../domain/TricycleZoneData';
import rawMartinsGraph from './martins/graph.json';

// =====================================================
// 🛺 IN-ZONE ROAD GRAPH + PATHFINDER
// =====================================================
// Mapbox has no notion of a tricycle zone boundary, so asking it for a route
// can hand back a path that briefly leaves the polygon. The only way to make
// "never leaves the zone" an actual guarantee (rather than a bias) is to stop
// asking an external engine and instead route over a graph that *only
// contains roads inside the zone* — the same reason jeepney routes can't
// wander off their line: the search space itself excludes anything outside.
//
// Roads come from OpenStreetMap via Overpass (same data source already used
// for amenities), restricted to non-arterial highway classes so tricycles
// stay off avenues by construction, not just by scoring preference.

// weight is the cost Dijkstra actually searches on — equal to distKm for a
// normal road, but inflated for a main road so it's only ever used to bridge
// a gap nothing else can cross, not preferred outright. distKm stays the
// real distance so the final route's reported length isn't inflated too.
interface ZoneGraph {
  coords: Map<string, number[]>; // node key -> [lon, lat]
  adjacency: Map<string, { to: string; distKm: number; weight: number }[]>;
  ways: { nodeIds: string[]; lineCoords: number[][] }[]; // kept for snapping arbitrary points
}

export interface ZoneRouteResult {
  coordinates: number[][];
  distanceMeters: number;
}

// How much a main-road edge's search cost is inflated by. High enough that
// Dijkstra always prefers any all-local-streets detour over it, but finite —
// unlike a hard exclusion, a main road stays usable as a last-resort bridge
// when it's genuinely the only thing connecting two parts of a zone, instead
// of the whole route falling back to Mapbox's unconstrained router.
const MAIN_ROAD_PENALTY = 8;

const graphCache = new Map<string, Promise<ZoneGraph | null>>();

const addEdge = (adjacency: ZoneGraph['adjacency'], a: string, b: string, distKm: number, isMainRoad = false) => {
  const weight = isMainRoad ? distKm * MAIN_ROAD_PENALTY : distKm;
  if (!adjacency.has(a)) adjacency.set(a, []);
  if (!adjacency.has(b)) adjacency.set(b, []);
  adjacency.get(a)!.push({ to: b, distKm, weight });
  adjacency.get(b)!.push({ to: a, distKm, weight }); // roads treated as two-way — no consistent one-way data at this scale
};

interface PrecomputedEdge {
  from: string;
  to: string;
  distanceKm: number;
  isMainRoad: boolean;
  coordinates: number[][];
}
interface PrecomputedGraph {
  edges: PrecomputedEdge[];
}

// scripts/build-martins-graph.ts already fetched roads around every zone in
// TricycleZoneData.ts and committed the result to martins/graph.json. If this
// zone is covered by that precomputed data, use it instead of hitting
// Overpass live — Overpass is a public, often-slow (multi-second, sometimes
// rate-limited) third-party API, and re-fetching the same roads on every
// fresh page load for a zone that hasn't changed is pure waste. Falls back
// to the live fetch below for any zone added after the graph was last built.
const buildGraphFromPrecomputed = (zone: TricycleZone): ZoneGraph | null => {
  const graph = rawMartinsGraph as unknown as PrecomputedGraph;

  // Same outward buffer as the live-fetch path below, so a road that hugs
  // the zone boundary isn't lost to floating-point precision either way.
  let filterPolygon: any = zone.polygon;
  try {
    const buffered = turf.buffer(zone.polygon, 0.015, { units: 'kilometers' });
    if (buffered?.geometry) filterPolygon = buffered.geometry;
  } catch {
    // fall back to the raw polygon
  }

  const coords: ZoneGraph['coords'] = new Map();
  const adjacency: ZoneGraph['adjacency'] = new Map();
  const ways: ZoneGraph['ways'] = [];

  for (const edge of graph.edges) {
    if (edge.coordinates.length < 2) continue;

    const [a, b] = edge.coordinates;
    let insideZone = false;
    try {
      insideZone = turf.booleanPointInPolygon(turf.midpoint(turf.point(a), turf.point(b)), filterPolygon);
    } catch {
      insideZone = false;
    }
    if (!insideZone) continue;

    // Main roads are included (not dropped) — heavily penalized below so a
    // real local-streets path is always preferred when one exists, but
    // still usable when it's the only thing connecting two parts of the
    // zone. Dropping them outright can fragment a zone's street graph into
    // disconnected islands, which previously meant falling all the way back
    // to Mapbox's unconstrained router — the very outcome this was meant to
    // prevent.
    addEdge(adjacency, edge.from, edge.to, edge.distanceKm, edge.isMainRoad);
    coords.set(edge.from, a);
    coords.set(edge.to, b);
    ways.push({ nodeIds: [edge.from, edge.to], lineCoords: [a, b] });
  }

  if (adjacency.size === 0) return null; // this zone isn't covered by the precomputed graph — caller falls back to live fetch
  return { coords, adjacency, ways };
};

const buildGraphForZone = async (zone: TricycleZone): Promise<ZoneGraph | null> => {
  try {
    const bbox = turf.bbox(zone.polygon) as [number, number, number, number];
    const res = await fetch(
      `/api/tricycle-roads?minLon=${bbox[0]}&minLat=${bbox[1]}&maxLon=${bbox[2]}&maxLat=${bbox[3]}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const elements: any[] = data.elements || [];
    if (elements.length === 0) return null;

    // Overpass's bbox is a rectangle superset of the polygon — filter segments
    // to a slightly outward-buffered version of the zone so genuinely outside
    // roads are excluded but edge-hugging roads aren't lost to precision.
    let filterPolygon: any = zone.polygon;
    try {
      const buffered = turf.buffer(zone.polygon, 0.015, { units: 'kilometers' });
      if (buffered?.geometry) filterPolygon = buffered.geometry;
    } catch {
      // fall back to the raw polygon
    }

    const nodeCoords = new Map<number, number[]>();
    for (const el of elements) {
      if (el.type === 'node' && typeof el.lon === 'number' && typeof el.lat === 'number') {
        nodeCoords.set(el.id, [el.lon, el.lat]);
      }
    }

    const coords: ZoneGraph['coords'] = new Map();
    const adjacency: ZoneGraph['adjacency'] = new Map();
    const ways: ZoneGraph['ways'] = [];

    for (const el of elements) {
      if (el.type !== 'way' || !Array.isArray(el.nodes)) continue;

      const nodeIds: string[] = [];
      const lineCoords: number[][] = [];
      for (const nid of el.nodes) {
        const c = nodeCoords.get(nid);
        if (!c) continue;
        nodeIds.push(String(nid));
        lineCoords.push(c);
      }
      if (nodeIds.length < 2) continue;

      for (let i = 0; i < nodeIds.length - 1; i++) {
        const midpoint = turf.midpoint(turf.point(lineCoords[i]), turf.point(lineCoords[i + 1]));
        let insideZone = false;
        try {
          insideZone = turf.booleanPointInPolygon(midpoint, filterPolygon);
        } catch {
          insideZone = false;
        }
        if (!insideZone) continue;

        const distKm = turf.distance(turf.point(lineCoords[i]), turf.point(lineCoords[i + 1]));
        addEdge(adjacency, nodeIds[i], nodeIds[i + 1], distKm);
        coords.set(nodeIds[i], lineCoords[i]);
        coords.set(nodeIds[i + 1], lineCoords[i + 1]);
      }

      // Keep the full way for snapping even if some segments got filtered out —
      // nearestPointOnLine still needs the original geometry to find the closest spot.
      ways.push({ nodeIds, lineCoords });
    }

    if (adjacency.size === 0) return null;
    return { coords, adjacency, ways };
  } catch {
    return null;
  }
};

const getOrBuildGraph = (zone: TricycleZone): Promise<ZoneGraph | null> => {
  if (!graphCache.has(zone.id)) {
    const precomputed = buildGraphFromPrecomputed(zone);
    graphCache.set(zone.id, precomputed ? Promise.resolve(precomputed) : buildGraphForZone(zone));
  }
  return graphCache.get(zone.id)!;
};

// Nearest point across every way in the graph, regardless of whether that
// segment made it into the routable adjacency (used for "where should the
// user walk to" — a sliver of road just outside the zone filter is still a
// perfectly good meeting point, even if it's not routable *within* the zone).
const nearestPointOnWays = (graph: ZoneGraph, point: number[]): { coords: number[]; distanceKm: number } | null => {
  let bestDist = Infinity;
  let bestCoords: number[] | null = null;

  for (const way of graph.ways) {
    if (way.lineCoords.length < 2) continue;
    const line = turf.lineString(way.lineCoords);
    const snap = turf.nearestPointOnLine(line, turf.point(point));
    const dist = snap.properties.dist as number;
    if (dist < bestDist) {
      bestDist = dist;
      bestCoords = snap.geometry.coordinates as number[];
    }
  }

  return bestCoords ? { coords: bestCoords, distanceKm: bestDist } : null;
};

// Snaps an arbitrary point onto the nearest edge in the graph, splitting that
// edge with a virtual node at the snapped location.
const snapToGraph = (graph: ZoneGraph, point: number[]): string | null => {
  let bestDist = Infinity;
  let bestEdge: { a: string; b: string; snapCoords: number[] } | null = null;

  for (const way of graph.ways) {
    if (way.lineCoords.length < 2) continue;
    const line = turf.lineString(way.lineCoords);
    const snap = turf.nearestPointOnLine(line, turf.point(point));
    const dist = snap.properties.dist as number;
    if (dist < bestDist) {
      const idx = snap.properties.index as number;
      const a = way.nodeIds[idx];
      const b = way.nodeIds[idx + 1];
      // Only a valid snap target if that segment actually made it into the graph
      // (wasn't filtered out for lying outside the zone).
      if (graph.coords.has(a) && graph.coords.has(b)) {
        bestDist = dist;
        bestEdge = { a, b, snapCoords: snap.geometry.coordinates as number[] };
      }
    }
  }

  if (!bestEdge) return null;

  const virtualKey = `virtual:${bestEdge.snapCoords[0]},${bestEdge.snapCoords[1]}`;
  if (!graph.coords.has(virtualKey)) {
    graph.coords.set(virtualKey, bestEdge.snapCoords);
    const distToA = turf.distance(turf.point(bestEdge.snapCoords), turf.point(graph.coords.get(bestEdge.a)!));
    const distToB = turf.distance(turf.point(bestEdge.snapCoords), turf.point(graph.coords.get(bestEdge.b)!));
    addEdge(graph.adjacency, virtualKey, bestEdge.a, distToA);
    addEdge(graph.adjacency, virtualKey, bestEdge.b, distToB);
  }

  return virtualKey;
};

// Plain-array Dijkstra — zone graphs are small (one neighborhood's worth of
// roads), so a proper heap isn't worth the extra code here. Searches on
// `weight` (main roads inflated) but the returned distKm is the real
// distance along the winning path, so a penalized-but-used main-road edge
// doesn't also inflate the reported ride length.
const dijkstra = (graph: ZoneGraph, startKey: string, endKey: string): { path: string[]; distKm: number } | null => {
  const cost = new Map<string, number>([[startKey, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  const queue: string[] = [startKey];

  while (queue.length > 0) {
    queue.sort((a, b) => (cost.get(a) ?? Infinity) - (cost.get(b) ?? Infinity));
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === endKey) break;

    for (const { to, weight } of graph.adjacency.get(current) || []) {
      if (visited.has(to)) continue;
      const candidateCost = (cost.get(current) ?? Infinity) + weight;
      if (candidateCost < (cost.get(to) ?? Infinity)) {
        cost.set(to, candidateCost);
        prev.set(to, current);
        queue.push(to);
      }
    }
  }

  if (!cost.has(endKey)) return null;

  const path: string[] = [endKey];
  let node = endKey;
  while (node !== startKey) {
    const p = prev.get(node);
    if (!p) return null;
    path.unshift(p);
    node = p;
  }

  let distKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = graph.adjacency.get(path[i])?.find((e) => e.to === path[i + 1]);
    distKm += edge?.distKm ?? 0;
  }

  return { path, distKm };
};

/**
 * Routes strictly within a zone's own road network. Returns null if the zone
 * has no usable road data (Overpass unreachable, sparse coverage, or the two
 * points can't be connected within the graph) — callers should fall back to
 * the Mapbox-based approach in that case.
 */
export const getZoneRoute = async (
  zone: TricycleZone,
  fromCoords: number[],
  toCoords: number[]
): Promise<ZoneRouteResult | null> => {
  const graph = await getOrBuildGraph(zone);
  if (!graph) return null;

  const startKey = snapToGraph(graph, fromCoords);
  const endKey = snapToGraph(graph, toCoords);
  if (!startKey || !endKey) return null;

  const result = dijkstra(graph, startKey, endKey);
  if (!result) return null;

  const coordinates = result.path.map((key) => graph.coords.get(key)!).filter(Boolean);
  if (coordinates.length < 2) return null;

  return { coordinates, distanceMeters: Math.round(result.distKm * 1000) };
};

export interface NearestRoadPoint {
  coords: number[];
  distanceKm: number;
}

/**
 * Finds the nearest point on a *real road* inside (or right at the edge of)
 * the zone — used to pick where a rider should walk to meet a tricycle,
 * instead of the nearest point on the zone's drawn polygon boundary, which
 * is just a hand-digitized shape and may not sit on an actual street.
 * Returns null if the zone has no usable road data — callers should fall
 * back to the polygon-boundary method in that case.
 */
export const findNearestRoadPoint = async (
  zone: TricycleZone,
  coords: number[]
): Promise<NearestRoadPoint | null> => {
  const graph = await getOrBuildGraph(zone);
  if (!graph) return null;
  return nearestPointOnWays(graph, coords);
};
