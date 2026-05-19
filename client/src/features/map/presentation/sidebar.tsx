"use client";
import React, { useState } from 'react';
import { getDistanceMeters } from '../application/getDirections';
import { mockRoutes } from '../domain/MockData';

export type TravelMode = 'walking' | 'cycling' | 'driving' | 'transit';

const JEEPNEY_HEX_COLORS: Record<string, string> = {
  YELLOW: '#ca8a04',
  BLUE: '#2563eb',
  RED: '#dc2626',
  GREEN: '#16a34a',
  ORANGE: '#FFA500',
  CREAM: '#FFFDD0',
  BROWN: '#964B00',
  WHITE: '#e5e7eb'
};

interface SidebarProps {
  places: any[];
  userLocation: number[] | null;
  origin: { name: string; coords: number[] } | null;
  destination: any | null;
  mode: TravelMode;
  isRoutingMode: boolean;
  setMode: (mode: TravelMode) => void;
  onSelectOriginMode: () => void; 
  onCloseRouting: () => void;
  onSelectPlace: (place: any) => void; 
  onStartNavigation: (place: any) => void; 
  routeInstructions?: any[];
  visibleRouteIds: string[];
  isolatedDirectionId: string | null; // 🟢 NEW: Tracks the exact Fwd/Rev direction
  onSelectRoute: (routeId: string, directionId: string) => void; // 🟢 NEW: Passes both IDs
}

export default function Sidebar({ 
  places, userLocation, origin, destination, mode, 
  isRoutingMode, setMode, onSelectOriginMode, onCloseRouting, onSelectPlace, onStartNavigation,
  routeInstructions = [],
  visibleRouteIds, isolatedDirectionId, onSelectRoute 
}: SidebarProps) {

  const [activeTab, setActiveTab] = useState<'places' | 'routes'>('places');

  if (isRoutingMode) {
    return (
      <div className="absolute left-0 top-0 h-full w-80 bg-white shadow-2xl z-20 flex flex-col border-r border-gray-200">
        <div className="p-4 bg-blue-600 text-white flex items-center gap-3 shadow-md">
          <button onClick={onCloseRouting} className="p-1 hover:bg-blue-700 rounded-full transition-colors" title="Cancel Navigation">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="font-bold text-lg">Directions</h2>
        </div>

        <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-4">
          <div className="flex bg-gray-200 rounded-lg p-1">
            {(['driving', 'cycling', 'transit', 'walking'] as TravelMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-xs font-bold capitalize rounded transition-all ${mode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {m === 'cycling' ? 'Motorcycle' : m === 'transit' ? 'Jeepney' : m}
              </button>
            ))}
          </div>

          <div className="space-y-3 relative">
            <div className="absolute left-3.5 top-5 bottom-5 w-0.5 bg-gray-300 border-dashed border-l-2"></div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-white z-10"></div>
              <button 
                onClick={onSelectOriginMode}
                className={`flex-1 text-left p-2.5 rounded border text-sm transition-all ${!origin ? 'border-blue-400 bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 animate-pulse' : 'border-gray-200 bg-white shadow-sm'}`}
              >
                <div className="truncate">{origin ? origin.name : "Choose starting point..."}</div>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 z-10"></div>
              <div className="flex-1 text-left p-2.5 rounded border border-gray-200 bg-gray-100 text-sm text-gray-700 font-medium">
                <div className="truncate">{destination ? destination.name : "Choose destination..."}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-white">
          {!origin ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-6">
              <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <p className="text-sm">Select a starting point on the map<br/>to calculate your route.</p>
            </div>
          ) : routeInstructions.length > 0 ? (
            <ul className="divide-y divide-gray-100 pb-20">
              {routeInstructions.map((step, idx) => (
                <li key={idx} className="p-4 flex gap-4 items-start hover:bg-gray-50 transition-colors">
                  <div className="mt-0.5 w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full flex-shrink-0 text-xs font-bold">{idx + 1}</div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 leading-tight">{step.maneuver.instruction}</p>
                    {step.distance > 0 && <p className="text-xs text-gray-500 mt-1 font-medium">{(step.distance).toFixed(0)} meters</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-sm text-blue-500 font-medium animate-pulse">Calculating route...</div>
          )}
        </div>
      </div>
    );
  }

  const placesWithDistance = places.map(place => {
    const startPos = origin ? origin.coords : userLocation || [0,0];
    const distance = getDistanceMeters(startPos, [parseFloat(place.lon), parseFloat(place.lat)]);
    return { ...place, distance };
  }).sort((a, b) => a.distance - b.distance);

  return (
    <div className="absolute left-0 top-0 h-full w-80 bg-white shadow-2xl z-20 flex flex-col border-r border-gray-200">
      <div className="bg-blue-600 text-white shadow-md pt-5 px-5">
        <h2 className="font-bold text-xl">OlongaPunta</h2>
        <div className="flex mt-4">
          <button onClick={() => setActiveTab('places')} className={`flex-1 pb-3 text-sm font-bold text-center border-b-4 transition-colors ${activeTab === 'places' ? 'border-white text-white' : 'border-blue-500 text-blue-200 hover:text-white'}`}>Places</button>
          <button onClick={() => setActiveTab('routes')} className={`flex-1 pb-3 text-sm font-bold text-center border-b-4 transition-colors ${activeTab === 'routes' ? 'border-white text-white' : 'border-blue-500 text-blue-200 hover:text-white'}`}>Jeepney Routes</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        
        {activeTab === 'places' && placesWithDistance.map((place, index) => (
          <div key={place.id || index} className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-md transition-all cursor-pointer" onClick={() => onSelectPlace(place)}>
            <h3 className="font-bold text-gray-800">{place.name}</h3>
            <p className="text-xs text-gray-500 mb-3 capitalize">{place.type.replace('_', ' ')}</p>
            <button onClick={(e) => { e.stopPropagation(); onStartNavigation(place); }} className="w-full py-2 rounded-lg font-semibold bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-sm">Navigate</button>
          </div>
        ))}

        {/* ROUTES TAB */}
        {activeTab === 'routes' && mockRoutes.flatMap((route) => {
          const routeHex = JEEPNEY_HEX_COLORS[route.colorCode] || '#000000';

          const directions = [
            { title: route.routeName, id: `${route.id}-fwd` },
            { title: route.reversedName, id: `${route.id}-rev` }
          ];

          return directions.map((dir) => {
            // 🟢 UI Logic: Highlight ONLY the exact clicked direction
            const isActive = isolatedDirectionId 
              ? isolatedDirectionId === dir.id 
              : visibleRouteIds.includes(route.id);

            return (
              <div 
                key={dir.id}
                onClick={() => onSelectRoute(route.id, dir.id)} // 🟢 Passes BOTH IDs to Map
                className={`flex items-center justify-between mb-2 p-3 rounded-lg shadow-sm cursor-pointer transition-all border border-gray-200 ${isActive ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 opacity-60 grayscale'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: routeHex }}></div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 leading-tight">
                      {route.routeCode} | {dir.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {route.routeCode} · <span className="capitalize">{route.colorCode.toLowerCase()}</span> Jeepney
                    </p>
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            );
          });
        })}

      </div>
    </div>
  );
}