"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Application Logic
import {  
  allMockRoutesFeatureCollection,
  fetchDrivingAlternatives, 
  findBestJeepneyRouteFeature, 
  fetchExactJeepneyPath,
  fetchWalkingRoute,
  extractRideSegment,
  getClosestCoordIndex,
  findNearestJeepneyRoute,
  getDistanceMeters
} from "../application/getDirections"; 
import { mockRoutes } from "../domain/MockData";

// Components
import AmenityPopupBox from "./AmenityPopupBox";

// --- CONSTANTS & HELPERS ---
const ICON_PATHS: Record<string, string> = {
  "townhall": "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  "hospital": "M12 6v12 M6 12h12",
  "police": "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  "bus_station": "M8 6h8 M6 10h12 M12 21v-4 M9 21h6 M4 18V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9",
  "school": "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c0 2 2 3 6 3s6-1 6-3v-5",
  "bank": "M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M11 10v11 M15 10v11 M20 10v11",
  "user": "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M12 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
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
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const handleRouteRequest = async (place: any) => {
    if (!map.current) return;
    const currentMap = map.current;

    // 1. Hide the background Jeepney lines
    mockRoutes.forEach(route => {
      const fwdLayerId = `route-layer-${route.colorCode}-fwd`;
      const revLayerId = `route-layer-${route.colorCode}-rev`;
      if (currentMap.getLayer(fwdLayerId)) currentMap.setLayoutProperty(fwdLayerId, 'visibility', 'none');
      if (currentMap.getLayer(revLayerId)) currentMap.setLayoutProperty(revLayerId, 'visibility', 'none');
    });

    setSelectedPlace(place);

    const endLon = parseFloat(place.lon);
    const endLat = parseFloat(place.lat);
    const startLon = USER_START_LOCATION[0];
    const startLat = USER_START_LOCATION[1];

    if (isNaN(endLon) || isNaN(endLat)) {
      console.error("Coordinates missing!", place);
      return; 
    }

    // 📍 ==========================================
    // 📍 THE BULLETPROOF DESTINATION MARKER
    // ==========================================
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
    markerEl.style.zIndex = '9999'; 

    (window as any).currentDestMarker = new mapboxgl.Marker({ element: markerEl }) 
      .setLngLat([endLon, endLat])
      .addTo(currentMap);

// ==========================================
    // 🛣️ FETCHING ROUTES & WALKING PATHS
    // ==========================================
    // ==========================================
    // 🛣️ FETCHING ROUTES & WALKING PATHS
    // ==========================================
    // ==========================================
    // 🛣️ FETCHING ROUTES & WALKING PATHS
    // ==========================================
    try {
      let finalColor = "#3b82f6"; 
      let routeGeometry: any = null;
      let walkingConnectorsGeoJSON: any = null;
      let allCoordinatesToFrame: any[] = [];
      
      const directDistance = getDistanceMeters([startLon, startLat], [endLon, endLat]);
      let needsFullWalk = directDistance < 400; // Walk if under 400m
      let walkReason = `Destination is very close (${Math.round(directDistance)}m).`;

      if (!needsFullWalk) {
        // 🟢 1. USE THE SMART DISTANCE MATH (It won't miss the Yellow Line now!)
        const transitRoute: any = findNearestJeepneyRoute(allMockRoutesFeatureCollection, [startLon, startLat], [endLon, endLat]);

        if (transitRoute?.features && transitRoute.features.length > 0) {
          
          let fullRouteCoords = (transitRoute.features[0].geometry as any).coordinates;
          if (Array.isArray(fullRouteCoords[0]) && Array.isArray(fullRouteCoords[0][0])) {
              fullRouteCoords = fullRouteCoords.flat();
          }

          const rawColor = transitRoute.features[0].properties?.routeColor;
          finalColor = JEEPNEY_HEX_COLORS[rawColor] || rawColor || finalColor;
          
          let rideSegment = extractRideSegment(fullRouteCoords, [startLon, startLat], [endLon, endLat]);

          if (rideSegment.length >= 2) {
            const rawBoardingPoint = rideSegment[0];
            const rawDropoffPoint = rideSegment[rideSegment.length - 1];

            // 🟢 2. IS THE RIDE WORTH IT?
            const walkToStartDist = getDistanceMeters([startLon, startLat], rawBoardingPoint);
            const walkFromEndDist = getDistanceMeters(rawDropoffPoint, [endLon, endLat]);
            const totalWalkForTransit = walkToStartDist + walkFromEndDist;

            if (totalWalkForTransit > directDistance) {
                needsFullWalk = true;
                walkReason = "Walking to the Jeepney route is longer than walking directly to the destination.";
            } else {
                
                // 🟢 3. PERFECT ROAD SNAPPING: Using your fetchExactJeepneyPath function!
                console.log("Snapping the Jeepney ride segment to the exact road network...");
                const snappedData: any = await fetchExactJeepneyPath(rideSegment);

                // Check standard mapbox routing OR mapbox matching formats
                if (snappedData?.routes?.[0]?.geometry) {
                    routeGeometry = snappedData.routes[0].geometry;
                } else if (snappedData?.matchings?.[0]?.geometry) {
                    routeGeometry = snappedData.matchings[0].geometry;
                } else {
                    routeGeometry = { type: "LineString", coordinates: rideSegment };
                }

                allCoordinatesToFrame = [...routeGeometry.coordinates];

                const boardingPoint = routeGeometry.coordinates[0];
                const dropoffPoint = routeGeometry.coordinates[routeGeometry.coordinates.length - 1];

                console.log("Fetching true walking paths to the Jeepney stops...");
                
                // 🟢 4. FETCH REAL WALKING ROUTES TO THE TERMINALS
                const [walkToStartData, walkFromEndData] = await Promise.all([
                  fetchWalkingRoute([startLon, startLat], boardingPoint),
                  fetchWalkingRoute(dropoffPoint, [endLon, endLat])
                ]);

                const walkingFeatures = [];
                
                // Add Start Walk
                if (walkToStartData?.routes?.[0]?.geometry) {
                  walkingFeatures.push({ type: "Feature", properties: {}, geometry: walkToStartData.routes[0].geometry });
                  allCoordinatesToFrame.push(...walkToStartData.routes[0].geometry.coordinates);
                } else {
                  walkingFeatures.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[startLon, startLat], boardingPoint] } });
                  allCoordinatesToFrame.push([startLon, startLat], boardingPoint);
                }

                // Add End Walk
                if (walkFromEndData?.routes?.[0]?.geometry) {
                  walkingFeatures.push({ type: "Feature", properties: {}, geometry: walkFromEndData.routes[0].geometry });
                  allCoordinatesToFrame.push(...walkFromEndData.routes[0].geometry.coordinates);
                } else {
                  walkingFeatures.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [dropoffPoint, [endLon, endLat]] } });
                  allCoordinatesToFrame.push(dropoffPoint, [endLon, endLat]);
                }

                walkingConnectorsGeoJSON = { type: "FeatureCollection", features: walkingFeatures };
            }
          } else {
              needsFullWalk = true;
              walkReason = "Jeepney ride is too short to be useful.";
          }
        } else {
          needsFullWalk = true;
          walkReason = "No Jeepney route found connecting these locations.";
        }
      }

      // 🟢 5. FULL WALK MODE
      if (needsFullWalk) {
        console.warn(`${walkReason} Fetching a full walking route.`);
        const fullWalkData: any = await fetchWalkingRoute([startLon, startLat], [endLon, endLat]);
        
        if (fullWalkData?.routes?.[0]?.geometry) {
          walkingConnectorsGeoJSON = {
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: {}, geometry: fullWalkData.routes[0].geometry }]
          };
          allCoordinatesToFrame = [...fullWalkData.routes[0].geometry.coordinates];
          routeGeometry = null; 
        } else {
          routeGeometry = { type: "LineString", coordinates: [[startLon, startLat], [endLon, endLat]] };
          allCoordinatesToFrame = [[startLon, startLat], [endLon, endLat]];
        }
      }

      const activeRouteGeoJSON = {
        type: "FeatureCollection",
        features: routeGeometry ? [{ type: "Feature", properties: {}, geometry: routeGeometry }] : []
      }
      
      // ... (KEEP ALL DRAWING LOGIC BELOW EXACTLY THE SAME)

      // drawing map lines
      const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(activeRouteGeoJSON as any);
        currentMap.setPaintProperty("active-route-layer", "line-color", finalColor);
        currentMap.setLayoutProperty("active-route-layer", "visibility", "visible");
      } else {
        currentMap.addSource("active-route", { type: "geojson", data: activeRouteGeoJSON as any });
        currentMap.addLayer({
          id: "active-route-layer",
          type: "line",
          source: "active-route",
          layout: { "line-join": "round", "line-cap": "round", "visibility": "visible" },
          paint: { "line-color": finalColor, "line-width": 8, "line-opacity": 0.9 },
        });
      }

      // ==========================================
      // 🚶 DRAWING THE WALKING CONNECTORS
      // ==========================================
      const walkSource = currentMap.getSource("active-walking-route") as mapboxgl.GeoJSONSource;
      
      if (walkingConnectorsGeoJSON) {
        if (walkSource) {
          walkSource.setData(walkingConnectorsGeoJSON);
          currentMap.setLayoutProperty("active-walking-layer", "visibility", "visible");
          currentMap.setPaintProperty("active-walking-layer", "line-color", finalColor);
        } else {
          currentMap.addSource("active-walking-route", { type: "geojson", data: walkingConnectorsGeoJSON });
          currentMap.addLayer({
            id: "active-walking-layer",
            type: "line",
            source: "active-walking-route",
            layout: { "line-join": "round", "line-cap": "round", "visibility": "visible" },
            paint: { 
              "line-color": finalColor, 
              "line-width": 4,          
              "line-dasharray": [2, 2], // Dashed to indicate walking!
              "line-opacity": 0.8 
            },
          });
        }
      } else if (walkSource) {
        currentMap.setLayoutProperty("active-walking-layer", "visibility", "none");
      }

      // 🎥 Smoothly zoom the camera to fit EVERYTHING (walking paths + main path)
      const bounds = new mapboxgl.LngLatBounds();
      allCoordinatesToFrame.forEach((c: any) => bounds.extend(c));
      currentMap.fitBounds(bounds, { padding: 60, duration: 1200 });

    } catch (error) { 
      console.error("Routing Error:", error); 
    }
  };

  const JEEPNEY_HEX_COLORS: Record<string, string> = {
    "BLUE": "#2563eb",   
    "RED": "#ef4444",    
    "YELLOW": "#eab308", 
    "GREEN": "#22c55e",  
  };

  const drawJeepneyRouteLine = async (jeepney: any) => {
    const routeName = jeepney?.colorCode || "UNKNOWN_ROUTE";
    console.log(`🟣 [DRAW-DEBUG 1] Starting draw process for ${routeName}`, jeepney);

    if (!map.current) {
      console.error(`🟣 [DRAW-DEBUG ERROR] map.current is missing! Cannot draw ${routeName}.`);
      return;
    }
    if (!jeepney?.path || jeepney.path.length < 2) {
      console.warn(`🟣 [DRAW-DEBUG WARNING] ${routeName} has invalid path coordinates!`, jeepney?.path);
      return;
    }
    
    const actualColor = JEEPNEY_HEX_COLORS[jeepney.colorCode] || "#000000";
    const currentMap = map.current;

    // ==========================================
    // FORWARD PATH
    // ==========================================
    const fwdSourceId = `route-source-${jeepney.colorCode}-fwd`;
    const fwdLayerId = `route-layer-${jeepney.colorCode}-fwd`;

    console.log(`🟣 [DRAW-DEBUG 2] Fetching FWD directions for ${routeName}...`);
    try {
      // 🟢 1. Use the new cycling fetcher instead of driving alternatives
      const fwdData: any = await fetchExactJeepneyPath(jeepney.path);
      
      let fwdGeoJSON;

      if (fwdData?.routes?.[0]?.geometry) {
        // Mapbox successfully snapped to the road using the cycling profile!
        fwdGeoJSON = {
          type: "Feature", properties: {}, geometry: fwdData.routes[0].geometry
        };
      } else {
        // Absolute last resort fallback
        fwdGeoJSON = {
          type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: jeepney.path }
        };
      }

      const fwdSource = currentMap.getSource(fwdSourceId) as mapboxgl.GeoJSONSource;
      if (fwdSource) {
        fwdSource.setData(fwdGeoJSON as any);
      } else {
        currentMap.addSource(fwdSourceId, { type: "geojson", data: fwdGeoJSON as any });
        currentMap.addLayer({
          id: fwdLayerId,
          type: "line",
          source: fwdSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": actualColor, "line-width": 8, "line-opacity": 0.9 },
        });
      }
    } catch (error) { 
      console.error(`Error with FWD path for ${routeName}:`, error); 
    }

    // ==========================================
    // REVERSE PATH
    // ==========================================
    const revSourceId = `route-source-${jeepney.colorCode}-rev`;
    const revLayerId = `route-layer-${jeepney.colorCode}-rev`;
    
    const returnPath = [...jeepney.path].reverse();

    console.log(`🟣 [DRAW-DEBUG 5] Fetching REV directions for ${routeName}...`);
    try {
      // 🟢 1. Use the new cycling fetcher instead of driving alternatives
      const revData: any = await fetchExactJeepneyPath(returnPath);
      
      let revGeoJSON;

      if (revData?.routes?.[0]?.geometry) {
        // Mapbox successfully snapped to the road using the cycling profile!
        revGeoJSON = {
          type: "Feature", properties: {}, geometry: revData.routes[0].geometry
        };
      } else {
        // Absolute last resort fallback
        revGeoJSON = {
          type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: jeepney.path }
        };
      }

      const revSource = currentMap.getSource(revSourceId) as mapboxgl.GeoJSONSource;
      if (revSource) {
        revSource.setData(revGeoJSON as any);
      } else {
        currentMap.addSource(revSourceId, { type: "geojson", data: revGeoJSON as any });
        currentMap.addLayer({
          id: revLayerId,
          type: "line",
          source: revSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": actualColor, "line-width": 8, "line-opacity": 0.9 },
        });
      }
    } catch (error) { 
      console.error(`Error with FWD path for ${routeName}:`, error); 
    }
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
      // Background lines
      // currentMap.addSource("background-routes", { type: "geojson", data: allMockRoutesFeatureCollection() });
      // currentMap.addLayer({
      //   id: "background-routes-layer",
      //   type: "line",
      //   source: "background-routes",
      //   paint: { "line-color": ["get", "routeColor"], "line-width": 4, "line-opacity": 0.4 },
      // });

      mockRoutes.forEach((jeepney) => {
        void drawJeepneyRouteLine(jeepney);
      });

      // mockRoutes.forEach(r => {
      //   const lid = `route-layer-${r.colorCode}`;
      //   if (map.current?.getLayer(lid)) {
      //     map.current.setLayoutProperty(lid, 'visibility', 'none');
      //   }
      // });

      // User Marker
      const startEl = document.createElement("div");
      startEl.style.cssText = "width:34px;height:34px;background:#3b82f6;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(0,0,0,0.3);cursor:pointer;";
      startEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      
      startMarkerRef.current = new mapboxgl.Marker({ element: startEl }).setLngLat(USER_START_LOCATION).addTo(currentMap);

      // Amenities & Click-to-Popup
      try {
        const res = await fetch("/api/amenities");
        const places = parseAmenities(await res.json());
        places.forEach((place: any) => {
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
      USER_START_LOCATION[0] = e.lngLat.lng;
      USER_START_LOCATION[1] = e.lngLat.lat;
      if (startMarkerRef.current) startMarkerRef.current.setLngLat(e.lngLat);
    });

    return () => { currentMap.remove(); map.current = null; };
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div ref={mapContainer} className="w-full h-screen" />
      {selectedPlace && document.getElementById("popup-portal-root") && (
        createPortal(
          <AmenityPopupBox 
            place={selectedPlace} 
            onClose={() => {
              setSelectedPlace(null);
              
              // 1. Show the background routes again
              mockRoutes.forEach(r => {
                const fwdLayerId = `route-layer-${r.colorCode}-fwd`;
                const revLayerId = `route-layer-${r.colorCode}-rev`;
                
                if (map.current?.getLayer(fwdLayerId)) {
                  map.current.setLayoutProperty(fwdLayerId, 'visibility', 'visible');
                }
                if (map.current?.getLayer(revLayerId)) {
                  map.current.setLayoutProperty(revLayerId, 'visibility', 'visible');
                }
              });

              // 2. Hide the active route & marker to clean up the map
              if (map.current?.getLayer("active-route-layer")) {
                map.current.setLayoutProperty("active-route-layer", 'visibility', 'none');
              }
              if ((window as any).currentDestMarker) {
                (window as any).currentDestMarker.remove();
              }
            }}
            onGetDirections={handleRouteRequest}
          />,
          document.getElementById("popup-portal-root")!
        )
      )}
    </div>
  );
}