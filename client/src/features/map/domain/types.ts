// Shared data shapes for the map feature.

import type { JeepneyRoute } from "./MockData";
import type { PlaceDetails } from "./placeDetails";

/** "mixed" = tricycle + jeepney + walking in one trip (planMixedTrip.ts). */
export type TravelMode = "driving" | "walking" | "cycling" | "transit" | "tricycle" | "mixed";

/** A GeoJSON LineString geometry, coordinates as [lon, lat]. */
export interface LineGeometry {
  type: "LineString";
  coordinates: number[][];
}

/** Anything the user can pick as a destination: an amenity, a tricycle stand, a jeepney stop. */
export interface Place {
  id: string | number;
  name: string;
  type: string;
  lat: number;
  lon: number;
  /** Tricycle stands: the TODA zone the stand belongs to. */
  zoneId?: string;
  /** Jeepney stops: the route the stop belongs to. */
  routeId?: string;
  /** Travel modes that make no sense for this destination (e.g. a tricycle ride to a tricycle stand). */
  excludeModes?: TravelMode[];
  /** OpenStreetMap amenities: address, hours, contacts and other facts from the place's tags. */
  details?: PlaceDetails;
  /** Where it is, in a few words ("Rizal Avenue, East Bajac-bajac", "near Barretto") — tells same-name places apart. */
  where?: string;
}

/** Where the trip starts. coords = [lon, lat]. */
export interface Origin {
  name: string;
  coords: number[];
}

// ---- Jeepney (transit) plans ----

/** One jeepney ride: which route direction, and where to board and alight along it. */
export interface TransitLeg {
  jeepney: JeepneyRoute;
  headingTowards: string;
  boardingCoords: number[];
  dropoffCoords: number[];
  /** The part of the digitized route actually ridden. */
  slicedGeometry: LineGeometry;
  /** The full digitized path of the direction being ridden. */
  activePathCoords: number[][];
}

/** A jeepney itinerary: one ride, or two rides with a walking transfer between them. */
export interface TransitCandidate extends TransitLeg {
  walkDistanceMeters: number;
  /** Estimated door-to-door minutes: walking + waiting + riding (transitCandidates.ts). */
  minutes: number;
  transfer?: TransitLeg;
}

// ---- Mapbox Directions (driving / walking / motor) ----

export interface DirectionsStep {
  maneuver: { instruction: string };
  distance: number;
}

/** The parts of a Mapbox Directions route this app reads. */
export interface DirectionsRoute {
  /** meters */
  distance: number;
  /** seconds */
  duration?: number;
  geometry: LineGeometry;
  legs: { steps: DirectionsStep[] }[];
  summary?: string;
}
