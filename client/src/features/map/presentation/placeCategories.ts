// How each kind of place looks: its colour and icon. Shared by the map
// markers and the place lists so a hospital is the same red everywhere.

const CROSS = "M12 6v12 M6 12h12";
const SHIELD = "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z";
const CAP = "M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c0 2 2 3 6 3s6-1 6-3v-5";
const BANK = "M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M11 10v11 M15 10v11 M20 10v11";
const CART =
  "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z";
const FORK = "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2H3zm10 0v20h2V2h-2z";

const ICON_PATHS: Record<string, string> = {
  townhall: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
  hospital: CROSS,
  clinic: CROSS,
  pharmacy: CROSS,
  dentist: CROSS,
  police: SHIELD,
  school: CAP,
  university: CAP,
  bank: BANK,
  atm: BANK,
  supermarket: CART,
  convenience: CART,
  restaurant: FORK,
  fast_food: FORK,
  cafe: "M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M10 1v3 M14 1v3",
  fuel: "M3 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18 M3 22h10 M15 8h2a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 3 0V8l-3-3",
  place_of_worship: "M12 2l4 8h-8z M8 22V10h8v12",
  post_office: "M3 8l9 6 9-6 M3 6h18v12H3z",
  tricycle_stand:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v4 M12 18v4 M4.93 4.93l2.83 2.83 M16.24 16.24l2.83 2.83 M2 12h4 M18 12h4 M4.93 19.07l2.83-2.83 M16.24 7.76l2.83-2.83",
};
const PIN_PATH = "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z";

const COLOR_GROUPS: [string, string[]][] = [
  ["#ef4444", ["hospital", "clinic", "pharmacy", "dentist"]],
  ["#3b82f6", ["school", "university", "college"]],
  ["#10b981", ["bank", "atm"]],
  ["#f59e0b", ["supermarket", "convenience", "mall", "marketplace", "restaurant", "cafe", "fast_food"]],
  ["#8b5cf6", ["townhall", "police", "fire_station", "post_office"]],
  ["#16a34a", ["tricycle_stand"]],
  ["#7c3aed", ["jeepney_stop"]],
];

export function categoryColor(type: string): string {
  const t = (type || "").toLowerCase();
  return COLOR_GROUPS.find(([, types]) => types.includes(t))?.[0] ?? "#64748b";
}

/** SVG path (24×24 viewBox, stroked) for a place type; a map pin for anything without its own icon. */
export function categoryIconPath(type: string): string {
  return ICON_PATHS[(type || "").toLowerCase()] ?? PIN_PATH;
}

/** "fast_food" → "Fast Food" */
export function categoryLabel(type: string): string {
  if (!type) return "Place";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
