import * as turf from '@turf/turf';
import { mockRoutes } from '../domain/MockData';

// =====================================================
// 📏 HAVERSINE DISTANCE
// =====================================================

export const getDistanceMeters = (coord1: number[], coord2: number[]) => {
  const R = 6371e3;
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// =====================================================
// 🗺️ MAPBOX ROAD-SNAPPING
// =====================================================

export const fetchExactJeepneyPath = async (pathCoordinates: number[][]) => {
  if (!pathCoordinates || pathCoordinates.length < 2) return null;

  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const coordinateString = pathCoordinates
      .map(coord => `${coord[0]},${coord[1]}`)
      .join(';');

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinateString}?alternatives=false&continue_straight=true&geometries=geojson&overview=full&access_token=${token}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      console.warn("Mapbox rejected the full route. Falling back to straight lines.");
      return null; 
    }

    return await response.json();
    
  } catch (error) {
    console.error("Error fetching exact jeepney path:", error);
    return null;
  }
};

// =====================================================
// 🚐 SINGLE-HOP JEEPNEY ROUTING ENGINE
// =====================================================

export const findBestJeepneyRoute = (originCoords: number[], destCoords: number[]) => {
  const startPoint = turf.point(originCoords);
  const endPoint = turf.point(destCoords);
  const directWalkKm = turf.distance(startPoint, endPoint);

  let bestRoute: any = null;
  let bestScore = Infinity; 

  const evaluatePath = (route: any, pathCoords: number[][], directionName: string) => {
    if (!pathCoords || pathCoords.length < 2) return;

    const jeepneyLine = turf.lineString(pathCoords);
    const boardingPoint = turf.nearestPointOnLine(jeepneyLine, startPoint);
    const dropoffPoint = turf.nearestPointOnLine(jeepneyLine, endPoint);

    if (boardingPoint.properties.location! >= dropoffPoint.properties.location!) {
      return; 
    }

    const walkToBoardKm = turf.distance(startPoint, boardingPoint);
    const walkFromDropKm = turf.distance(dropoffPoint, endPoint);
    const totalWalk = walkToBoardKm + walkFromDropKm;

    const riddenPath = turf.lineSlice(boardingPoint, dropoffPoint, jeepneyLine);
    const rideDistanceKm = turf.length(riddenPath);

    if (rideDistanceKm > directWalkKm * 3) {
      return; 
    }

    const tripScore = (totalWalk * 3) + rideDistanceKm;

    if (totalWalk < 1.5 && rideDistanceKm > 0.15 && totalWalk < directWalkKm) {
      if (tripScore < bestScore) {
        bestScore = tripScore;
        
        bestRoute = {
          jeepney: route,
          headingTowards: directionName.split(' to ')[1] || directionName, 
          boardingCoords: boardingPoint.geometry.coordinates,
          dropoffCoords: dropoffPoint.geometry.coordinates,
          slicedGeometry: riddenPath.geometry, 
          walkDistanceMeters: Math.round(totalWalk * 1000),
          activePathCoords: pathCoords 
        };
      }
    }
  };

  mockRoutes.forEach(route => {
    if (route.path) {
      evaluatePath(route, route.path, route.routeName);
    }
    const revPath = route.returnPath || (route.path ? [...route.path].reverse() : null);
    if (revPath) {
      evaluatePath(route, revPath, route.reversedName);
    }
  });

  return bestRoute;
};

// =====================================================
// 🔄 MULTI-HOP (2-JEEPNEY TRANSFER) ROUTING ENGINE
// =====================================================

export const findTransferRoute = (originCoords: number[], destCoords: number[]) => {
  const startPoint = turf.point(originCoords);
  const endPoint = turf.point(destCoords);

  const MAX_WALK = 1.5;
  const MAX_TRANSFER_WALK = 0.5;
  const TRANSFER_PENALTY = 0.5;

  let bestPlan: any = null;
  let bestScore = Infinity;

  const directions: { route: any; coords: number[][]; label: string }[] = [];

  for (const route of mockRoutes) {
    if (route.path && route.path.length >= 2) {
      directions.push({
        route,
        coords: route.path,
        label: route.routeName,
      });
    }

    const rev = route.returnPath || (route.path ? [...route.path].reverse() : null);
    if (rev && rev.length >= 2) {
      directions.push({
        route,
        coords: rev,
        label: route.reversedName,
      });
    }
  }

  for (let i = 0; i < directions.length; i++) {
    const a = directions[i];
    const lineA = turf.lineString(a.coords);
    const boardA = turf.nearestPointOnLine(lineA, startPoint);
    const walkToA = turf.distance(startPoint, boardA);
    if (walkToA > MAX_WALK) continue;

    for (let j = 0; j < directions.length; j++) {
      if (a.route.id === directions[j].route.id) continue;

      const b = directions[j];
      const lineB = turf.lineString(b.coords);
      const dropB = turf.nearestPointOnLine(lineB, endPoint);
      const walkFromB = turf.distance(dropB, endPoint);
      if (walkFromB > MAX_WALK) continue;

      let transferOffA: any = null;
      let transferOnB: any = null;
      let transferDist = Infinity;

      for (const coord of a.coords) {
        const vertex = turf.point(coord);
        const snapA = turf.nearestPointOnLine(lineA, vertex);
        if (snapA.properties.location! <= boardA.properties.location!) continue;
        const snapB = turf.nearestPointOnLine(lineB, vertex);
        if (snapB.properties.location! >= dropB.properties.location!) continue;

        const gap = turf.distance(vertex, snapB);
        if (gap < transferDist) {
          transferDist = gap;
          transferOffA = snapA;
          transferOnB = snapB;
        }
      }

      if (!transferOffA || transferDist > MAX_TRANSFER_WALK) continue;

      const rideA = turf.lineSlice(boardA, transferOffA, lineA);
      const rideB = turf.lineSlice(transferOnB, dropB, lineB);
      const rideAKm = turf.length(rideA);
      const rideBKm = turf.length(rideB);

      if (rideAKm < 0.15 || rideBKm < 0.15) continue;

      const totalWalk = walkToA + transferDist + walkFromB;
      const score = (totalWalk * 3) + rideAKm + rideBKm + TRANSFER_PENALTY;

      if (score < bestScore) {
        bestScore = score;
        bestPlan = {
          jeepney: a.route,
          headingTowards: a.label.split(' to ')[1] || a.label,
          boardingCoords: boardA.geometry.coordinates,
          dropoffCoords: transferOffA.geometry.coordinates,
          slicedGeometry: rideA.geometry,
          walkDistanceMeters: Math.round(totalWalk * 1000),
          activePathCoords: a.coords,
          transfer: {
            jeepney: b.route,
            headingTowards: b.label.split(' to ')[1] || b.label,
            boardingCoords: transferOnB.geometry.coordinates,
            dropoffCoords: dropB.geometry.coordinates,
            slicedGeometry: rideB.geometry,
            activePathCoords: b.coords,
          },
        };
      }
    }
  }

  return bestPlan;
};

// =====================================================
// 🚂 NEW: TRANSIT ROUTE CANDIDATE GENERATOR (TOP 3)
// =====================================================

export const findTransitRouteCandidates = (originCoords: number[], destCoords: number[]): any[] => {
  const startPoint = turf.point(originCoords);
  const endPoint = turf.point(destCoords);
  const directWalkKm = turf.distance(startPoint, endPoint);

  const MAX_WALK = 1.5;          // km
  const MAX_TRANSFER_WALK = 0.5; // km
  const TRANSFER_PENALTY = 0.5;

  const candidates: any[] = [];

  // 1. Gather Single Hop Candidates
  const evaluateSinglePath = (route: any, pathCoords: number[][], directionName: string) => {
    if (!pathCoords || pathCoords.length < 2) return;

    const jeepneyLine = turf.lineString(pathCoords);
    const boardingPoint = turf.nearestPointOnLine(jeepneyLine, startPoint);
    const dropoffPoint = turf.nearestPointOnLine(jeepneyLine, endPoint);

    if (boardingPoint.properties.location! >= dropoffPoint.properties.location!) return;

    const walkToBoardKm = turf.distance(startPoint, boardingPoint);
    const walkFromDropKm = turf.distance(dropoffPoint, endPoint);
    const totalWalk = walkToBoardKm + walkFromDropKm;

    const riddenPath = turf.lineSlice(boardingPoint, dropoffPoint, jeepneyLine);
    const rideDistanceKm = turf.length(riddenPath);

    if (rideDistanceKm > directWalkKm * 3) return;

    const score = (totalWalk * 3) + rideDistanceKm;

    if (totalWalk < MAX_WALK && rideDistanceKm > 0.15 && totalWalk < directWalkKm) {
      candidates.push({
        jeepney: route,
        headingTowards: directionName.split(' to ')[1] || directionName, 
        boardingCoords: boardingPoint.geometry.coordinates,
        dropoffCoords: dropoffPoint.geometry.coordinates,
        slicedGeometry: riddenPath.geometry, 
        walkDistanceMeters: Math.round(totalWalk * 1000),
        activePathCoords: pathCoords,
        score
      });
    }
  };

  mockRoutes.forEach(route => {
    if (route.path) evaluateSinglePath(route, route.path, route.routeName);
    const revPath = route.returnPath || (route.path ? [...route.path].reverse() : null);
    if (revPath) evaluateSinglePath(route, revPath, route.reversedName);
  });

  // 2. Gather Multi-Hop Candidates
  const directions: { route: any; coords: number[][]; label: string }[] = [];
  for (const route of mockRoutes) {
    if (route.path && route.path.length >= 2) {
      directions.push({ route, coords: route.path, label: route.routeName });
    }
    const rev = route.returnPath || (route.path ? [...route.path].reverse() : null);
    if (rev && rev.length >= 2) {
      directions.push({ route, coords: rev, label: route.reversedName });
    }
  }

  for (let i = 0; i < directions.length; i++) {
    const a = directions[i];
    const lineA = turf.lineString(a.coords);
    const boardA = turf.nearestPointOnLine(lineA, startPoint);
    const walkToA = turf.distance(startPoint, boardA);
    if (walkToA > MAX_WALK) continue;

    for (let j = 0; j < directions.length; j++) {
      if (a.route.id === directions[j].route.id) continue;

      const b = directions[j];
      const lineB = turf.lineString(b.coords);
      const dropB = turf.nearestPointOnLine(lineB, endPoint);
      const walkFromB = turf.distance(dropB, endPoint);
      if (walkFromB > MAX_WALK) continue;

      let transferOffA: any = null;
      let transferOnB: any = null;
      let transferDist = Infinity;

      for (const coord of a.coords) {
        const vertex = turf.point(coord);
        const snapA = turf.nearestPointOnLine(lineA, vertex);
        if (snapA.properties.location! <= boardA.properties.location!) continue;
        const snapB = turf.nearestPointOnLine(lineB, vertex);
        if (snapB.properties.location! >= dropB.properties.location!) continue;

        const gap = turf.distance(vertex, snapB);
        if (gap < transferDist) {
          transferDist = gap;
          transferOffA = snapA;
          transferOnB = snapB;
        }
      }

      if (!transferOffA || transferDist > MAX_TRANSFER_WALK) continue;

      const rideA = turf.lineSlice(boardA, transferOffA, lineA);
      const rideB = turf.lineSlice(transferOnB, dropB, lineB);
      const rideAKm = turf.length(rideA);
      const rideBKm = turf.length(rideB);

      if (rideAKm < 0.15 || rideBKm < 0.15) continue;

      const totalWalk = walkToA + transferDist + walkFromB;
      const score = (totalWalk * 3) + rideAKm + rideBKm + TRANSFER_PENALTY;

      candidates.push({
        jeepney: a.route,
        headingTowards: a.label.split(' to ')[1] || a.label,
        boardingCoords: boardA.geometry.coordinates,
        dropoffCoords: transferOffA.geometry.coordinates,
        slicedGeometry: rideA.geometry,
        walkDistanceMeters: Math.round(totalWalk * 1000),
        activePathCoords: a.coords,
        score,
        transfer: {
          jeepney: b.route,
          headingTowards: b.label.split(' to ')[1] || b.label,
          boardingCoords: transferOnB.geometry.coordinates,
          dropoffCoords: dropB.geometry.coordinates,
          slicedGeometry: rideB.geometry,
          activePathCoords: b.coords,
        }
      });
    }
  }

  // 3. Filter Duplicates, Sort and Take Top 3
  const seenKeys = new Set<string>();
  const uniqueCandidates: any[] = [];

  candidates.sort((x, y) => x.score - y.score);

  for (const c of candidates) {
    const key = c.transfer 
      ? `transfer-${c.jeepney.routeCode}-${c.transfer.jeepney.routeCode}`
      : `single-${c.jeepney.routeCode}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueCandidates.push(c);
    }
  }

  return uniqueCandidates.slice(0, 3);
};