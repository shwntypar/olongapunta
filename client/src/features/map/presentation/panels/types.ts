// Everything the side panels (desktop sidebar, phone/tablet bottom sheet) show
// and can do. map.tsx owns the state; the panels only display it.

import type { RouteResult } from "../../application/martins/types";
import type { JeepneyRoute } from "../../domain/MockData";
import type { DirectionsRoute, DirectionsStep, Origin, Place, TravelMode } from "../../domain/types";

export interface DirectionsProps {
  origin: Origin | null;
  destination: Place | null;
  mode: TravelMode;
  setMode: (mode: TravelMode) => void;
  routeSteps: DirectionsStep[];
  onSelectOriginMode: () => void;
  onCloseRouting: () => void;

  /** Driving / walking / motor alternatives from Mapbox. */
  roadRoutes: DirectionsRoute[];
  activeRoadIdx: number;
  setActiveRoadIdx: (idx: number) => void;

  /** Jeepney-only trips from the network search (planMixedTrip with tricycles off), fastest first. */
  transitRoutes: RouteResult[];
  activeTransitIdx: number;
  setActiveTransitIdx: (idx: number) => void;
  /** The Transit search is still running (it runs in a Web Worker). */
  isPlanningTransit: boolean;
  /** Minutes to walk the whole way, when known. */
  transitWalkMinutes: number | null;
  /** No jeepney beats walking by TRIP_MIN_SAVING_MIN (or none was found): the panel notes the walk and suggests other ways. */
  transitSavesLittle: boolean;
  /** Routes that would serve this trip but aren't running at this hour. */
  transitNotRunning: JeepneyRoute[];
  /** The fastest tricycle option, offered on the Transit tab when no jeepney clearly beats walking. */
  transitTricycle: { minutes: number; fare: number } | null;

  tricycleRoutes: RouteResult[];
  activeTricycleIdx: number;
  setActiveTricycleIdx: (idx: number) => void;
  /** Walking was at least as fast as any tricycle (see planTricycleTrip). */
  tricycleWalkOnly: boolean;
  tricycleWalkMinutes: number | null;

  /** Mixed mode: tricycle + jeepney itineraries (planMixedTrip). */
  mixedRoutes: RouteResult[];
  activeMixedIdx: number;
  setActiveMixedIdx: (idx: number) => void;
  /** The mixed search is still running (it runs in a Web Worker). */
  isPlanningMixed: boolean;
  /** Walking alone beat every ride combination. */
  mixedWalkOnly: boolean;
  mixedWalkMinutes: number | null;
}

export interface ExploreProps {
  places: Place[];
  isLoadingAmenities: boolean;
  searchQuery: string;
  visibleRouteIds: string[];
  isolatedDirectionId: string | null;
  onSelectRoute: (routeId: string, directionId: string) => void;
  onSelectPlace: (place: Place) => void;
  onStartNavigation: (place: Place) => void;
}

export interface PanelProps extends DirectionsProps, ExploreProps {
  isRoutingMode: boolean;
  isPickingOrigin: boolean;
}
