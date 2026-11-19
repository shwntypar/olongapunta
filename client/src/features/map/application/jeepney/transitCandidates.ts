// =====================================================
// 🚐 JEEPNEY ITINERARY MATCHER
// =====================================================
// Jeepney routes are fixed lines, so an itinerary is found by projecting the
// trip's two ends onto each digitized route direction — not by graph search.
// Jeepneys are hail-and-ride (board/alight anywhere along the route), so the
// nearest point on the line to the actual trip coordinates is the boarding /
// alighting point.

//
// Every itinerary gets a time estimate on the same model as Mixed mode
// (walking speed, jeepney speed, waiting time — martins/neighbors.ts), with
// walking measured along real streets (../walking.ts: a river crossing
// means going round by the bridge), and is only offered if riding is
// actually worth it compared with what the rider could do instead:
//   1. the itinerary must beat walking the whole trip by TRIP_MIN_SAVING_MIN
//      (no walking 1.2 km to ride a short way);
//   2. a transfer must beat both of its one-ride alternatives — "ride the
//      first jeepney, walk the rest" and "walk to the second jeepney, ride
//      it" — by EXTRA_RIDE_MIN_SAVING_MIN (no hopping on for a few hundred
//      metres over a bridge);
//   3. a transfer must also beat the best direct ride by that much — each
//      extra ride (and fare) has to buy real time.

import * as turf from "@turf/turf";
import { mockRoutes, type JeepneyRoute } from "../../domain/MockData";
import { routePath } from "../../domain/routeGeometry";
import type { TransitCandidate, TransitLeg } from "../../domain/types";
import { EXTRA_RIDE_MIN_SAVING_MIN } from "../martins/curation";
import { JEEP_BOARD_WAIT_MINUTES, JEEP_SPEED_KMH, WALK_SPEED_KMH } from "../martins/neighbors";
import { closedRouteIds, expectedWaitMinutes } from "./serviceRules";
import { getDistanceMeters } from "../geo";
import { headingOf, sampleStops } from "../martins/jeepneyLayer";
import { snapToRoad, STREET_DETOUR, walkingFrom, type RoadSnap, type WalkingField } from "../walking";

const MAX_WALK_KM = 1.5; // total walking to reach and leave the jeepney network
const MAX_TRANSFER_WALK_KM = 0.5; // walking between two jeepneys
const MAX_DETOUR_MULTIPLIER = 3; // travel can't exceed 3x the straight-line distance
const MAX_CANDIDATES = 3;
/** Never suggest boarding for less than this. */
const MIN_RIDE_KM = 0.3;
/** When nothing beats walking, a direct jeepney at most this much slower is still offered… */
const ABOUT_AS_FAST_MIN = 3;
/** …if it cuts the walking by at least this share. */
const MIN_WALK_CUT = 1 / 3;
/**
 * A trip that beats walking by less than this is a "short trip": a direct
 * jeepney is still offered (riders take one for the heat or bags), with a note
 * saying how long the walk is. A transfer must always beat walking by this much.
 */
export const TRIP_MIN_SAVING_MIN = 5;

/** Minutes on foot for a street distance in km. */
const walkMinutes = (km: number) => (km / WALK_SPEED_KMH) * 60;
/** Waiting (this route's expected wait — serviceRules.ts) plus riding. */
const rideMinutes = (route: JeepneyRoute, rideKm: number) => expectedWaitMinutes(route) + (rideKm / JEEP_SPEED_KMH) * 60;
const tripMinutes = (walkKm: number, rides: [JeepneyRoute, number][]) => walkMinutes(walkKm) + rides.reduce((m, [route, km]) => m + rideMinutes(route, km), 0);

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

/** Forward and return directions of a route, along the roads (domain/routeGeometry.ts). */
function directionsOf(route: JeepneyRoute): RouteDirection[] {
  const directions: RouteDirection[] = [];
  const fwd = routePath(route, "fwd");
  if (fwd) directions.push({ route, coords: fwd, label: route.routeName });
  const rev = routePath(route, "rev");
  if (rev) directions.push({ route, coords: rev, label: route.reversedName });
  return directions;
}

// ---- Precomputed once per route direction (routes are static data) ----

/** A point every SAMPLE_SPACING_KM along a direction, with its distance from the start. */
interface Sample {
  coords: [number, number];
  alongKm: number;
  /** Nearest road node, for walking distances (fixed, so found once). */
  road: RoadSnap;
}

interface PreparedDirection extends RouteDirection {
  line: Line;
  samples: Sample[];
  /** Samples bucketed on a lon/lat grid, for "which samples are near this point". */
  grid: Map<number, Sample[]>;
}

const SAMPLE_SPACING_KM = 0.05;
const GRID_DEG = 0.005; // ~550 m — larger than any transfer walk
const cellId = (cx: number, cy: number) => cx * 1_000_000 + cy;
const cellOf = (lon: number, lat: number) => cellId(Math.floor(lon / GRID_DEG), Math.floor(lat / GRID_DEG));

/** Fast flat-earth distance in km — accurate to well under 1% over the few hundred metres it is used for. */
function nearKm(a: number[], b: number[]): number {
  const dx = (b[0] - a[0]) * 111.32 * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  const dy = (b[1] - a[1]) * 110.574;
  return Math.sqrt(dx * dx + dy * dy);
}

function prepare(direction: RouteDirection): PreparedDirection {
  const { stops } = sampleStops(direction.coords as [number, number][], SAMPLE_SPACING_KM);
  const samples: Sample[] = [];
  let along = 0;
  stops.forEach((coords, i) => {
    if (i > 0) along += getDistanceMeters(stops[i - 1], coords) / 1000;
    samples.push({ coords, alongKm: along, road: snapToRoad(coords) });
  });
  const grid = new Map<number, Sample[]>();
  for (const sample of samples) {
    const key = cellOf(sample.coords[0], sample.coords[1]);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(sample);
  }
  return { ...direction, line: turf.lineString(direction.coords), samples, grid };
}

let preparedDirections: PreparedDirection[] | null = null;
const allDirections = () => (preparedDirections ??= mockRoutes.flatMap(directionsOf).map(prepare));


/** A route direction with the trip's two ends already projected onto it. */
interface DirectionFit extends PreparedDirection {
  /** Nearest point on the line to the trip's origin, and the walk (along streets) to reach it. */
  board: SnappedPoint;
  walkToBoardKm: number;
  /** Nearest point on the line to the trip's destination, and the walk (along streets) from it. */
  drop: SnappedPoint;
  walkFromDropKm: number;
}

/** Street walking from the trip's origin and to its destination (the graph is two-way, so "from the destination" = "to it"). */
interface TripWalks {
  fromOrigin: WalkingField;
  toDestination: WalkingField;
  /** The whole trip on foot, km. */
  wholeTripKm: number;
}

/**
 * Where to get on (or off) this line: the spot quickest to WALK to from
 * `anchor`, not merely the closest in a straight line — across a river the
 * closest spot can be the far bank. Starts from the straight-line nearest
 * point, then checks spots along the line that could possibly be shorter.
 */
function bestAccessPoint(direction: PreparedDirection, anchor: Point, walking: WalkingField): { point: SnappedPoint; walkKm: number } {
  const line = direction.line;
  const nearest = turf.nearestPointOnLine(line, anchor);
  let best: { coords: number[]; walkKm: number } = { coords: nearest.geometry.coordinates, walkKm: walking.kmTo(nearest.geometry.coordinates) };
  let improved = false;
  const anchorCoords = anchor.geometry.coordinates;
  for (const { coords: spot, road } of direction.samples) {
    if (nearKm(anchorCoords, spot) >= best.walkKm) continue; // a street walk is never shorter than the straight line
    const walkKm = walking.kmToSnapped(spot, road);
    if (walkKm < best.walkKm - 0.01) {
      best = { coords: spot, walkKm };
      improved = true;
    }
  }
  return { point: improved ? turf.nearestPointOnLine(line, turf.point(best.coords)) : nearest, walkKm: best.walkKm };
}

function fitDirection(direction: PreparedDirection, startPoint: Point, endPoint: Point, walks: TripWalks): DirectionFit {
  const board = bestAccessPoint(direction, startPoint, walks.fromOrigin);
  const drop = bestAccessPoint(direction, endPoint, walks.toDestination);
  return { ...direction, board: board.point, walkToBoardKm: board.walkKm, drop: drop.point, walkFromDropKm: drop.walkKm };
}

/** A single jeepney ride covering the whole trip, or null if this direction doesn't fit. */
function singleRideCandidate(fit: DirectionFit, directKm: number, wholeTripWalkKm: number): TransitCandidate | null {
  // The route must travel from the boarding point towards the drop-off, not away from it.
  if (fit.board.properties.location! >= fit.drop.properties.location!) return null;

  const totalWalk = fit.walkToBoardKm + fit.walkFromDropKm;
  // Distance along the line between the two points (cheap); the geometry is only cut for rides that pass.
  const rideDistanceKm = fit.drop.properties.location! - fit.board.properties.location!;

  if (rideDistanceKm > directKm * MAX_DETOUR_MULTIPLIER) return null;
  if (!(totalWalk < MAX_WALK_KM && totalWalk < wholeTripWalkKm && rideDistanceKm >= MIN_RIDE_KM)) return null;

  const riddenPath = turf.lineSlice(fit.board, fit.drop, fit.line);
  const candidate: TransitCandidate = {
    jeepney: fit.route,
    headingTowards: headingOf(fit.label),
    boardingCoords: fit.board.geometry.coordinates,
    dropoffCoords: fit.drop.geometry.coordinates,
    slicedGeometry: riddenPath.geometry,
    walkDistanceMeters: Math.round(totalWalk * 1000),
    activePathCoords: fit.coords,
    minutes: tripMinutes(totalWalk, [[fit.route, rideDistanceKm]]),
  };
  // Walking more than you ride (e.g. 1.2 km on foot for a few hundred metres of jeepney) — see "Worth it?" below.
  if (totalWalk > rideDistanceKm) walkHeavy.add(candidate);
  return candidate;
}

/** Direct rides that walk further than they ride: only ever offered as an "about as fast as walking" fallback. */
const walkHeavy = new WeakSet<TransitCandidate>();

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
function bestTransferPoint(a: DirectionFit, b: DirectionFit, maxRideAKm: number): TransferPoint | null {
  const boardAt = a.board.properties.location!;
  const dropAt = b.drop.properties.location!;
  const maxGapKm = MAX_TRANSFER_WALK_KM / STREET_DETOUR; // straight-line limit for the walk between the lines
  let best: { off: Sample; on: Sample; gapKm: number; totalKm: number } | null = null;

  // Precomputed samples and grid: only B's samples near each A sample are compared, with plain arithmetic.
  for (const off of a.samples) {
    if (off.alongKm <= boardAt) continue; // before boarding
    if (off.alongKm - boardAt > maxRideAKm) break; // riding A any further would break the detour limit anyway
    const cx = Math.floor(off.coords[0] / GRID_DEG);
    const cy = Math.floor(off.coords[1] / GRID_DEG);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const on of b.grid.get(cellId(cx + dx, cy + dy)) ?? []) {
          if (on.alongKm >= dropAt) continue; // past the drop-off
          const straight = nearKm(off.coords, on.coords);
          if (straight > maxGapKm) continue;
          const gapKm = straight * STREET_DETOUR; // short hop between two lines: straight line × street factor
          const totalKm = off.alongKm - boardAt + (dropAt - on.alongKm) + gapKm;
          if (!best || totalKm < best.totalKm) best = { off, on, gapKm, totalKm };
        }
      }
    }
  }
  if (!best) return null;
  return {
    offA: turf.nearestPointOnLine(a.line, turf.point(best.off.coords)),
    onB: turf.nearestPointOnLine(b.line, turf.point(best.on.coords)),
    walkKm: best.gapKm,
  };
}

/** A two-jeepney itinerary (ride A, walk, ride B), or null if this pair doesn't connect the trip. */
function transferCandidate(a: DirectionFit, b: DirectionFit, directKm: number, walks: TripWalks): TransitCandidate | null {
  // Same walking limit as a single ride: skip the pair before any geometry work.
  if (a.walkToBoardKm + b.walkFromDropKm >= MAX_WALK_KM) return null;

  const transfer = bestTransferPoint(a, b, directKm * MAX_DETOUR_MULTIPLIER);
  if (!transfer) return null;

  // Distances along each line (cheap); the geometry is only cut for transfers that pass every check.
  const rideAKm = transfer.offA.properties.location! - a.board.properties.location!;
  const rideBKm = b.drop.properties.location! - transfer.onB.properties.location!;
  if (rideAKm < MIN_RIDE_KM || rideBKm < MIN_RIDE_KM) return null;

  const totalWalk = a.walkToBoardKm + transfer.walkKm + b.walkFromDropKm;

  // Reject candidates that travel far more than the direct distance would
  // require — this is what rules out "loop" trips like riding south then
  // doubling back north past the starting point.
  if (totalWalk + rideAKm + rideBKm > directKm * MAX_DETOUR_MULTIPLIER) return null;

  // Each of the two rides has to earn its fare: the pair must clearly beat
  // riding just one of them and walking the rest of the way.
  const minutes = tripMinutes(totalWalk, [
    [a.route, rideAKm],
    [b.route, rideBKm],
  ]);
  const onlyFirst = tripMinutes(a.walkToBoardKm + walks.toDestination.kmTo(transfer.offA.geometry.coordinates), [[a.route, rideAKm]]);
  const onlySecond = tripMinutes(walks.fromOrigin.kmTo(transfer.onB.geometry.coordinates) + b.walkFromDropKm, [[b.route, rideBKm]]);
  if (minutes > Math.min(onlyFirst, onlySecond) - EXTRA_RIDE_MIN_SAVING_MIN) return null;

  const rideA = turf.lineSlice(a.board, transfer.offA, a.line);
  const rideB = turf.lineSlice(transfer.onB, b.drop, b.line);

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
    minutes,
    transfer: secondRide,
  };
}

/** Two candidates that would read the same to a commuter ("J-02", or "J-10 → J-02"). */
const displayKey = (c: TransitCandidate) =>
  c.transfer ? `transfer-${c.jeepney.routeCode}-${c.transfer.jeepney.routeCode}` : `single-${c.jeepney.routeCode}`;

export interface TransitPlan {
  /** Fastest first, at most three. */
  candidates: TransitCandidate[];
  /** Minutes to walk the whole trip (same estimate the rules compare against). */
  walkMinutes: number;
  /**
   * No jeepney beats walking by TRIP_MIN_SAVING_MIN: `candidates` (if any)
   * only save a little, and the panel says how long the walk is.
   */
  walkingIsBetter: boolean;
  /** Routes that would give a direct ride for this trip but aren't running at this hour (serviceRules.ts). */
  notRunning: JeepneyRoute[];
  /** Running routes that serve the trip but lose to walking because of their long wait (few units — serviceRules.ts). */
  longWait: JeepneyRoute[];
}

/**
 * The jeepney itineraries worth taking for a trip: direct rides and, when
 * they earn it, one-transfer rides — fastest first, at most three, with
 * look-alikes removed.
 */
let lastPlan: { key: string; plan: TransitPlan } | null = null;

/**
 * `at`: plan for this time of day (routes outside their service hours are
 * left out). `null` ignores service hours — the thesis scripts use that so
 * results don't depend on when they run.
 */
export function planTransitTrip(originCoords: number[], destCoords: number[], at: Date | null = new Date()): TransitPlan {
  // The plan depends only on the trip and which routes are running: switching travel modes asks again for the same one.
  const closed = closedRouteIds(mockRoutes, at);
  const key = [...originCoords, ...destCoords].map((v) => v.toFixed(6)).join(",") + `|${[...closed].join(",")}`;
  if (lastPlan?.key === key) return lastPlan.plan;
  const plan = computeTransitPlan(originCoords, destCoords, closed);
  lastPlan = { key, plan };
  return plan;
}

function computeTransitPlan(originCoords: number[], destCoords: number[], closed: Set<string>): TransitPlan {
  const startPoint = turf.point(originCoords);
  const endPoint = turf.point(destCoords);
  /** Straight-line trip length — only for the detour cap. */
  const directKm = turf.distance(startPoint, endPoint);
  const fromOrigin = walkingFrom(originCoords);
  const walks: TripWalks = { fromOrigin, toDestination: walkingFrom(destCoords), wholeTripKm: fromOrigin.kmTo(destCoords) };

  // Project the trip onto every route direction once — only routes running now.
  const fits = allDirections()
    .filter((direction) => !closed.has(direction.route.id))
    .map((direction) => fitDirection(direction, startPoint, endPoint, walks));
  const candidates: TransitCandidate[] = [];

  // Routes that are off at this hour but would have served the trip directly — so the panel can say so.
  const notRunning = [
    ...new Set(
      allDirections()
        .filter((direction) => closed.has(direction.route.id))
        .filter((direction) => singleRideCandidate(fitDirection(direction, startPoint, endPoint, walks), directKm, walks.wholeTripKm))
        .map((direction) => direction.route)
    ),
  ];

  // 1. Direct rides.
  for (const fit of fits) {
    const candidate = singleRideCandidate(fit, directKm, walks.wholeTripKm);
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

      const candidate = transferCandidate(a, b, directKm, walks);
      if (candidate) candidates.push(candidate);
    }
  }

  // 3. Worth it?
  //    A direct ride: faster than walking at all (if only a little, the panel says how long the walk is),
  //      riding at least as far as you walk.
  //    A transfer: clearly faster than walking AND than the best direct ride — two fares must buy real time.
  //    If nothing qualifies: a direct ride about as fast as walking that cuts the walking a lot (below).
  const walkAllMinutes = walkMinutes(walks.wholeTripKm);
  const direct = candidates.filter((c) => !c.transfer && c.minutes < walkAllMinutes && !walkHeavy.has(c));
  const bestDirect = Math.min(...direct.map((c) => c.minutes));
  const transfers = candidates.filter(
    (c) => c.transfer && c.minutes <= walkAllMinutes - TRIP_MIN_SAVING_MIN && c.minutes <= bestDirect - EXTRA_RIDE_MIN_SAVING_MIN
  );
  let worthIt = [...direct, ...transfers];
  if (worthIt.length === 0) {
    // Nothing beats walking. Still offer a direct jeepney that is about as fast and spares a good part of
    // the walk (riders take one for the heat) — the panel notes how long walking all the way takes.
    worthIt = candidates.filter(
      (c) =>
        !c.transfer &&
        c.minutes <= walkAllMinutes + ABOUT_AS_FAST_MIN &&
        c.walkDistanceMeters / 1000 <= walks.wholeTripKm * (1 - MIN_WALK_CUT)
    );
  }
  // A direct ride that only lost to walking because its route has few units (long wait).
  const longWait = [
    ...new Set(
      candidates
        .filter((c) => !c.transfer && c.minutes >= walkAllMinutes && expectedWaitMinutes(c.jeepney) > JEEP_BOARD_WAIT_MINUTES)
        .filter((c) => c.minutes - expectedWaitMinutes(c.jeepney) + JEEP_BOARD_WAIT_MINUTES < walkAllMinutes)
        .map((c) => c.jeepney)
    ),
  ];
  const walkingIsBetter = candidates.length > 0 && !worthIt.some((c) => c.minutes <= walkAllMinutes - TRIP_MIN_SAVING_MIN);

  // 4. Fastest first (then cheapest), one per display label, top three.
  const fare = (c: TransitCandidate) => c.jeepney.baseFare + (c.transfer?.jeepney.baseFare ?? 0);
  worthIt.sort((x, y) => x.minutes - y.minutes || fare(x) - fare(y));

  const seen = new Set<string>();
  const unique: TransitCandidate[] = [];
  for (const candidate of worthIt) {
    const key = displayKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  return {
    candidates: unique.slice(0, MAX_CANDIDATES),
    walkMinutes: walkAllMinutes,
    walkingIsBetter,
    notRunning,
    longWait,
  };
}

/**
 * Routes that would give a direct ride for this trip but aren't running at
 * `at` (service hours — serviceRules.ts), so the panel can say so ("J-01
 * (GREEN) would serve this trip but runs 6–9 AM only"). Cheap: only the
 * closed routes are fitted.
 */
export function routesNotRunning(originCoords: number[], destCoords: number[], at: Date): JeepneyRoute[] {
  const closed = closedRouteIds(mockRoutes, at);
  if (closed.size === 0) return [];
  const startPoint = turf.point(originCoords);
  const endPoint = turf.point(destCoords);
  const directKm = turf.distance(startPoint, endPoint);
  const fromOrigin = walkingFrom(originCoords);
  const walks: TripWalks = { fromOrigin, toDestination: walkingFrom(destCoords), wholeTripKm: fromOrigin.kmTo(destCoords) };
  const serving = allDirections()
    .filter((direction) => closed.has(direction.route.id))
    .filter((direction) => singleRideCandidate(fitDirection(direction, startPoint, endPoint, walks), directKm, walks.wholeTripKm));
  return [...new Set(serving.map((direction) => direction.route))];
}

/** Just the itineraries, ignoring service hours (see planTransitTrip) — what the thesis scripts evaluate. */
export function findTransitRouteCandidates(originCoords: number[], destCoords: number[]): TransitCandidate[] {
  return planTransitTrip(originCoords, destCoords, null).candidates;
}
