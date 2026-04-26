"use client";

import { useState, useEffect, useRef, forwardRef } from "react";
import { Map } from "@/components/ui/map";
import { MapMarker, MarkerContent, MarkerTooltip, MapRoute } from "@/components/ui/map";
import { mockRoutes } from "../domain/MockData";
import MapLibreGL from "maplibre-gl";

export function RoutesOverlay() {
  const colorMap = {
    YELLOW: '#ffff00',
    BLUE: '#0000ff',
    RED: '#ff0000',
    GREEN: '#00ff00',
  };

  return (
    <>
      {/* Draw route lines only for routes with detailed paths */}
      {mockRoutes
        .filter((route) => route.path) // Only routes with path
        .map((route) => (
          <>
            {/* Glow layer */}
            <MapRoute
              key={`${route.id}-glow`}
              coordinates={route.path!}
              color={colorMap[route.colorCode] || '#4285F4'}
              width={12}
              opacity={0.4}
            />
            {/* Main line */}
            <MapRoute
              key={route.id}
              coordinates={route.path!}
              color={colorMap[route.colorCode] || '#4285F4'}
              width={8}
              opacity={0.8}
            />
          </>
        ))}

      {/* Markers (if you want them) */}
      {mockRoutes.map((route) =>
        route.stops.map((stop) => (
          <MapMarker
            key={`${route.id}-${stop.order}`}
            longitude={stop.lng}
            latitude={stop.lat}
          >
            <MarkerContent>
              <div className="flex size-4.5 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-xs font-semibold text-white shadow-lg">
                {stop.order}
              </div>
            </MarkerContent>
            <MarkerTooltip>{stop.name} ({route.routeName})</MarkerTooltip>
          </MapMarker>
        ))
      )}
    </>
  );
}

export const MapComponent = forwardRef<MapLibreGL.Map | null, { children?: React.ReactNode }>(function MapComponent(props, ref) {
  const [center, setCenter] = useState<[number, number]>([120.283479, 14.837409]); // Default to Olongapo (lng, lat)
  const mapRef = useRef<MapLibreGL.Map | null>(null);

  // Update the map center whenever it changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setCenter(center);
    }
  }, [center]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("User location:", position.coords);
          // Update center to user's location (lng first, then lat)
          //setCenter([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.error("Error getting location:", error.message);
          // Optionally, show a user-friendly message or keep the default center
        },
        { enableHighAccuracy: true, timeout: 10000 } // Optional: better accuracy, 10s timeout
      );
    } else {
      console.warn("Geolocation is not supported by this browser.");
    }
  }, []);

  return (
    <div className="h-screen w-full">
      <Map ref={mapRef} center={center} zoom={14}>
        {props.children}
      </Map>
    </div>
  );
});