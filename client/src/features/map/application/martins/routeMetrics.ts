// Facts about one tricycle itinerary that the UI displays.

import { pathLengthKm } from "../geo";
import type { RouteResult } from "./types";

/** Number of tricycles boarded. 2 or more means the itinerary has a transfer. */
export const rideCount = (route: RouteResult) => route.legs.filter((leg) => leg.transition === "board-trike").length;

/** True if any ride continues into another TODA's zone (and so pays the crossing fee). */
export const crossesZone = (route: RouteResult) => route.legs.some((leg) => leg.transition === "trike-cross");

/** Distance actually ridden on a tricycle (walking excluded), in km. */
export const rideKm = (route: RouteResult) =>
  route.legs
    .filter((leg) => leg.transition === "trike-home" || leg.transition === "trike-cross")
    .reduce((km, leg) => km + pathLengthKm(leg.coordinates ?? []), 0);

/** Whole itinerary length, walking included, in km. */
export const totalKm = (route: RouteResult) => route.legs.reduce((km, leg) => km + pathLengthKm(leg.coordinates ?? []), 0);
