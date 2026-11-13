// App-wide settings for the map feature.

export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
export const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

/** Where the map opens, and where the "you are here" marker sits until an origin is set. [lon, lat] */
export const DEFAULT_CITY_CENTER: [number, number] = [120.2843319, 14.8388901];
export const DEFAULT_ZOOM = 14;

/**
 * Jeepney stop markers and the "Jeepney Routes & Stops" list are switched off:
 * the stop coordinates are not verified data yet (unlike the field-surveyed
 * Green-zone tricycle stops). Flip to true to show them everywhere at once.
 */
export const SHOW_JEEPNEY_STOPS = false;
