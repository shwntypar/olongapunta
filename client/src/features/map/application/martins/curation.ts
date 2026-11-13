// =====================================================
// 🧭 CHOOSING WHICH PARETO ROUTES TO SHOW
// =====================================================
// Display-only. None of this touches the search: findParetoRoutes() still
// returns the full, correct Pareto set (which is what the thesis evaluates).

import { RouteResult } from "./types";

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

/**
 * Distance-based fare (farePerKm) makes the raw Pareto frontier large — many
 * routes differing only in "walk a little more/less, pay a little less/more"
 * are all genuinely non-dominated, but showing all of them is clutter, not
 * useful choice. This samples a small, evenly-spaced subset for display —
 * always the fastest and cheapest extremes, plus a few points between —
 * without touching findParetoRoutes itself (still the full, correct set,
 * e.g. for the thesis's own "Pareto set size" evaluation metric).
 */
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
