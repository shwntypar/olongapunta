"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Application Logic
import { 
  allMockRoutesFeatureCollection, 
  fetchDrivingAlternatives, 
  findBestJeepneyRouteFeature 
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

  // 🔴 Function: Route Navigation Logic
  const handleRouteRequest = async (place: any) => {
    if (!map.current) return;
    const currentMap = map.current;

    // 🟢 ADD THIS: Remove the initial blue line if it exists
    if (currentMap.getLayer("blue-marker-route-layer")) {
      currentMap.removeLayer("blue-marker-route-layer");
    }
    if (currentMap.getSource("blue-marker-route")) {
      currentMap.removeSource("blue-marker-route");
    }

    setSelectedPlace(place);
    const { lon: endLon, lat: endLat } = place;

    if ((window as any).currentDestMarker) (window as any).currentDestMarker.remove();
    (window as any).currentDestMarker = new mapboxgl.Marker({ color: "#FF00FF" }) 
      .setLngLat([endLon, endLat])
      .addTo(currentMap);

    try {
      let routeGeoJSON = await fetchDrivingAlternatives(
        USER_START_LOCATION[0], USER_START_LOCATION[1], endLon, endLat
      );

      if (!routeGeoJSON?.features?.length) return;
      routeGeoJSON.features = [...routeGeoJSON.features].reverse(); 

      const transitRoute = await findBestJeepneyRouteFeature(
        USER_START_LOCATION[0], USER_START_LOCATION[1], endLon, endLat
      );

      if (transitRoute?.features && transitRoute.features.length > 0) {
        const jeepneyColor = transitRoute.features[0].properties?.routeColor;
        routeGeoJSON.features.forEach((f: any) => {
           if (f.properties) f.properties.routeColor = jeepneyColor;
        });
      }

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
      routeGeoJSON.features.forEach((f: any) => {
        if (f.geometry?.coordinates) f.geometry.coordinates.forEach((c: any) => bounds.extend(c));
      });
      currentMap.fitBounds(bounds, { padding: 60, duration: 1200 });
    } catch (error) { console.error("Routing Error:", error); }
  };

  // 🔵 Function: Blue Jeepney Marker Line
  const drawBlueJeepneyRoute = async () => {
    if (!map.current) return;
    const currentMap = map.current;

    const blueRoute = mockRoutes.find(r => r.colorCode === 'BLUE');
    if (!blueRoute?.path || blueRoute.path.length < 2) return;

    try {
      let routeGeoJSON = await fetchDrivingAlternatives(
        blueRoute.path[0][0], blueRoute.path[0][1],
        blueRoute.path[blueRoute.path.length - 1][0], blueRoute.path[blueRoute.path.length - 1][1]
      );
      if (!routeGeoJSON?.features?.length) return;

      routeGeoJSON.features.forEach((f: any) => {
        if (f.properties) f.properties.routeColor = "#0000FF";
      });

      const source = currentMap.getSource("blue-marker-route") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(routeGeoJSON);
      } else {
        currentMap.addSource("blue-marker-route", { type: "geojson", data: routeGeoJSON });
        currentMap.addLayer({
          id: "blue-marker-route-layer",
          type: "line",
          source: "blue-marker-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "routeColor"], "line-width": 8, "line-opacity": 0.9 },
        });
      }
    } catch (error) { console.error("Error drawing Blue Marker line:", error); }
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
      currentMap.addSource("background-routes", { type: "geojson", data: allMockRoutesFeatureCollection() });
      currentMap.addLayer({
        id: "background-routes-layer",
        type: "line",
        source: "background-routes",
        paint: { "line-color": ["get", "routeColor"], "line-width": 4, "line-opacity": 0.4 },
      });

      // User Marker
      const startEl = document.createElement("div");
      startEl.style.cssText = "width:34px;height:34px;background:#3b82f6;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(0,0,0,0.3);cursor:pointer;";
      startEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      
      startMarkerRef.current = new mapboxgl.Marker({ element: startEl }).setLngLat(USER_START_LOCATION).addTo(currentMap);

      // RESTORED: Blue Route Initialization
      void drawBlueJeepneyRoute();

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
              const p = document.getElementsByClassName('mapboxgl-popup'); 
              while(p[0]) p[0].remove(); 
            }} 
            onGetDirections={handleRouteRequest}
          />,
          document.getElementById("popup-portal-root")!
        )
      )}
    </div>
  );
}