// Proper jeepney waiting areas — terminals, loading bays, waiting sheds —
// where jeepneys reliably stop. Anywhere else a rider can still flag one
// down, but it may pass full or not stop, so the wait is longer.
//
// ⚠ Field data still to collect: the route data's own stop lists are
// placeholders (MockData.ts), so this list starts empty. While it is empty
// the app treats every boarding spot the same (no extra wait, no warning).
// Add points as { name, lon, lat } and both Transit and Mixed pick them up.

export interface WaitingArea {
  name: string;
  lon: number;
  lat: number;
}

export const JEEPNEY_WAITING_AREAS: WaitingArea[] = [];

/** A boarding spot this close to a waiting area counts as boarding there. */
export const WAITING_AREA_RADIUS_KM = 0.1;
/** Extra expected wait when flagging a jeepney down away from any waiting area (assumption — tune with field data). */
export const OFF_WAITING_AREA_EXTRA_MINUTES = 5;
