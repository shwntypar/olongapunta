// Card details for the app's own places: tricycle stands (zone, fare, which
// zones the ride can continue into) and jeepney stops (route, fare).

import { ZONE_RULES } from "../../application/martins/zoneRules";
import { mockRoutes } from "../../domain/MockData";
import { tricycleZones } from "../../domain/TricycleZoneData";
import type { Place } from "../../domain/types";
import { formatZoneFare } from "../../domain/zoneFare";
import DetailRow from "./DetailRow";

const shortZone = (id: string) => tricycleZones.find((z) => z.id === id)?.name.replace(/ Tricycle Zone$/i, "") ?? id;

export default function TransportStopInfo({ place }: { place: Place }) {
  if (place.type === "tricycle_stand" && place.zoneId) {
    const zone = tricycleZones.find((z) => z.id === place.zoneId);
    const rule = ZONE_RULES[place.zoneId];
    const crossTo = rule?.crossTo ?? [];
    return (
      <>
        <DetailRow label="Zone">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: zone?.color }} />
            {zone?.name ?? place.zoneId} {zone?.code ? <span className="text-gray-400">({zone.code})</span> : null}
          </span>
        </DetailRow>
        {zone && <DetailRow label="Fare">{formatZoneFare(zone)}</DetailRow>}
        <DetailRow label="Other zones">
          {crossTo.length
            ? `Can continue into ${crossTo.map(shortZone).join(" and ")} (+₱${rule!.crossFee} per zone entered)`
            : "Cannot cross into other zones — change tricycles at the border"}
        </DetailRow>
        <DetailRow label="Boarding">Surveyed stand — tricycles wait here for passengers</DetailRow>
      </>
    );
  }

  if (place.type === "jeepney_stop" && place.routeId) {
    const route = mockRoutes.find((r) => r.id === place.routeId);
    if (!route) return null;
    return (
      <>
        <DetailRow label="Route">
          {route.routeCode} ({route.colorCode}) — {route.routeName}
        </DetailRow>
        <DetailRow label="Fare">₱{route.baseFare.toFixed(2)} per ride</DetailRow>
      </>
    );
  }

  return null;
}
