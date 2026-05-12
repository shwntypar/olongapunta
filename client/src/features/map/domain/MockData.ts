export type JeepneyColor = 'YELLOW' | 'BLUE' | 'RED' | 'GREEN' | 'ORANGE' | 'CREAM' | 'BROWN' | 'WHITE' ;

// 📍 Temporary hardcoded user location (Marikit Park area) for testing
export const USER_START_LOCATION = [120.2831, 14.8299];
/** Hex colors for Mapbox line layers (jeepney coding). */
export const JEEPNEY_COLOR_HEX: Record<JeepneyColor, string> = {
  YELLOW: '#ca8a04',
  BLUE: '#2563eb',
  RED: '#dc2626',
  GREEN: '#16a34a',
  ORANGE: '#FFA500',
  CREAM: '#000000',
  BROWN: '#964B00',
  WHITE: '#FFFFFF'

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
  returnPath?: [number, number][];  
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
    id: 'route-3',
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
  },{
    id: 'route-4',
    colorCode: 'ORANGE',
    routeName: 'GORDON HEIGTS GATE VIA PAG-ASA',
    baseFare: 13.00,
    farePerKm: 1.40,
    stops: [
      { name: 'Filtration', lat: 14.851620, lng: 120.288707, order: 1 },
      { name: 'Mabayuan Arch', lat: 14.839914, lng: 120.280935, order: 2 },
    ],
    path: [
      [
        120.2933543,
        14.8662469
      ],
      [
        120.2950356,
        14.8532057
      ],
      [
        120.2919998,
        14.8480335
      ],
      [
        120.2897751,
        14.8414307
      ],
      [
        120.2855625,
        14.8374982
      ],
      [
        120.2882761,
        14.8313155
      ],
      [
        120.2835797,
        14.8268104
      ]
    ],
  },{
    id: 'route-5',
    colorCode: 'GREEN',
    routeName: 'MABAYUAN - PALENGKE',
    baseFare: 13.00,
    farePerKm: 1.40,
    stops: [
      { name: 'Filtration', lat: 14.851620, lng: 120.288707, order: 1 },
      { name: 'Mabayuan Arch', lat: 14.839914, lng: 120.280935, order: 2 },
    ],
    path: [
      [
        120.2887203,
        14.8517401
      ],
      [
        120.2808785,
        14.8397659
      ],
      [
        120.2855445,
        14.8393795
      ],
      [
        120.2860017,
        14.8402672
      ],
      [
        120.2864032,
        14.8398983
      ],
      [
        120.2855842,
        14.8394179
      ]
    ],
  },{
    id: 'route-6',
    colorCode: 'CREAM',
    routeName: 'GORDON HEIGHTS - PALENGKE (Waterdam Road)',
    baseFare: 13.00,
    farePerKm: 1.40,
    stops: [
      { name: 'Filtration', lat: 14.851620, lng: 120.288707, order: 1 },
      { name: 'Mabayuan Arch', lat: 14.839914, lng: 120.280935, order: 2 },
    ],
    path: [
      [
        120.2863839,
        14.8409312
      ],
      [
        120.285025,
        14.8415571
      ],
      [
        120.2855708,
        14.8429462
      ],
      [
        120.2869934,
        14.8424127
      ],
      [
        120.2899654,
        14.845081
      ],
      [
        120.2910614,
        14.8475857
      ],
      [
        120.2952691,
        14.8525694
      ],
      [
        120.2952492,
        14.8750075
      ]
    ],returnPath: [
      [
        120.2952338,
        14.8750202
      ],
      [
        120.2922628,
        14.8602315
      ],
      [
        120.2923277,
        14.8481425
      ],
      [
        120.2901616,
        14.8479721
      ],
      [
        120.2900483,
        14.845087
      ],
      [
        120.2874445,
        14.8427108
      ],
      [
        120.2865638,
        14.8411284
      ]
  ]
  },{
    id: 'route-7',
    colorCode: 'CREAM',
    routeName: 'GORDON HEIGHTS - PALENGKE (Long Road)',
    baseFare: 13.00,
    farePerKm: 1.40,
    stops: [
      { name: 'Filtration', lat: 14.851620, lng: 120.288707, order: 1 },
      { name: 'Mabayuan Arch', lat: 14.839914, lng: 120.280935, order: 2 },
    ],
    path: [
      [
        120.2863955,
        14.8409387
      ],
      [
        120.2850108,
        14.8415748
      ],
      [
        120.2855673,
        14.8429541
      ],
      [
        120.2869827,
        14.8424096
      ],
      [
        120.2904625,
        14.8454026
      ],
      [
        120.2903126,
        14.8480275
      ],
      [
        120.2885369,
        14.8514806
      ],
      [
        120.2892028,
        14.8538805
      ],
      [
        120.2898351,
        14.8587348
      ],
      [
        120.2933186,
        14.8753003
      ]
    ], returnPath: []
  },{
    id: 'route-8',
    colorCode: 'BROWN',
    routeName: 'NEW CABALAN - PALENGKE',
    baseFare: 13.00,
    farePerKm: 1.40,
    stops: [
      { name: 'Filtration', lat: 14.851620, lng: 120.288707, order: 1 },
      { name: 'Mabayuan Arch', lat: 14.839914, lng: 120.280935, order: 2 },
    ],
    path: [
      [
            120.2893305,
            14.8428786
          ],
          [
            120.2888734,
            14.8423938
          ],
          [
            120.2884956,
            14.842762
          ],
          [
            120.3047048,
            14.8492983
          ],
          [
            120.3093081,
            14.8637182
          ]
    ],
  },{
    id: 'route-9',
    colorCode: 'WHITE',
    routeName: 'OLONGAPO - DINALUPIHAN ',
    baseFare: 13.00,
    farePerKm: 1.40,
    stops: [
      { name: 'Filtration', lat: 14.851620, lng: 120.288707, order: 1 },
      { name: 'Mabayuan Arch', lat: 14.839914, lng: 120.280935, order: 2 },
    ],
    path: [
      [
        120.467069,
        14.86776
      ],
      [
        120.4648414,
        14.8671409
      ],
      [
        120.3998814,
        14.8456815
      ],
      [
        120.3430668,
        14.8468011
      ],
      [
        120.2894212,
        14.8436635
      ],
      [
        120.2902651,
        14.8428483
      ],
      [
        120.2892783,
        14.8410428
      ],
      [
        120.2878379,
        14.8405308
      ]
    ],
  },
];