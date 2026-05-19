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
  "clinic": "M12 6v12 M6 12h12",
  "police": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "school": "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c0 2 2 3 6 3s6-1 6-3v-5",
  "university": "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c0 2 2 3 6 3s6-1 6-3v-5",
  "bank": "M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M11 10v11 M15 10v11 M20 10v11",
  "supermarket": "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  "restaurant": "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2H3zm10 0v20h2V2h-2z",
  "cafe": "M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M10 1v3 M14 1v3"
};

function getCategoryColor(type: string) {
  const t = (type || "").toLowerCase();
  if (['hospital', 'clinic', 'pharmacy', 'dentist'].includes(t)) return '#ef4444'; // Red for Healthcare
  if (['school', 'university', 'college'].includes(t)) return '#3b82f6'; // Blue for Education
  if (['bank', 'atm'].includes(t)) return '#10b981'; // Green for Finance
  if (['supermarket', 'mall', 'marketplace', 'restaurant', 'cafe', 'fast_food'].includes(t)) return '#f59e0b'; // Orange for Food/Retail
  if (['townhall', 'police', 'fire_station', 'post_office'].includes(t)) return '#8b5cf6'; // Purple for Government
  return '#64748b'; // Slate Gray for everything else
}

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
const DEFAULT_CITY_CENTER = [
  120.2843319,
  14.8388901
] as [number, number];

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

  // 1. Keep the size strictly uniform so the map stays clean
  const uniformSize = "24px";
  const uniformIconSize = 14;
  
  // 2. Fetch the dynamic color based on the amenity type!
  const bgColor = getCategoryColor(type); 

  el.style.width = uniformSize;
  el.style.height = uniformSize;
  el.style.backgroundColor = bgColor;

  // 3. Fetch the specific SVG icon (or use a default map pin icon if not found)
  const path = ICON_PATHS[type.toLowerCase()] || "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"; 

  el.innerHTML = `
    <svg width="${uniformIconSize}" height="${uniformIconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="${path}"></path>
    </svg>`;
    
  // Keep the priority attached for the zoom-visibility logic!
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
  
  // 🟢 NEW: A reference the map can instantly read to check if we are navigating
  const isRoutingModeRef = useRef(false);
  
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const liveCoords = [position.coords.longitude, position.coords.latitude];
          
          // 1. Set the Origin state so the app knows where they are
          setOrigin({
            name: "My Current Location",
            coords: liveCoords
          });

          // 2. Move the blue Start Marker to their location
          if (startMarkerRef.current) {
            startMarkerRef.current.setLngLat(liveCoords as any);
          }

          // 3. Smoothly fly the camera to their location
          if (map.current) {
            map.current.flyTo({ center: liveCoords as any, zoom: 15, duration: 2000 });
          }
        },
        (error) => {
          console.warn("User denied GPS on load or signal failed:", error);
          // If they deny it, the map just stays at the DEFAULT_CITY_CENTER
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // 🟢 NEW: Keep the reference perfectly synced with your state
  useEffect(() => {
    if (isRoutingMode && origin && selectedPlace) {
      handleRouteRequest(selectedPlace, travelMode, origin.coords);
    }
  }, [origin, travelMode, isRoutingMode, selectedPlace]); 
  // Because 'origin' is in the array, changing your pin recalculates the route instantly!
  
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

  // ==========================================
  // 🟢 NEW: LIVE GPS LOCATOR
  // ==========================================
  const requestGpsLocation = (destinationPlace: any) => {
    if (!navigator.geolocation) {
      // Browser doesn't support GPS at all -> Fallback to manual pin
      console.warn("Geolocation is not supported by this browser.");
      setIsPickingOrigin(true);
      return;
    }

    // Optional: You could add a temporary instruction here like "Locating you..."
    setRouteInstructions([{ maneuver: { instruction: "📡 Acquiring GPS location..." }, distance: 0 }]);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // SUCCESS! User allowed GPS.
        const userCoords = [position.coords.longitude, position.coords.latitude];
        
        // Update the origin state
        setOrigin({
          name: "My Current Location",
          coords: userCoords
        });

        // Snap the start marker to their real location
        if (startMarkerRef.current) {
          startMarkerRef.current.setLngLat(userCoords as any);
        }

        // We must call handleRouteRequest manually here because the state update 
        // for `origin` might not be fast enough for the next line of code
        handleRouteRequest(destinationPlace, travelMode, userCoords);
      },
      (error) => {
        // FAILED OR DENIED! User blocked GPS or signal is weak.
        console.warn("GPS Error:", error.message);
        
        // Clear the "Acquiring..." message
        setRouteInstructions([]);
        
        // Fallback: Turn on the "Drop a Pin" mode automatically!
        setIsPickingOrigin(true); 
      },
      { 
        enableHighAccuracy: true, // Use the actual GPS chip if available
        timeout: 10000,           // Give up after 10 seconds
        maximumAge: 0             // Don't use a cached location
      }
    );
  };

  const startNavigationFlow = (place: any) => {
    setSelectedPlace(place);
    setIsRoutingMode(true);
    
    if (!origin) {
      // 🟢 TRIGGER GPS INSTEAD OF INSTANT MANUAL PIN
      requestGpsLocation(place);
    } else {
      handleRouteRequest(place, travelMode); 
    }
  };

  const handleRouteRequest = async (place: any, mode: TravelMode, overrideStart?: number[]) => {
    // Use the override if provided by GPS, otherwise use the state origin
    const startingCoords = overrideStart || origin?.coords;
    
    if (!map.current || !startingCoords) return;
    const currentMap = map.current;

    mockRoutes.forEach(route => {
      const fwdLayerId = `route-layer-${route.id}-fwd`;
      const revLayerId = `route-layer-${route.id}-rev`;
      
      if (currentMap.getLayer(fwdLayerId)) currentMap.setLayoutProperty(fwdLayerId, 'visibility', 'none');
      if (currentMap.getLayer(revLayerId)) currentMap.setLayoutProperty(revLayerId, 'visibility', 'none');
      if (currentMap.getLayer(`${fwdLayerId}-outline`)) currentMap.setLayoutProperty(`${fwdLayerId}-outline`, 'visibility', 'none');
      if (currentMap.getLayer(`${revLayerId}-outline`)) currentMap.setLayoutProperty(`${revLayerId}-outline`, 'visibility', 'none');
    });

    const startLon = startingCoords[0];
    const startLat = startingCoords[1];
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
        const directDistance = getDistanceMeters(startingCoords, [endLon, endLat]);
        
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
        const transitPlan = findBestJeepneyRoute(startingCoords, [endLon, endLat]);

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
            const preciseBoardPt = turf.nearestPointOnLine(highResLine, turf.point(startingCoords));
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
        const walk1Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startingCoords[0]},${startingCoords[1]};${finalBoardCoords[0]},${finalBoardCoords[1]}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;
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
      center: DEFAULT_CITY_CENTER,
      zoom: 14,
    });
    map.current = currentMap;

    const startEl = document.createElement("div");
      startEl.style.cssText = "width:34px;height:34px;background:#3b82f6;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(0,0,0,0.3);cursor:pointer;";
      startEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      
      startMarkerRef.current = new mapboxgl.Marker({ element: startEl }).setLngLat(DEFAULT_CITY_CENTER as [number, number]).addTo(currentMap);

    const updateMarkerVisibility = () => {
      const zoom = currentMap.getZoom();
      
      // ==========================================
      // 🟢 MASTER ZOOM CONTROLS
      // Higher number = You must zoom in closer to see them!
      // ==========================================
      const SHOW_HOSPITALS = 14.0;       // Priority 1 (Currently pops up at city/district view)
      const SHOW_SCHOOLS_BANKS = 16.5;   // Priority 2 (Currently pops up at deep neighborhood view)
      const SHOW_EVERYTHING = 17.5;      // Priority 3 (Minor places - only pops up at extreme street view!)

      markers.current.forEach((marker) => {
        const el = marker.getElement();
        
        // Hide everything if navigating
        if (isRoutingModeRef.current) {
          el.style.display = "none";
          return; 
        }

        const priority = parseInt(el.dataset.priority || "3");

        // Execute visibility based on your master controls
        if (zoom < SHOW_HOSPITALS) {
          el.style.display = "none"; // Zoomed out too far: Hide all
        } 
        else if (priority > 1 && zoom < SHOW_SCHOOLS_BANKS) {
          el.style.display = "none"; // Hide Priority 2 & 3
        } 
        else if (priority > 2 && zoom < SHOW_EVERYTHING) {
          el.style.display = "none"; // Hide Priority 3
        } 
        else {
          el.style.display = "flex"; // Show it!
        }
      });
    };

    currentMap.on("load", async () => {
      mockRoutes.forEach((jeepney) => {
        void drawJeepneyRouteLine(jeepney);
      });

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
      // 🟢 THE FIX: Only allow clicking the map to move the pin IF the blue banner is active!
      if (!isPickingOriginRef.current) return; 

      const newCoords = [e.lngLat.lng, e.lngLat.lat];
      
      setOrigin({
        name: `Dropped Pin (${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)})`,
        coords: newCoords
      });
      
      setIsPickingOrigin(false); 
      
      if (startMarkerRef.current) {
        startMarkerRef.current.setLngLat(e.lngLat);
      }

      if (isRoutingModeRef.current) {
        setTimeout(() => {
          const destPlace = document.getElementById("popup-portal-root")?.children.length 
            ? (window as any).currentActivePlace 
            : null; 
            
          // The state dependency array will catch the 'origin' change and trigger routing.
        }, 100);
      }
    });

    return () => { currentMap.remove(); map.current = null; };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden flex">
      
      <Sidebar 
        places={filteredPlaces} 
        userLocation={DEFAULT_CITY_CENTER} 
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

      <div className="relative flex-1 h-full ml-96">
        
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