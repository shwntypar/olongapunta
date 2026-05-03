"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

/**
 * Amenities URL resolution:
 * 1. NEXT_PUBLIC_AMENITIES_URL — full URL override (any backend).
 * 2. NEXT_PUBLIC_API_BASE_URL — Express: must include `/api` (e.g. http://localhost:5000/api).
 * 3. Default — Next Route Handler at /api/amenities (no separate server needed).
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

  // 🧠 CLEANING FUNCTION
  function extractAmenities(data: any) {
    console.log("🧠 Cleaning data...");

    const nodes: Record<number, any> = {};
    const results: any[] = [];

    data.elements.forEach((el: any) => {
      if (el.type === "node") {
        nodes[el.id] = el;
      }
    });

    data.elements.forEach((el: any) => {
      if (!el.tags) return;

      // NODE
      if (el.type === "node") {
        results.push({
          id: el.id,
          name: el.tags.name || "Unnamed",
          type: el.tags.amenity || el.tags.shop,
          lat: el.lat,
          lon: el.lon,
        });
      }

      // WAY
      if (el.type === "way" && el.nodes) {
        const coords = el.nodes.map((id: number) => nodes[id]).filter(Boolean);

        if (coords.length === 0) return;

        const avgLat =
          coords.reduce((sum, n) => sum + n.lat, 0) / coords.length;
        const avgLon =
          coords.reduce((sum, n) => sum + n.lon, 0) / coords.length;

        results.push({
          id: el.id,
          name: el.tags.name || "Unnamed",
          type: el.tags.amenity || el.tags.shop,
          lat: avgLat,
          lon: avgLon,
        });
      }
    });

    console.log("✅ Cleaned amenities:", results.length);
    return results;
  }

  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return;

    console.log("🗺️ Initializing map...");

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [120.283479, 14.837409],
      zoom: 15,
    });

    const currentMap = map.current;

    const addEstablishmentMarkers = async () => {
      try {
        console.log("🔵 Fetching amenities from API...");

        const response = await fetch(amenitiesUrl());
        console.log("🟡 Response status:", response.status);

        const rawData = await response.json();
        if (!response.ok) {
          console.error("Amenities API error:", rawData);
          return;
        }
        if (!rawData?.elements || !Array.isArray(rawData.elements)) {
          console.warn("Unexpected amenities payload (no elements array)");
          return;
        }
        console.log("📦 RAW DATA:", rawData);

        const places = extractAmenities(rawData);
        console.log("📍 CLEANED PLACES:", places);

        // 🧹 Remove old markers
        markers.current.forEach(marker => marker.remove());
        markers.current = [];

        places.forEach((place) => {
          if (!place.lat || !place.lon) return;

          const popup = new mapboxgl.Popup().setHTML(
            `<div class="flex flex-col gap-2 text-accent-foreground font-black bg-white">
              <h3>${place.name}</h3>
              <p>${place.type}</p>
            </div>`
          );

          const marker = new mapboxgl.Marker({ color: "#FF0000" })
            .setLngLat([place.lon, place.lat])
            .setPopup(popup)
            .addTo(currentMap);

          markers.current.push(marker);
        });

        console.log("✅ Markers added:", markers.current.length);

      } catch (error) {
        console.error("🔴 Error adding markers:", error);
      }
    };

    currentMap.on("load", () => {
      console.log("🟢 Map loaded");
      addEstablishmentMarkers();
    });

    return () => {
      console.log("🧹 Cleaning up map...");

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