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

const approxCache = new Map<string, Promise<string | null>>();

/**
 * A short street-level address for a place OSM has no address for:
 * "Rizal Avenue, East Bajac-Bajac, Olongapo 2200". OpenStreetMap Nominatim,
 * looked up once per place and cached (its usage policy allows light,
 * on-demand use like this — never bulk lookups). null if it can't tell.
 */
export function approximateAddress(coords: number[]): Promise<string | null> {
  const key = `${coords[1].toFixed(5)},${coords[0].toFixed(5)}`;
  let pending = approxCache.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords[1]}&lon=${coords[0]}&format=jsonv2&addressdetails=1&zoom=18`);
        if (!res.ok) return null;
        const a = (await res.json()).address ?? {};
        const street = [a.house_number, a.road].filter(Boolean).join(" ");
        const barangay = a.quarter || a.suburb || a.neighbourhood || a.village;
        const city = [a.city || a.town || a.municipality, a.postcode].filter(Boolean).join(" ");
        const text = [street, barangay, city].filter(Boolean).join(", ");
        return text || null;
      } catch {
        return null;
      }
    })();
    approxCache.set(key, pending);
  }
  return pending;
}
