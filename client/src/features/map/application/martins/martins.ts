import { Cost, Label, RouteLeg, RouteResult, stateKey } from "./types";
import { LoadedGraph, neighbors } from "./neighbors";

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
    rideKm: 0,
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

    for (const n of neighbors(graph, L.state, L.rideKm)) {
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

      // Reset on board/alight (a fresh ride starts at 0); accumulate while riding.
      const rideKm = n.transition === "trike-home" || n.transition === "trike-cross" ? L.rideKm + (n.edge?.distanceKm ?? 0) : 0;
      const NL: Label = { cost, state: n.state, prev: L, edge: n.edge, transition: n.transition, rideKm };
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

/**
 * Distance-based fare (farePerKm) makes the raw Pareto frontier large — many
 * routes differing only in "walk a little more/less, pay a little less/more"
 * are all genuinely non-dominated, but showing all of them is clutter, not
 * useful choice. This samples a small, evenly-spaced subset for display —
 * always the fastest and cheapest extremes, plus a few points between —
 * without touching findParetoRoutes itself (still the full, correct set,
 * e.g. for the thesis's own "Pareto set size" evaluation metric).
 */
/**
 * The raw Pareto set always contains a "never board" route (₱0, pure
 * walking) — it's mathematically optimal on fare, but it's not a tricycle
 * suggestion, it's "don't take a tricycle." Showing it as "Cheapest" in a
 * Tricycle-mode route list is misleading, since ₱0 trivially beats every
 * real ride. This filters it out so "Cheapest" means the cheapest route
 * that actually rides a tricycle somewhere.
 */
export function requiresTricycle(route: RouteResult): boolean {
  return route.legs.some((leg) => leg.transition === "board-trike");
}

// Haversine, not Turf — curateParetoRoutes is a display-only step (it never
// touches findParetoRoutes' own output), so it deliberately stays as
// dependency-light as the rest of this module per the thesis doc's "no
// Turf-heavy work in the runtime search path" design note.
function haversineKm(a: readonly number[], b: readonly number[]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Walking distance covered after the last alight — how far the rider is stranded from the destination. */
function trailingWalkKm(route: RouteResult): number {
  let km = 0;
  for (let i = route.legs.length - 1; i >= 0; i--) {
    const leg = route.legs[i];
    if (leg.mode !== "walk") break;
    for (let j = 1; j < leg.coordinates.length; j++) km += haversineKm(leg.coordinates[j - 1], leg.coordinates[j]);
  }
  return km;
}

// A continuous per-km fare means the raw Pareto set is full of routes that
// are really "the same ride, cut off a bit earlier" — riding a short extra
// stretch instead of walking it only costs a few pesos (farePerKm is ~8-10
// in the current placeholder data). Showing every one of those cutoff
// points as a distinct "Balanced" option just strands the rider further
// and further from the destination to save pocket change. If paying at
// most WALK_TRADEOFF_PESOS more gets a route with meaningfully
// (MIN_WALK_SAVED_KM+) less walking left at the end, prefer that one.
const WALK_TRADEOFF_PESOS = 10;
const MIN_WALK_SAVED_KM = 0.1;

function dropsRiderTooFarOut(route: RouteResult, pool: RouteResult[]): boolean {
  const walk = trailingWalkKm(route);
  return pool.some((other) => {
    if (other === route) return false;
    const extraCost = other.cost[1] - route.cost[1];
    if (extraCost <= 0 || extraCost > WALK_TRADEOFF_PESOS) return false;
    return walk - trailingWalkKm(other) >= MIN_WALK_SAVED_KM;
  });
}

export function curateParetoRoutes(routes: RouteResult[], maxCount = 4): RouteResult[] {
  const keptEnough = routes.filter((r) => !dropsRiderTooFarOut(r, routes));
  const pool = keptEnough.length > 0 ? keptEnough : routes;

  if (pool.length <= maxCount) return pool;
  const indices = new Set<number>();
  for (let i = 0; i < maxCount; i++) {
    indices.add(Math.round((i * (pool.length - 1)) / (maxCount - 1)));
  }
  return [...indices].sort((a, b) => a - b).map((i) => pool[i]);
}

const isTransfer = (r: RouteResult) => r.legs.filter((l) => l.transition === "board-trike").length >= 2;

/**
 * Two-card display, same framing as Transit mode: Direct (one continuous
 * ride) vs Transfer (board a second trike). The cheapest-extreme pick is
 * deliberately never shown here — it's rarely the trip a rider actually
 * wants and just adds a third, lower-value option. Picks the fastest route
 * in each category (routes arrives time-sorted). Falls back to two direct
 * picks (fastest + a true time-middle one) when no transfer exists in the
 * curated set.
 */
export function selectDirectAndTransfer(routes: RouteResult[]): RouteResult[] {
  if (routes.length <= 1) return routes;
  const direct = routes.filter((r) => !isTransfer(r));
  const transfers = routes.filter(isTransfer);

  const directPick = direct[0] ?? routes[0];
  if (transfers.length > 0) return [directPick, transfers[0]];

  if (direct.length <= 1) return direct.length > 0 ? direct : routes.slice(0, 1);
  const middleIndex = Math.min(direct.length - 1, Math.max(1, Math.round((direct.length - 1) / 2)));
  return [directPick, direct[middleIndex]];
}
