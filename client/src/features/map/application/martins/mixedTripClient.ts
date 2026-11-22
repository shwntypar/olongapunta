// What the page calls for Mixed and Transit: sends the search to a Web Worker
// (mixedTrip.worker.ts) and resolves with its plan. Falls back to searching
// on the main thread if a worker can't be started. The same trip asked again
// within the same minute (switching tabs back) reuses the earlier answer.

import { planMixedTrip, type MixedTripPlan } from "./planMixedTrip";
import type { MixedTripRequest } from "./mixedTrip.worker";

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 0;
const pending = new Map<number, { resolve: (plan: MixedTripPlan) => void; request: MixedTripRequest }>();

function getWorker(): Worker | null {
  if (worker || workerFailed || typeof Worker === "undefined") return worker;
  try {
    worker = new Worker(new URL("./mixedTrip.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; plan: MixedTripPlan }>) => {
      pending.get(event.data.id)?.resolve(event.data.plan);
      pending.delete(event.data.id);
    };
    worker.onerror = (event) => {
      console.warn("Mixed-trip worker failed; searching on the main thread instead.", event);
      workerFailed = true;
      worker?.terminate();
      worker = null;
      for (const { resolve, request } of pending.values()) {
        resolve(planMixedTrip(request.origin, request.destination, new Date(request.at), { tricycles: request.tricycles }));
      }
      pending.clear();
    };
  } catch (error) {
    console.warn("Could not start the mixed-trip worker.", error);
    workerFailed = true;
  }
  return worker;
}

const recent = new Map<string, Promise<MixedTripPlan>>();
const RECENT_MAX = 8;

/**
 * Tricycle/jeepney options between two [lon, lat] points, leaving now.
 * `tricycles: false` searches jeepneys and walking only (Transit tab).
 */
export function requestMixedTrip(origin: number[], destination: number[], { tricycles = true }: { tricycles?: boolean } = {}): Promise<MixedTripPlan> {
  const at = Date.now();
  // Service hours change by the minute at most: same trip, same minute → same answer.
  const key = [...origin, ...destination].map((v) => v.toFixed(6)).join(",") + `|${tricycles}|${Math.floor(at / 60000)}`;
  const cached = recent.get(key);
  if (cached) return cached;

  const w = getWorker();
  const plan: Promise<MixedTripPlan> = w
    ? new Promise((resolve) => {
        const request: MixedTripRequest = { id: ++nextId, origin, destination, at, tricycles };
        pending.set(request.id, { resolve, request });
        w.postMessage(request);
      })
    : Promise.resolve(planMixedTrip(origin, destination, new Date(at), { tricycles }));

  recent.set(key, plan);
  if (recent.size > RECENT_MAX) recent.delete(recent.keys().next().value!);
  return plan;
}
