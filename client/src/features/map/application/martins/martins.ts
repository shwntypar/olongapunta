import { Cost, Label, RouteLeg, RouteResult, stateKey } from "./types";
import { LoadedGraph, neighbors } from "./neighbors";

// =====================================================
// 🧭 MARTINS' LABEL-SETTING ALGORITHM
// =====================================================
// Reference: Martins, E. Q. V. (1984). On a multicriteria shortest path
// problem. European Journal of Operational Research, 16(2). Adapted from the
// reference sketch in the thesis handoff doc, section 7.

const dominates = (a: Cost, b: Cost) => a[0] <= b[0] && a[1] <= b[1] && (a[0] < b[0] || a[1] < b[1]);
const equalCost = (a: Cost, b: Cost) => a[0] === b[0] && a[1] === b[1];
const lexLess = (a: Cost, b: Cost) => (a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]);

/** Minimal binary min-heap — no external dependency needed for a two-criteria queue. */
class MinHeap<T> {
  private items: T[] = [];
  constructor(private cmp: (a: T, b: T) => number) {}

  get length() {
    return this.items.length;
  }

  push(item: T) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.cmp(this.items[i], this.items[parent]) >= 0) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  private bubbleDown(i: number) {
    const n = this.items.length;
    for (;;) {
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      let smallest = i;
      if (l < n && this.cmp(this.items[l], this.items[smallest]) < 0) smallest = l;
      if (r < n && this.cmp(this.items[r], this.items[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
      i = smallest;
    }
  }
}

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
}

/**
 * Returns the Pareto set of [minutes, pesos] routes from startNode to
 * goalNode — every label where no cheaper-and-faster alternative exists.
 * A route must end in "walk" mode at the goal (you can't stay on a trike).
 */
export function martins(graph: LoadedGraph, startNode: string, goalNode: string, options: MartinsOptions = {}): Label[] {
  const maxLabels = options.maxLabels ?? 200_000;

  const permanent = new Map<string, Label[]>();
  const temporary = new Map<string, Label[]>();
  const heap = new MinHeap<Label>((a, b) => lexLess(a.cost, b.cost));
  const results: Label[] = [];

  const startLabel: Label = {
    cost: [0, 0],
    state: { node: startNode, mode: "walk", homeZone: null, crossed: false },
    prev: null,
    edge: null,
    transition: "start",
  };
  heap.push(startLabel);
  pushToMap(temporary, stateKey(startLabel.state), startLabel);

  let processed = 0;

  while (heap.length > 0) {
    const L = heap.pop()!;
    if (L.dead) continue;

    if (++processed > maxLabels) {
      console.warn("martins(): maxLabels exceeded — returning the partial Pareto set found so far");
      break;
    }

    const k = stateKey(L.state);
    removeFromMap(temporary, k, L);
    pushToMap(permanent, k, L); // lexicographic pop ⇒ L is Pareto-optimal for its state

    if (L.state.node === goalNode && L.state.mode === "walk") {
      results.push(L);
      continue; // a label at the goal has no useful onward neighbors
    }

    for (const n of neighbors(graph, L.state)) {
      const cost: Cost = [L.cost[0] + n.minutes, L.cost[1] + n.pesos];

      // Target pruning — this label can't beat an already-found result.
      if (results.some((r) => dominates(r.cost, cost) || equalCost(r.cost, cost))) continue;

      const nk = stateKey(n.state);
      const existing = [...(permanent.get(nk) ?? []), ...(temporary.get(nk) ?? [])];
      if (existing.some((e) => dominates(e.cost, cost) || equalCost(e.cost, cost))) continue;

      for (const t of temporary.get(nk) ?? []) {
        if (dominates(cost, t.cost)) t.dead = true;
      }
      temporary.set(nk, (temporary.get(nk) ?? []).filter((t) => !t.dead));

      const NL: Label = { cost, state: n.state, prev: L, edge: n.edge, transition: n.transition };
      pushToMap(temporary, nk, NL);
      heap.push(NL);
    }
  }

  return results;
}

/** Walks a label's .prev chain back to the start and turns it into per-leg deltas. */
export function rebuildLegs(goalLabel: Label): RouteLeg[] {
  const chain: Label[] = [];
  for (let cur: Label | null = goalLabel; cur; cur = cur.prev) chain.unshift(cur);

  const legs: RouteLeg[] = [];
  for (let i = 1; i < chain.length; i++) {
    const prevLabel = chain[i - 1];
    const curLabel = chain[i];
    legs.push({
      mode: curLabel.state.mode,
      minutes: curLabel.cost[0] - prevLabel.cost[0],
      pesos: curLabel.cost[1] - prevLabel.cost[1],
      transition: curLabel.transition,
      fromNode: prevLabel.state.node,
      toNode: curLabel.state.node,
      coordinates: curLabel.edge?.coordinates ?? [],
    });
  }
  return legs;
}

export function toRouteResult(label: Label): RouteResult {
  return { cost: label.cost, legs: rebuildLegs(label) };
}

/** Pareto set of routes, fastest first. */
export function findParetoRoutes(
  graph: LoadedGraph,
  startNode: string,
  goalNode: string,
  options?: MartinsOptions
): RouteResult[] {
  const labels = martins(graph, startNode, goalNode, options);
  return labels
    .map(toRouteResult)
    .sort((a, b) => (a.cost[0] !== b.cost[0] ? a.cost[0] - b.cost[0] : a.cost[1] - b.cost[1]));
}
