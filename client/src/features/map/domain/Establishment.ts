export interface Establishment {
  name: string;
  lat: number;
  lng: number;
  establishmentType: string;
}

export const mockEstablishments: Establishment[] = [
  {
    name: "Olongapo City Hall",
    lat: 14.8392,
    lng: 120.2820,
    establishmentType: "Government",
    },
    {
    name: "SM City Downtown",
    lat: 14.8264059,
    lng: 120.283126,
    establishmentType: "Commercial",
    },
    {
    name: "SM City Central",
    lat: 14.8361641,
    lng: 120.2830871,
    establishmentType: "Commercial",
    },
    {   
    name: "Olongapo City National High School",
    lat: 14.83511,
    lng: 120.2819061,  
    establishmentType: "Educational",
    },
];