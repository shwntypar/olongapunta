export const getDistanceMeters = (coord1: number[], coord2: number[]) => {
  const R = 6371e3; // Earth radius in meters
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const deltaLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const deltaLon = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// 🟢 The "Chunk-Loading" Transit Fetcher
export const fetchExactJeepneyPath = async (pathCoordinates: number[][]) => {
  if (!pathCoordinates || pathCoordinates.length < 2) return null;

  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    // 1. Join all coordinates into a single Mapbox-friendly string: "lon,lat;lon,lat;lon,lat"
    const coordinateString = pathCoordinates
      .map(coord => `${coord[0]},${coord[1]}`)
      .join(';');

    // 2. Make ONE single request for the entire route
    // (Using 'cycling' instead of 'driving' to bypass strict one-way street errors)
    const url = `https://api.mapbox.com/directions/v5/mapbox/cycling/${coordinateString}?alternatives=false&continue_straight=true&geometries=geojson&overview=full&access_token=${token}`;
    
    const response = await fetch(url);

    // 3. Fail gracefully if Mapbox rejects the route, so Next.js doesn't crash
    if (!response.ok) {
      console.warn("Mapbox rejected the full route. Falling back to straight lines.");
      return null; 
    }

    return await response.json();
    
  } catch (error) {
    console.error("Error fetching exact jeepney path:", error);
    return null;
  }
};