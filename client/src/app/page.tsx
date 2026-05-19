"use client";

import MapComponent from "@/features/map/presentation/map";

export default function Page() {
  // This renders your map engine immediately at the root path
  return (
    <div className="h-screen w-screen overflow-hidden">
      <MapComponent />
    </div>
  );
}