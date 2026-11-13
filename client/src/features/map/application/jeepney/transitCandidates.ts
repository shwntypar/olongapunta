// =====================================================
// 🚐 JEEPNEY ITINERARY MATCHER
// =====================================================
// Jeepney routes are fixed lines, so an itinerary is found by projecting the
// trip's two ends onto each digitized route direction — not by graph search.
// Jeepneys are hail-and-ride (board/alight anywhere along the route), so the
// nearest point on the line to the actual trip coordinates is the boarding /
// alighting point.

import * as turf from "@turf/turf";
import { mockRoutes, type JeepneyRoute } from "../../domain/MockData";
import type { TransitCandidate, TransitLeg } from "../../domain/types";

const MAX_WALK_KM = 1.5; // total walking to reach and leave the jeepney network
const MAX_TRANSFER_WALK_KM = 0.5; // walking between two jeepneys
const MIN_RIDE_KM = 0.15; // shorter than this isn't worth boarding
const TRANSFER_PENALTY = 0.5; // score handicap for needing a second ride
const MAX_DETOUR_MULTIPLIER = 3; // travel can't exceed 3x the straight-line distance
const WALK_WEIGHT = 3; // a km walked counts as 3 km ridden in the score
const MAX_CANDIDATES = 3;

type Point = ReturnType<typeof turf.point>;
type SnappedPoint = ReturnType<typeof turf.nearestPointOnLine>;
type Line = ReturnType<typeof turf.lineString>;

/** One direction of travel along a jeepney route. */
interface RouteDirection {
  route: JeepneyRoute;
  coords: number[][];
  /** e.g. "Sta. Rita to SM Olongapo Downtown" */
  label: string;
}

/** Forward and return directions of a route (the return falls back to the forward path reversed). */
function directionsOf(route: JeepneyRoute): RouteDirection[] {
  const directions: RouteDirection[] = [];
  if (route.path && route.path.length >= 2) {
    directions.push({ route, coords: route.path, label: route.routeName });
  }
  const returnPath = route.returnPath || (route.path ? [...route.path].reverse() : null);
  if (returnPath && returnPath.length >= 2) {
    directions.push({ route, coords: returnPath, label: route.reversedName });
  }
  return directions;
}

const headingOf = (label: string) => label.split(" to ")[1] || label;

/** A route direction with the trip's two ends already projected onto it. */
interface DirectionFit extends RouteDirection {
  line: Line;
  /** Nearest point on the line to the trip's origin, and the walk to reach it. */
  board: SnappedPoint;
  walkToBoardKm: number;
  /** Nearest point on the line to the trip's destination, and the walk from it. */
  drop: SnappedPoint;
  walkFromDropKm: number;
}

function fitDirection(direction: RouteDirection, startPoint: Point, endPoint: Point): DirectionFit {
  const line = turf.lineString(direction.coords);
  const board = turf.nearestPointOnLine(line, startPoint);
  const drop = turf.nearestPointOnLine(line, endPoint);
  return {
    ...direction,
    line,
    board,
    walkToBoardKm: turf.distance(startPoint, board),
    drop,
    walkFromDropKm: turf.distance(drop, endPoint),
  };
}

/** A single jeepney ride covering the whole trip, or null if this direction doesn't fit. */
function singleRideCandidate(fit: DirectionFit, directWalkKm: number): TransitCandidate | null {
  // The route must travel from the boarding point towards the drop-off, not away from it.
  if (fit.board.properties.location! >= fit.drop.properties.location!) return null;

  const totalWalk = fit.walkToBoardKm + fit.walkFromDropKm;

  const riddenPath = turf.lineSlice(fit.board, fit.drop, fit.line);
  const rideDistanceKm = turf.length(riddenPath);

  if (rideDistanceKm > directWalkKm * MAX_DETOUR_MULTIPLIER) return null;
  if (!(totalWalk < MAX_WALK_KM && rideDistanceKm > MIN_RIDE_KM && totalWalk < directWalkKm)) return null;

  return {
    jeepney: fit.route,
    headingTowards: headingOf(fit.label),
    boardingCoords: fit.board.geometry.coordinates,
    dropoffCoords: fit.drop.geometry.coordinates,
    slicedGeometry: riddenPath.geometry,
    walkDistanceMeters: Math.round(totalWalk * 1000),
    activePathCoords: fit.coords,
    score: totalWalk * WALK_WEIGHT + rideDistanceKm,
  };
}

interface TransferPoint {
  offA: SnappedPoint;
  onB: SnappedPoint;
  walkKm: number;
}

/**
 * Where to change from route A to route B.
 *
 * Picks whichever valid transfer point minimizes TOTAL travel distance (both
 * ride legs + the transfer walk) — not just the walking gap at the transfer
 * itself. Optimizing on gap alone can pick a transfer point far down route A
 * that happens to sit close to route B, producing a route that rides way past
 * the destination and doubles back.
 */
function bestTransferPoint(a: DirectionFit, b: DirectionFit): TransferPoint | null {
  let best: TransferPoint | null = null;
  let bestTotalRideKm = Infinity;

  for (const coord of a.coords) {
    const vertex = turf.point(coord);
    const snapA = turf.nearestPointOnLine(a.line, vertex);
    if (snapA.properties.location! <= a.board.properties.location!) continue; // before boarding
    const snapB = turf.nearestPointOnLine(b.line, vertex);
    if (snapB.properties.location! >= b.drop.properties.location!) continue; // past the drop-off

    const gap = turf.distance(vertex, snapB);
    if (gap > MAX_TRANSFER_WALK_KM) continue;

    const partialRideAKm = turf.length(turf.lineSlice(a.board, snapA, a.line));
    const partialRideBKm = turf.length(turf.lineSlice(snapB, b.drop, b.line));
    const totalRideKm = partialRideAKm + partialRideBKm + gap;

    if (totalRideKm < bestTotalRideKm) {
      bestTotalRideKm = totalRideKm;
      best = { offA: snapA, onB: snapB, walkKm: gap };
    }
  }

  return best;
}

/** A two-jeepney itinerary (ride A, walk, ride B), or null if this pair doesn't connect the trip. */
function transferCandidate(a: DirectionFit, b: DirectionFit, directWalkKm: number): TransitCandidate | null {
  if (a.walkToBoardKm > MAX_WALK_KM || b.walkFromDropKm > MAX_WALK_KM) return null;

  const transfer = bestTransferPoint(a, b);
  if (!transfer) return null;

  const rideA = turf.lineSlice(a.board, transfer.offA, a.line);
  const rideB = turf.lineSlice(transfer.onB, b.drop, b.line);
  const rideAKm = turf.length(rideA);
  const rideBKm = turf.length(rideB);
  if (rideAKm < MIN_RIDE_KM || rideBKm < MIN_RIDE_KM) return null;

  const totalWalk = a.walkToBoardKm + transfer.walkKm + b.walkFromDropKm;

  // Reject candidates that travel far more than the direct distance would
  // require — this is what rules out "loop" trips like riding south then
  // doubling back north past the starting point.
  if (totalWalk + rideAKm + rideBKm > directWalkKm * MAX_DETOUR_MULTIPLIER) return null;

  const secondRide: TransitLeg = {
    jeepney: b.route,
    headingTowards: headingOf(b.label),
    boardingCoords: transfer.onB.geometry.coordinates,
    dropoffCoords: b.drop.geometry.coordinates,
    slicedGeometry: rideB.geometry,
    activePathCoords: b.coords,
  };

  return {
    jeepney: a.route,
    headingTowards: headingOf(a.label),
    boardingCoords: a.board.geometry.coordinates,
    dropoffCoords: transfer.offA.geometry.coordinates,
    slicedGeometry: rideA.geometry,
    walkDistanceMeters: Math.round(totalWalk * 1000),
    activePathCoords: a.coords,
    score: totalWalk * WALK_WEIGHT + rideAKm + rideBKm + TRANSFER_PENALTY,
    transfer: secondRide,
  };
}

/** Two candidates that would read the same to a commuter ("J-02", or "J-10 → J-02"). */
const displayKey = (c: TransitCandidate) =>
  c.transfer ? `transfer-${c.jeepney.routeCode}-${c.transfer.jeepney.routeCode}` : `single-${c.jeepney.routeCode}`;

/**
 * The best jeepney itineraries for a trip: direct rides and one-transfer
 * rides together, best score first, at most three, with look-alikes removed.
 */
export function findTransitRouteCandidates(originCoords: number[], destCoords: number[]): TransitCandidate[] {
  const startPoint = turf.point(originCoords);
  const endPoint = turf.point(destCoords);
  const directWalkKm = turf.distance(startPoint, endPoint);

  // Project the trip onto every route direction once.
  const fits = mockRoutes.flatMap(directionsOf).map((direction) => fitDirection(direction, startPoint, endPoint));
  const candidates: TransitCandidate[] = [];

  // 1. Direct rides.
  for (const fit of fits) {
    const candidate = singleRideCandidate(fit, directWalkKm);
    if (candidate) candidates.push(candidate);
  }

  // 2. One-transfer rides.
  // Provincial routes (Cabalan, Bataan) are excluded here: a transfer only
  // rides part of each leg, so splicing one in would offer a Cabalan- or
  // Bataan-bound jeepney for a short in-city segment that has nothing to do
  // with either place. Direct rides on those routes are unaffected.
  const transferable = fits.filter((fit) => !fit.route.isProvincial);

  for (const a of transferable) {
    for (const b of transferable) {
      if (a.route.id === b.route.id) continue;
      // Several distinct routes share the same display code (three different
      // routes are all "J-01"). A transfer between two same-coded routes
      // would read as the nonsensical "J-01 → J-01", so it isn't offered.
      if (a.route.routeCode === b.route.routeCode) continue;

      const candidate = transferCandidate(a, b, directWalkKm);
      if (candidate) candidates.push(candidate);
    }
  }

  // 3. Best first, one per display label, top three.
  candidates.sort((x, y) => x.score - y.score);

  const seen = new Set<string>();
  const unique: TransitCandidate[] = [];
  for (const candidate of candidates) {
    const key = displayKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  return unique.slice(0, MAX_CANDIDATES);
}
