"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from '@turf/turf';

import {  
  fetchExactJeepneyPath,
  getDistanceMeters,
  findBestJeepneyRoute
} from "../application/getDirections"; 
import { mockRoutes } from "../domain/MockData";

import AmenityPopupBox from "./AmenityPopupBox";
import Sidebar, { TravelMode } from "./sidebar"; 

const ICON_PATHS: Record<string, string> = {
  "townhall": "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  "hospital": "M12 6v12 M6 12h12",
  "police": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "bus_station": "M8 6h8 M6 10h12 M12 21v-4 M9 21h6 M4 18V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9",
  "school": "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c0 2 2 3 6 3s6-1 6-3v-5",
  "bank": "M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M11 10v11 M15 10v11 M20 10v11",
  "user": "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
};

const JEEPNEY_HEX_COLORS: Record<string, string> = {
  YELLOW: '#ca8a04',
  BLUE: '#2563eb',
  RED: '#dc2626',
  GREEN: '#16a34a',
  ORANGE: '#FFA500',
  CREAM: '#FFFDD0',
  BROWN: '#964B00',
  WHITE: '#e5e7eb'
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;
const USER_START_LOCATION = [120.283479, 14.837409] as [number, number];

const AMENITY_PRIORITY: Record<string, number> = {
  "townhall": 1, "hospital": 1, "police": 1, "fire_station": 1, "bus_station": 1, 
  "ferry_terminal": 1, "university": 1, "college": 1,
  "school": 2, "clinic": 2, "dentist": 2, "doctors": 2, "pharmacy": 2, 
  "bank": 2, "atm": 2, "supermarket": 2, "mall": 2, "marketplace": 2, 
  "place_of_worship": 2, "post_office": 2, "fuel": 2, "gas": 2,
  "waste_basket": 4, "toilets": 4, "parking_space": 4, "motorcycle_parking": 4, 
  "bicycle_parking": 4, "shelter": 4, "compressed_air": 4
};

// 🟢 NEW: Samples an array down to 24 points so Mapbox doesn't crash!
const sampleCoordinates = (coords: number[][], maxPoints = 24) => {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const sampled = [];
  for (let i = 0; i < maxPoints; i++) {
    sampled.push(coords[Math.round(i * step)]);
  }
  return sampled;
};

function getPriority(type: string): number {
  return AMENITY_PRIORITY[type.toLowerCase()] || 3;
}

function createCustomMarkerElement(type: string, priority: number) {
  const el = document.createElement("div");
  el.className = "custom-marker";
  el.style.borderRadius = "50%";
  el.style.border = "2px solid white";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

  let bgColor = priority === 1 ? "#000000" : priority === 2 ? "#F59E0B" : "#EF4444"; 
  let size = priority === 1 ? "28px" : priority === 2 ? "22px" : "12px";
  let iconSize = priority === 1 ? 16 : priority === 2 ? 14 : 0;

  el.style.width = size;
  el.style.height = size;
  el.style.backgroundColor = bgColor;

  if (priority <= 2) {
    const path = ICON_PATHS[type] || ICON_PATHS["bank"];
    el.innerHTML = `
      <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="${path}"></path>
      </svg>`;
  }
  el.dataset.priority = priority.toString();
  return el;
}

function parseAmenities(data: any) {
  const nodes: Record<number, any> = {};
  data.elements.forEach((el: any) => { if (el.type === "node") nodes[el.id] = el; });
  return data.elements
    .filter((el: any) => el.tags && (el.type === "node" || (el.type === "way" && el.nodes)))
    .map((el: any) => {
      let lat = el.lat, lon = el.lon;
      if (el.type === "way") {
        const coords = el.nodes.map((id: number) => nodes[id]).filter(Boolean);
        lat = coords.reduce((s: number, n: any) => s + n.lat, 0) / coords.length;
        lon = coords.reduce((s: number, n: any) => s + n.lon, 0) / coords.length;
      }
      return { id: el.id, name: el.tags.name || "Unnamed", type: el.tags.amenity || el.tags.shop, lat, lon };
    });
}

export default function MapComponent() {
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [origin, setOrigin] = useState<{name: string, coords: number[]} | null>(null);
  const [isPickingOrigin, setIsPickingOrigin] = useState(false);
  const isPickingOriginRef = useRef(false);

  const [isRoutingMode, setIsRoutingMode] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>('driving'); 
  const [routeInstructions, setRouteInstructions] = useState<any[]>([]);

  const [visibleRouteIds, setVisibleRouteIds] = useState<string[]>(mockRoutes.map(r => r.id));
  const [isolatedDirectionId, setIsolatedDirectionId] = useState<string | null>(null); // 🟢 NEW STATE

  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const routeEndpointMarkers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    isPickingOriginRef.current = isPickingOrigin;
  }, [isPickingOrigin]);

  const filteredPlaces = places.filter(place => {
    if (!searchQuery) return true; 
    const term = searchQuery.toLowerCase();
    const nameMatch = (place.name || "").toLowerCase().includes(term);
    const typeMatch = (place.type || "").toLowerCase().includes(term);
    return nameMatch || typeMatch;
  });

  const toggleColorGroup = (colorCode: string) => {
    setIsolatedDirectionId(null); // Clear isolated view if active
    routeEndpointMarkers.current.forEach(marker => marker.remove());
    routeEndpointMarkers.current = [];

    const routesOfColor = mockRoutes.filter(r => r.colorCode === colorCode).map(r => r.id);
    if (routesOfColor.length === 0) return;

    const allActive = routesOfColor.every(id => visibleRouteIds.includes(id));
    if (allActive) {
      setVisibleRouteIds(prev => prev.filter(id => !routesOfColor.includes(id)));
    } else {
      setVisibleRouteIds(prev => Array.from(new Set([...prev, ...routesOfColor])));
    }
  };

  // 🟢 UPGRADED: ISOLATE INDIVIDUAL DIRECTION & DRAW ACCURATE ENDPOINTS
  const selectSingleRoute = (routeId: string, directionId: string) => {
    const currentMap = map.current;

    routeEndpointMarkers.current.forEach(marker => marker.remove());
    routeEndpointMarkers.current = [];

    setIsolatedDirectionId(prevDir => {
      // Toggle OFF if clicking the same specific direction twice
      if (prevDir === directionId) {
        setVisibleRouteIds(mockRoutes.map(r => r.id)); 
        return null;
      }

      // Toggle ON
      setVisibleRouteIds([routeId]); 
      const selectedRoute = mockRoutes.find(r => r.id === routeId);

      if (selectedRoute && selectedRoute.path && currentMap) {
        const isFwd = directionId.endsWith('-fwd');
        
        // 🟢 Accurately determine if we should plot markers on the Forward or Reverse path
        const activePath = isFwd 
          ? selectedRoute.path 
          : (selectedRoute.returnPath || [...selectedRoute.path].reverse());

        if (activePath && activePath.length > 0) {
          const startCoord = activePath[0];
          const endCoord = activePath[activePath.length - 1];
          
          const startEl = document.createElement('div');
          startEl.innerHTML = `<div style="background-color: white; border: 3px solid ${JEEPNEY_HEX_COLORS[selectedRoute.colorCode]}; color: black; padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">📍 Start</div>`;
          
          const endEl = document.createElement('div');
          endEl.innerHTML = `<div style="background-color: white; border: 3px solid #374151; color: black; padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🏁 End</div>`;

          const startMarker = new mapboxgl.Marker({ element: startEl }).setLngLat(startCoord as any).addTo(currentMap);
          const endMarker = new mapboxgl.Marker({ element: endEl }).setLngLat(endCoord as any).addTo(currentMap);
          
          routeEndpointMarkers.current.push(startMarker, endMarker);
          
          const bounds = new mapboxgl.LngLatBounds();
          activePath.forEach(coord => bounds.extend(coord as any));
          currentMap.fitBounds(bounds, { padding: 100, duration: 1000 });
        }
      }

      return directionId; // Save the newly isolated direction
    });
  };

  // 🟢 UPGRADED: VISIBILITY & DYNAMIC OPACITY EFFECT
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const currentMap = map.current;

    mockRoutes.forEach(route => {
      const fwdLayerId = `route-layer-${route.id}-fwd`;
      const revLayerId = `route-layer-${route.id}-rev`;
      const fwdOutlineId = `${fwdLayerId}-outline`;
      const revOutlineId = `${revLayerId}-outline`;

      const isVisible = visibleRouteIds.includes(route.id);
      const visibilityValue = isVisible ? 'visible' : 'none';

      // Set base layout visibility
      if (currentMap.getLayer(fwdLayerId)) currentMap.setLayoutProperty(fwdLayerId, 'visibility', visibilityValue);
      if (currentMap.getLayer(revLayerId)) currentMap.setLayoutProperty(revLayerId, 'visibility', visibilityValue);
      if (currentMap.getLayer(fwdOutlineId)) currentMap.setLayoutProperty(fwdOutlineId, 'visibility', visibilityValue);
      if (currentMap.getLayer(revOutlineId)) currentMap.setLayoutProperty(revOutlineId, 'visibility', visibilityValue);

      // Handle Opacity based on Isolation
      if (isVisible) {
        if (isolatedDirectionId) {
          // If a direction is clicked, dim the un-clicked path!
          const isFwdActive = isolatedDirectionId === `${route.id}-fwd`;
          const isRevActive = isolatedDirectionId === `${route.id}-rev`;

          if (currentMap.getLayer(fwdLayerId)) currentMap.setPaintProperty(fwdLayerId, 'line-opacity', isFwdActive ? 1.0 : 0.15);
          if (currentMap.getLayer(fwdOutlineId)) currentMap.setPaintProperty(fwdOutlineId, 'line-opacity', isFwdActive ? 0.8 : 0.1);

          if (currentMap.getLayer(revLayerId)) currentMap.setPaintProperty(revLayerId, 'line-opacity', isRevActive ? 1.0 : 0.15);
          if (currentMap.getLayer(revOutlineId)) currentMap.setPaintProperty(revOutlineId, 'line-opacity', isRevActive ? 0.8 : 0.1);
        } else {
          // Standard View (All full opacity)
          if (currentMap.getLayer(fwdLayerId)) currentMap.setPaintProperty(fwdLayerId, 'line-opacity', 1.0);
          if (currentMap.getLayer(fwdOutlineId)) currentMap.setPaintProperty(fwdOutlineId, 'line-opacity', 0.8);
          if (currentMap.getLayer(revLayerId)) currentMap.setPaintProperty(revLayerId, 'line-opacity', 1.0);
          if (currentMap.getLayer(revOutlineId)) currentMap.setPaintProperty(revOutlineId, 'line-opacity', 0.8);
        }
      }
    });
  }, [visibleRouteIds, isolatedDirectionId]); // Re-run when either changes!

  useEffect(() => {
    if (isRoutingMode && origin && selectedPlace) {
      handleRouteRequest(selectedPlace, travelMode);
    }
  }, [origin, travelMode, isRoutingMode, selectedPlace]);

  const startNavigationFlow = (place: any) => {
    setSelectedPlace(place);
    setIsRoutingMode(true);
    if (!origin) {
      setIsPickingOrigin(true);
    } else {
      handleRouteRequest(place, travelMode); 
    }
  };

  const handleRouteRequest = async (place: any, mode: TravelMode) => {
    if (!map.current || !origin) return;
    const currentMap = map.current;

    mockRoutes.forEach(route => {
      const fwdLayerId = `route-layer-${route.id}-fwd`;
      const revLayerId = `route-layer-${route.id}-rev`;
      
      if (currentMap.getLayer(fwdLayerId)) currentMap.setLayoutProperty(fwdLayerId, 'visibility', 'none');
      if (currentMap.getLayer(revLayerId)) currentMap.setLayoutProperty(revLayerId, 'visibility', 'none');
      if (currentMap.getLayer(`${fwdLayerId}-outline`)) currentMap.setLayoutProperty(`${fwdLayerId}-outline`, 'visibility', 'none');
      if (currentMap.getLayer(`${revLayerId}-outline`)) currentMap.setLayoutProperty(`${revLayerId}-outline`, 'visibility', 'none');
    });

    const startLon = origin.coords[0];
    const startLat = origin.coords[1];
    const endLon = parseFloat(place.lon);
    const endLat = parseFloat(place.lat);

    if (isNaN(endLon) || isNaN(endLat)) return;

    if ((window as any).currentDestMarker) {
      (window as any).currentDestMarker.remove();
    }

    const markerEl = document.createElement('div');
    markerEl.style.width = '24px';
    markerEl.style.height = '24px';
    markerEl.style.backgroundColor = '#FF00FF'; 
    markerEl.style.borderRadius = '50%';
    markerEl.style.border = '3px solid white';
    markerEl.style.boxShadow = '0 0 10px rgba(0,0,0,0.6)';

    (window as any).currentDestMarker = new mapboxgl.Marker({ element: markerEl }) 
      .setLngLat([endLon, endLat])
      .addTo(currentMap);

    try {
      if (mode === 'transit') {
        // 🟢 1. WALKABLE FALLBACK
        const directDistance = getDistanceMeters(origin.coords, [endLon, endLat]);
        
        if (directDistance < 600) { 
          setRouteInstructions([{ maneuver: { instruction: "Calculating walking route..." }, distance: 0 }]);
          
          const walkUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;
          const walkRes = await fetch(walkUrl);
          const walkData = await walkRes.json();

          setRouteInstructions([
            { maneuver: { instruction: "🚶 Destination is very close! Walking is faster than waiting for a Jeepney." }, distance: walkData.routes[0].distance },
            ...walkData.routes[0].legs[0].steps
          ]);

          const walkGeoJSON = {
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: { color: "#10b981", dashArray: [2, 2] }, geometry: walkData.routes[0].geometry }]
          };

          const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData(walkGeoJSON as any);
            currentMap.setPaintProperty("active-route-layer", "line-color", ['get', 'color']);
            currentMap.setPaintProperty("active-route-layer", "line-dasharray", ['get', 'dashArray']);
            currentMap.setLayoutProperty("active-route-layer", "visibility", "visible");
          } else {
            currentMap.addSource("active-route", { type: "geojson", data: walkGeoJSON as any });
            currentMap.addLayer({
              id: "active-route-layer",
              type: "line",
              source: "active-route",
              layout: { "line-join": "round", "line-cap": "round", "visibility": "visible" },
              paint: { "line-color": ['get', 'color'], "line-width": 6, "line-dasharray": ['get', 'dashArray'] },
            });
          }
          
          const bounds = new mapboxgl.LngLatBounds();
          walkData.routes[0].geometry.coordinates.forEach((c: any) => bounds.extend(c));
          currentMap.fitBounds(bounds, { padding: 80, duration: 1200 });

          return; 
        }

        // 🟢 2. JEEPNEY SEARCH ENGINE
        setRouteInstructions([{ maneuver: { instruction: "Calculating optimal Jeepney route..." }, distance: 0 }]);
        const transitPlan = findBestJeepneyRoute(origin.coords, [endLon, endLat]);

        if (!transitPlan) {
          setRouteInstructions([{ maneuver: { instruction: "Destination is too far from any Jeepney route." }, distance: 0 }]);
          return;
        }

        // ==========================================
        // 🟢 3. THE ULTIMATE HIGH-RES RE-CALCULATION
        // ==========================================
        let rideGeometry = transitPlan.slicedGeometry;
        let finalBoardCoords = transitPlan.boardingCoords;
        let finalDropCoords = transitPlan.dropoffCoords;

        try {
          // Ask Mapbox for the perfect, curved road connecting your raw MockData points
          const fullJeepneyData = await fetchExactJeepneyPath(transitPlan.activePathCoords);
          
          if (fullJeepneyData?.routes?.[0]?.geometry) {
            const highResLine = turf.lineString(fullJeepneyData.routes[0].geometry.coordinates);

            // Re-calculate the exact pickup/dropoff by snapping the user's pins
            // directly onto the actual STREET curves, not the mathematical straight lines!
            const preciseBoardPt = turf.nearestPointOnLine(highResLine, turf.point(origin.coords));
            const preciseDropPt = turf.nearestPointOnLine(highResLine, turf.point([endLon, endLat]));

            finalBoardCoords = preciseBoardPt.geometry.coordinates;
            finalDropCoords = preciseDropPt.geometry.coordinates;

            // Cleanly slice the beautifully curved road
            rideGeometry = turf.lineSlice(preciseBoardPt, preciseDropPt, highResLine).geometry;
          }
        } catch (error) {
          console.warn("High-res recalculation failed, falling back to low-poly geometry.");
        }

        // 🟢 4. FETCH PRECISE WALKING ROUTES
        const walk1Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${origin.coords[0]},${origin.coords[1]};${finalBoardCoords[0]},${finalBoardCoords[1]}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;
        const walk2Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${finalDropCoords[0]},${finalDropCoords[1]};${endLon},${endLat}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;

        const [walk1Res, walk2Res] = await Promise.all([fetch(walk1Url), fetch(walk2Url)]);
        const walk1Data = await walk1Res.json();
        const walk2Data = await walk2Res.json();

        const walkToJeepneySteps = walk1Data.routes[0].legs[0].steps;
        const walkToDestinationSteps = walk2Data.routes[0].legs[0].steps;

        const customInstructions = [
          ...walkToJeepneySteps, 
          { maneuver: { instruction: `🚐 BOARD JEEPNEY: Ride the ${transitPlan.jeepney.routeCode} (${transitPlan.jeepney.colorCode} Jeep) heading towards ${transitPlan.headingTowards}.` }, distance: 0 },
          { maneuver: { instruction: `🛑 ALIGHT JEEPNEY: Get off here and continue on foot.` }, distance: 0 },
          ...walkToDestinationSteps 
        ];

        setRouteInstructions(customInstructions);

        const transitGeoJSON = {
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: { color: "#10b981", dashArray: [2, 2] }, geometry: walk1Data.routes[0].geometry },
            { type: "Feature", properties: { color: JEEPNEY_HEX_COLORS[transitPlan.jeepney.colorCode], dashArray: [1, 0] }, geometry: rideGeometry },
            { type: "Feature", properties: { color: "#10b981", dashArray: [2, 2] }, geometry: walk2Data.routes[0].geometry }
          ]
        };

        const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(transitGeoJSON as any);
          currentMap.setPaintProperty("active-route-layer", "line-color", ['get', 'color']);
          currentMap.setPaintProperty("active-route-layer", "line-dasharray", ['get', 'dashArray']);
          currentMap.setLayoutProperty("active-route-layer", "visibility", "visible");
        } else {
          currentMap.addSource("active-route", { type: "geojson", data: transitGeoJSON as any });
          currentMap.addLayer({
            id: "active-route-layer",
            type: "line",
            source: "active-route",
            layout: { "line-join": "round", "line-cap": "round", "visibility": "visible" },
            paint: { "line-color": ['get', 'color'], "line-width": 6, "line-dasharray": ['get', 'dashArray'] },
          });
        }

        const bounds = new mapboxgl.LngLatBounds();
        walk1Data.routes[0].geometry.coordinates.forEach((c: any) => bounds.extend(c));
        if (rideGeometry.coordinates) rideGeometry.coordinates.forEach((c: any) => bounds.extend(c));
        walk2Data.routes[0].geometry.coordinates.forEach((c: any) => bounds.extend(c));
        currentMap.fitBounds(bounds, { padding: 80, duration: 1200 });

        return; 
      }

      const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        console.warn(`No route found for ${mode}.`);
        return;
      }

      // 🟢 NEW: OFF-ROAD DETECTION (For Cars & Motorcycles only)
      if (mode === 'driving' || mode === 'cycling') {
        const snappedStart = data.waypoints[0].location; // Where Mapbox put the car
        const snappedEnd = data.waypoints[data.waypoints.length - 1].location; // Where Mapbox parked the car

        // Calculate how far Mapbox had to teleport the pins
        const startTeleportDist = getDistanceMeters([startLon, startLat], snappedStart);
        const endTeleportDist = getDistanceMeters([endLon, endLat], snappedEnd);

        // If it teleported more than 50 meters, block the route!
        if (startTeleportDist > 25 || endTeleportDist > 25) {
          setRouteInstructions([{ 
            maneuver: { 
              instruction: "🚫 OFF-ROAD WARNING: Your starting or ending pin is too far from a drivable street! Please move the pin closer to a road, or switch to Walking / Jeepney mode." 
            }, 
            distance: 0 
          }]);
          
          // Clear any existing active routes off the map
          if (currentMap.getLayer("active-route-layer")) {
            currentMap.setLayoutProperty("active-route-layer", "visibility", "none");
          }
          return; // Stop drawing!
        }
      }

      // If it passes the test, proceed with normal instructions
      setRouteInstructions(data.routes[0].legs[0].steps);

      const routeGeometry = data.routes[0].geometry;
      const allCoordinatesToFrame = routeGeometry.coordinates;

      let finalColor = "#3b82f6"; // Blue for Driving
      let dashArray = [1, 0];     // Solid line

      if (mode === 'walking') {
        finalColor = "#10b981";   // Green for Walking
        dashArray = [2, 2];       // Dashed line
      } else if (mode === 'cycling') {
        finalColor = "#f59e0b";   // Orange for Motorcycle
      }

      const activeRouteGeoJSON = {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: routeGeometry }]
      };

      const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(activeRouteGeoJSON as any);
        currentMap.setPaintProperty("active-route-layer", "line-color", finalColor);
        currentMap.setPaintProperty("active-route-layer", "line-dasharray", dashArray);
        currentMap.setLayoutProperty("active-route-layer", "visibility", "visible");
      } else {
        currentMap.addSource("active-route", { type: "geojson", data: activeRouteGeoJSON as any });
        currentMap.addLayer({
          id: "active-route-layer",
          type: "line",
          source: "active-route",
          layout: { "line-join": "round", "line-cap": "round", "visibility": "visible" },
          paint: { 
            "line-color": finalColor, 
            "line-width": 6, 
            "line-opacity": 0.9,
            "line-dasharray": dashArray
          },
        });
      }

      const bounds = new mapboxgl.LngLatBounds();
      allCoordinatesToFrame.forEach((c: any) => bounds.extend(c));
      currentMap.fitBounds(bounds, { padding: 80, duration: 1200 });

    } catch (error) { 
      console.error("Routing Error:", error); 
    }
  };

  const drawJeepneyRouteLine = async (jeepney: any) => {
    if (!map.current) return;
    if (!jeepney?.path || jeepney.path.length < 2) return;  
    
    const actualColor = JEEPNEY_HEX_COLORS[jeepney.colorCode] || "#000000";
    const currentMap = map.current;

    const fwdSourceId = `route-source-${jeepney.id}-fwd`;
    const fwdLayerId = `route-layer-${jeepney.id}-fwd`;

    try {
      const fwdData: any = await fetchExactJeepneyPath(jeepney.path);
      let fwdGeoJSON = fwdData?.routes?.[0]?.geometry 
        ? { type: "Feature", properties: {}, geometry: fwdData.routes[0].geometry }
        : { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: jeepney.path } };

      const fwdSource = currentMap.getSource(fwdSourceId) as mapboxgl.GeoJSONSource;
      if (fwdSource) {
        fwdSource.setData(fwdGeoJSON as any);
      } else { 
        currentMap.addSource(fwdSourceId, { type: "geojson", data: fwdGeoJSON as any });

        currentMap.addLayer({
          id: `${fwdLayerId}-outline`,
          type: "line", 
          source: fwdSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#374151", "line-width": 12, "line-opacity": 0.8 },
        });

        currentMap.addLayer({
          id: fwdLayerId, 
          type: "line", 
          source: fwdSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": actualColor, "line-width": 6, "line-opacity": 1.0, "line-blur": 3 },
        });
      }
    } catch (error) { console.error(error); }

    const revSourceId = `route-source-${jeepney.id}-rev`;
    const revLayerId = `route-layer-${jeepney.id}-rev`;
    const returnPath = jeepney.returnPath || [...jeepney.path].reverse();

    try {
      const revData: any = await fetchExactJeepneyPath(returnPath);
      let revGeoJSON = revData?.routes?.[0]?.geometry
        ? { type: "Feature", properties: {}, geometry: revData.routes[0].geometry }
        : { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: returnPath } };

      const revSource = currentMap.getSource(revSourceId) as mapboxgl.GeoJSONSource;
      if (revSource) {
        revSource.setData(revGeoJSON as any);
      } else {
        currentMap.addSource(revSourceId, { type: "geojson", data: revGeoJSON as any });
        
        currentMap.addLayer({
          id: `${revLayerId}-outline`,
          type: "line", 
          source: revSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#374151", "line-width": 12, "line-opacity": 0.8 },
        });

        currentMap.addLayer({
          id: revLayerId, 
          type: "line", 
          source: revSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": actualColor, "line-width": 6, "line-opacity": 1.0, "line-blur": 3},
        });
      }
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return;

    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: USER_START_LOCATION,
      zoom: 14,
    });
    map.current = currentMap;

    const updateMarkerVisibility = () => {
      const zoom = currentMap.getZoom();
      markers.current.forEach((marker) => {
        const el = marker.getElement();
        const priority = parseInt(el.dataset.priority || "3");
        if (priority === 4 || zoom < 13.0) el.style.display = "none";
        else if (zoom < 14.5 && priority > 1) el.style.display = "none";
        else if (zoom < 15.5 && priority > 2) el.style.display = "none";
        else el.style.display = "flex";
      });
    };

    currentMap.on("load", async () => {
      mockRoutes.forEach((jeepney) => {
        void drawJeepneyRouteLine(jeepney);
      });

      const startEl = document.createElement("div");
      startEl.style.cssText = "width:34px;height:34px;background:#3b82f6;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(0,0,0,0.3);cursor:pointer;";
      startEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      
      startMarkerRef.current = new mapboxgl.Marker({ element: startEl }).setLngLat(USER_START_LOCATION).addTo(currentMap);

      try {
        const res = await fetch("/api/amenities");
        const parsedPlaces = parseAmenities(await res.json());
        
        setPlaces(parsedPlaces);

        parsedPlaces.forEach((place: any) => {
          const priority = getPriority(place.type);
          const el = createCustomMarkerElement(place.type, priority);
          const marker = new mapboxgl.Marker({ element: el }).setLngLat([place.lon, place.lat]).addTo(currentMap);
          
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            const existing = document.getElementsByClassName('mapboxgl-popup');
            while(existing[0]) existing[0].remove();

            new mapboxgl.Popup({ offset: 25, closeButton: false })
              .setLngLat([place.lon, place.lat])
              .setHTML('<div id="popup-portal-root"></div>')
              .addTo(currentMap);

            setSelectedPlace(place);
          });
          markers.current.push(marker);
        });
        updateMarkerVisibility();
      } catch (e) { console.error(e); }

      currentMap.on("zoomend", updateMarkerVisibility);
      currentMap.on("moveend", updateMarkerVisibility);
    });

    currentMap.on("click", (e) => {
      if (isPickingOriginRef.current) {
        setOrigin({
          name: `Dropped Pin (${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)})`,
          coords: [e.lngLat.lng, e.lngLat.lat]
        });
        setIsPickingOrigin(false); 
        
        if (startMarkerRef.current) startMarkerRef.current.setLngLat(e.lngLat);
      } else {
        USER_START_LOCATION[0] = e.lngLat.lng;
        USER_START_LOCATION[1] = e.lngLat.lat;
        if (startMarkerRef.current) startMarkerRef.current.setLngLat(e.lngLat);
      }
    });

    return () => { currentMap.remove(); map.current = null; };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden flex">
      
      <Sidebar 
        places={filteredPlaces} 
        userLocation={USER_START_LOCATION} 
        origin={origin}
        destination={selectedPlace}
        mode={travelMode}
        isRoutingMode={isRoutingMode}
        setMode={setTravelMode}
        routeInstructions={routeInstructions}
        visibleRouteIds={visibleRouteIds}
        isolatedDirectionId={isolatedDirectionId} // 🟢 NEW PROP
        onSelectOriginMode={() => setIsPickingOrigin(true)}
        onSelectRoute={selectSingleRoute}
        
        onCloseRouting={() => {
          setIsRoutingMode(false);
          setIsPickingOrigin(false);
          setRouteInstructions([]);
          
          setIsolatedDirectionId(null); // Clear isolated view when closing routing
          routeEndpointMarkers.current.forEach(marker => marker.remove());
          routeEndpointMarkers.current = [];

          if (map.current?.getLayer("active-route-layer")) map.current.setLayoutProperty("active-route-layer", 'visibility', 'none');
          if ((window as any).currentDestMarker) (window as any).currentDestMarker.remove();
          
          mockRoutes.forEach(r => {
            const fwdLayerId = `route-layer-${r.id}-fwd`;
            const revLayerId = `route-layer-${r.id}-rev`;
            const vis = visibleRouteIds.includes(r.id) ? 'visible' : 'none';
            
            if (map.current?.getLayer(fwdLayerId)) {
              map.current.setLayoutProperty(fwdLayerId, 'visibility', vis);
              map.current.setPaintProperty(fwdLayerId, 'line-opacity', 1.0); // Reset Opacity
            }
            if (map.current?.getLayer(revLayerId)) {
              map.current.setLayoutProperty(revLayerId, 'visibility', vis);
              map.current.setPaintProperty(revLayerId, 'line-opacity', 1.0); // Reset Opacity
            }
            if (map.current?.getLayer(`${fwdLayerId}-outline`)) {
              map.current.setLayoutProperty(`${fwdLayerId}-outline`, 'visibility', vis);
              map.current.setPaintProperty(`${fwdLayerId}-outline`, 'line-opacity', 0.8);
            }
            if (map.current?.getLayer(`${revLayerId}-outline`)) {
              map.current.setLayoutProperty(`${revLayerId}-outline`, 'visibility', vis);
              map.current.setPaintProperty(`${revLayerId}-outline`, 'line-opacity', 0.8);
            }
          });
        }}

        onSelectPlace={(place) => {
          setSelectedPlace(place);
          map.current?.flyTo({ center: [place.lon, place.lat], zoom: 16 });
        }} 

        onStartNavigation={startNavigationFlow} 
      />

      {isPickingOrigin && (
        <div className="absolute top-20 left-[calc(50%+10rem)] -translate-x-1/2 z-30 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg font-bold animate-bounce cursor-default border-2 border-white">
          👇 Click anywhere on the map to set your Starting Point
        </div>
      )}

      <div className="relative flex-1 h-full ml-80">
        
        <div className="absolute top-4 left-4 right-4 z-10 flex gap-3 pointer-events-none">
          <div className="pointer-events-auto bg-white rounded-full shadow-md px-4 py-2 flex items-center w-64 md:w-80">
            <svg className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input
              type="text"
              placeholder="Search places or categories..."
              className="w-full text-sm outline-none bg-transparent text-gray-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="text-gray-400 hover:text-gray-600 ml-2 focus:outline-none"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            )}
          </div>

          <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => {
                setVisibleRouteIds(mockRoutes.map(r => r.id));
                setIsolatedDirectionId(null); // Clear isolated view
                routeEndpointMarkers.current.forEach(m => m.remove());
                routeEndpointMarkers.current = [];
              }}
              className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap shadow-md transition-all ${
                visibleRouteIds.length === mockRoutes.length ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              All Routes
            </button>

            {Object.entries(JEEPNEY_HEX_COLORS).map(([colorName, hexValue]) => {
              const routesOfColor = mockRoutes.filter(r => r.colorCode === colorName).map(r => r.id);
              const isActive = routesOfColor.length > 0 && routesOfColor.every(id => visibleRouteIds.includes(id));
              
              return (
                <button
                  key={colorName}
                  onClick={() => toggleColorGroup(colorName)}
                  className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap shadow-md transition-all flex items-center gap-2 ${
                    isActive ? "bg-white text-gray-900 border-2" : "bg-white text-gray-500 border border-transparent hover:bg-gray-50"
                  }`}
                  style={{ borderColor: isActive ? hexValue : 'transparent' }}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hexValue }} />
                  {colorName}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
        
        {selectedPlace && document.getElementById("popup-portal-root") && (
          createPortal(
            <AmenityPopupBox 
              place={selectedPlace} 
              onClose={() => {
                setSelectedPlace(null);
                
                if (map.current?.getLayer("active-route-layer")) map.current.setLayoutProperty("active-route-layer", 'visibility', 'none');
                if ((window as any).currentDestMarker) (window as any).currentDestMarker.remove();

                mockRoutes.forEach(r => {
                  const fwdLayerId = `route-layer-${r.id}-fwd`;
                  const revLayerId = `route-layer-${r.id}-rev`;
                  const vis = visibleRouteIds.includes(r.id) ? 'visible' : 'none';
                  
                  if (map.current?.getLayer(fwdLayerId)) map.current.setLayoutProperty(fwdLayerId, 'visibility', vis);
                  if (map.current?.getLayer(revLayerId)) map.current.setLayoutProperty(revLayerId, 'visibility', vis);
                  if (map.current?.getLayer(`${fwdLayerId}-outline`)) map.current.setLayoutProperty(`${fwdLayerId}-outline`, 'visibility', vis);
                  if (map.current?.getLayer(`${revLayerId}-outline`)) map.current.setLayoutProperty(`${revLayerId}-outline`, 'visibility', vis);
                });
              }}
              onGetDirections={() => startNavigationFlow(selectedPlace)} 
            />,
            document.getElementById("popup-portal-root")!
          )
        )}
      </div>
    </div>
  );
}