"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from '@turf/turf';

import {  
  fetchExactJeepneyPath,
  getDistanceMeters,
  findTransitRouteCandidates  // ← NEW: alternate route list
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
  if (['hospital', 'clinic', 'pharmacy', 'dentist'].includes(t)) return '#ef4444';
  if (['school', 'university', 'college'].includes(t)) return '#3b82f6';
  if (['bank', 'atm'].includes(t)) return '#10b981';
  if (['supermarket', 'mall', 'marketplace', 'restaurant', 'cafe', 'fast_food'].includes(t)) return '#f59e0b';
  if (['townhall', 'police', 'fire_station', 'post_office'].includes(t)) return '#8b5cf6';
  return '#64748b';
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

  const uniformSize = "24px";
  const uniformIconSize = 14;
  const bgColor = getCategoryColor(type); 

  el.style.width = uniformSize;
  el.style.height = uniformSize;
  el.style.backgroundColor = bgColor;

  const path = ICON_PATHS[type.toLowerCase()] || "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"; 

  el.innerHTML = `
    <svg width="${uniformIconSize}" height="${uniformIconSize}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="${path}"></path>
    </svg>`;
    
  el.dataset.priority = priority.toString();
  
  return el;
}

function parseAmenities(data: any) {
  const nodes: Record<number, any> = {};
  data.elements.forEach((el: any) => { if (el.type === "node") nodes[el.id] = el; });

  return data.elements
    .filter((el: any) => {
      if (!el.tags) return false;
      if (el.type === "way") {
        const coords = (el.nodes || []).map((id: number) => nodes[id]).filter(Boolean);
        return coords.length > 0;
      }
      return el.type === "node" && typeof el.lat === 'number' && typeof el.lon === 'number';
    })
    .map((el: any) => {
      let lat = el.lat;
      let lon = el.lon;

      if (el.type === "way") {
        const coords = el.nodes.map((id: number) => nodes[id]).filter(Boolean);
        lat = coords.reduce((s: number, n: any) => s + n.lat, 0) / coords.length;
        lon = coords.reduce((s: number, n: any) => s + n.lon, 0) / coords.length;
      }

      return { 
        id: el.id, 
        name: el.tags.name || "Unnamed", 
        type: el.tags.amenity || el.tags.shop, 
        lat, 
        lon 
      };
    })
    .filter((place: any) => !isNaN(place.lat) && !isNaN(place.lon));
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

  // 🚗 Alternatives Routing States (Shared by Driving, Walking, Motor)
  const [alternativeRoutes, setAlternativeRoutes] = useState<any[]>([]);
  const [activeRouteIdx, setActiveRouteIdx] = useState<number>(0);

  // 🚐 Transit Alternatives States
  const [transitCandidates, setTransitCandidates] = useState<any[]>([]);
  const [activeTransitIdx, setActiveTransitIdx] = useState<number>(0);

  const [visibleRouteIds, setVisibleRouteIds] = useState<string[]>(mockRoutes.map(r => r.id));
  const [isolatedDirectionId, setIsolatedDirectionId] = useState<string | null>(null);

  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const routeEndpointMarkers = useRef<mapboxgl.Marker[]>([]);

  // Ref container to hold reference of mid-point alternative markers (pills) and alight markers
  const altMidpointMarkers = useRef<mapboxgl.Marker[]>([]);
  const transitMarkers = useRef<mapboxgl.Marker[]>([]);
  
  const isRoutingModeRef = useRef(false);
  
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const liveCoords = [position.coords.longitude, position.coords.latitude];
          
          setOrigin({
            name: "My Current Location",
            coords: liveCoords
          });

          if (startMarkerRef.current) {
            startMarkerRef.current.setLngLat(liveCoords as any);
          }

          if (map.current) {
            map.current.flyTo({ center: liveCoords as any, zoom: 15, duration: 2000 });
          }
        },
        (error) => {
          console.warn("User denied GPS on load or signal failed:", error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Recalculates route immediately on parameters change
  useEffect(() => {
    if (isRoutingMode && origin && selectedPlace) {
      handleRouteRequest(selectedPlace, travelMode, origin.coords);
    }
  }, [origin, travelMode, isRoutingMode, selectedPlace]); 
  
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
    setIsolatedDirectionId(null);
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

  const selectSingleRoute = (routeId: string, directionId: string) => {
    const currentMap = map.current;

    routeEndpointMarkers.current.forEach(marker => marker.remove());
    routeEndpointMarkers.current = [];

    setIsolatedDirectionId(prevDir => {
      if (prevDir === directionId) {
        setVisibleRouteIds(mockRoutes.map(r => r.id)); 
        return null;
      }

      setVisibleRouteIds([routeId]); 
      const selectedRoute = mockRoutes.find(r => r.id === routeId);

      if (selectedRoute && selectedRoute.path && currentMap) {
        const isFwd = directionId.endsWith('-fwd');
        
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

      return directionId;
    });
  };

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

      if (currentMap.getLayer(fwdLayerId)) currentMap.setLayoutProperty(fwdLayerId, 'visibility', visibilityValue);
      if (currentMap.getLayer(revLayerId)) currentMap.setLayoutProperty(revLayerId, 'visibility', visibilityValue);
      if (currentMap.getLayer(fwdOutlineId)) currentMap.setLayoutProperty(fwdOutlineId, 'visibility', visibilityValue);
      if (currentMap.getLayer(revOutlineId)) currentMap.setLayoutProperty(revOutlineId, 'visibility', visibilityValue);

      if (isVisible) {
        if (isolatedDirectionId) {
          const isFwdActive = isolatedDirectionId === `${route.id}-fwd`;
          const isRevActive = isolatedDirectionId === `${route.id}-rev`;

          if (currentMap.getLayer(fwdLayerId)) currentMap.setPaintProperty(fwdLayerId, 'line-opacity', isFwdActive ? 1.0 : 0.15);
          if (currentMap.getLayer(fwdOutlineId)) currentMap.setPaintProperty(fwdOutlineId, 'line-opacity', isFwdActive ? 0.8 : 0.1);

          if (currentMap.getLayer(revLayerId)) currentMap.setPaintProperty(revLayerId, 'line-opacity', isRevActive ? 1.0 : 0.15);
          if (currentMap.getLayer(revOutlineId)) currentMap.setPaintProperty(revOutlineId, 'line-opacity', isRevActive ? 0.8 : 0.1);
        } else {
          if (currentMap.getLayer(fwdLayerId)) currentMap.setPaintProperty(fwdLayerId, 'line-opacity', 1.0);
          if (currentMap.getLayer(fwdOutlineId)) currentMap.setPaintProperty(fwdOutlineId, 'line-opacity', 0.8);
          if (currentMap.getLayer(revLayerId)) currentMap.setPaintProperty(revLayerId, 'line-opacity', 1.0);
          if (currentMap.getLayer(revOutlineId)) currentMap.setPaintProperty(revOutlineId, 'line-opacity', 0.8);
        }
      }
    });
  }, [visibleRouteIds, isolatedDirectionId]);

  // ==========================================
  // 🟢 LIVE GPS LOCATOR
  // ==========================================
  const requestGpsLocation = async (destinationPlace: any) => {
    if (!navigator.geolocation) {
      setIsPickingOrigin(true);
      return;
    }
  
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords[1]}&lon=${coords[0]}&format=json`);
        const data = await res.json();
        
        setOrigin({ name: data.display_name || "Current Location", coords });
        if (startMarkerRef.current) startMarkerRef.current.setLngLat(coords as any);
        handleRouteRequest(destinationPlace, travelMode, coords);
      },
      (error) => {
        console.warn("GPS failed, switching to manual pin mode:", error);
        setIsPickingOrigin(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const startNavigationFlow = (place: any) => {
    setSelectedPlace(place);
    setIsRoutingMode(true);
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
    if (isMobile) {
       requestGpsLocation(place);
    } else {
       setIsPickingOrigin(true); 
       alert("Since you are on a PC, please click your starting point on the map.");
    }
  };

  // Helper to remove custom floating markers and alight points
  const clearCustomNavigationVisuals = () => {
    altMidpointMarkers.current.forEach(m => m.remove());
    altMidpointMarkers.current = [];
    transitMarkers.current.forEach(m => m.remove());
    transitMarkers.current = [];
  };

  // =====================================================
  // 🚗 DRAW MODAL ALTERNATIVE ROUTE GEOMETRIES & FLOATING PILLS
  //    (Applies to Driving, Walking, and Motor modes)
  // =====================================================
  const drawAlternativeModalityRoutes = (routes: any[], activeIdx: number, activeColor: string) => {
    if (!map.current) return;
    const currentMap = map.current;

    // 1. Clean up past alternative route layers/sources & midpoint markers
    for (let i = 0; i < 5; i++) {
      if (currentMap.getLayer(`alt-route-layer-${i}`)) currentMap.removeLayer(`alt-route-layer-${i}`);
      if (currentMap.getSource(`alt-route-source-${i}`)) currentMap.removeSource(`alt-route-source-${i}`);
    }
    altMidpointMarkers.current.forEach(m => m.remove());
    altMidpointMarkers.current = [];

    if (!routes || routes.length === 0) return;

    routes.forEach((route, idx) => {
      const sourceId = `alt-route-source-${idx}`;
      const layerId = `alt-route-layer-${idx}`;

      if (idx === activeIdx) {
        // Draw active path on "active-route"
        const activeRouteGeoJSON = {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: route.geometry }]
        };
        const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData(activeRouteGeoJSON as any);
          currentMap.setPaintProperty("active-route-layer", "line-color", activeColor);
          currentMap.setPaintProperty("active-route-layer", "line-dasharray", travelMode === 'walking' ? [2, 2] : [1, 0]);
          currentMap.setLayoutProperty("active-route-layer", "visibility", "visible");
        } else {
          currentMap.addSource("active-route", { type: "geojson", data: activeRouteGeoJSON as any });
          currentMap.addLayer({
            id: "active-route-layer",
            type: "line",
            source: "active-route",
            layout: { "line-join": "round", "line-cap": "round", "visibility": "visible" },
            paint: { 
              "line-color": activeColor, 
              "line-width": 6, 
              "line-opacity": 0.9, 
              "line-dasharray": travelMode === 'walking' ? [2, 2] : [1, 0] 
            },
          });
        }
      } else {
        // Draw alternative path in light gray
        currentMap.addSource(sourceId, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: route.geometry }
        });

        currentMap.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#94a3b8",
            "line-width": 5,
            "line-opacity": 0.5,
            "line-dasharray": travelMode === 'walking' ? [2, 2] : [1, 0]
          }
        });

        // Click line to activate alternative
        (currentMap as any).on("click", layerId, (e: any) => {
          if (e.originalEvent) e.originalEvent.stopPropagation();
          setActiveRouteIdx(idx);
        });

        currentMap.on("mouseenter", layerId, () => {
          currentMap.getCanvas().style.cursor = "pointer";
        });
        currentMap.on("mouseleave", layerId, () => {
          currentMap.getCanvas().style.cursor = "";
        });

        // 📍 Calculate mid-point of the alternative route to add floating label displaying distance/duration
        try {
          const line = turf.lineString(route.geometry.coordinates);
          const totalLength = turf.length(line);
          const midPt = turf.along(line, totalLength / 2).geometry.coordinates;

          const durationMin = Math.round(route.duration / 60);
          const distanceKm = (route.distance / 1000).toFixed(1);

          const pillEl = document.createElement("div");
          pillEl.innerHTML = `<div style="background: rgba(15, 23, 42, 0.9); border: 2.5px solid #64748b; color: #cbd5e1; padding: 4px 10px; border-radius: 14px; font-weight: 800; font-size: 10px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.4); white-space: nowrap;">Alt: ${durationMin}m (${distanceKm}km)</div>`;

          pillEl.addEventListener("click", (e) => {
            e.stopPropagation();
            setActiveRouteIdx(idx);
          });

          const midMarker = new mapboxgl.Marker({ element: pillEl })
            .setLngLat(midPt as [number, number])
            .addTo(currentMap);

          altMidpointMarkers.current.push(midMarker);
        } catch (err) {
          console.warn("Could not construct alternative mid-point label:", err);
        }
      }
    });
  };

  // =====================================================
  // 🚐 DRAW ACTIVE & ALTERNATIVE TRANSIT ROUTES ON THE MAP
  // =====================================================
  const drawTransitRoutesOnMap = async () => {
    if (!map.current || transitCandidates.length === 0 || !origin || !selectedPlace) return;
    const currentMap = map.current;

    // 1. Clear old layers and markers
    for (let i = 0; i < 5; i++) {
      if (currentMap.getLayer(`alt-transit-layer-${i}`)) currentMap.removeLayer(`alt-transit-layer-${i}`);
      if (currentMap.getSource(`alt-transit-source-${i}`)) currentMap.removeSource(`alt-transit-source-${i}`);
    }
    transitMarkers.current.forEach(m => m.remove());
    transitMarkers.current = [];

    const activePlan = transitCandidates[activeTransitIdx];
    const startingCoords = origin.coords;
    const endLon = parseFloat(selectedPlace.lon);
    const endLat = parseFloat(selectedPlace.lat);

    // 2. Render all alternative transit candidates as gray/dashed lines
    transitCandidates.forEach((candidate, idx) => {
      if (idx === activeTransitIdx) return;

      const features: any[] = [];
      // Walk 1
      features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [startingCoords, candidate.boardingCoords] } });
      // Ride 1
      features.push({ type: "Feature", properties: {}, geometry: candidate.slicedGeometry });

      if (candidate.transfer) {
        // Walk transfer
        features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [candidate.dropoffCoords, candidate.transfer.boardingCoords] } });
        // Ride 2
        features.push({ type: "Feature", properties: {}, geometry: candidate.transfer.slicedGeometry });
        // Walk to dest
        features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [candidate.transfer.dropoffCoords, [endLon, endLat]] } });
      } else {
        // Walk to dest
        features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [candidate.dropoffCoords, [endLon, endLat]] } });
      }

      const sourceId = `alt-transit-source-${idx}`;
      const layerId = `alt-transit-layer-${idx}`;

      currentMap.addSource(sourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: features } as any
      });

      currentMap.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#94a3b8",
          "line-width": 4,
          "line-dasharray": [2, 2],
          "line-opacity": 0.45
        }
      });

      // Map alt click triggers swap
      (currentMap as any).on("click", layerId, (e: any) => {
        if (e.originalEvent) e.originalEvent.stopPropagation();
        setActiveTransitIdx(idx);
      });

      currentMap.on("mouseenter", layerId, () => {
        currentMap.getCanvas().style.cursor = "pointer";
      });
      currentMap.on("mouseleave", layerId, () => {
        currentMap.getCanvas().style.cursor = "";
      });

      // 📍 Add mid-point tag on alternative transit routes
      try {
        const midCoords = candidate.transfer ? candidate.transfer.boardingCoords : candidate.boardingCoords;
        const pillEl = document.createElement("div");
        pillEl.innerHTML = `<div style="background: rgba(15, 23, 42, 0.9); border: 2.5px solid #475569; color: #94a3b8; padding: 4px 10px; border-radius: 14px; font-weight: 800; font-size: 10px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.4); white-space: nowrap;">🚐 Alt Option (${candidate.transfer ? "1 Trans." : "Direct"})</div>`;

        pillEl.addEventListener("click", (e) => {
          e.stopPropagation();
          setActiveTransitIdx(idx);
        });

        const midMarker = new mapboxgl.Marker({ element: pillEl })
          .setLngLat(midCoords as [number, number])
          .addTo(currentMap);

        transitMarkers.current.push(midMarker);
      } catch (e) {}
    });

    // 3. Render active transit plan (High-res snapping + precise distance indicators)
    if (activePlan.transfer) {
      const leg1 = activePlan;
      const leg2 = activePlan.transfer;

      let ride1Geometry = leg1.slicedGeometry;
      let ride2Geometry = leg2.slicedGeometry;
      let finalBoard1 = leg1.boardingCoords;
      let finalDrop1 = leg1.dropoffCoords;
      let finalBoard2 = leg2.boardingCoords;
      let finalDrop2 = leg2.dropoffCoords;

      try {
        const [hiRes1, hiRes2] = await Promise.all([
          fetchExactJeepneyPath(leg1.activePathCoords),
          fetchExactJeepneyPath(leg2.activePathCoords),
        ]);

        if (hiRes1?.routes?.[0]?.geometry) {
          const line1 = turf.lineString(hiRes1.routes[0].geometry.coordinates);
          const snap1Board = turf.nearestPointOnLine(line1, turf.point(startingCoords));
          const snap1Drop = turf.nearestPointOnLine(line1, turf.point(leg1.dropoffCoords));
          finalBoard1 = snap1Board.geometry.coordinates;
          finalDrop1 = snap1Drop.geometry.coordinates;
          ride1Geometry = turf.lineSlice(snap1Board, snap1Drop, line1).geometry;
        }

        if (hiRes2?.routes?.[0]?.geometry) {
          const line2 = turf.lineString(hiRes2.routes[0].geometry.coordinates);
          const snap2Board = turf.nearestPointOnLine(line2, turf.point(leg2.boardingCoords));
          const snap2Drop = turf.nearestPointOnLine(line2, turf.point([endLon, endLat]));
          finalBoard2 = snap2Board.geometry.coordinates;
          finalDrop2 = snap2Drop.geometry.coordinates;
          ride2Geometry = turf.lineSlice(snap2Board, snap2Drop, line2).geometry;
        }
      } catch (err) {
        console.warn("High-res snapped fetch failed, falling back to straight geometries.", err);
      }

      const walk1Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startingCoords[0]},${startingCoords[1]};${finalBoard1[0]},${finalBoard1[1]}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;
      const walk2Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${finalDrop1[0]},${finalDrop1[1]};${finalBoard2[0]},${finalBoard2[1]}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;
      const walk3Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${finalDrop2[0]},${finalDrop2[1]};${endLon},${endLat}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;

      const [walk1Res, walk2Res, walk3Res] = await Promise.all([fetch(walk1Url), fetch(walk2Url), fetch(walk3Url)]);
      const [walk1Data, walk2Data, walk3Data] = await Promise.all([walk1Res.json(), walk2Res.json(), walk3Res.json()]);

      const walk1Meters = Math.round(walk1Data.routes[0].distance);
      const walk2Meters = Math.round(walk2Data.routes[0].distance);
      const walk3Meters = Math.round(walk3Data.routes[0].distance);

      const color1 = JEEPNEY_HEX_COLORS[leg1.jeepney.colorCode] || '#000';
      const color2 = JEEPNEY_HEX_COLORS[leg2.jeepney.colorCode] || '#000';

      const instructions = [
        ...walk1Data.routes[0].legs[0].steps,
        { maneuver: { instruction: `🚐 BOARD: Ride the ${leg1.jeepney.routeCode} (${leg1.jeepney.colorCode} Jeep) heading towards ${leg1.headingTowards}.` }, distance: 0 },
        { maneuver: { instruction: `🛑 ALIGHT: Get off here and walk to the next jeepney.` }, distance: 0 },
        ...walk2Data.routes[0].legs[0].steps,
        { maneuver: { instruction: `🔄 TRANSFER — Board the ${leg2.jeepney.routeCode} (${leg2.jeepney.colorCode} Jeep) heading towards ${leg2.headingTowards}.` }, distance: 0 },
        { maneuver: { instruction: `🛑 ALIGHT: Get off here and continue on foot.` }, distance: 0 },
        ...walk3Data.routes[0].legs[0].steps,
      ];
      setRouteInstructions(instructions);

      // 📍 BOARDING POINT 1 MARKER (precise distance)
      const b1El = document.createElement("div");
      b1El.innerHTML = `<div style="background: white; border: 3px solid #3b82f6; color: #1e3a8a; padding: 5px 12px; border-radius: 16px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); white-space: nowrap;">🚐 Board ${leg1.jeepney.routeCode} (Walk ${walk1Meters}m)</div>`;
      const board1Marker = new mapboxgl.Marker({ element: b1El }).setLngLat(finalBoard1 as [number, number]).addTo(currentMap);

      // 📍 ALIGHT POINT 1 / TRANSFER WALK MARKER
      const alightEl = document.createElement('div');
      alightEl.innerHTML = `<div style="background: white; border: 3px solid #dc2626; color: #dc2626; padding: 5px 12px; border-radius: 16px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); white-space: nowrap;">🛑 Get Down (Walk ${walk2Meters}m to next)</div>`;
      const alight1Marker = new mapboxgl.Marker({ element: alightEl }).setLngLat(finalDrop1 as [number, number]).addTo(currentMap);

      // 📍 BOARDING POINT 2 MARKER
      const b2El = document.createElement('div');
      b2El.innerHTML = `<div style="background: white; border: 3px solid #16a34a; color: #16a34a; padding: 5px 12px; border-radius: 16px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); white-space: nowrap;">🚐 Board Next (${leg2.jeepney.routeCode})</div>`;
      const board2Marker = new mapboxgl.Marker({ element: b2El }).setLngLat(finalBoard2 as [number, number]).addTo(currentMap);

      // 📍 FINAL ALIGHT / DESTINATION MARKER
      const destEl = document.createElement("div");
      destEl.innerHTML = `<div style="background: white; border: 3px solid #db2777; color: #db2777; padding: 5px 12px; border-radius: 16px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); white-space: nowrap;">🏁 Alight (Walk ${walk3Meters}m to destination)</div>`;
      const destMarker = new mapboxgl.Marker({ element: destEl }).setLngLat(finalDrop2 as [number, number]).addTo(currentMap);

      transitMarkers.current.push(board1Marker, alight1Marker, board2Marker, destMarker);

      const transitGeoJSON = {
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { color: "#10b981", dashArray: [2, 2] }, geometry: walk1Data.routes[0].geometry },
          { type: "Feature", properties: { color: color1,     dashArray: [1, 0] }, geometry: ride1Geometry },
          { type: "Feature", properties: { color: "#f59e0b",  dashArray: [2, 2] }, geometry: walk2Data.routes[0].geometry },
          { type: "Feature", properties: { color: color2,     dashArray: [1, 0] }, geometry: ride2Geometry },
          { type: "Feature", properties: { color: "#10b981",  dashArray: [2, 2] }, geometry: walk3Data.routes[0].geometry },
        ]
      };

      const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(transitGeoJSON as any);
        currentMap.setPaintProperty("active-route-layer", "line-color", ['get', 'color']);
        currentMap.setPaintProperty("active-route-layer", "line-dasharray", ['get', 'dashArray']);
      }

      const bounds = new mapboxgl.LngLatBounds();
      walk1Data.routes[0].geometry.coordinates.forEach((c: any) => bounds.extend(c));
      if (ride1Geometry.coordinates) ride1Geometry.coordinates.forEach((c: any) => bounds.extend(c));
      walk2Data.routes[0].geometry.coordinates.forEach((c: any) => bounds.extend(c));
      if (ride2Geometry.coordinates) ride2Geometry.coordinates.forEach((c: any) => bounds.extend(c));
      walk3Data.routes[0].geometry.coordinates.forEach((c: any) => bounds.extend(c));
      currentMap.fitBounds(bounds, { padding: 80, duration: 1200 });

    } else {
      // Direct route rendering
      const leg = activePlan;
      let rideGeometry = leg.slicedGeometry;
      let finalBoardCoords = leg.boardingCoords;
      let finalDropCoords = leg.dropoffCoords;

      try {
        const fullJeepneyData = await fetchExactJeepneyPath(leg.activePathCoords);
        if (fullJeepneyData?.routes?.[0]?.geometry) {
          const highResLine = turf.lineString(fullJeepneyData.routes[0].geometry.coordinates);
          const preciseBoardPt = turf.nearestPointOnLine(highResLine, turf.point(startingCoords));
          const preciseDropPt = turf.nearestPointOnLine(highResLine, turf.point([endLon, endLat]));
          finalBoardCoords = preciseBoardPt.geometry.coordinates;
          finalDropCoords = preciseDropPt.geometry.coordinates;
          rideGeometry = turf.lineSlice(preciseBoardPt, preciseDropPt, highResLine).geometry;
        }
      } catch (error) {
        console.warn("High-res Snap failed, using straight poly fallbacks.");
      }

      const walk1Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${startingCoords[0]},${startingCoords[1]};${finalBoardCoords[0]},${finalBoardCoords[1]}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;
      const walk2Url = `https://api.mapbox.com/directions/v5/mapbox/walking/${finalDropCoords[0]},${finalDropCoords[1]};${endLon},${endLat}?geometries=geojson&steps=true&access_token=${MAPBOX_TOKEN}`;

      const [walk1Res, walk2Res] = await Promise.all([fetch(walk1Url), fetch(walk2Url)]);
      const [walk1Data, walk2Data] = await Promise.all([walk1Res.json(), walk2Res.json()]);

      const walk1Meters = Math.round(walk1Data.routes[0].distance);
      const walk2Meters = Math.round(walk2Data.routes[0].distance);

      setRouteInstructions([
        ...walk1Data.routes[0].legs[0].steps,
        { maneuver: { instruction: `🚐 BOARD JEEPNEY: Ride the ${leg.jeepney.routeCode} (${leg.jeepney.colorCode} Jeep) heading towards ${leg.headingTowards}.` }, distance: 0 },
        { maneuver: { instruction: `🛑 ALIGHT JEEPNEY: Get off here and continue on foot.` }, distance: 0 },
        ...walk2Data.routes[0].legs[0].steps
      ]);

      // 📍 BOARDING POINT 1 MARKER
      const b1El = document.createElement("div");
      b1El.innerHTML = `<div style="background: white; border: 3px solid #3b82f6; color: #1e3a8a; padding: 5px 12px; border-radius: 16px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); white-space: nowrap;">🚐 Board ${leg.jeepney.routeCode} (Walk ${walk1Meters}m)</div>`;
      const board1Marker = new mapboxgl.Marker({ element: b1El }).setLngLat(finalBoardCoords as [number, number]).addTo(currentMap);

      // 📍 FINAL ALIGHT MARKER
      const destEl = document.createElement("div");
      destEl.innerHTML = `<div style="background: white; border: 3px solid #db2777; color: #db2777; padding: 5px 12px; border-radius: 16px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); white-space: nowrap;">🏁 Alight (Walk ${walk2Meters}m to destination)</div>`;
      const destMarker = new mapboxgl.Marker({ element: destEl }).setLngLat(finalDropCoords as [number, number]).addTo(currentMap);

      transitMarkers.current.push(board1Marker, destMarker);

      const color = JEEPNEY_HEX_COLORS[leg.jeepney.colorCode] || '#000';
      const transitGeoJSON = {
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { color: "#10b981", dashArray: [2, 2] }, geometry: walk1Data.routes[0].geometry },
          { type: "Feature", properties: { color: color,        dashArray: [1, 0] }, geometry: rideGeometry },
          { type: "Feature", properties: { color: "#10b981", dashArray: [2, 2] }, geometry: walk2Data.routes[0].geometry }
        ]
      };

      const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(transitGeoJSON as any);
        currentMap.setPaintProperty("active-route-layer", "line-color", ['get', 'color']);
        currentMap.setPaintProperty("active-route-layer", "line-dasharray", ['get', 'dashArray']);
      }

      const bounds = new mapboxgl.LngLatBounds();
      walk1Data.routes[0].geometry.coordinates.forEach((c: any) => bounds.extend(c));
      if (rideGeometry.coordinates) rideGeometry.coordinates.forEach((c: any) => bounds.extend(c));
      walk2Data.routes[0].geometry.coordinates.forEach((c: any) => bounds.extend(c));
      currentMap.fitBounds(bounds, { padding: 80, duration: 1200 });
    }
  };

  // Sync alternative route renderings when active indexes or modes change
  useEffect(() => {
    if (isRoutingMode) {
      if (travelMode === "transit") {
        if (transitCandidates.length > 0) {
          void drawTransitRoutesOnMap();
        }
      } else {
        if (alternativeRoutes.length > 0) {
          let activeColor = "#3b82f6"; // Driving
          if (travelMode === "walking") activeColor = "#10b981";
          if (travelMode === "cycling") activeColor = "#f59e0b"; // Motor
          
          drawAlternativeModalityRoutes(alternativeRoutes, activeRouteIdx, activeColor);
        }
      }
    }
  }, [activeRouteIdx, alternativeRoutes, activeTransitIdx, transitCandidates, travelMode, isRoutingMode]);

  // =====================================================
  // 🧭 MAIN ROUTE REQUEST FLOW
  // =====================================================
  const handleRouteRequest = async (place: any, mode: TravelMode, overrideStart?: number[]) => {
    const startingCoords = overrideStart || origin?.coords;
    
    if (!map.current || !startingCoords) return;
    const currentMap = map.current;

    // Reset Routing states
    clearCustomNavigationVisuals();
    setAlternativeRoutes([]);
    setTransitCandidates([]);

    // Hide all default jeepney route overlays
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
      // 1. Fetch Transit Options first to load transit summary
      const candidates = findTransitRouteCandidates(startingCoords, [endLon, endLat]);
      if (candidates && candidates.length > 0) {
        setTransitCandidates(candidates);
        setActiveTransitIdx(0);
      }

      // =============================================
      // 🚐 TRANSIT MODE
      // =============================================
      if (mode === "transit") {
        // Trigger draw effect by setting index (handled inside useEffect)
        return;
      }

      // =============================================
      // 🚗 WALKING, DRIVING, CYCLING MODES (WITH ALTERNATIVES)
      // =============================================
      const mapboxMode = mode === "cycling" ? "driving" : mode; // use driving profile for motor fallback
      const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxMode}/${startLon},${startLat};${endLon},${endLat}?geometries=geojson&overview=full&steps=true&alternatives=true&access_token=${MAPBOX_TOKEN}`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        setAlternativeRoutes(data.routes);
        setActiveRouteIdx(0);
      }

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

  // =====================================================
  // 🗺️ MAP INITIALIZATION
  // =====================================================
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
      
      const SHOW_HOSPITALS = 14.0;
      const SHOW_SCHOOLS_BANKS = 16.5;
      const SHOW_EVERYTHING = 17.5;

      markers.current.forEach((marker) => {
        const el = marker.getElement();
        
        if (isRoutingModeRef.current) {
          el.style.display = "none";
          return; 
        }

        const priority = parseInt(el.dataset.priority || "3");

        if (zoom < SHOW_HOSPITALS) {
          el.style.display = "none";
        } 
        else if (priority > 1 && zoom < SHOW_SCHOOLS_BANKS) {
          el.style.display = "none";
        } 
        else if (priority > 2 && zoom < SHOW_EVERYTHING) {
          el.style.display = "none";
        } 
        else {
          el.style.display = "flex";
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
        isolatedDirectionId={isolatedDirectionId}
        onSelectOriginMode={() => setIsPickingOrigin(true)}
        onSelectRoute={selectSingleRoute}

        // Alternative modality states
        alternativeRoutes={alternativeRoutes}
        activeRouteIdx={activeRouteIdx}
        setActiveRouteIdx={setActiveRouteIdx}

        // Transit candidate states
        transitCandidates={transitCandidates}
        activeTransitIdx={activeTransitIdx}
        setActiveTransitIdx={setActiveTransitIdx}
        
        onCloseRouting={() => {
          setIsRoutingMode(false);
          setIsPickingOrigin(false);
          setRouteInstructions([]);
          setAlternativeRoutes([]);
          setActiveRouteIdx(0);
          setTransitCandidates([]);
          setActiveTransitIdx(0);
          
          setIsolatedDirectionId(null);
          routeEndpointMarkers.current.forEach(marker => marker.remove());
          routeEndpointMarkers.current = [];

          if (map.current?.getLayer("active-route-layer")) map.current.setLayoutProperty("active-route-layer", 'visibility', 'none');
          if ((window as any).currentDestMarker) (window as any).currentDestMarker.remove();
          
          clearCustomNavigationVisuals(); // Clean midpoint labels + transfer markers

          // Clean alternative route lines on route closure
          if (map.current) {
            for (let i = 0; i < 5; i++) {
              if (map.current.getLayer(`alt-route-layer-${i}`)) map.current.removeLayer(`alt-route-layer-${i}`);
              if (map.current.getSource(`alt-route-source-${i}`)) map.current.removeSource(`alt-route-source-${i}`);
              if (map.current.getLayer(`alt-transit-layer-${i}`)) map.current.removeLayer(`alt-transit-layer-${i}`);
              if (map.current.getSource(`alt-transit-source-${i}`)) map.current.removeSource(`alt-transit-source-${i}`);
            }
          }
          
          mockRoutes.forEach(r => {
            const fwdLayerId = `route-layer-${r.id}-fwd`;
            const revLayerId = `route-layer-${r.id}-rev`;
            const vis = visibleRouteIds.includes(r.id) ? 'visible' : 'none';
            
            if (map.current?.getLayer(fwdLayerId)) {
              map.current.setLayoutProperty(fwdLayerId, 'visibility', vis);
              map.current.setPaintProperty(fwdLayerId, 'line-opacity', 1.0);
            }
            if (map.current?.getLayer(revLayerId)) {
              map.current.setLayoutProperty(revLayerId, 'visibility', vis);
              map.current.setPaintProperty(revLayerId, 'line-opacity', 1.0);
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
                setIsolatedDirectionId(null);
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
                clearCustomNavigationVisuals();

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