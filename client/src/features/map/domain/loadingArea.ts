export interface loadingArea {
  name: string;
  lat: number;
  lng: number;
  baseFare: number;
  maximumFare?: number;
  colorCode: string;
}

export interface unloadingArea {
    name: string;
    lat: number;
    lng: number;
    colorCode: string;
}

export const loadingAreas: loadingArea[] = [
  {
    name: "Blue Tricycle Loading Area 1",
    lat: 14.8390669,
    lng: 120.2834153,
    baseFare: 30,
    maximumFare: 50,
    colorCode: "BLUE"
  },
  {
    name: "Blue Tricycle Loading Area Victory Liner Terminal",
    lat: 14.8393188,
    lng: 120.2838985,
    baseFare: 30,
    maximumFare: 60,
    colorCode: "BLUE"
  },
  {
    name: "Blue Tricycle Loading Area Public Market",
    lat: 14.84066,
    lng: 120.2859692,
    baseFare: 30,
    maximumFare: 60,
    colorCode: "BLUE"
  },
  {
    name: "Blue Tricycle Loading Area Triangle",
    lat: 14.8418652,
    lng: 120.2866898,
    baseFare: 30,
    maximumFare: 60,
    colorCode: "BLUE"
  },
  {
    name: "Blue Tricycle Loading Area City Hall",
    lat: 14.8428259,
    lng: 120.2875837,
    baseFare: 30,
    maximumFare: 60,
    colorCode: "BLUE"
  },{
    name: "Blue Tricycle Loading Area Caltex",
    lat: 14.845187,
    lng: 120.2906248,
    baseFare: 30,
    maximumFare: 60,
    colorCode: "BLUE"
  },
];

export const unloadingAreas: unloadingArea[] = [
    {
    name: "Yellow Unloading Area - SM Central", 
    lat: 14.8377184,
    lng: 120.2827752,
    colorCode: "YELLOW"
    },{
    name: "Yellow Unloading Area - Ulo ng Apo", 
    lat: 14.8386438,
    lng: 120.2841005,
    colorCode: "YELLOW"
    },{
    name: "Yellow Unloading Area - SM DOWNTOWN", 
    lat: 14.8266678,
    lng: 120.2825893,
    colorCode: "YELLOW"
    },{
    name: "Yellow Unloading Area - Public Market 1", 
    lat: 14.840391,
    lng: 120.2860023,
    colorCode: "YELLOW"
    },{
    name: "Yellow Unloading Area - Public Market 2", 
    lat: 14.8412434,
    lng: 120.2868726,
    colorCode: "YELLOW"
    },{
    name: "Red Unloading Area - SM Downtown", 
    lat: 14.8269109,
    lng: 120.2824112,
    colorCode: "RED"
    },
];