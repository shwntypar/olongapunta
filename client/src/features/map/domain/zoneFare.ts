import type { TricycleZone } from "./TricycleZoneData";

/** One-line fare description for a zone, e.g. "₱30.00 per ride" or "Base fare ₱30.00 · ₱8.00/km". */
export function formatZoneFare(zone: Pick<TricycleZone, "baseFare" | "farePerKm">): string {
  return zone.farePerKm > 0
    ? `Base fare ₱${zone.baseFare.toFixed(2)} · ₱${zone.farePerKm.toFixed(2)}/km`
    : `₱${zone.baseFare.toFixed(2)} per ride`;
}
