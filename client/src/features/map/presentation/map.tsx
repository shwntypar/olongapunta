"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { 
  allMockRoutesFeatureCollection, 
  fetchDrivingAlternatives, 
  findBestJeepneyRouteFeature 
} from "../application/getDirections"; 
import { mockRoutes } from "../domain/MockData";
// import path from "path"; // Not used

// 🗑️ CLEANUP: Removed unused Lucide and ReactDOMServer imports

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

// The central starting point for all routes
const USER_START_LOCATION = [120.283479, 14.837409] as [number, number];

// 🏆 PRIORITY DICTIONARY
// ... (AMENITY_PRIORITY remains same)
const AMENITY_PRIORITY: Record<string, number> = {
  // 🔴 Level 1: Major Landmarks & Transit
  "townhall": 1,
  "hospital": 1,
  "police": 1,
  "fire_station": 1,
  "bus_station": 1,
  "ferry_terminal": 1,
  "university": 1,
  "college": 1,

  // 🟠 Level 2: Community Hubs & Essentials
  "school": 2,
  "clinic": 2,
  "dentist": 2,
  "doctors": 2,
  "pharmacy": 2,
  "bank": 2,
  "atm": 2,
  "supermarket": 2,
  "mall": 2,
  "marketplace": 2,
  "place_of_worship": 2,
  "post_office": 2,
  "fuel": 2,
  "gas": 2,

  // 🗑️ Level 4: Map Clutter (Hide completely)
  "waste_basket": 4,
  "toilets": 4,
  "parking_space": 4,
  "motorcycle_parking": 4,
  "bicycle_parking": 4,
  "shelter": 4,
  "compressed_air": 4
};

// Helper function to get priority
function getPriority(type: string): number {
  return AMENITY_PRIORITY[type.toLowerCase()] || 3;
}

// 🎨 CUSTOM SVG MARKER GENERATOR
// ... ( createCustomMarkerElement remains same)
function createCustomMarkerElement(type: string, priority: number) {
  const el = document.createElement("div");
  el.className = "custom-marker";
  
  // Base Styling
  el.style.borderRadius = "50%";
  el.style.border = "2px solid white";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.cursor = "pointer";
  el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

  let bgColor = "#EF4444"; 
  let size = "14px";
  let iconSize = 10;

  if (priority === 1) {
    bgColor = "#000000";
    size = "28px";
    iconSize = 16;
  } else if (priority === 2) {
    bgColor = "#F59E0B";
    size = "22px";
    iconSize = 14;
  } else {
    size = "12px"; 
  }

  el.style.width = size;
  el.style.height = size;
  el.style.backgroundColor = bgColor;

  // Insert Raw SVG Path if priority is high
  if (priority <= 2) {
    const path = ICON_PATHS[type] || ICON_PATHS["bank"]; // Default fallback
    el.innerHTML = `
      <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="${path}"></path>
      </svg>
    `;
  }

  el.dataset.priority = priority.toString();
  return el;
}

// =====================================================================
// 🛠️ OUTSIDE HELPERS: parseAmenities, getAmenitiesUrl remain same
// =====================================================================
function getAmenitiesUrl() {
  const custom = process.env.NEXT_PUBLIC_AMENITIES_URL?.trim();
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  return custom || (base ? `${base}/amenities` : "/api/amenities");
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

// =====================================================================
// 🗺️ MAIN MAP COMPONENT
// =====================================================================

export default function MapComponent() {
  // 👇 🟢 FIX: Moved startMarkerRef to the very top of the hook block
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return;

    // 👁️ ZOOM VISIBILITY CONTROLLER
    const updateMarkerVisibility = () => {
      if (!currentMap) return;
      const zoom = currentMap.getZoom();

      markers.current.forEach((marker) => {
        const el = marker.getElement();
        const priority = parseInt(el.dataset.priority || "3");

        // 🗑️ Level 4: Always hide
        if (priority === 4) {
          el.style.display = "none";
        } 
        // 🔴 Zoom < 13: Hide EVERYTHING
        else if (zoom < 13.0) {
          el.style.display = "none";
        } 
        // 🟠 Zoom Midway: Show ONLY Level 1 (Black Stars)
        else if (zoom < 14.5 && priority > 1) {
          el.style.display = "none";
        } 
        // 🟡 Zoom In: Show Level 1 & 2 (Amber Diamonds)
        else if (zoom < 15.5 && priority > 2) {
          el.style.display = "none";
        } 
        // 🟢 Zoom Max: Show everything
        else {
          el.style.display = "flex";
        }
      });
    };

    // 1. INITIALIZE MAP
    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: USER_START_LOCATION,
      zoom: 14,
    });
    map.current = currentMap;

    currentMap.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      
      USER_START_LOCATION[0] = lng;
      USER_START_LOCATION[1] = lat;

      if (startMarkerRef.current) {
        startMarkerRef.current.setLngLat([lng, lat]);
      }

      console.log(`🏠 Location updated to: ${lng.toFixed(4)}, ${lat.toFixed(4)}`);
    });

    // 2. CORE ROUTING LOGIC
    // ... (handleRouteRequest remains same)
    const handleRouteRequest = async (endLon: number, endLat: number) => {
      console.log(`\n🚦 ========================================`);
      console.log(`📍 Route requested to exactly: [${endLon}, ${endLat}]`);
      
      if ((window as any).currentDestMarker) {
         (window as any).currentDestMarker.remove();
      }
      (window as any).currentDestMarker = new mapboxgl.Marker({ color: "#FF00FF" }) 
        .setLngLat([endLon, endLat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText("🎯 Your Destination"))
        .addTo(currentMap);

      try {
        let routeGeoJSON = await fetchDrivingAlternatives(
          USER_START_LOCATION[0], USER_START_LOCATION[1], endLon, endLat
        );

        if (!routeGeoJSON || !routeGeoJSON.features || routeGeoJSON.features.length === 0) {
          console.error("❌ Mapbox API failed to return a route.");
          return;
        }

        routeGeoJSON.features = routeGeoJSON.features.reverse(); 

        const transitRoute = await findBestJeepneyRouteFeature(
          USER_START_LOCATION[0], USER_START_LOCATION[1], endLon, endLat
        );

        if (transitRoute && transitRoute.features.length > 0) {
           const jeepneyName = transitRoute.features[0].properties?.name;
           const jeepneyColor = transitRoute.features[0].properties?.routeColor;
           
           console.log(`🚌 Smart Transit: Take the ${jeepneyName}!`);

           routeGeoJSON.features.forEach((f: any) => {
              if (f.properties) f.properties.routeColor = jeepneyColor;
           });
        }

        console.log("✅ Exact route generated. Drawing on map...");

        const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(routeGeoJSON);
        } else {
          currentMap.addSource("active-route", { type: "geojson", data: routeGeoJSON });
          currentMap.addLayer({
            id: "active-route-layer",
            type: "line",
            source: "active-route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": ["get", "routeColor"], "line-width": 8, "line-opacity": 0.9 },
          });
        }

        const bounds = new mapboxgl.LngLatBounds();
        routeGeoJSON.features.forEach((feature: any) => {
          if (feature.geometry && feature.geometry.coordinates) {
            feature.geometry.coordinates.forEach((coord: [number, number]) => {
               bounds.extend(coord);
            });
          }
        });
        
        // Firing update immediately after fitting bounds to avoid flash of pins
        currentMap.fitBounds(bounds, { padding: 60, duration: 1200 });
        console.log(`🚦 ========================================\n`);

      } catch (error) {
        console.error("💥 CRITICAL ERROR in handleRouteRequest:", error);
      }
    };

    // 🌐 NAVIGATION API
    const drawBlueJeepneyRoute = async () => {
      console.log("🌐 Fetching Navigation API for the Blue Jeepney Route...");

      const blueRoute = mockRoutes.find(r => r.colorCode === 'BLUE');

      if (!blueRoute || !blueRoute.path || blueRoute.path.length < 2) {
        console.error("❌ Blue route not found.");
        return;
      }

      const blueStart = blueRoute.path[0];
      const blueEnd = blueRoute.path[blueRoute.path.length - 1]; 

      console.log(`📍 Blue Start: [${blueStart}] | 📍 Blue End: [${blueEnd}]`);

      try {
        let routeGeoJSON = await fetchDrivingAlternatives(
          blueStart[0], blueStart[1],
          blueEnd[0], blueEnd[1]
        );

        if (!routeGeoJSON || !routeGeoJSON.features?.length) {
           console.error("❌ Mapbox API failed.");
           return;
        }

        routeGeoJSON.features = routeGeoJSON.features.reverse();

        routeGeoJSON.features.forEach((f: any) => {
            if (f.properties) f.properties.routeColor = "#0000FF";
        });

        const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(routeGeoJSON);
        } else {
          currentMap.addSource("active-route", { type: "geojson", data: routeGeoJSON });
          currentMap.addLayer({
            id: "active-route-layer",
            type: "line",
            source: "active-route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": ["get", "routeColor"], "line-width": 8, "line-opacity": 0.9 },
          });
        }

        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(blueStart as [number, number]);
        bounds.extend(blueEnd as [number, number]);
        currentMap.fitBounds(bounds, { padding: 60, duration: 1200 });

        console.log("✅ Blue Jeepney Navigation applied!");

      } catch (error) {
         console.error("💥 Error drawing Blue Jeepney route:", error);
      }
    };

    // 3. MAP LOAD SEQUENCE
    currentMap.on("load", async () => {

      // A. Draw all background jeepney routes
      currentMap.addSource("background-routes", { type: "geojson", data: allMockRoutesFeatureCollection() });
      currentMap.addLayer({
        id: "background-routes-layer",
        type: "line",
        source: "background-routes",
        paint: { "line-color": ["get", "routeColor"], "line-width": 4, "line-opacity": 0.4 },
      });

      // B. Drop a Redesigned Start Marker
      const startEl = document.createElement("div");
      
      startEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      `;
      
      startEl.style.width = "34px";
      startEl.style.height = "34px";
      startEl.style.backgroundColor = "#3b82f6"; 
      startEl.style.borderRadius = "50%";
      startEl.style.border = "3px solid white";
      startEl.style.display = "flex";
      startEl.style.alignItems = "center";
      startEl.style.justifyContent = "center";
      startEl.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
      startEl.style.cursor = "pointer";

      startEl.animate([
        { boxShadow: "0 0 0 0px rgba(59, 130, 246, 0.5)" },
        { boxShadow: "0 0 0 15px rgba(59, 130, 246, 0)" }
      ], {
        duration: 2000,
        iterations: Infinity
      });

      const startMarker = new mapboxgl.Marker({ element: startEl })
        .setLngLat(USER_START_LOCATION)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText("You are here"))
        .addTo(currentMap);

      // Save to ref first
      startMarkerRef.current = startMarker; 
      markers.current.push(startMarker);

      // C. Fetch, Clean, and Draw Red Amenity Markers
      try {
        const res = await fetch(getAmenitiesUrl());
        if (!res.ok) throw new Error("Amenities API failed");
        
        const places = parseAmenities(await res.json());

        const uniqueTypes = new Set(places.map((p: any) => p.type));
        console.log("🔍 ALL AMENITY TYPES IN DATABASE:");
        console.log(Array.from(uniqueTypes).sort());

        places.forEach((place: any) => {
          if (!place.lat || !place.lon) return;

          const priority = getPriority(place.type);
          const popupHtml = `<div style="color:black;padding:4px"><strong>${place.name}</strong><br/><small>${place.type}</small></div>`;
          
          const customDOMElement = createCustomMarkerElement(place.type, priority);

          const marker = new mapboxgl.Marker({ element: customDOMElement })
            .setLngLat([place.lon, place.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml))
            .addTo(currentMap);

          marker.getElement().addEventListener("click", (e) => {
            e.stopPropagation(); 
            handleRouteRequest(place.lon, place.lat);
          });
          
          markers.current.push(marker);
        });

        // Trigger visibility once everything is loaded
        updateMarkerVisibility();

      } catch (error) {
        console.error("Failed to load amenities:", error);
      }

      void drawBlueJeepneyRoute();
      
      // Changed to 'zoomend' for better performance
      currentMap.on("zoomend", updateMarkerVisibility);
      currentMap.on("moveend", updateMarkerVisibility);
    });

    // 4. CLEANUP ON UNMOUNT
    return () => {
      markers.current.forEach(m => m.remove());
      markers.current = [];
      if (startMarkerRef.current) startMarkerRef.current.remove();
      startMarkerRef.current = null;
      currentMap.remove();
      map.current = null;
    };
  }, []);

  return <div ref={mapContainer} className="w-full h-screen" />;
}