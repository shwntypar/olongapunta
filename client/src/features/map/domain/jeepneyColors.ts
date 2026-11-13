import type { JeepneyColor } from "./MockData";

/** Route line colours on the map, and the colour chips in the Layers panel. */
export const JEEPNEY_LINE_COLORS: Record<JeepneyColor, string> = {
  YELLOW: "#eab308",
  BLUE: "#2563eb",
  RED: "#dc2626",
  GREEN: "#16a34a",
  ORANGE: "#c2410c",
  CREAM: "#FFFDD0",
  BROWN: "#964B00",
  WHITE: "#e5e7eb",
};

/**
 * Colour dots in the sidebar lists. Same fleets as above, but tuned to stay
 * visible on a white card (the real cream/white would disappear there).
 */
export const JEEPNEY_SWATCH_COLORS: Record<JeepneyColor, string> = {
  YELLOW: "#eab308",
  BLUE: "#2563eb",
  RED: "#dc2626",
  GREEN: "#16a34a",
  ORANGE: "#f97316",
  CREAM: "#fef08a",
  BROWN: "#78350f",
  WHITE: "#94a3b8",
};
