"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Application Logic
import {  
  fetchExactJeepneyPath,
  fetchWalkingRoute,
  getDistanceMeters
} from "../application/getDirections"; 
import { mockRoutes } from "../domain/MockData";

// Components
import AmenityPopupBox from "./AmenityPopupBox";
import Sidebar from "./sidebar"; // 🟢 Ensure casing matches your actual file name!

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

const JEEPNEY_HEX_COLORS: Record<string, string> = {
  "BLUE": "#2563eb",   
  "RED": "#ef4444",    
  "YELLOW": "#eab308", 
  "GREEN": "#22c55e",  
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
  const [places, setPlaces] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Trip Planning States
  const [origin, setOrigin] = useState<{name: string, coords: number[]} | null>(null);
  const [isPickingOrigin, setIsPickingOrigin] = useState(false);
  const isPickingOriginRef = useRef(false); // Ref needed to prevent Mapbox stale closures

  const [activeRouteFilters, setActiveRouteFilters] = useState<string[]>(["ALL"]);

  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Sync state to ref for Mapbox events
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

  const toggleRouteFilter = (colorCode: string) => {
    if (colorCode === "ALL") {
      setActiveRouteFilters(["ALL"]);
      return;
    }
    setActiveRouteFilters(prev => {
      if (prev.includes("ALL")) return [colorCode];
      if (prev.includes(colorCode)) {
        const newFilters = prev.filter(c => c !== colorCode);
        return newFilters.length === 0 ? ["ALL"] : newFilters;
      }
      return [...prev, colorCode];
    });
  };

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const currentMap = map.current;

    mockRoutes.forEach(route => {
      const fwdLayerId = `route-layer-${route.colorCode}-fwd`;
      const revLayerId = `route-layer-${route.colorCode}-rev`;
      const isVisible = activeRouteFilters.includes("ALL") || activeRouteFilters.includes(route.colorCode);
      const visibilityValue = isVisible ? 'visible' : 'none';

      if (currentMap.getLayer(fwdLayerId)) currentMap.setLayoutProperty(fwdLayerId, 'visibility', visibilityValue);
      if (currentMap.getLayer(revLayerId)) currentMap.setLayoutProperty(revLayerId, 'visibility', visibilityValue);
    });
  }, [activeRouteFilters]);

  // 🟢 Multimodal handleRouteRequest (Driving, Walking, Cycling)
  const handleRouteRequest = async (place: any, mode: 'walking' | 'cycling' | 'driving') => {
    if (!map.current || !origin) return;
    const currentMap = map.current;

    // Hide background Jeepney lines for clear navigation
    mockRoutes.forEach(route => {
      const fwdLayerId = `route-layer-${route.colorCode}-fwd`;
      const revLayerId = `route-layer-${route.colorCode}-rev`;
      if (currentMap.getLayer(fwdLayerId)) currentMap.setLayoutProperty(fwdLayerId, 'visibility', 'none');
      if (currentMap.getLayer(revLayerId)) currentMap.setLayoutProperty(revLayerId, 'visibility', 'none');
    });

    setSelectedPlace(place);

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
      // Dynamic Mapbox API Call based on selected mode
      const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        console.warn(`No route found for ${mode}.`);
        return;
      }

      const routeGeometry = data.routes[0].geometry;
      const allCoordinatesToFrame = routeGeometry.coordinates;

      // Visual Styles based on Mode
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

      // Cleanup old walking layer if it exists
      if (currentMap.getLayer("active-walking-layer")) {
        currentMap.setLayoutProperty("active-walking-layer", "visibility", "none");
      }

      const bounds = new mapboxgl.LngLatBounds();
      allCoordinatesToFrame.forEach((c: any) => bounds.extend(c));
      currentMap.fitBounds(bounds, { padding: 80, duration: 1200 });

    } catch (error) { 
      console.error("Routing Error:", error); 
    }
  };

  const drawJeepneyRouteLine = async (jeepney: any) => {
    const routeName = jeepney?.colorCode || "UNKNOWN_ROUTE";
    if (!map.current) return;
    if (!jeepney?.path || jeepney.path.length < 2) return;
    
    const actualColor = JEEPNEY_HEX_COLORS[jeepney.colorCode] || "#000000";
    const currentMap = map.current;

    const fwdSourceId = `route-source-${jeepney.colorCode}-fwd`;
    const fwdLayerId = `route-layer-${jeepney.colorCode}-fwd`;

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
          id: fwdLayerId, type: "line", source: fwdSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": actualColor, "line-width": 8, "line-opacity": 0.9 },
        });
      }
    } catch (error) { console.error(error); }

    const revSourceId = `route-source-${jeepney.colorCode}-rev`;
    const revLayerId = `route-layer-${jeepney.colorCode}-rev`;
    const returnPath = [...jeepney.path].reverse();

    try {
      const revData: any = await fetchExactJeepneyPath(returnPath);
      let revGeoJSON = revData?.routes?.[0]?.geometry
        ? { type: "Feature", properties: {}, geometry: revData.routes[0].geometry }
        : { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: jeepney.path } };

      const revSource = currentMap.getSource(revSourceId) as mapboxgl.GeoJSONSource;
      if (revSource) {
        revSource.setData(revGeoJSON as any);
      } else {
        currentMap.addSource(revSourceId, { type: "geojson", data: revGeoJSON as any });
        currentMap.addLayer({
          id: revLayerId, type: "line", source: revSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": actualColor, "line-width": 8, "line-opacity": 0.9 },
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

    // 🟢 CLICK HANDLER: Handles both normal clicks and "Picking Origin" mode
    currentMap.on("click", (e) => {
      if (isPickingOriginRef.current) {
        setOrigin({
          name: `Dropped Pin (${e.lngLat.lat.toFixed(4)}, ${e.lngLat.lng.toFixed(4)})`,
          coords: [e.lngLat.lng, e.lngLat.lat]
        });
        setIsPickingOrigin(false); 
        
        if (startMarkerRef.current) startMarkerRef.current.setLngLat(e.lngLat);
      } else {
        // Normal behavior if not picking an origin
        USER_START_LOCATION[0] = e.lngLat.lng;
        USER_START_LOCATION[1] = e.lngLat.lat;
        if (startMarkerRef.current) startMarkerRef.current.setLngLat(e.lngLat);
      }
    });

    return () => { currentMap.remove(); map.current = null; };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden flex">
      
      {/* 🟢 The Multimodal Sidebar */}
      <Sidebar 
        places={filteredPlaces} 
        userLocation={USER_START_LOCATION} 
        origin={origin}
        destination={selectedPlace}
        onSelectOriginMode={() => setIsPickingOrigin(true)}
        onNavigate={handleRouteRequest} 
      />

      {/* 🟢 UI Notification for Origin Selection */}
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
              onClick={() => toggleRouteFilter("ALL")}
              className={`px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap shadow-md transition-all ${
                activeRouteFilters.includes("ALL") ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              All Routes
            </button>

            {Object.entries(JEEPNEY_HEX_COLORS).map(([colorName, hexValue]) => {
              const isActive = activeRouteFilters.includes(colorName);
              return (
                <button
                  key={colorName}
                  onClick={() => toggleRouteFilter(colorName)}
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
                
                mockRoutes.forEach(r => {
                  const fwdLayerId = `route-layer-${r.colorCode}-fwd`;
                  const revLayerId = `route-layer-${r.colorCode}-rev`;
                  if (map.current?.getLayer(fwdLayerId)) map.current.setLayoutProperty(fwdLayerId, 'visibility', 'visible');
                  if (map.current?.getLayer(revLayerId)) map.current.setLayoutProperty(revLayerId, 'visibility', 'visible');
                });

                if (map.current?.getLayer("active-route-layer")) map.current.setLayoutProperty("active-route-layer", 'visibility', 'none');
                if (map.current?.getLayer("active-walking-layer")) map.current.setLayoutProperty("active-walking-layer", 'visibility', 'none');
                if ((window as any).currentDestMarker) (window as any).currentDestMarker.remove();
              }}
              onGetDirections={() => {}} // Disabled here since Sidebar handles it now
            />,
            document.getElementById("popup-portal-root")!
          )
        )}

      </div>
    </div>
  );
}