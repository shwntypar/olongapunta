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
  CREAM: '#fef3c7', // Adjusted for better visibility
  BROWN: '#964B00',
  WHITE: '#f3f4f6'  // Adjusted for better visibility
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
  isolatedDirectionId: string | null;
  onSelectRoute: (routeId: string, directionId: string) => void; 
}

export default function Sidebar({ 
  places, userLocation, origin, destination, mode, 
  isRoutingMode, setMode, onSelectOriginMode, onCloseRouting, onSelectPlace, onStartNavigation,
  routeInstructions = [],
  visibleRouteIds, isolatedDirectionId, onSelectRoute 
}: SidebarProps) {

  const [activeTab, setActiveTab] = useState<'places' | 'routes'>('routes');

  // ==========================================
  // 🟢 ROUTING / DIRECTIONS MODE
  // ==========================================
  if (isRoutingMode) {
    return (
      <div className="absolute left-0 top-0 h-full w-96 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.1)] z-20 flex flex-col border-r border-gray-200 transition-all">
        {/* Routing Header */}
        <div className="p-5 bg-gradient-to-r from-blue-700 to-blue-600 text-white flex items-center gap-4 shadow-md">
          <button onClick={onCloseRouting} className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition-all" title="Cancel Navigation">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="font-extrabold text-xl tracking-tight">Directions</h2>
        </div>

        {/* Travel Modes & Inputs */}
        <div className="p-5 bg-gray-50 border-b border-gray-200 space-y-5">
          {/* Segmented Control for Travel Modes */}
          <div className="flex bg-gray-200/80 rounded-xl p-1.5 shadow-inner">
            {(['driving', 'cycling', 'transit', 'walking'] as TravelMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs font-bold capitalize rounded-lg transition-all duration-200 ${mode === m ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'}`}
              >
                {m === 'cycling' ? 'Motorcycle' : m === 'transit' ? 'Jeepney' : m}
              </button>
            ))}
          </div>

          <div className="space-y-4 relative">
            <div className="absolute left-[17px] top-7 bottom-7 w-0.5 bg-gray-300 border-dashed border-l-2"></div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-4 h-4 rounded-full border-[4px] border-blue-500 bg-white flex-shrink-0 shadow-sm"></div>
              <button 
                onClick={onSelectOriginMode}
                className={`flex-1 text-left px-4 py-3 rounded-xl border text-sm transition-all ${!origin ? 'border-blue-400 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 animate-pulse' : 'border-gray-200 bg-white shadow-sm font-medium text-gray-800'}`}
              >
                <div className="truncate">{origin ? origin.name : "Choose starting point..."}</div>
              </button>
            </div>

            <div className="flex items-center gap-4 relative z-10">
              <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0 shadow-sm flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
              <div className="flex-1 text-left px-4 py-3 rounded-xl border border-gray-200 bg-gray-100 text-sm text-gray-800 font-bold shadow-inner">
                <div className="truncate">{destination ? destination.name : "Choose destination..."}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Directions List */}
        <div className="flex-1 overflow-y-auto bg-white">
          {!origin ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 p-8">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
                <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </div>
              <p className="text-sm font-medium">Select a starting point on the map<br/>to calculate your route.</p>
            </div>
          ) : routeInstructions.length > 0 ? (
            <ul className="divide-y divide-gray-100 pb-24">
              {routeInstructions.map((step, idx) => (
                <li key={idx} className="p-5 flex gap-4 items-start hover:bg-gray-50 transition-colors">
                  <div className="mt-0.5 w-7 h-7 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full flex-shrink-0 text-xs font-bold">{idx + 1}</div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 leading-snug">{step.maneuver.instruction}</p>
                    {step.distance > 0 && <p className="text-xs text-gray-500 mt-1.5 font-semibold">{(step.distance).toFixed(0)} meters</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-8 text-center text-sm text-blue-600 font-bold animate-pulse">Calculating optimal route...</div>
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

  // ==========================================
  // 🟢 EXPLORE / DEFAULT MODE
  // ==========================================
  return (
    <div className="absolute left-0 top-0 h-full w-96 bg-gray-50 shadow-[4px_0_24px_rgba(0,0,0,0.08)] z-20 flex flex-col border-r border-gray-200">
      
      {/* Sleek Gradient Header */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 pt-7 px-5 shadow-md z-10 relative">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
          </div>
          <div>
            <h2 className="font-black text-white text-2xl tracking-tight leading-none">OlongaPunta</h2>
            <p className="text-blue-200 text-xs font-semibold tracking-wide uppercase mt-1">Transit & Explore</p>
          </div>
        </div>

        {/* Modern Segmented Tabs */}
        <div className="flex bg-blue-900/40 p-1.5 rounded-t-2xl gap-1 backdrop-blur-sm">
          <button 
            onClick={() => setActiveTab('places')} 
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'places' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white hover:bg-white/10'}`}
          >
            Places
          </button>
          <button 
            onClick={() => setActiveTab('routes')} 
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${activeTab === 'routes' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white hover:bg-white/10'}`}
          >
            Jeepney Routes
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        
        {/* PLACES TAB (Upgraded to match Jeepney cards) */}
        {activeTab === 'places' && placesWithDistance.map((place, index) => (
          <div key={place.id || index} className="group bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer" onClick={() => onSelectPlace(place)}>
            <div className="flex justify-between items-start mb-3">
              <div className="pr-3">
                <h3 className="font-extrabold text-gray-900 text-base leading-tight mb-1 group-hover:text-blue-600 transition-colors">{place.name}</h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{place.type.replace('_', ' ')}</p>
              </div>
              {place.distance > 0 && (
                <div className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0 border border-gray-200">
                  {(place.distance / 1000).toFixed(1)} km
                </div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); onStartNavigation(place); }} className="w-full py-2.5 rounded-xl font-bold bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all text-sm flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
              Navigate Here
            </button>
          </div>
        ))}

        {/* ROUTES TAB */}
        {activeTab === 'routes' && mockRoutes.flatMap((route) => {
          const routeHex = JEEPNEY_HEX_COLORS[route.colorCode] || '#000000';

          const directions = [
            { title: route.routeName, id: `${route.id}-fwd`, label: 'Forward' },
            { title: route.reversedName, id: `${route.id}-rev`, label: 'Return' }
          ];

          return directions.map((dir) => {
            const isIsolated = isolatedDirectionId === dir.id;
            const isActive = isolatedDirectionId ? isIsolated : visibleRouteIds.includes(route.id);
            const isLightBadge = ['YELLOW', 'WHITE', 'CREAM'].includes(route.colorCode);
            const badgeTextColor = isLightBadge ? 'text-gray-900' : 'text-white';

            return (
              <div 
                key={dir.id}
                onClick={() => onSelectRoute(route.id, dir.id)}
                className={`group relative flex items-center p-3 rounded-2xl cursor-pointer transition-all duration-300 border-2 overflow-hidden ${
                  isActive 
                    ? 'bg-white border-transparent shadow-sm hover:shadow-lg hover:-translate-y-0.5' 
                    : 'bg-white/50 border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-100'
                } ${isIsolated ? '!border-blue-500 shadow-blue-100' : ''}`}
              >
                <div 
                  className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl flex-shrink-0 shadow-inner font-black tracking-tighter ${badgeTextColor}`}
                  style={{ backgroundColor: routeHex }}
                >
                  <span className="text-[10px] opacity-80 mb-0.5 uppercase tracking-widest font-bold">JEEP</span>
                  <span className="text-lg leading-none">{route.routeCode}</span>
                </div>

                <div className="ml-4 flex-1 pr-6">
                  <h3 className={`font-extrabold text-sm leading-snug mb-2 transition-colors ${isIsolated ? 'text-blue-700' : 'text-gray-900'}`}>
                    {dir.title}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                      <div className="w-2 h-2 rounded-full shadow-inner" style={{ backgroundColor: routeHex }}></div>
                      {route.colorCode} Line
                    </span>
                    <span className={`px-2 py-1 rounded-md ${dir.label === 'Forward' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      {dir.label}
                    </span>
                  </div>
                </div>

                <div className={`absolute right-4 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                  isIsolated 
                    ? 'bg-blue-600 text-white scale-110 shadow-md' 
                    : 'bg-gray-100 text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isIsolated ? "3" : "2.5"} d={isIsolated ? "M5 13l4 4L19 7" : "M9 5l7 7-7 7"}></path>
                  </svg>
                </div>
              </div>
            );
          });
        })}

      </div>
    </div>
  );
}