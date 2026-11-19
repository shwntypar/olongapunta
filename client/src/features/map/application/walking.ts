// Walking distance along real streets, not as the crow flies. Rivers,
// bridges and dead ends matter: a pin across the Kalaklan River from its
// destination is a short straight line but a long walk round by the bridge.
//
// walkingFrom(point) runs one Dijkstra over the road graph's walkable edges
// from the point's nearest node; the result answers "how far on foot to X"
// for any number of X. Points off the mapped road area fall back to a
// straight line × STREET_DETOUR.

import { getDistanceMeters } from "./geo";
import { MinHeap } from "./martins/minHeap";
import { ROAD_GRAPH, ROAD_GRID } from "./martins/roadGraph";

/** Typical ratio of street distance to straight-line distance, for the fallback. */
export const STREET_DETOUR = 1.3;
/** A point farther than this from every road node is off the map: use the fallback. */
const SNAP_KM = 0.3;
/** Stop exploring past this distance — nobody is told to walk farther. */
const MAX_SEARCH_KM = 8;

const straightKm = (a: number[], b: number[]) => getDistanceMeters(a, b) / 1000;

/** A point's nearest road node, found once and reused (see snapToRoad). null = off the mapped roads. */
export type RoadSnap = { nodeId: string; km: number } | null;

/** The nearest road node to a point — for fixed points (route samples), compute once and pass to kmToSnapped. */
export function snapToRoad(point: number[]): RoadSnap {
  const near = ROAD_GRID.nearest(point, SNAP_KM);
  return near ? { nodeId: near.node.id, km: near.km } : null;
}

export interface WalkingField {
  /** Kilometres on foot from the source to `point`. */
  kmTo(point: number[]): number;
  /** Same, with the point's road snap already known (saves the nearest-node lookup). */
  kmToSnapped(point: number[], snap: RoadSnap): number;
}

export function walkingFrom(source: number[]): WalkingField {
  const straightWalk = (p: number[]) => straightKm(source, p) * STREET_DETOUR;
  const fallback: WalkingField = { kmTo: straightWalk, kmToSnapped: straightWalk };
  const start = ROAD_GRID.nearest(source, SNAP_KM);
  if (!start) return fallback;

  // Dijkstra on walkable edges (distanceKm), from the source's nearest node.
  const dist = new Map<string, number>([[start.node.id, start.km]]);
  const heap = new MinHeap<[number, string]>((a, b) => a[0] - b[0]);
  heap.push([start.km, start.node.id]);
  while (heap.length > 0) {
    const [d, id] = heap.pop()!;
    if (d > (dist.get(id) ?? Infinity) || d > MAX_SEARCH_KM) continue;
    for (const edge of ROAD_GRAPH.adjacency.get(id) ?? []) {
      if (!edge.walkable) continue;
      const next = d + edge.distanceKm;
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next);
        heap.push([next, edge.to]);
      }
    }
  }

  const kmToSnapped = (point: number[], snap: RoadSnap) => {
    const viaRoads = snap ? dist.get(snap.nodeId) : undefined;
    if (!snap || viaRoads === undefined) return straightWalk(point);
    // Never claim a walk shorter than the straight line (snapping can cut corners on very short hops).
    return Math.max(viaRoads + snap.km, straightKm(source, point));
  };
  return { kmTo: (point) => kmToSnapped(point, snapToRoad(point)), kmToSnapped };
}
