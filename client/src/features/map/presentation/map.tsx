"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { jeepneyColorToHex, mockRoutes } from "../domain/MockData";
// 👇 ADDED findDirectJeepneyRoute to your imports
import { 
  allMockRoutesFeatureCollection, 
  fetchDrivingAlternatives, 
  findBestJeepneyRouteFeature // <-- ADD THIS HERE
} from "../application/getDirections"; 

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

/**
 * Amenities URL resolution
 */
function amenitiesUrl(): string {
  const custom = process.env.NEXT_PUBLIC_AMENITIES_URL?.trim();
  if (custom) return custom;

  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  if (base) return `${base}/amenities`;

  return "/api/amenities";
}

const MapComponent = () => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Map center / Route starting point
  const USER_START_LOCATION = [120.283479, 14.837409];

  // 🧠 CLEANING FUNCTION
  function extractAmenities(data: any) {
    const nodes: Record<number, any> = {};
    const results: any[] = [];

    data.elements.forEach((el: any) => {
      if (el.type === "node") {
        nodes[el.id] = el;
      }
    });

    data.elements.forEach((el: any) => {
      if (!el.tags) return;

      if (el.type === "node") {
        results.push({
          id: el.id,
          name: el.tags.name || "Unnamed",
          type: el.tags.amenity || el.tags.shop,
          lat: el.lat,
          lon: el.lon,
        });
      }

      if (el.type === "way" && el.nodes) {
        const coords = el.nodes.map((id: number) => nodes[id]).filter(Boolean);
        if (coords.length === 0) return;

        const avgLat = coords.reduce((sum: number, n: { lat: number }) => sum + n.lat, 0) / coords.length;
        const avgLon = coords.reduce((sum: number, n: { lon: number }) => sum + n.lon, 0) / coords.length;

        results.push({
          id: el.id,
          name: el.tags.name || "Unnamed",
          type: el.tags.amenity || el.tags.shop,
          lat: avgLat,
          lon: avgLon,
        });
      }
    });

    return results;
  }

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [USER_START_LOCATION[0], USER_START_LOCATION[1]], 
      zoom: 15,
    });

    const currentMap = map.current;

    /** Route lines from MockData (`path` or straight stop-to-stop), no network required. */
    const drawJeepneyRoutesFromMock = () => {
      const collection = allMockRoutesFeatureCollection();

      if (currentMap.getSource("jeepney-routes-source")) {
        (currentMap.getSource("jeepney-routes-source") as mapboxgl.GeoJSONSource).setData(collection);
        return;
      }

      currentMap.addSource("jeepney-routes-source", {
        type: "geojson",
        data: collection,
      });

      currentMap.addLayer({
        id: "jeepney-routes-layer",
        type: "line",
        source: "jeepney-routes-source",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": ["get", "routeColor"],
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });

      currentMap.on("click", "jeepney-routes-layer", (e) => {
        if (!e.features?.length) return;
        const properties = e.features[0].properties;
        alert(`Route: ${properties?.name}\n${properties?.description ?? ""}`);
      });

      currentMap.on("mouseenter", "jeepney-routes-layer", () => {
        currentMap.getCanvas().style.cursor = "pointer";
      });
      currentMap.on("mouseleave", "jeepney-routes-layer", () => {
        currentMap.getCanvas().style.cursor = "";
      });
    };

    /** Deduped jeepney stops from mockRoutes for markers (same lat/lng → one pin, multiple routes in popup). */
    const mockStopsForMarkers = () => {
      const byKey = new Map<string, { lng: number; lat: number; name: string; routes: { routeName: string; colorHex: string }[] }>();

      for (const route of mockRoutes) {
        const sorted = [...route.stops].sort((a, b) => a.order - b.order);
        const colorHex = jeepneyColorToHex(route.colorCode);
        for (const s of sorted) {
          const key = `${s.lng.toFixed(5)},${s.lat.toFixed(5)}`;
          let row = byKey.get(key);
          if (!row) {
            row = { lng: s.lng, lat: s.lat, name: s.name, routes: [] };
            byKey.set(key, row);
          }
          if (!row.routes.some((r) => r.routeName === route.routeName)) {
            row.routes.push({ routeName: route.routeName, colorHex });
          }
        }
      }

      return [...byKey.values()];
    };

    // 🚌 OFFLINE ROUTING: Draws a thick route and markers using purely Mock Data
    const drawOfflineJeepneyRoute = (routeName: string) => {
      // 1. Find the exact route in your mock data
      const route = mockRoutes.find(r => r.routeName === routeName);
      if (!route) {
        console.error(`Route ${routeName} not found in mock data!`);
        return;
      }

      console.log(`🗺️ Automatically drawing offline route: ${routeName}`);

      // 2. Create the line geometry using the predefined 'path'
      const routeColor = jeepneyColorToHex(route.colorCode);
      const coordinates = route.path && route.path.length > 0 
        ? route.path.map(([lng, lat]) => [lng, lat]) // Use high-res path if available
        : [...route.stops].sort((a,b) => a.order - b.order).map(s => [s.lng, s.lat]); // Fallback to straight lines

      const routeGeoJSON: any = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: { routeColor },
          geometry: { type: "LineString", coordinates }
        }]
      };

      // 3. Draw the thick line on the map
      const source = currentMap.getSource("live-route-source") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(routeGeoJSON);
      } else {
        currentMap.addSource("live-route-source", { type: "geojson", data: routeGeoJSON });
        currentMap.addLayer({
          id: "live-route-layer",
          type: "line",
          source: "live-route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": ["get", "routeColor"],
            "line-width": 8,
            "line-opacity": 0.9,
          },
        });
      }

      // 4. Clear all existing markers off the map
      markers.current.forEach(m => m.remove());
      markers.current = [];

      // 5. Automatically put markers down for EVERY STOP on this path
      route.stops.forEach(stop => {
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div style="padding:8px;color:black;">
            <strong style="font-size:14px;">${stop.name}</strong><br/>
            <span style="font-size:12px;color:#666;">Stop #${stop.order} • ${route.routeName}</span>
          </div>`
        );

        const marker = new mapboxgl.Marker({ color: routeColor })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(popup)
          .addTo(currentMap);
          
        markers.current.push(marker);
      });

      // 6. Automatically move the camera to look at the route!
      if (coordinates.length > 0) {
        const firstCoord = coordinates[0];
        currentMap.flyTo({ center: [firstCoord[0], firstCoord[1]], zoom: 14 });
      }
    };
    // 👇 UPDATED: SMART ROUTING FUNCTION (Tries Transit first, falls back to Driving)
    // 🛣️ SMART ROUTING FUNCTION: Tries Transit first, falls back to Driving
    const fetchAndDrawRoute = async (endLon: number, endLat: number) => {
      try {
        console.log(`🛣️ Requesting live route to: ${endLon}, ${endLat}...`);
        
        let routeGeoJSON: any = null;

        // 1. FIRST: Try to automatically find a Jeepney route!
        const jeepneyRouteGeoJSON = await findBestJeepneyRouteFeature(
          USER_START_LOCATION[0],
          USER_START_LOCATION[1],
          endLon,
          endLat
        );

        if (jeepneyRouteGeoJSON) {
          console.log("🚌 Direct Jeepney Route found! Displaying transit line.");
          alert(`Take the ${jeepneyRouteGeoJSON.features[0].properties?.name} jeepney!`);
          routeGeoJSON = jeepneyRouteGeoJSON;
        } else {
          // 2. FALLBACK: No direct jeepney found. Use standard Mapbox Driving directions.
          console.log("🚗 No direct jeepney found. Falling back to Mapbox driving route.");
          routeGeoJSON = await fetchDrivingAlternatives(
            USER_START_LOCATION[0],
            USER_START_LOCATION[1],
            endLon,
            endLat,
          );

          if (!routeGeoJSON || !routeGeoJSON.features?.length) {
            console.warn("🟡 No valid driving route found to this destination.");
            alert("No valid driving route found to this destination.");
            return;
          }

          // Reverse the array so the fastest driving route (index 0) is drawn ON TOP
          routeGeoJSON.features = routeGeoJSON.features.reverse();
        }

        console.log("✅ Successfully received route data to draw!");

        // 3. DRAW THE ROUTE ON THE MAP
        const source = currentMap.getSource("live-route-source") as mapboxgl.GeoJSONSource;
        
        if (source) {
          source.setData(routeGeoJSON);
        } else {
          currentMap.addSource("live-route-source", {
            type: "geojson",
            data: routeGeoJSON,
          });

          currentMap.addLayer({
            id: "live-route-layer",
            type: "line",
            source: "live-route-source",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": ["get", "routeColor"], 
              "line-width": 8, 
              "line-opacity": 1.0,
            },
          });
        }
      } catch (error) {
        console.error("🔴 Unexpected error fetching/drawing live route:", error);
      }
    };

    const addMockStopMarkers = () => {
      for (const stop of mockStopsForMarkers()) {
        const routesHtml = stop.routes
          .map((r) => `<li style="border-left:4px solid ${r.colorHex};padding-left:8px;margin:4px 0">${r.routeName}</li>`)
          .join("");

        const popup = new mapboxgl.Popup().setHTML(
          `<div style="padding:8px;min-width:200px">
            <strong>${stop.name}</strong>
            <p style="margin:8px 0 4px;font-size:12px;color:#666">Jeepney routes</p>
            <ul style="margin:0;padding-left:0;list-style:none">${routesHtml}</ul>
          </div>`,
        );

        const markerColor = stop.routes[0]?.colorHex ?? "#333333";
        const marker = new mapboxgl.Marker({ color: markerColor })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(popup)
          .addTo(currentMap);

        // FIXED: Stop event propagation so the click triggers the route
        marker.getElement().addEventListener("click", (e) => {
          e.stopPropagation();
          console.log(`🖱️ Mock Stop clicked! Triggering route...`);
          fetchAndDrawRoute(stop.lng, stop.lat);
        });

        markers.current.push(marker);
      }
    };

    // 📍 OSM amenities (optional) + mock route stops
    const addEstablishmentMarkers = async () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];

      addMockStopMarkers();

      try {
        const response = await fetch(amenitiesUrl());
        const rawData = await response.json();

        if (!response.ok || !rawData?.elements) return;

        const places = extractAmenities(rawData);

        places.forEach((place) => {
          if (!place.lat || !place.lon) return;

          const popup = new mapboxgl.Popup().setHTML(
            `<div class="flex flex-col gap-2 text-accent-foreground font-black bg-white">
              <h3>${place.name}</h3>
              <p>${place.type}</p>
            </div>`,
          );

          const marker = new mapboxgl.Marker({ color: "#FF0000" })
            .setLngLat([place.lon, place.lat])
            .setPopup(popup)
            .addTo(currentMap);

          // FIXED: Stop event propagation so the click triggers the route
          marker.getElement().addEventListener("click", (e) => {
            e.stopPropagation();
            console.log(`🖱️ Amenity clicked! Triggering route...`);
            fetchAndDrawRoute(place.lon, place.lat);
          });

          markers.current.push(marker);
        });
      } catch (error) {
        console.error("Error adding amenities markers:", error);
      }
    };

    // 🚀 INITIALIZE DATA WHEN MAP LOADS
    currentMap.on("load", () => {
      // 🚀 INITIALIZE DATA WHEN MAP LOADS
    currentMap.on("load", () => {
      
      // Draw faded background lines (optional, remove if you only want the active route)
      drawJeepneyRoutesFromMock(); 

      // 👉 Automatically draw a specific route and its markers on load!
      // (Change "Yellow Jeepney" to whatever exact name you used in your mockData.ts)
      drawOfflineJeepneyRoute("Yellow Jeepney"); 
      
    });
      
      // 👇 OPTIONAL: Draw a Blue marker for your Start Location so you know where routes begin!
      const startMarker = new mapboxgl.Marker({ color: "#0000FF" })
        .setLngLat([USER_START_LOCATION[0], USER_START_LOCATION[1]])
        .setPopup(new mapboxgl.Popup().setText("Your Starting Location"))
        .addTo(currentMap);
      markers.current.push(startMarker);
    });

    // 🧹 CLEANUP
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  return <div ref={mapContainer} className="w-full h-screen" />;
};

export default MapComponent;