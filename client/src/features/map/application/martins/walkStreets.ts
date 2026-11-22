// Streets outside the Martins road graph (graph.json covers the original
// tricycle zones only), added to the Transit/Mixed graph as walk-only paths —
// see scripts/fetch-walk-streets.ts. Without them, a trip to New Cabalan ends
// with a straight line across blocks from wherever the jeepney happens to stop.
//
// walkOnly: tricycles never ride them (neighbors.ts), so tricycle routing is
// exactly what graph.json gives. They're added before the jeepney layer, so
// stops out there link to a real street like any stop in the city.

import { getDistanceMeters } from "../geo";
import type { LoadedGraph } from "./neighbors";
import type { MartinsEdge } from "./types";

export interface WalkStreetsData {
  /** [osm node id, lon, lat] */
  nodes: (string | number)[][];
  /** [from, to] node ids, walkable both ways */
  edges: string[][];
}

/** Adds the streets to `graph` (mutates it). Returns how many street segments were added. */
export function addWalkStreets(graph: LoadedGraph, data: WalkStreetsData): number {
  for (const [id, lon, lat] of data.nodes) {
    if (!graph.nodes.has(String(id))) graph.nodes.set(String(id), { id: String(id), lon: Number(lon), lat: Number(lat), zoneId: null });
  }
  let added = 0;
  for (const [from, to] of data.edges) {
    const a = graph.nodes.get(from);
    const b = graph.nodes.get(to);
    if (!a || !b) continue;
    const edge: MartinsEdge = {
      from,
      to,
      distanceKm: getDistanceMeters([a.lon, a.lat], [b.lon, b.lat]) / 1000,
      trikeMinutes: 0,
      isMainRoad: false,
      boardable: false,
      zoneId: null,
      walkable: true,
      walkOnly: true,
      coordinates: [
        [a.lon, a.lat],
        [b.lon, b.lat],
      ],
    };
    for (const e of [edge, { ...edge, from: to, to: from, coordinates: [edge.coordinates[1], edge.coordinates[0]] }]) {
      if (!graph.adjacency.has(e.from)) graph.adjacency.set(e.from, []);
      graph.adjacency.get(e.from)!.push(e);
    }
    added++;
  }
  return added;
}
