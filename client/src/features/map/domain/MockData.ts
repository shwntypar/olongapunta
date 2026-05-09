export type JeepneyColor = 'YELLOW' | 'BLUE' | 'RED' | 'GREEN';

/** Hex colors for Mapbox line layers (jeepney coding). */
export const JEEPNEY_COLOR_HEX: Record<JeepneyColor, string> = {
  YELLOW: '#ca8a04',
  BLUE: '#2563eb',
  RED: '#dc2626',
  GREEN: '#16a34a',
};

export function jeepneyColorToHex(color: JeepneyColor): string {
  return JEEPNEY_COLOR_HEX[color];
}

export interface RouteStop {
  name: string;
  lat: number;
  lng: number;
  order: number;
}

export interface JeepneyRoute {
  id: string;
  colorCode: JeepneyColor;
  routeName: string;
  baseFare: number;
  farePerKm: number;
  stops: RouteStop[];
  path?: [number, number][]; // Optional full path coordinates [lng, lat]
}

export const mockRoutes: JeepneyRoute[] = [
  {
    id: 'route-1',
    colorCode: 'YELLOW',
    routeName: 'Balic-Balic to SM Downtown',
    baseFare: 13.00,
    farePerKm: 1.50,
    stops: [
      { name: 'City Hall', lat: 14.8374, lng: 120.2835, order: 1 },
      { name: 'Rizal Avenue', lat: 14.8350, lng: 120.2850, order: 2 },
      { name: 'SM Olongapo', lat: 14.8320, lng: 120.2870, order: 3 },
      { name: 'Barretto Beach', lat: 14.8200, lng: 120.2900, order: 4 },
    ],path: [
      [
        120.292606,
        14.8598008
      ],
      [
        120.2906872,
        14.8451319
      ],
      [
        120.2825872,
        14.8267851
      ]
    ]
  },
  {
    id: 'route-2',
    colorCode: 'BLUE',
    routeName: 'Gordon Heights to Subic Bay',
    baseFare: 10.00,
    farePerKm: 1.75,
    stops: [
      { name: 'Gordon Heights Gate', lat: 14.8500, lng: 120.2700, order: 1 },
      { name: 'Kalaklan Ridge', lat: 14.8450, lng: 120.2750, order: 2 },
      { name: 'Subic Bay Freeport', lat: 14.8300, lng: 120.2800, order: 3 },
      { name: 'Naval Base', lat: 14.8250, lng: 120.2850, order: 4 },
    ],path: [
      [
        120.2834751,
        14.8396388
      ],
      [
        120.2526302,
        14.8522904
      ],
      [
        120.2448824,
        14.857505
      ],
      [
        120.2372535,
        14.888303
      ],
    ],
    //return paths of the jeep
    // returnPath: []
  },
  // {
  //   id: 'route-4',
  //   colorCode: 'GREEN',
  //   routeName: 'West Bajac to East Tapinac',
  //   baseFare: 9.00,
  //   farePerKm: 1.60,
  //   stops: [
  //     { name: 'West Bajac Elementary', lat: 14.8250, lng: 120.2750, order: 1 },
  //     { name: 'Bajac Road', lat: 14.8280, lng: 120.2780, order: 2 },
  //     { name: 'East Tapinac', lat: 14.8300, lng: 120.2820, order: 3 },
  //     { name: 'Tapinac Market', lat: 14.8320, lng: 120.2850, order: 4 },
  //   ],
  // },
  {
    id: 'route-5',
    colorCode: 'RED',
    routeName: 'Filtration to Mabayuan Arch',
    baseFare: 12.00,
    farePerKm: 1.40,
    stops: [
      { name: 'Filtration', lat: 14.851620, lng: 120.288707, order: 1 },
      { name: 'Mabayuan Arch', lat: 14.839914, lng: 120.280935, order: 2 },
    ],
    path: [
      [
        120.2922302,
        14.8604858
      ],
      [
        120.280861,
        14.8398471
      ],
      [
        120.2823649,
        14.8377328
      ],
      [
        120.2824334,
        14.8268938
      ]
    ],
  },
];