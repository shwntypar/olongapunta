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

/**
 * Every extra ride in an itinerary must save at least this many minutes over
 * the best option with fewer rides; otherwise it is an unnecessary transfer
 * (same trip, more fares) and is not shown. Used by Tricycle, Mixed and
 * Transit (jeepney/transitCandidates.ts) alike.
 */
export const EXTRA_RIDE_MIN_SAVING_MIN = 5;

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
  const transfers = routes.filter(isTransfer);
  // A single tricycle can't cover a long trip (rides are capped — MAX_RIDE_KM), so its "Direct"
  // option can mean walking most of the way first (41 min on foot, then one ride). When a
  // transfer exists, such a Direct isn't offered: the hop is necessary, not optional.
  const direct = routes.filter((r) => !isTransfer(r) && (transfers.length === 0 || walkingKm(r) <= MIXED_MAX_WALK_KM));

  const fastestFirst = (picks: RouteResult[]) => picks.sort((a, b) => a.cost[0] - b.cost[0] || a.cost[1] - b.cost[1]);
  const directPick = direct[0];
  // A transfer is only offered when there's no direct ride, or it's clearly faster.
  const transferPick = transfers.find((t) => direct.length === 0 || t.cost[0] <= direct[0].cost[0] - EXTRA_RIDE_MIN_SAVING_MIN);
  if (transferPick) return fastestFirst(directPick ? [directPick, transferPick] : [transferPick]);

  if (direct.length <= 1) return direct.length > 0 ? direct : routes.slice(0, 1);
  const middleIndex = Math.min(direct.length - 1, Math.max(1, Math.round((direct.length - 1) / 2)));
  return [directPick, direct[middleIndex]];
}

// ---- Mixed mode (tricycle + jeepney + walking, planMixedTrip.ts) ----

/** True if the itinerary boards anything at all (a tricycle or a jeepney). */
export const ridesSomething = (route: RouteResult) =>
  route.legs.some((leg) => leg.transition === "board-trike" || leg.transition === "board-jeep");

/** Vehicles boarded (tricycles and jeepneys). */
const boardings = (route: RouteResult) => route.legs.filter((l) => l.transition === "board-trike" || l.transition === "board-jeep").length;

/**
 * Keeps an option with more rides only if it is at least EXTRA_RIDE_MIN_SAVING_MIN
 * faster than every option with fewer rides — no "J-02 → J-01" for the same time
 * (and twice the fare) as a direct J-06.
 */
export function dropUnnecessaryTransfers(routes: RouteResult[], alsoWorthIt?: (route: RouteResult, fewerRides: RouteResult) => boolean): RouteResult[] {
  return routes.filter((r) =>
    routes.every((other) => boardings(other) >= boardings(r) || r.cost[0] <= other.cost[0] - EXTRA_RIDE_MIN_SAVING_MIN || !!alsoWorthIt?.(r, other))
  );
}

/** All walking in the itinerary, in km. */
export function walkingKm(route: RouteResult): number {
  let km = 0;
  for (const leg of route.legs) {
    if (leg.mode !== "walk") continue;
    for (let j = 1; j < leg.coordinates.length; j++) km += haversineKm(leg.coordinates[j - 1], leg.coordinates[j]);
  }
  return km;
}

/**
 * More walking than this in total, and the itinerary is only shown when
 * nothing else exists. Walking is free, so the Pareto set's cheapest end is
 * often "walk 2 km to save ₱13" — correct, but rarely what a rider wants first.
 */
export const MIXED_MAX_WALK_KM = 1.5;

/**
 * Up to three mixed options, fastest first: the fastest, the cheapest and one
 * in between — plus, when an end of the trip is remote, the best tricycle +
 * jeepney combination (remoteCombo). Fares are flat per boarding, so each Pareto route sits at its
 * own fare level (₱13 jeep, ₱26 two jeeps, ₱30 trike, ₱43 trike + jeep, …)
 * and the set stays small; this only trims long-walk extremes.
 */
export function curateMixedRoutes(routes: RouteResult[], maxCount = 3, builtCombo: RouteResult | null = null): RouteResult[] {
  const comfortable = routes.filter((r) => walkingKm(r) <= MIXED_MAX_WALK_KM);
  const walkable = comfortable.length > 0 ? comfortable : routes;
  const pool = dropUnnecessaryTransfers(walkable);
  let shown = pool;
  if (pool.length > maxCount) {
    const picks = new Set<number>([0, Math.round((pool.length - 1) / 2), pool.length - 1]);
    shown = [...picks].sort((a, b) => a - b).map((i) => pool[i]);
  }

  // Tricycle + jeepney for a remote end of the trip (see remoteCombo), as one extra option.
  const combo = remoteCombo(comfortable, shown) ?? (shown.some(isTrikeJeepCombo) ? null : builtCombo);
  return combo ? [...shown, combo].sort((a, b) => a.cost[0] - b.cost[0] || a.cost[1] - b.cost[1]) : shown;
}

const usesJeep = (r: RouteResult) => r.legs.some((l) => l.transition === "board-jeep");
const usesTrike = (r: RouteResult) => r.legs.some((l) => l.transition === "board-trike");
/** Rides both a jeepney and a tricycle, in either order. */
export const isTrikeJeepCombo = (r: RouteResult) => usesJeep(r) && usesTrike(r);

/** How much walking a tricycle leg must save, compared with going by jeepney alone, to earn a combo its place. */
export const COMBO_MIN_WALK_SAVED_KM = 0.3;

/**
 * The jeepney-and-tricycle option for a trip with a remote end: ride the
 * jeepney for the main stretch and a tricycle for the part it doesn't reach
 * (a destination up a side road, or the reverse — a tricycle out to the
 * jeepney). The other display rules count it as "an unnecessary extra ride"
 * whenever a single tricycle is a few minutes faster, so it gets its own slot
 * when it's justified: there's no jeepney-only option at all, or the
 * tricycle saves at least COMBO_MIN_WALK_SAVED_KM of walking compared with
 * the jeepney-only one. Taken from the Pareto set first; when the Pareto
 * set has none (a single tricycle beats every combo on time and price), the
 * caller's built one (comboBuilder.ts) is offered instead. Fastest such
 * combo; null if one is already shown or none qualifies.
 */
function remoteCombo(routes: RouteResult[], shown: RouteResult[]): RouteResult | null {
  if (shown.some(isTrikeJeepCombo)) return null;
  const jeepOnlyWalk = Math.min(...routes.filter((r) => usesJeep(r) && !usesTrike(r)).map(walkingKm));
  const justified = routes.filter(
    (r) => isTrikeJeepCombo(r) && (jeepOnlyWalk === Infinity || jeepOnlyWalk - walkingKm(r) >= COMBO_MIN_WALK_SAVED_KM)
  );
  return justified.sort((a, b) => a.cost[0] - b.cost[0])[0] ?? null;
}
