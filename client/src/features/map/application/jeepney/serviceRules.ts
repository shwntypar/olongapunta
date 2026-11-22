// Applies domain/jeepneyService.ts to trip planning: which routes are running
// at a given time, and how long a rider should expect to wait for one.

import { RUSH_HOURS, SERVICE_RULES } from "../../domain/jeepneyService";
import type { JeepneyRoute } from "../../domain/MockData";
import { manilaNow } from "../../domain/openingHours";
import { routePath } from "../../domain/routeGeometry";
import { pathLengthKm } from "../geo";
import { JEEP_BOARD_WAIT_MINUTES, JEEP_SPEED_KMH } from "../martins/neighbors";

/** Longest wait the model will assume, however few units. */
const MAX_WAIT_MINUTES = 30;
/** Time a jeepney spends at each end of its route filling up before it leaves again (assumption — tune with field data). */
const TERMINAL_LAYOVER_MINUTES = 10;

/**
 * Is the route running at `at`? `null` means "ignore service hours" — used
 * by the thesis scripts so their results don't depend on the time they run.
 */
export function isRunning(route: JeepneyRoute, at: Date | null): boolean {
  const hours = SERVICE_RULES[route.colorCode]?.hours;
  if (!hours || at === null) return true;
  const { minutes } = manilaNow(at);
  return (hours.from === undefined || minutes >= hours.from) && (hours.to === undefined || minutes < hours.to);
}

/** Is `at` within rush hours (domain/jeepneyService.ts)? `null` (thesis scripts) never is. */
export function isRushHour(at: Date | null): boolean {
  if (at === null) return false;
  const { day, minutes } = manilaNow(at);
  return day !== 6 && RUSH_HOURS.some((r) => minutes >= r.from && minutes < r.to); // day 6 = Sunday
}

/**
 * Typical wait for this route in the Transit/Mixed planner: expectedWaitMinutes from a known fleet size,
 * else the colour's rider-reported wait (Yellow and Red are common, Cream is not), else the default.
 * (The older jeepney matcher behind the Chapter 3 tables keeps expectedWaitMinutes.)
 */
export function typicalWaitMinutes(route: JeepneyRoute): number {
  const rule = SERVICE_RULES[route.colorCode];
  if (!rule?.units && rule?.waitMinutes !== undefined) return rule.waitMinutes;
  return expectedWaitMinutes(route);
}

const waitCache = new Map<string, number>();

/**
 * Expected minutes waiting at the roadside for this route. With a known
 * number of units, a jeepney passes every (round trip — driving plus a
 * layover at each terminal — ÷ units), so the average wait is half that;
 * otherwise the usual JEEP_BOARD_WAIT_MINUTES.
 */
export function expectedWaitMinutes(route: JeepneyRoute): number {
  const units = SERVICE_RULES[route.colorCode]?.units;
  if (!units) return JEEP_BOARD_WAIT_MINUTES;
  let wait = waitCache.get(route.id);
  if (wait === undefined) {
    const roundTripKm = pathLengthKm(routePath(route, "fwd") ?? []) + pathLengthKm(routePath(route, "rev") ?? []);
    const roundTripMinutes = (roundTripKm / JEEP_SPEED_KMH) * 60 + 2 * TERMINAL_LAYOVER_MINUTES;
    const headway = roundTripMinutes / units;
    wait = Math.min(MAX_WAIT_MINUTES, Math.max(JEEP_BOARD_WAIT_MINUTES, headway / 2));
    waitCache.set(route.id, wait);
  }
  return wait;
}

/** Route ids not running at `at` (empty when `at` is null). */
export function closedRouteIds(routes: JeepneyRoute[], at: Date | null): Set<string> {
  return new Set(routes.filter((r) => !isRunning(r, at)).map((r) => r.id));
}
