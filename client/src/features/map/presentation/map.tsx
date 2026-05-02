"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import { MapMarker, MarkerContent, MarkerTooltip, MapRoute } from "@/components/ui/map";
import { mockRoutes } from "../domain/MockData";
import { Map } from "mapbox-gl";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const MapComponent = () => {

  const mapContainer = useRef<HTMLDivElement | null>(null);
    // Reference to store the Mapbox instance
  const map = useRef<mapboxgl.Map | null>(null); 
    useEffect(() => {
        // Prevent re-initializing the map if it already exists
        if (!mapContainer.current || map.current) return;

        // Initialize the Mapbox map instance
        map.current = new mapboxgl.Map({
            container: mapContainer.current as HTMLDivElement, // The HTML container for the map
            style: "mapbox://styles/mapbox/outdoors-v12", // Mapbox style to use
            center: [120.283479, 14.837409], // Initial longitude and latitude for the map's center
            zoom: 12, // Initial zoom level
        });

        // Clean up the map instance only when the component unmounts
        return () => {
            if (map.current) {
                map.current.remove(); // Properly remove the map instance
                map.current = null;
            }
        };
    }, []);

    return (
        <div ref={mapContainer} className="w-full h-screen" />
    );
}

export default MapComponent;
