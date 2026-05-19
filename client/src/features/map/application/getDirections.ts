import * as turf from '@turf/turf';
import { mockRoutes } from '../domain/MockData'; // Adjust this path if your folder structure is different!

export const getDistanceMeters = (coord1: number[], coord2: number[]) => {
  const R = 6371e3; // Earth radius in meters
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const fetchExactJeepneyPath = async (pathCoordinates: number[][]) => {
  if (!pathCoordinates || pathCoordinates.length < 2) return null;

  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // 1. Join all coordinates into a single Mapbox-friendly string: "lon,lat;lon,lat;lon,lat"
    const coordinateString = pathCoordinates
      .map(coord => `${coord[0]},${coord[1]}`)
      .join(';');

    // 2. Make ONE single request for the entire route
    // 🟢 BUG FIX: Changed 'driving' to 'cycling' to match your comment and bypass one-way street errors!
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinateString}?alternatives=false&continue_straight=true&geometries=geojson&overview=full&access_token=${token}`;
    
    const response = await fetch(url);

    // 3. Fail gracefully if Mapbox rejects the route, so Next.js doesn't crash
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

// --- 🟢 NEW: TURF.JS TRANSIT ROUTING ENGINE ---

export const findBestJeepneyRoute = (originCoords: number[], destCoords: number[]) => {
  const startPoint = turf.point(originCoords);
  const endPoint = turf.point(destCoords);
  const directWalkKm = turf.distance(startPoint, endPoint);

  let bestRoute: any = null;
  let bestScore = Infinity; 

  // Helper function to evaluate a specific direction of a route
  // Helper function to evaluate a specific direction of a route
  const evaluatePath = (route: any, pathCoords: number[][], directionName: string) => {
    if (!pathCoords || pathCoords.length < 2) return;

    const jeepneyLine = turf.lineString(pathCoords);
    const boardingPoint = turf.nearestPointOnLine(jeepneyLine, startPoint);
    const dropoffPoint = turf.nearestPointOnLine(jeepneyLine, endPoint);

    if (boardingPoint.properties.location >= dropoffPoint.properties.location) {
      return; 
    }

    const walkToBoardKm = turf.distance(startPoint, boardingPoint);
    const walkFromDropKm = turf.distance(dropoffPoint, endPoint);
    const totalWalk = walkToBoardKm + walkFromDropKm;

    const riddenPath = turf.lineSlice(boardingPoint, dropoffPoint, jeepneyLine);
    const rideDistanceKm = turf.length(riddenPath);

    // 🟢 THE SUBMARINE FIX: 
    // If the ride is ridiculously long compared to the direct distance, 
    // it means it's taking you on the "Grand Tour" around the whole city loop. Reject it!
    if (rideDistanceKm > directWalkKm * 3) {
      return; 
    }

    // 🟢 THE NEW SCORE: We add walking and riding together, 
    // but multiply walking by 3 because human energy is precious!
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

  // 🟢 Evaluate BOTH directions for every Jeepney!
  mockRoutes.forEach(route => {
    if (route.path) evaluatePath(route, route.path, route.routeName);
    if (route.returnPath) evaluatePath(route, route.returnPath, route.reversedName);
  });

  return bestRoute;
};