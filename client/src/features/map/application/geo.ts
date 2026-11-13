// Small distance helpers. Coordinates are [lon, lat].

const EARTH_RADIUS_M = 6371e3;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance between two points, in meters. */
export function getDistanceMeters(a: number[], b: number[]): number {
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);

  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_M * c;
}

/** Length of a path of [lon, lat] points, in kilometers. */
export function pathLengthKm(coords: number[][]): number {
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1];
    const [lon2, lat2] = coords[i];
    const h =
      Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
    km += 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  return km;
}
