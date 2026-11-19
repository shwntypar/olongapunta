// "Est. Total Fare" bar at the bottom of the directions panel (jeepney, tricycle and mixed).

import type { DirectionsProps } from "../types";
import { mixedFacts, tricycleFacts } from "./directionsSummary";

function FareBar({ amount, reference }: { amount: string; reference?: string }) {
  return (
    <div className="p-3 border-t border-gray-200 bg-emerald-50/60 flex items-center justify-between gap-2">
      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Est. Total Fare</span>
        <span className="text-xl font-black text-emerald-600">{amount}</span>
      </div>
      {reference && (
        <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 shadow-sm flex-shrink-0">Ref: {reference}</div>
      )}
    </div>
  );
}

/** Fuel-price heads-up for long tricycle riding: the fare is flat, and drivers may ask for more on long trips. */
function FuelNote({ km, fare }: { km: number; fare: number }) {
  return (
    <div className="px-3 py-2.5 border-t border-amber-200 bg-amber-50 text-xs text-amber-800 leading-snug">
      <span className="font-bold">⛽ Long tricycle ride (~{km.toFixed(1)} km).</span> With fuel prices up, drivers may ask for more than the ₱
      {fare.toFixed(2)} estimate on longer trips. Agree on the fare with the driver before boarding.
    </div>
  );
}

export default function FareFooter(props: DirectionsProps) {
  if (props.routeSteps.length === 0) return null;

  if (props.mode === "tricycle") {
    const trip = tricycleFacts(props);
    if (!trip) return <FareBar amount="Not available" />;
    const reference = trip.rides >= 2 ? "1 Transfer" : trip.crossesZone ? "Crosses Zone" : "Within Zone";
    return (
      <>
        {trip.isLong && <FuelNote km={trip.rideKm} fare={trip.fare} />}
        <FareBar amount={`₱${trip.fare.toFixed(2)}`} reference={reference} />
      </>
    );
  }

  if (props.mode === "mixed" || props.mode === "transit") {
    const trip = mixedFacts(props);
    if (!trip) return null;
    return (
      <>
        {trip.isLongTrike && <FuelNote km={trip.trikeKm} fare={trip.trikeFare} />}
        <FareBar amount={`₱${trip.fare.toFixed(2)}`} reference={trip.rides >= 2 ? `${trip.rides} Rides` : "Direct Ride"} />
      </>
    );
  }

  return null;
}
