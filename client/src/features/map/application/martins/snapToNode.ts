import * as turf from "@turf/turf";
import { MartinsNode } from "./types";

// Linear scan — fine for a single-zone graph (a few hundred nodes). If this
// grows to a city-wide graph, replace with a spatial index (e.g. a simple
// lon/lat grid bucket, or an rbush/flatbush dependency) rather than scanning
// every node per lookup.
export function nearestNode(nodes: MartinsNode[], coords: [number, number]): MartinsNode | null {
  if (nodes.length === 0) return null;

  const pt = turf.point(coords);
  let best: MartinsNode | null = null;
  let bestDistKm = Infinity;

  for (const node of nodes) {
    const dist = turf.distance(pt, turf.point([node.lon, node.lat]));
    if (dist < bestDistKm) {
      bestDistKm = dist;
      best = node;
    }
  }

  return best;
}
