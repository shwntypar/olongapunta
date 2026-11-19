// Runs Mixed-mode searches off the main thread. The mixed graph is ~15k nodes
// and a long cross-city trip settles ~100k labels (over a second), which
// would otherwise freeze the map while it runs. See mixedTripClient.ts.

import { planMixedTrip } from "./planMixedTrip";

export interface MixedTripRequest {
  id: number;
  origin: number[];
  destination: number[];
  /** When the trip starts (ms since epoch) — decides which jeepneys are running. */
  at: number;
  /** false: jeepneys and walking only (Transit tab). */
  tricycles: boolean;
}

self.onmessage = (event: MessageEvent<MixedTripRequest>) => {
  const { id, origin, destination, at, tricycles } = event.data;
  self.postMessage({ id, plan: planMixedTrip(origin, destination, new Date(at), { tricycles }) });
};
