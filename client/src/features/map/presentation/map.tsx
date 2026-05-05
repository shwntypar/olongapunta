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
import path from "path";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

// The central starting point for all routes
const USER_START_LOCATION = [120.283479, 14.837409] as [number, number];

// =====================================================================
// 🛠️ OUTSIDE HELPERS: Keeps the main component tiny and readable
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

// function drawBlueJeepneyRoute() {
//   const mapContainer = useRef<HTMLDivElement | null>(null);
//   const map = useRef<mapboxgl.Map | null>(null);
//   const markers = useRef<mapboxgl.Marker[]>([]);

//   const bluestart = mockRoutes.find(r => r.colorCode = 'BLUE')?.path?.[0];
//   const blueEnd = mockRoutes.find(r => r.colorCode = 'BLUE')?.path?.[1];

//   console.log(blueEnd,bluestart);

//   const currentMap = new mapboxgl.Map({
//     container: mapContainer.current,
//     style: "mapbox://styles/mapbox/streets-v12",
//     center: USER_START_LOCATION,
//     zoom: 14,
//   });
//   map.current = currentMap;

//   let routeGeoJSON: any = null;
//   const source = currentMap.getSource("active-route") as mapboxgl.GeoJSONSource;
//         if (source) {
//           source.setData(routeGeoJSON);
//         } else {
//           currentMap.addSource("active-route", { type: "geojson", data: routeGeoJSON });
//           currentMap.addLayer({
//             id: "active-route-layer",
//             type: "line",
//             source: "active-route",
//             layout: { "line-join": "round", "line-cap": "round" },
//             paint: { "line-color": ["get", "routeColor"], "line-width": 8, "line-opacity": 0.9 },
//           });
//         }
// }

// =====================================================================
// 🗺️ MAIN MAP COMPONENT
// =====================================================================

export default function MapComponent() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return;

    // 1. INITIALIZE MAP
    const currentMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: USER_START_LOCATION,
      zoom: 14,
    });
    map.current = currentMap;

    // 2. CORE ROUTING LOGIC (Fires when a marker is clicked)
   // 2. CORE ROUTING LOGIC (Fires when a marker is clicked)
   const handleRouteRequest = async (endLon: number, endLat: number) => {
    console.log(`\n🚦 ========================================`);
    console.log(`📍 Route requested to exactly: [${endLon}, ${endLat}]`);
    
    // 🎯 Drop a bright purple "Target" pin where they clicked
    if ((window as any).currentDestMarker) {
       (window as any).currentDestMarker.remove();
    }
    (window as any).currentDestMarker = new mapboxgl.Marker({ color: "#FF00FF" }) 
      .setLngLat([endLon, endLat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setText("🎯 Your Destination"))
      .addTo(currentMap);

    try {
      // 1. ALWAYS get the precise A-to-B line connecting Start to Finish
      let routeGeoJSON = await fetchDrivingAlternatives(
        USER_START_LOCATION[0], USER_START_LOCATION[1], endLon, endLat
      );

      if (!routeGeoJSON || !routeGeoJSON.features || routeGeoJSON.features.length === 0) {
        console.error("❌ Mapbox API failed to return a route to the destination.");
        return;
      }

      // Put fastest route on top
      routeGeoJSON.features = routeGeoJSON.features.reverse(); 

      // 2. Secretly check if a Jeepney can make this trip (Smart Transit)
      const transitRoute = await findBestJeepneyRouteFeature(
        USER_START_LOCATION[0], USER_START_LOCATION[1], endLon, endLat
      );

      if (transitRoute && transitRoute.features.length > 0) {
         const jeepneyName = transitRoute.features[0].properties?.name;
         const jeepneyColor = transitRoute.features[0].properties?.routeColor;
         
         console.log(`🚌 Smart Transit: Take the ${jeepneyName}!`);

         // Paint the A-to-B line with the Jeepney's specific color!
         routeGeoJSON.features.forEach((f: any) => {
            if (f.properties) f.properties.routeColor = jeepneyColor;
         });
      }

      console.log("✅ Exact route generated. Drawing on map...");

      // 3. Draw the active route layer
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

      // 🎥 CAMERA AUTO-ZOOM
      const bounds = new mapboxgl.LngLatBounds();
      routeGeoJSON.features.forEach((feature: any) => {
        if (feature.geometry && feature.geometry.coordinates) {
          feature.geometry.coordinates.forEach((coord: [number, number]) => {
             bounds.extend(coord);
          });
        }
      });
      
      currentMap.fitBounds(bounds, { padding: 60, duration: 1200 });
      console.log(`🚦 ========================================\n`);

    } catch (error) {
      console.error("💥 CRITICAL ERROR in handleRouteRequest:", error);
    }
  };

    // 🌐 NAVIGATION API: Automatically fetches and draws the Blue Jeepney
    const drawBlueJeepneyRoute = async () => {
      console.log("🌐 Fetching Navigation API for the Blue Jeepney Route...");

      // 1. Safely find the Blue route using ===
      const blueRoute = mockRoutes.find(r => r.colorCode === 'BLUE');

      if (!blueRoute || !blueRoute.path || blueRoute.path.length < 2) {
        console.error("❌ Blue route not found or missing path data.");
        return;
      }

      // 2. Get the Start point and the LAST point (End point)
      const blueStart = blueRoute.path[0];
      const blueEnd = blueRoute.path[blueRoute.path.length - 1]; 

      console.log(`📍 Blue Start: [${blueStart}] | 📍 Blue End: [${blueEnd}]`);

      try {
        // 3. Ask your existing Mapbox API function for the road-snapped route
        let routeGeoJSON = await fetchDrivingAlternatives(
          blueStart[0], blueStart[1],
          blueEnd[0], blueEnd[1]
        );

        if (!routeGeoJSON || !routeGeoJSON.features?.length) {
           console.error("❌ Mapbox API failed to return a route for the Blue Jeepney.");
           return;
        }

        // Put the fastest route on top
        routeGeoJSON.features = routeGeoJSON.features.reverse();

        // Override the color so it explicitly draws as Blue
        routeGeoJSON.features.forEach((f: any) => {
            if (f.properties) f.properties.routeColor = "#0000FF";
        });

        // 4. Draw it on your existing map instance (currentMap)
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

        // 5. Auto-zoom the camera so the whole Blue route fits on screen!
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(blueStart as [number, number]);
        bounds.extend(blueEnd as [number, number]);
        currentMap.fitBounds(bounds, { padding: 60, duration: 1200 });

        console.log("✅ Blue Jeepney Navigation applied and drawn!");

      } catch (error) {
         console.error("💥 Error drawing Blue Jeepney route:", error);
      }
    };

    // 3. MAP LOAD SEQUENCE (Strictly ordered)
    currentMap.on("load", async () => {

      // A. Instantly draw all mock jeepney routes in the background
      currentMap.addSource("background-routes", { type: "geojson", data: allMockRoutesFeatureCollection() });
      currentMap.addLayer({
        id: "background-routes-layer",
        type: "line",
        source: "background-routes",
        paint: { "line-color": ["get", "routeColor"], "line-width": 4, "line-opacity": 0.4 },
      });


      // B. Drop the Blue Start Marker
      markers.current.push(
        new mapboxgl.Marker({ color: "#0000FF" })
          .setLngLat(USER_START_LOCATION)
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setText("Start Location"))
          .addTo(currentMap)
      );

      // C. Fetch, Clean, and Draw Red Amenity Markers
      try {
        const res = await fetch(getAmenitiesUrl());
        if (!res.ok) throw new Error("Amenities API failed");
        
        const places = parseAmenities(await res.json());

        places.forEach((place: any) => {
          if (!place.lat || !place.lon) return;

          const popupHtml = `<div style="color:black;padding:4px"><strong>${place.name}</strong><br/><small>${place.type}</small></div>`;
          const marker = new mapboxgl.Marker({ color: "#FF0000" })
            .setLngLat([place.lon, place.lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml))
            .addTo(currentMap);

          // Listen for clicks to trigger the Navigation API!
          marker.getElement().addEventListener("click", (e) => {
            e.stopPropagation(); 
            handleRouteRequest(place.lon, place.lat);
          });
          
          markers.current.push(marker);
        });
      } catch (error) {
        console.error("Failed to load amenities:", error);
      }

      void drawBlueJeepneyRoute();
    });

    // 4. CLEANUP ON UNMOUNT
    return () => {
      markers.current.forEach(m => m.remove());
      markers.current = [];
      currentMap.remove();
      map.current = null;
    };
  }, []);

  return <div ref={mapContainer} className="w-full h-screen" />;
}