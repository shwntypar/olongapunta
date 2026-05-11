import type { Feature, FeatureCollection, LineString } from "geojson";
import type { JeepneyRoute } from "../domain/MockData";
import { jeepneyColorToHex, mockRoutes } from "../domain/MockData";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

/** Line geometry from `path` or straight segments between ordered stops — always works offline. */
export function jeepneyRouteToLineFeature(route: JeepneyRoute): Feature<LineString> {
  const sorted = [...route.stops].sort((a, b) => a.order - b.order);
  const coordinates = route.path?.length
    ? route.path.map(([lng, lat]) => [lng, lat])
    : sorted.map((s) => [s.lng, s.lat]);
  return {
    type: "Feature",
    properties: {
      routeColor: jeepneyColorToHex(route.colorCode),
      name: route.routeName,
      description: `${route.colorCode} · ${sorted.length} stops`,
      routeId: route.id,
    },
    geometry: { type: "LineString", coordinates },
  };
}

export function allMockRoutesFeatureCollection(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: mockRoutes.map(jeepneyRouteToLineFeature),
  };
}

/** Ordered stops as Mapbox expects: lng,lat segments separated by `;`. */
export function waypointsFromJeepneyRoute(route: JeepneyRoute): string {
  const sorted = [...route.stops].sort((a, b) => a.order - b.order);
  return sorted.map((s) => `${s.lng},${s.lat}`).join(";");
}

/**
 * One continuous driving line through all stops (Direct Mapbox API Call).
 */
export async function fetchJeepneyPathFromMapbox(
  route: JeepneyRoute,
): Promise<Feature<LineString> | null> {
  console.log(`\n================================================`);
  console.log(`🚐 [JEEPNEY ROUTE] Fetching Mapbox route for: ${route.routeName}`);
  
  const waypoints = waypointsFromJeepneyRoute(route);
  if (!waypoints.includes(";")) {
    console.warn(`⚠️ [JEEPNEY ROUTE] Not enough waypoints to create a route.`);
    return null;
  }

  // 🛑 Mapbox limitation: Max 25 coordinates per request. 
  const segmentsCount = waypoints.split(";").length;
  if (segmentsCount > 25) {
    console.warn(`🛑 [JEEPNEY ROUTE] Route has ${segmentsCount} stops. Mapbox allows max 25. Falling back to mock lines.`);
    return null; 
  }

  try {
    if (!MAPBOX_TOKEN) {
      console.error("❌ [JEEPNEY ROUTE] NEXT_PUBLIC_MAPBOX_TOKEN is missing!");
      return null;
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypoints}?alternatives=false&overview=full&geometries=geojson&access_token=${MAPBOX_TOKEN}`;
    console.log(`🚀 [JEEPNEY ROUTE] Hitting Mapbox URL:`, url.replace(MAPBOX_TOKEN, "HIDDEN_TOKEN"));

    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [JEEPNEY ROUTE] Mapbox API Failed! Status: ${response.status}`);
      console.error(`❌ [JEEPNEY ROUTE] Mapbox Reason:`, errorText);
      return null;
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      console.warn(`⚠️ [JEEPNEY ROUTE] Mapbox returned success, but 0 routes found.`);
      return null;
    }

    console.log(`✅ [JEEPNEY ROUTE] Successfully fetched route from Mapbox!`);
    const rawGeometry = data.routes[0].geometry;

    return {
      type: "Feature",
      properties: {
        routeColor: jeepneyColorToHex(route.colorCode),
        name: route.routeName,
        description: `${route.colorCode} jeepney · ${route.stops.length} stops (Mapbox Direct)`,
        routeId: route.id,
      },
      geometry: rawGeometry,
    };
  } catch (error) {
    console.error("🔴 [JEEPNEY ROUTE] Catch Block Error:", error);
    return null;
  } finally {
    console.log(`================================================\n`);
  }
}

/** Mapbox path when the token is available; otherwise mock path or straight segments. */
export async function fetchJeepneyPathWithFallback(
  route: JeepneyRoute,
): Promise<Feature<LineString>> {
  const fromApi = await fetchJeepneyPathFromMapbox(route);
  return fromApi ?? jeepneyRouteToLineFeature(route);
}

/**
 * Point A → B with alternative routes (Direct Mapbox API Call).
 */
export const fetchDrivingAlternatives = async (pathCoordinates: number [][]): Promise<FeatureCollection | null> => {
  const safeCoordinates = pathCoordinates.slice(0, 25);
  console.log(`📍 [A-TO-B ROUTE] Fetching route from ${safeCoordinates}`);

  const coordinateString = safeCoordinates
    .map(coord => `${coord[0]},${coord[1]}`)
    .join(";");

  try {
    if (!MAPBOX_TOKEN) {
      console.error("❌ [A-TO-B ROUTE] NEXT_PUBLIC_MAPBOX_TOKEN is missing! Check your .env.local file.");
      return null;
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinateString}?alternatives=true&overview=full&geometries=geojson&access_token=${MAPBOX_TOKEN}`;
    
    console.log(`🚀 [A-TO-B ROUTE] Hitting Mapbox URL:`, url.replace(MAPBOX_TOKEN, "HIDDEN_TOKEN"));
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [A-TO-B ROUTE] Mapbox API Failed! Status: ${response.status}`);
      console.error(`❌ [A-TO-B ROUTE] Mapbox Reason:`, errorText);
      return null;
    }
    
    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      console.warn(`⚠️ [A-TO-B ROUTE] Mapbox returned success, but 0 routes found for these coordinates.`);
      return null;
    }

    console.log(`✅ [A-TO-B ROUTE] Successfully fetched ${data.routes.length} route(s)!`);

    const routeColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"];

    const routeFeatures = data.routes.map((route: any, index: number) => {
      const isFastest = index === 0;
      const routeColor = routeColors[index % routeColors.length] ?? "#2563eb";
      
      return {
        type: "Feature",
        properties: {
          routeColor,
          distance: route.distance,
          duration: route.duration,
          routeIndex: index,
          routeLabel: isFastest ? "Fastest route" : `Alternative ${index}`,
        },
        geometry: route.geometry,
      };
    });

    return {
      type: "FeatureCollection",
      features: routeFeatures as Feature<LineString>[],
    };
  } catch (error) {
    console.error("🔴 [A-TO-B ROUTE] Catch Block Error:", error);
    return null;
  } finally {
    console.log(`================================================\n`);
  }
}

// ==========================================
// 🧮 SMART TRANSIT MATH & SLICING 
// ==========================================

/** Calculates distance between two coordinates in kilometers (Haversine formula) */
export function getDistanceFromLatLonInKm(lon1: number, lat1: number, lon2: number, lat2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** * Automatically finds the best Jeepney route between a start and end point.
 * Checks if a route has stops within a walkable distance (default 0.5km / 500m) of BOTH points.
 */
export async function findBestJeepneyRouteFeature(
  startLng: number, startLat: number, endLng: number, endLat: number, maxWalkKm = 0.5
): Promise<FeatureCollection | null> {
  let bestRoute: JeepneyRoute | null = null;
  let minTotalWalk = Infinity;

  for (const route of mockRoutes) {
    let distToStart = Math.min(...route.stops.map(s => getDistanceFromLatLonInKm(startLng, startLat, s.lng, s.lat)));
    let distToDest = Math.min(...route.stops.map(s => getDistanceFromLatLonInKm(endLng, endLat, s.lng, s.lat)));

    if (distToStart <= maxWalkKm && distToDest <= maxWalkKm) {
      const totalWalk = distToStart + distToDest;
      if (totalWalk < minTotalWalk) {
        minTotalWalk = totalWalk;
        bestRoute = route;
      }
    }
  }

  if (!bestRoute) return null;

  console.log(`🚌 Best Jeepney Route found: ${bestRoute.routeName}. Fetching its path...`);
  const routeFeature = await fetchJeepneyPathWithFallback(bestRoute);

  return {
    type: "FeatureCollection",
    features: [routeFeature]
  };
}

// 🚶 Get the true walking path, distance, and time
export const fetchWalkingRoute = async (startCoord: number[], endCoord: number[]) => {
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startCoord[0]},${startCoord[1]};${endCoord[0]},${endCoord[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch walking path");
    return await response.json(); 
  } catch (error) {
    console.error("Error fetching walking path:", error);
    return null;
  }
};

// 🟢 Dedicated function for drawing strict Jeepney paths
export const fetchExactJeepneyPath = async (pathCoordinates: number[][]) => {
  const safeCoordinates = pathCoordinates.slice(0, 25);
  const coordinateString = safeCoordinates.map(coord => `${coord[0]},${coord[1]}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinateString}?alternatives=false&continue_straight=true&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch jeepney path");
    return await response.json(); 
  } catch (error) {
    console.error("Error fetching exact jeepney path:", error);
    return null;
  }
};

// 🧮 Helper: Find the closest coordinate index using Pythagorean distance
export const getClosestCoordIndex = (routeCoords: number[][], targetLonLat: number[]) => {
  let minIdx = 0;
  let minDist = Infinity;
  routeCoords.forEach((coord, i) => {
    const dist = Math.pow(coord[0] - targetLonLat[0], 2) + Math.pow(coord[1] - targetLonLat[1], 2);
    if (dist < minDist) {
      minDist = dist;
      minIdx = i;
    }
  });
  return minIdx;
};

// ✂️ Helper: Slice the Jeepney route down to just the part the user is riding
export const extractRideSegment = (fullRouteCoords: number[][], startLonLat: number[], endLonLat: number[]) => {
  const startIndex = getClosestCoordIndex(fullRouteCoords, startLonLat);
  const endIndex = getClosestCoordIndex(fullRouteCoords, endLonLat);

  if (startIndex <= endIndex) {
    return fullRouteCoords.slice(startIndex, endIndex + 1);
  } else {
    return fullRouteCoords.slice(endIndex, startIndex + 1).reverse();
  }
};

// 📏 Helper: Get real-world distance in meters
export const getDistanceMeters = (coord1: number[], coord2: number[]) => {
  const R = 6371e3; 
  const lat1 = coord1[1] * Math.PI/180;
  const lat2 = coord2[1] * Math.PI/180;
  const deltaLat = (coord2[1]-coord1[1]) * Math.PI/180;
  const deltaLon = (coord2[0]-coord1[0]) * Math.PI/180;
  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

// 🎯 The True Transit Engine
export const findNearestJeepneyRoute = (allRoutesCollection: any, startLonLat: number[], endLonLat: number[]) => {
  let bestRoute = null;
  let lowestWalkScore = Infinity;

  if (!allRoutesCollection?.features) return null;

  allRoutesCollection.features.forEach((route: any) => {
    let fullCoords = route.geometry.coordinates;
    if (Array.isArray(fullCoords[0]) && Array.isArray(fullCoords[0][0])) fullCoords = fullCoords.flat();

    const startIndex = getClosestCoordIndex(fullCoords, startLonLat);
    const endIndex = getClosestCoordIndex(fullCoords, endLonLat);

    if (startIndex === endIndex) return;

    const walkToStart = getDistanceMeters(startLonLat, fullCoords[startIndex]);
    const walkFromEnd = getDistanceMeters(fullCoords[endIndex], endLonLat);
    const totalWalk = walkToStart + walkFromEnd;

    if (totalWalk < lowestWalkScore) {
      lowestWalkScore = totalWalk;
      bestRoute = route;
    }
  });

  return bestRoute ? { features: [bestRoute] } : null;
};