import * as turf from '@turf/turf';
import { tricycleZones, TricycleZone } from '../domain/TricycleZoneData';

// =====================================================
// 🛺 TRICYCLE ZONE ROUTING ENGINE
// =====================================================
// Unlike jeepney routes (fixed polylines), a tricycle zone is an *open* area —
// any road inside the polygon is fair game for a roaming tricycle. So instead
// of snapping onto a line, we snap onto the zone's boundary (the "curb" a
// tricycle can meet you at) and let Mapbox's own road-snapping handle the rest.

export interface TricycleLeg {
  zone: TricycleZone;
  pickupCoords: number[];
  dropoffCoords: number[];
}

export interface TricyclePlan {
  legs: TricycleLeg[]; // length 1 (direct/entry/exit) or 2 (cross-zone transfer)
  score: number; // lower is better — same walk-penalized-km style as the jeepney engine
}

const MAX_CROSS_ZONE_GAP_KM = 0.4; // zones farther apart than this can't hand off directly
const ENTRY_INSET_KM = 0.02; // ~20m
const MAX_WALK_TO_ZONE_KM = 1.5; // beyond this, walking the whole trip beats waiting for a tricycle — same cap as jeepney's MAX_WALK

const zonesContaining = (coords: number[]): TricycleZone[] => {
  const pt = turf.point(coords);
  return tricycleZones.filter((zone) => {
    try {
      return turf.booleanPointInPolygon(pt, zone.polygon);
    } catch {
      return false;
    }
  });
};

// A zone's polygon is often hand-drawn along the perimeter road that bounds
// it — so the raw boundary line often *is* that road. Snapping entry/exit
// points onto it as-is means a tricycle "picks you up" right on the avenue.
// Buffering the polygon inward a little before snapping moves those points
// onto the first interior street instead, which is what a tricycle actually does.
const insetBoundaryLines = (zone: TricycleZone) => {
  let source: any = zone.polygon;
  try {
    const inset = turf.buffer(zone.polygon, -ENTRY_INSET_KM, { units: 'kilometers' });
    if (inset?.geometry) source = inset.geometry;
  } catch {
    // Zone too small/thin to buffer inward — fall back to the raw boundary.
  }

  const boundary = turf.polygonToLine(source) as any;
  return boundary.type === 'FeatureCollection' ? boundary.features : [boundary];
};

// Nearest point on a zone's (inset) boundary to a given coordinate — used both
// as a "walk-in entry point" (when approaching the zone) and an "exit point"
// (when leaving it towards somewhere outside).
const nearestBoundaryPoint = (coords: number[], zone: TricycleZone) => {
  const lines = insetBoundaryLines(zone);

  let bestCoords: number[] | null = null;
  let bestDist = Infinity;

  for (const line of lines) {
    const snap = turf.nearestPointOnLine(line, turf.point(coords));
    const dist = snap.properties.dist as number;
    if (dist < bestDist) {
      bestDist = dist;
      bestCoords = snap.geometry.coordinates as number[];
    }
  }

  return { coords: bestCoords as number[], distanceKm: bestDist };
};

// Closest pair of (inset) boundary points between two zones — the handoff
// point for a cross-zone transfer (near-zero distance when the zones actually border).
const nearestZoneBoundaryPair = (zoneA: TricycleZone, zoneB: TricycleZone) => {
  const featsA = insetBoundaryLines(zoneA);
  const featsB = insetBoundaryLines(zoneB);

  let pointA: number[] | null = null;
  let pointB: number[] | null = null;
  let bestDist = Infinity;

  for (const featA of featsA) {
    const coordsA = (featA.geometry as any).coordinates as number[][];
    for (const coord of coordsA) {
      const vertex = turf.point(coord);
      for (const featB of featsB) {
        const snap = turf.nearestPointOnLine(featB, vertex);
        const dist = snap.properties.dist as number;
        if (dist < bestDist) {
          bestDist = dist;
          pointA = coord;
          pointB = snap.geometry.coordinates as number[];
        }
      }
    }
  }

  return pointA && pointB ? { pointA, pointB, distanceKm: bestDist } : null;
};

const candidateKey = (plan: { legs: TricycleLeg[] }) =>
  plan.legs.length === 2
    ? `transfer-${plan.legs[0].zone.code}-${plan.legs[1].zone.code}`
    : `single-${plan.legs[0].zone.code}`;

/**
 * Returns every viable tricycle plan for this trip, best first (lowest score),
 * deduplicated by zone combination, capped to the top 3 — mirroring
 * findTransitRouteCandidates so both modes offer the same "alternatives" UX.
 */
export const findTricycleRouteCandidates = (originCoords: number[], destCoords: number[]): TricyclePlan[] => {
  if (tricycleZones.length === 0) return [];

  const originZones = zonesContaining(originCoords);
  const destZones = zonesContaining(destCoords);
  const candidates: TricyclePlan[] = [];

  // Case 1: a zone covers both points — direct ride, no walking needed.
  // (Collect one candidate per overlapping zone, in case more than one TODA serves the area.)
  const sharedZones = originZones.filter((z) => destZones.some((dz) => dz.id === z.id));
  for (const zone of sharedZones) {
    const score = turf.distance(turf.point(originCoords), turf.point(destCoords));
    candidates.push({ legs: [{ zone, pickupCoords: originCoords, dropoffCoords: destCoords }], score });
  }

  // Case 2: origin and destination are each inside a (different) zone —
  // ride to the nearest shared boundary, hand off, ride the rest.
  if (candidates.length === 0 && originZones.length > 0 && destZones.length > 0) {
    for (const zA of originZones) {
      for (const zB of destZones) {
        const pair = nearestZoneBoundaryPair(zA, zB);
        if (!pair || pair.distanceKm > MAX_CROSS_ZONE_GAP_KM) continue;

        const rideAKm = turf.distance(turf.point(originCoords), turf.point(pair.pointA));
        const rideBKm = turf.distance(turf.point(pair.pointB), turf.point(destCoords));
        const score = rideAKm + rideBKm + pair.distanceKm * 3;

        candidates.push({
          score,
          legs: [
            { zone: zA, pickupCoords: originCoords, dropoffCoords: pair.pointA },
            { zone: zB, pickupCoords: pair.pointB, dropoffCoords: destCoords },
          ],
        });
      }
    }
  }

  // Case 3: only the destination is inside a zone(s) — walk to the nearest
  // entry point, ride from there. One candidate per candidate zone.
  if (candidates.length === 0 && destZones.length > 0) {
    for (const zone of destZones) {
      const entry = nearestBoundaryPoint(originCoords, zone);
      if (entry.distanceKm > MAX_WALK_TO_ZONE_KM) continue;
      const score = entry.distanceKm * 3 + turf.distance(turf.point(entry.coords), turf.point(destCoords));
      candidates.push({ legs: [{ zone, pickupCoords: entry.coords, dropoffCoords: destCoords }], score });
    }
  }

  // Case 4: only the origin is inside a zone(s) — ride to the nearest exit
  // point, walk the rest of the way. One candidate per candidate zone.
  if (candidates.length === 0 && originZones.length > 0) {
    for (const zone of originZones) {
      const exit = nearestBoundaryPoint(destCoords, zone);
      if (exit.distanceKm > MAX_WALK_TO_ZONE_KM) continue;
      const score = turf.distance(turf.point(originCoords), turf.point(exit.coords)) + exit.distanceKm * 3;
      candidates.push({ legs: [{ zone, pickupCoords: originCoords, dropoffCoords: exit.coords }], score });
    }
  }

  // Case 5 (neither point near any zone): candidates stays empty — no tricycle option.

  const seenKeys = new Set<string>();
  const unique: TricyclePlan[] = [];

  candidates.sort((a, b) => a.score - b.score);
  for (const c of candidates) {
    const key = candidateKey(c);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      unique.push(c);
    }
  }

  return unique.slice(0, 3);
};
