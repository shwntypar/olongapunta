// Browser geolocation and reverse geocoding, as promises.

/** The device's position as [lon, lat]. Rejects if unavailable, denied, or timed out. */
export function getCurrentCoords(timeoutMs: number): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve([position.coords.longitude, position.coords.latitude]),
      reject,
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

/** A human-readable address for [lon, lat] (OpenStreetMap Nominatim), or the fallback if the lookup fails. */
export async function reverseGeocode(coords: number[], fallback: string): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords[1]}&lon=${coords[0]}&format=json`);
    const data = await res.json();
    return data.display_name || fallback;
  } catch {
    return fallback;
  }
}
