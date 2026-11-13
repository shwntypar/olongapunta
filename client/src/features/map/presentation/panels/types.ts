// Everything the side panels (desktop sidebar, phone/tablet bottom sheet) show
// and can do. map.tsx owns the state; the panels only display it.

import type { RouteResult } from "../../application/martins/types";
import type { DirectionsRoute, DirectionsStep, Origin, Place, TransitCandidate, TravelMode } from "../../domain/types";

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

  transitCandidates: TransitCandidate[];
  activeTransitIdx: number;
  setActiveTransitIdx: (idx: number) => void;

  tricycleRoutes: RouteResult[];
  activeTricycleIdx: number;
  setActiveTricycleIdx: (idx: number) => void;
  /** Walking was at least as fast as any tricycle (see planTricycleTrip). */
  tricycleWalkOnly: boolean;
  tricycleWalkMinutes: number | null;
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
