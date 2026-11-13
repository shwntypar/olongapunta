import { Cost, Label, stateKey } from "./types";
import { LoadedGraph, neighbors } from "./neighbors";
import { MinHeap } from "./minHeap";

// =====================================================
// 🧭 MARTINS' LABEL-SETTING ALGORITHM
// =====================================================
// Reference: Martins, E. Q. V. (1984). On a multicriteria shortest path
// problem. European Journal of Operational Research, 16(2). Adapted from the
// reference sketch in the thesis handoff doc, section 7.

// Dominance/equality are checked on bucketed cost, not raw cost. Once fare
// started accruing continuously per edge (distance-based pricing), two paths
// differing by a fraction of a peso or a few seconds became "non-dominated"
// of each other by the raw numbers, even though they're not a meaningfully
// different trade-off — this is exactly the explosion the thesis doc's own
// "Performance notes" warn about and prescribe bucketing for. The heap order
// (lexLess) stays on true cost — only pruning uses the bucketed view, so the
// cheapest-in-bucket label is still the one that gets kept.
const COST_BUCKET: Cost = [0.5, 1]; // 0.5 min, ₱1
const bucket = (c: Cost): Cost => [Math.round(c[0] / COST_BUCKET[0]), Math.round(c[1] / COST_BUCKET[1])];

const dominates = (a: Cost, b: Cost) => {
  const ba = bucket(a);
  const bb = bucket(b);
  return ba[0] <= bb[0] && ba[1] <= bb[1] && (ba[0] < bb[0] || ba[1] < bb[1]);
};
const equalCost = (a: Cost, b: Cost) => {
  const ba = bucket(a);
  const bb = bucket(b);
  return ba[0] === bb[0] && ba[1] === bb[1];
};
const lexLess = (a: Cost, b: Cost) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);

function pushToMap(map: Map<string, Label[]>, key: string, label: Label) {
  if (!map.has(key)) map.set(key, []);
  map.get(key)!.push(label);
}

function removeFromMap(map: Map<string, Label[]>, key: string, label: Label) {
  const arr = map.get(key);
  if (!arr) return;
  const idx = arr.indexOf(label);
  if (idx !== -1) arr.splice(idx, 1);
}

export interface MartinsOptions {
  /** Safety cap on permanent labels, in case of unexpectedly dense graph data. */
  maxLabels?: number;
  /**
   * Optional out-parameter for evaluation (thesis Chapter 3, "search effort").
   * Filled in place; has no effect on the search itself.
   */
  stats?: MartinsStats;
  /**
   * Only accept itineraries that board at least one tricycle. Off by default
   * (the evaluated algorithm). Used as a UI fallback when walking alone
   * dominates every tricycle option on a short trip, so Tricycle mode can
   * still show the fastest ride instead of nothing. Adds a "has ridden"
   * dimension to every state key, so walk-only labels can no longer
   * dominate (and prune) labels that have ridden.
   */
  requireRide?: boolean;
}

export interface MartinsStats {
  /** Labels made permanent (popped from the heap, not dead) — the search-effort metric. */
  labelsSettled: number;
  /** Labels ever pushed onto the heap, including ones later marked dead. */
  labelsCreated: number;
  /** True if maxLabels stopped the search early (result may be partial). */
  hitLabelCap: boolean;
}

/**
 * Returns the Pareto set of [minutes, pesos] routes from startNode to
 * goalNode — every label where no cheaper-and-faster alternative exists.
 * A route must end in "walk" mode at the goal (you can't stay on a trike).
 */
export function martins(graph: LoadedGraph, startNode: string, goalNode: string, options: MartinsOptions = {}): Label[] {
  const maxLabels = options.maxLabels ?? 200_000;
  const requireRide = options.requireRide ?? false;
  const rode = new WeakMap<Label, boolean>();
  const keyOf = (l: Label) => (requireRide ? `${stateKey(l.state)}|${rode.get(l) ? 1 : 0}` : stateKey(l.state));

  const permanent = new Map<string, Label[]>();
  const temporary = new Map<string, Label[]>();
  const heap = new MinHeap<Label>((a, b) => lexLess(a.cost, b.cost));
  const results: Label[] = [];

  const startLabel: Label = {
    cost: [0, 0],
    state: { node: startNode, mode: "walk", homeZone: null, crossed: false, entered: "" },
    prev: null,
    edge: null,
    transition: "start",
    rideKm: 0,
  };
  heap.push(startLabel);
  pushToMap(temporary, keyOf(startLabel), startLabel);

  let processed = 0;
  let created = 1; // the start label
  const stats = options.stats;
  if (stats) {
    stats.labelsSettled = 0;
    stats.labelsCreated = 0;
    stats.hitLabelCap = false;
  }

  while (heap.length > 0) {
    const L = heap.pop()!;
    if (L.dead) continue;

    if (++processed > maxLabels) {
      console.warn("martins(): maxLabels exceeded — returning the partial Pareto set found so far");
      if (stats) stats.hitLabelCap = true;
      break;
    }

    const k = keyOf(L);
    removeFromMap(temporary, k, L);
    pushToMap(permanent, k, L); // lexicographic pop ⇒ L is Pareto-optimal for its state
    if (stats) stats.labelsSettled++;

    if (L.state.node === goalNode && L.state.mode === "walk" && (!requireRide || rode.get(L))) {
      // Labels pop in raw lexicographic order, but dominance is judged on
      // bucketed cost. A later goal label can share an earlier result's
      // time bucket while sitting in a cheaper fare bucket — it then
      // bucket-dominates that earlier result (e.g. 50.42 min/₱33.42 vs
      // 50.59 min/₱30.00). Drop such results so the returned set stays
      // non-dominated under the same rule used for pruning (Section 2.6.3).
      for (let i = results.length - 1; i >= 0; i--) {
        if (dominates(L.cost, results[i].cost)) results.splice(i, 1);
      }
      results.push(L);
      continue; // a label at the goal has no useful onward neighbors
    }

    for (const n of neighbors(graph, L.state, L.rideKm)) {
      const cost: Cost = [L.cost[0] + n.minutes, L.cost[1] + n.pesos];

      // Target pruning — this label can't beat an already-found result.
      if (results.some((r) => dominates(r.cost, cost) || equalCost(r.cost, cost))) continue;

      const nRode = (rode.get(L) ?? false) || n.transition === "board-trike";
      const nk = requireRide ? `${stateKey(n.state)}|${nRode ? 1 : 0}` : stateKey(n.state);
      const existing = [...(permanent.get(nk) ?? []), ...(temporary.get(nk) ?? [])];
      if (existing.some((e) => dominates(e.cost, cost) || equalCost(e.cost, cost))) continue;

      for (const t of temporary.get(nk) ?? []) {
        if (dominates(cost, t.cost)) t.dead = true;
      }
      temporary.set(nk, (temporary.get(nk) ?? []).filter((t) => !t.dead));

      // Reset on board/alight (a fresh ride starts at 0); accumulate while riding.
      const rideKm = n.transition === "trike-home" || n.transition === "trike-cross" ? L.rideKm + (n.edge?.distanceKm ?? 0) : 0;
      const NL: Label = { cost, state: n.state, prev: L, edge: n.edge, transition: n.transition, rideKm };
      if (nRode) rode.set(NL, true);
      pushToMap(temporary, nk, NL);
      heap.push(NL);
      created++;
    }
  }

  if (stats) stats.labelsCreated = created;
  return results;
}
