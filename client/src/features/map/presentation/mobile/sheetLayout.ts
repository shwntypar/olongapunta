// Sizes of the phone/tablet bottom sheet, shared by the sheet itself and by the
// map (which keeps fitted routes and focused places clear of the sheet).

/** Below this width (px) the app uses the bottom sheet; at or above it, the desktop sidebar (Tailwind's lg). */
export const DESKTOP_MIN_WIDTH = 1024;

export type SheetSnap = "peek" | "half" | "full";

export const PEEK_PX = 140;
const VH_FRACTION: Record<Exclude<SheetSnap, "peek">, number> = { half: 0.5, full: 0.88 };

export function snapHeight(snap: SheetSnap): number {
  if (typeof window === "undefined" || snap === "peek") return PEEK_PX;
  return Math.round(window.innerHeight * VH_FRACTION[snap]);
}

export const usesBottomSheet = () => typeof window !== "undefined" && window.innerWidth < DESKTOP_MIN_WIDTH;

/** Space above the map's floating search bar. */
const TOP_CONTROLS_PX = 90;

/**
 * Padding for fitBounds / flyTo. On phones and tablets it leaves room for the
 * search bar and for the sheet at the given height, so nothing ends up hidden.
 */
export function mapViewPadding(edge: number, sheet: SheetSnap) {
  if (!usesBottomSheet()) return { top: edge, bottom: edge, left: edge, right: edge };
  return { top: TOP_CONTROLS_PX, bottom: snapHeight(sheet) + 24, left: 40, right: 40 };
}
