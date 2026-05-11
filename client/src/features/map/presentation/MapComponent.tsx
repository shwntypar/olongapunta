// "use client";

// import Map, { Marker } from "react-map-gl/mapbox";
// import "mapbox-gl/dist/mapbox-gl.css";
// import { useMapState } from "../application/useMapState";
// import { useEffect } from "react";

// // Olongapo boundaries (southwest to northeast corners)
// const OLONGAPO_BOUNDS: [[number, number], [number, number]] = [
//   [120.2, 14.95], // Southwest
//   [120.38, 14.75], // Northeast
// ];

// const MapComponent = () => {
//   const {
//     viewState,
//     setViewState,
//     styleUrl,
//     isStyleReady,
//     mapRef,
//     handleStyleChange,
//     handleMapLoad,
//     handleMove,
//   } = useMapState();

//   useEffect(() => {
//     if (mapRef) {
//       mapRef.flyTo({
//         center: [120.28278, 14.82917],
//         zoom: 10,
//         essential: true,
//         duration: 1500,
//       });
//     }
//   }, [mapRef, isStyleReady]);

//   return (
//     <div className="w-full h-full">
//       <Map
//         mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
//         initialViewState={viewState}
//         onMove={handleMove}
//         onLoad={handleMapLoad}
//         style={{ width: "100%", height: "100%" }}
//         mapStyle={styleUrl}
//         attributionControl={false}
//         transformRequest={(url) => {
//           if (url.includes("events.mapbox.com")) return { url: "" };
//           return { url };
//         }}
//         reuseMaps={true}
//         maxBounds={OLONGAPO_BOUNDS}
//       >
//         <Marker longitude={120.28278} latitude={14.82917}>
//           <div className="bg-blue-500 w-4 h-4 rounded-full border-3 border-white shadow-lg cursor-pointer" />
//         </Marker>
//       </Map>
//     </div>
//   );
// };

// export default MapComponent;
