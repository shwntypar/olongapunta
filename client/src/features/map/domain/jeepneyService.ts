// When each jeepney colour runs and how many units are on the road.
//
// ⚠ Rider reports, NOT yet verified in the field — confirm with the drivers'
// associations / LTFRB and update here. Nothing else needs to change: Transit
// and Mixed both read these rules (application/jeepney/serviceRules.ts).
//
// Keyed by colour because that is how riders tell jeepneys apart. A colour
// with no entry is assumed to run all day with enough units for a short wait.

import type { JeepneyColor } from "./MockData";

export interface ServiceRule {
  /** Minutes from midnight (Manila time). Omit `from` / `to` when only one end is known. */
  hours?: { from?: number; to?: number };
  /** Units in service, when known. Few units on a long loop mean long waits. */
  units?: number;
  /**
   * Typical minutes at the roadside for this colour, as riders know it — used when `units` isn't known.
   * A common colour (a jeepney every couple of minutes) is shorter than the default 5; a rare one longer.
   */
  waitMinutes?: number;
  /** Where the rule comes from and how sure it is. */
  source: string;
}

const h = (hours: number) => hours * 60;

export const SERVICE_RULES: Partial<Record<JeepneyColor, ServiceRule>> = {
  GREEN: { hours: { from: h(6), to: h(9) }, units: 1, source: "Rider report (to verify): runs about 6–9 AM; one unit in service." },
  WHITE: { hours: { to: h(20) }, source: "Rider report (to verify): last trip around 8 PM." },
  YELLOW: { waitMinutes: 3, source: "Rider report (to verify): one of the two most common colours — one passes every few minutes." },
  RED: { waitMinutes: 3, source: "Rider report (to verify): one of the two most common colours — one passes every few minutes." },
  CREAM: { waitMinutes: 10, source: "Rider report (to verify): runs all day, but far fewer units than Yellow or Red." },
};

/** Limited hours or a known small fleet: less dependable to plan a trip on. */
export function hasLimitedService(color: JeepneyColor): boolean {
  const rule = SERVICE_RULES[color];
  return !!(rule?.hours || rule?.units);
}

/**
 * Rush hours, Monday–Saturday (minutes from midnight, Manila time). Jeepneys fill up in their first few
 * kilometres, so further along the route the ones passing are often full: boarding there costs
 * RUSH_HOUR_FULL_EXTRA_MINUTES more (letting one or two pass). Near the start of the route it doesn't.
 * ⚠ Assumption — confirm the hours, and which routes/directions fill up, in the field.
 */
export const RUSH_HOURS: { from: number; to: number }[] = [
  { from: h(6), to: h(9) },
  { from: h(16), to: h(19) },
];
/** How far along a route direction (km from its start) jeepneys are usually full at rush hour. */
export const RUSH_HOUR_FULL_AFTER_KM = 2;
/** Extra wait at rush hour past RUSH_HOUR_FULL_AFTER_KM — about one full jeepney let pass. */
export const RUSH_HOUR_FULL_EXTRA_MINUTES = 6;

function clock(minutes: number) {
  const hh = Math.floor(minutes / 60) % 24;
  const suffix = hh < 12 ? "AM" : "PM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const mm = minutes % 60;
  return mm ? `${h12}:${String(mm).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** "6–9 AM only", "until 8 PM", or null for an all-day colour. */
export function serviceHoursLabel(color: JeepneyColor): string | null {
  const hours = SERVICE_RULES[color]?.hours;
  if (!hours) return null;
  if (hours.from !== undefined && hours.to !== undefined) {
    const [a, b] = [clock(hours.from), clock(hours.to)];
    const sameHalf = a.slice(-2) === b.slice(-2);
    return `${sameHalf ? a.slice(0, -3) : a}–${b} only`;
  }
  if (hours.to !== undefined) return `until ${clock(hours.to)}`;
  return `from ${clock(hours.from!)}`;
}

/**
 * A note for the step list when a colour has limited hours or few units:
 * " Runs 6–9 AM only · 1 unit in service — expect a longer wait (~19 min)." ('' otherwise).
 */
export function serviceNote(color: JeepneyColor, waitMinutes?: number): string {
  const parts = [serviceHoursLabel(color)?.replace(/^/, "Runs "), unitsLabel(color)].filter(Boolean);
  if (parts.length === 0) return "";
  const wait = SERVICE_RULES[color]?.units && waitMinutes ? ` — expect a longer wait (~${Math.round(waitMinutes)} min)` : "";
  return ` ${parts.join(" · ")}${wait}.`;
}

/** "1 unit in service" or null. */
export function unitsLabel(color: JeepneyColor): string | null {
  const units = SERVICE_RULES[color]?.units;
  return units ? `${units} unit${units === 1 ? "" : "s"} in service` : null;
}
