// "Where is it?" for any place, in a few words — what tells two Jollibees
// apart: "Rizal Avenue, East Bajac-bajac" or "near Barretto".
//
// Order of preference: the street (and barangay) from the place's own OSM
// address; otherwise the nearest named locality (barangay, neighbourhood or
// subdivision centre point — localities.json, fetched by
// scripts/fetch-localities.ts). OSM has no barangay boundaries for
// Olongapo, so the nearest-point answer is approximate near a border; it is
// always worded "near …".

import { getDistanceMeters } from "../application/geo";
import data from "./localities.json";
import type { PlaceDetails } from "./placeDetails";

interface Locality {
  name: string;
  lat: number;
  lon: number;
}

const LOCALITIES: Locality[] = data.localities;

/** Farther than this from every known locality, "near X" would mislead — say nothing instead. */
const MAX_NEAR_KM = 2.5;

/** The closest named locality to a point, or null if none is within MAX_NEAR_KM. */
export function nearestLocality(lat: number, lon: number): { name: string; km: number } | null {
  let best: { name: string; km: number } | null = null;
  for (const l of LOCALITIES) {
    const km = getDistanceMeters([lon, lat], [l.lon, l.lat]) / 1000;
    if (!best || km < best.km) best = { name: l.name, km };
  }
  return best && best.km <= MAX_NEAR_KM ? best : null;
}

/** Short location label for lists, the place card and the trip header. */
export function locationLabel(lat: number, lon: number, details?: PlaceDetails): string | undefined {
  const branch = details?.branch ? `${details.branch} branch` : undefined;
  const street = [details?.street, details?.barangay].filter(Boolean).join(", ");
  const near = nearestLocality(lat, lon);
  const where = street || (near ? `near ${near.name}` : undefined);
  return [branch, where].filter(Boolean).join(" · ") || undefined;
}

/** Kinds of place people give directions by. */
const LANDMARK_TYPES = new Set([
  "mall", "department_store", "supermarket", "marketplace", "hospital", "clinic", "school", "college", "university", "townhall",
  "police", "fire_station", "bank", "fuel", "place_of_worship", "hotel", "bus_station", "post_office", "library", "pharmacy", "fast_food", "restaurant",
]);
const LANDMARK_KM = [0.3, 0.6]; // try close landmarks first

interface Locatable {
  name: string;
  type: string;
  lat: number;
  lon: number;
  where?: string;
}

/**
 * Same-name places whose labels still match ("near Asinan" twice) get the
 * nearest landmark added: "near Asinan · by Olongapo City Public Market".
 * A landmark must have a name no other place shares — "by 7-Eleven" would
 * not help. Places whose labels already differ are left alone.
 */
export function disambiguateLocations<T extends Locatable>(places: T[]): void {
  const nameCount = new Map<string, number>();
  for (const p of places) nameCount.set(p.name.toLowerCase(), (nameCount.get(p.name.toLowerCase()) ?? 0) + 1);
  const landmarks = places.filter((p) => LANDMARK_TYPES.has(p.type) && p.name !== "Unnamed" && nameCount.get(p.name.toLowerCase()) === 1);

  const groups = new Map<string, T[]>();
  for (const p of places) {
    if (p.name === "Unnamed") continue;
    const key = `${p.name.toLowerCase()}|${p.where ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const p of group) {
      for (const radius of LANDMARK_KM) {
        let best: { name: string; km: number } | null = null;
        for (const l of landmarks) {
          if (l === p) continue;
          const km = getDistanceMeters([p.lon, p.lat], [l.lon, l.lat]) / 1000;
          if (km <= radius && (!best || km < best.km)) best = { name: l.name, km };
        }
        if (best) {
          p.where = [p.where, `by ${best.name}`].filter(Boolean).join(" · ");
          break;
        }
      }
    }
  }
}

/** Farther than these, "by …" would mislead: a landmark within 250 m, else any named place within 150 m. */
const BY_LANDMARK_KM = 0.25;
const BY_ANY_PLACE_KM = 0.15;

/**
 * "by Jollibee (40 m)" — the closest named place to a point, for telling
 * fixed points apart (tricycle stands). Prefers a landmark people give
 * directions by, with a name no other place shares; otherwise any named
 * place close by. null if nothing named is near enough.
 */
export function nearbyPlaceLabel(lat: number, lon: number, places: Locatable[]): string | null {
  const nameCount = new Map<string, number>();
  for (const p of places) nameCount.set(p.name.toLowerCase(), (nameCount.get(p.name.toLowerCase()) ?? 0) + 1);
  let landmark: { name: string; km: number } | null = null;
  let any: { name: string; km: number } | null = null;
  for (const p of places) {
    if (p.name === "Unnamed" || p.type === "tricycle_stand" || p.type === "jeepney_stop") continue;
    const km = getDistanceMeters([lon, lat], [p.lon, p.lat]) / 1000;
    if (km <= BY_ANY_PLACE_KM && (!any || km < any.km)) any = { name: p.name, km };
    if (km <= BY_LANDMARK_KM && LANDMARK_TYPES.has(p.type) && nameCount.get(p.name.toLowerCase()) === 1 && (!landmark || km < landmark.km)) {
      landmark = { name: p.name, km };
    }
  }
  const best = landmark ?? any;
  if (!best) return null;
  const metres = Math.max(10, Math.round((best.km * 1000) / 10) * 10);
  return `by ${best.name} (${metres} m)`;
}

/** Same name and type this close: one place mapped twice (OSM often has both a point and the building outline). */
const SAME_SPOT_M = 10;
const POINT_IN_OUTLINE_M = 30;

interface Mergeable extends Locatable {
  id: string | number;
  details?: PlaceDetails;
}

/** How much a place's OSM record says — the richer copy wins a merge. */
function richness(d?: PlaceDetails): number {
  if (!d) return 0;
  return [d.address, d.openingHours, d.website, d.facebook, d.email, d.brand, d.operator, d.description].filter(Boolean).length + d.phones.length + d.facts.length + d.cuisine.length;
}

const isOutline = (p: Mergeable) => typeof p.id === "string" && /^(way|relation)-/.test(p.id);

/**
 * Drops places that are the same place mapped twice, keeping the copy with
 * more details (and the point's position, which is usually the entrance,
 * over a building's centre). Shops that merely share a name — two sari-sari
 * stores called "Variety Store" a few doors apart — are left alone.
 */
export function mergeDuplicatePlaces<T extends Mergeable>(places: T[]): T[] {
  const removed = new Set<T>();
  const byKey = new Map<string, T[]>();
  for (const p of places) {
    if (p.name === "Unnamed") continue;
    const key = `${p.name.toLowerCase()}|${p.type}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(p);
  }
  for (const group of byKey.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (removed.has(a) || removed.has(b)) continue;
        const m = getDistanceMeters([a.lon, a.lat], [b.lon, b.lat]);
        const samePlace = m <= SAME_SPOT_M || (m <= POINT_IN_OUTLINE_M && isOutline(a) !== isOutline(b));
        if (!samePlace) continue;
        const [keep, drop] = richness(b.details) > richness(a.details) ? [b, a] : [a, b];
        if (isOutline(keep) && !isOutline(drop)) {
          keep.lat = drop.lat; // the point marks the door; the outline's centre may be mid-building
          keep.lon = drop.lon;
        }
        removed.add(drop);
      }
    }
  }
  return places.filter((p) => !removed.has(p));
}
