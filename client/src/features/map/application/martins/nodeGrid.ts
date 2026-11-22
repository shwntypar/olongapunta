// Fast "which graph nodes are near this point" lookups: nodes bucketed on a
// lon/lat grid, so a lookup only checks the 3×3 cells around the point
// instead of every node. Used by the jeepney layer and walking distances.

import type { MartinsNode } from "./types";

/** Flat-earth km — exact enough within the 3×3 cells (~1.6 km) a lookup searches, and much cheaper than haversine. */
function km(a: number[], b: number[]): number {
  const dx = (b[0] - a[0]) * 111.32 * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  const dy = (b[1] - a[1]) * 110.574;
  return Math.sqrt(dx * dx + dy * dy);
}
/** One number per grid cell (cheaper to look up than a "x,y" string). */
const cellId = (cx: number, cy: number) => cx * 1_000_000 + cy;

/** Lon/lat grid for nearest-node lookups — the road graph has ~11k nodes. */
export class NodeGrid {
  private static CELL = 0.005; // degrees, ~550 m — larger than every lookup radius used here
  private cells = new Map<number, MartinsNode[]>();
  private key = (lon: number, lat: number) => cellId(Math.floor(lon / NodeGrid.CELL), Math.floor(lat / NodeGrid.CELL));

  constructor(nodes: Iterable<MartinsNode>) {
    for (const n of nodes) {
      const k = this.key(n.lon, n.lat);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k)!.push(n);
    }
  }

  /** Every node within `maxKm` of the point (maxKm must not exceed the cell size). */
  near(point: number[], maxKm: number): { node: MartinsNode; km: number }[] {
    const cx = Math.floor(point[0] / NodeGrid.CELL);
    const cy = Math.floor(point[1] / NodeGrid.CELL);
    const found: { node: MartinsNode; km: number }[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const node of this.cells.get(cellId(cx + dx, cy + dy)) ?? []) {
          const d = km(point, [node.lon, node.lat]);
          if (d <= maxKm) found.push({ node, km: d });
        }
      }
    }
    return found.sort((a, b) => a.km - b.km);
  }

  /** The closest node within `maxKm`, or null. (Same cells as near(), without building and sorting a list.) */
  nearest(point: number[], maxKm: number): { node: MartinsNode; km: number } | null {
    const cx = Math.floor(point[0] / NodeGrid.CELL);
    const cy = Math.floor(point[1] / NodeGrid.CELL);
    let best: { node: MartinsNode; km: number } | null = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const node of this.cells.get(cellId(cx + dx, cy + dy)) ?? []) {
          const d = km(point, [node.lon, node.lat]);
          if (d <= maxKm && (!best || d < best.km)) best = { node, km: d };
        }
      }
    }
    return best;
  }
}
