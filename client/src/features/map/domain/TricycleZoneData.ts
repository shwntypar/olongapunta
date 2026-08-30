export interface TricycleZone {
  id: string;
  code: string;   // e.g. "TODA-3" — shown on the map and in fare lookups
  name: string;   // e.g. "Barretto Tricycle Zone"
  color: string;  // hex color used to draw this zone's boundary + ride legs
  baseFare: number;
  farePerKm: number;
  polygon: any; // GeoJSON Polygon or MultiPolygon *geometry* (not a Feature) — [[ [lng,lat], ... ]]
}

// 📍 HOW TO ADD A ZONE (Option A — geojson.io):
// 1. Open https://geojson.io, draw the zone's polygon over its actual streets.
// 2. In the right-hand panel, copy only the `geometry` object of the drawn
//    Feature (the `{ "type": "Polygon", "coordinates": [...] }` part — not
//    the whole Feature wrapper) into the `polygon` field below.
// 3. Give it a unique `id`/`code`, a display `name`, a `color`, and its fares.
export const tricycleZones: TricycleZone[] = [
  {
    id: "toda-1",
    code: "TODA-1",
    name: "Barretto Tricycle Zone",
    color: "#0ea5e9",
    baseFare: 30,
    farePerKm: 8,
    polygon: {
      type: "Polygon",
      "coordinates": [
          [
            [
              120.2734176,
              14.8285233
            ],
            [
              120.2759597,
              14.8271509
            ],
            [
              120.2792689,
              14.8264601
            ],
            [
              120.2824861,
              14.8261414
            ],
            [
              120.282566,
              14.8274839
            ],
            [
              120.2818866,
              14.8287202
            ],
            [
              120.2811978,
              14.830085
            ],
            [
              120.2803975,
              14.8311542
            ],
            [
              120.2806856,
              14.8331505
            ],
            [
              120.2811511,
              14.8341071
            ],
            [
              120.2813309,
              14.8373909
            ],
            [
              120.2807099,
              14.8369469
            ],
            [
              120.2781647,
              14.8351869
            ],
            [
              120.2770756,
              14.8335256
            ],
            [
              120.2765124,
              14.8318479
            ],
            [
              120.2757231,
              14.8298003
            ],
            [
              120.2734176,
              14.8285233
            ]
          ]
        ]
    },
  },
];
