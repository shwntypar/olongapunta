import type { Request, Response } from "express";
import { asyncHandler } from "../core/middleware/error-handler.middleware";

type MapboxDirectionsResponse = {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: string;
      coordinates: number[][];
    };
  }>;
  message?: string;
};

type RouteFeature = {
  type: "Feature";
  properties: {
    routeColor: string;
    distance: number;
    duration: number;
    routeIndex: number;
    routeLabel: string;
  };
  geometry: {
    type: string;
    coordinates: number[][];
  };
};

function mapboxDirectionsUrl(pathCoords: string, alternatives: boolean, token: string): string {
  const alt = alternatives ? "true" : "false";
  return `https://api.mapbox.com/directions/v5/mapbox/driving/${pathCoords}?alternatives=${alt}&overview=full&geometries=geojson&access_token=${token}`;
}

export const getRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log("\n================================================");
  console.log("🚦 [BACKEND] /api/route ENDPOINT HIT");
  console.log("📥 [BACKEND] Query Params received:", req.query);

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    console.error("❌ [BACKEND] MAPBOX_TOKEN is missing in .env!");
    res.status(500).json({ error: "Server configuration error" });
    return;
  }
  console.log(`🔑 [BACKEND] Token found (starts with: ${token.substring(0, 5)}...)`);

  const waypointsRaw = req.query.waypoints as string | undefined;
  const start = req.query.start as string | undefined;
  const end = req.query.end as string | undefined;

  let pathCoords: string;
  let alternatives: boolean;

  // LOGIC BRANCHING
  if (waypointsRaw?.trim()) {
    console.log("🛣️ [BACKEND] Processing as Multi-Stop (Jeepney Route)");
    const segments = waypointsRaw.split(";").map((s) => s.trim()).filter(Boolean);
    
    if (segments.length < 2) {
      console.warn("⚠️ [BACKEND] Not enough waypoints provided.");
      res.status(400).json({ error: "waypoints must contain at least two lng,lat pairs separated by ;" });
      return;
    }
    
    if (segments.length > 25) {
      console.warn(`🛑 [BACKEND] Mapbox limit exceeded: ${segments.length} waypoints requested.`);
      res.status(400).json({ error: `Mapbox allows max 25 waypoints. Provided ${segments.length}.` });
      return;
    }
    
    pathCoords = segments.join(";");
    alternatives = false;
  } else if (start && end) {
    console.log("📍 [BACKEND] Processing as A-to-B Navigation");
    pathCoords = `${start};${end}`;
    alternatives = true;
  } else {
    console.warn("⚠️ [BACKEND] Missing required parameters (No waypoints, start, or end).");
    res.status(400).json({
      error: "Provide start and end as lng,lat, or waypoints=lng,lat;lng,lat;...",
    });
    return;
  }

  console.log(`🔗 [BACKEND] Path Coordinates: ${pathCoords}`);
  console.log(`🔀 [BACKEND] Alternatives Enabled: ${alternatives}`);

  const url = mapboxDirectionsUrl(pathCoords, alternatives, token);
  
  // Create a safe URL to log (without exposing your real token in the console)
  const safeLogUrl = mapboxDirectionsUrl(pathCoords, alternatives, "HIDDEN_TOKEN");
  console.log(`🚀 [BACKEND] Calling Mapbox API: ${safeLogUrl}`);

  const response = await fetch(url);
  console.log(`📡 [BACKEND] Mapbox API responded with status: ${response.status}`);

  if (!response.ok) {
    const errText = await response.text();
    console.error("❌ [BACKEND] Mapbox API Error:", errText);
    res.status(502).json({
      error: "Mapbox Directions request failed",
      status: response.status,
      detail: errText.slice(0, 500),
    });
    return;
  }

  const data = (await response.json()) as MapboxDirectionsResponse;

  if (data.message && !data.routes?.length) {
    console.error(`❌ [BACKEND] Mapbox returned a message but no routes: ${data.message}`);
    res.status(404).json({ error: data.message });
    return;
  }

  const routes = data.routes ?? [];
  console.log(`✅ [BACKEND] Mapbox returned ${routes.length} route(s).`);

  if (routes.length === 0) {
    console.warn("⚠️ [BACKEND] Mapbox returned 0 routes for these coordinates.");
    res.status(404).json({ error: "No route found for these coordinates" });
    return;
  }

  const routeColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed"] as const;

  const routeFeatures: RouteFeature[] = routes.map((route, index) => {
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

  console.log(`📤 [BACKEND] Sending FeatureCollection to Client with ${routeFeatures.length} features.`);
  console.log("================================================\n");

  res.json({
    type: "FeatureCollection",
    features: routeFeatures,
  });
});