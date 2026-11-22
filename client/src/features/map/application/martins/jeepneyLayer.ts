// =====================================================
// 🚐 JEEPNEY LAYER FOR THE MIXED (MULTIMODAL) GRAPH
// =====================================================
// Adds the jeepney network to a road graph so one Martins search can plan a
// trip that walks, rides tricycles and rides jeepneys, hopping between them.
// The plain tricycle graph (planTricycleTrip.ts) is never touched: this works
// on a separate copy built by buildMixedGraph().
//
// What gets added:
//   stops        a node every STOP_SPACING_KM along each route direction
//                (jeepneys stop wherever they're flagged down)
//   ride edges   stop → next stop of the same direction (one-way, in jeepRides,
//                not in the road adjacency — only someone on board can use them)
//   walk links   stop ↔ nearest road node, so riders can walk in and out and
//                transfer through the road network; a stop with no road node
//                close by (outside the mapped road area) links straight to the
//                nearby stops of other directions instead
//
// Boarding costs the route's expected wait (jeepney/serviceRules.ts) and flat fare; riding
// costs time only (see neighbors.ts).

import type { JeepneyRoute } from "../../domain/MockData";
import { routePath } from "../../domain/routeGeometry";
import { DEFAULT_CITY_CENTER } from "../../config";
import { LOCAL_BOARDING_RULES, PROVINCIAL_ROUTE_IDS } from "../../domain/jeepneyAreaRules";
import { nearestLocality } from "../../domain/placeLocation";
import { typicalWaitMinutes } from "../jeepney/serviceRules";
import { JEEPNEY_WAITING_AREAS, OFF_WAITING_AREA_EXTRA_MINUTES, WAITING_AREA_RADIUS_KM } from "../../domain/jeepneyWaitingAreas";
import { getDistanceMeters } from "../geo";
import { JEEP_SPEED_KMH, loadGraph, type LoadedGraph } from "./neighbors";
import { NodeGrid } from "./nodeGrid";
import { addWalkStreets, type WalkStreetsData } from "./walkStreets";
import type { JeepLine, JeepRideEdge, MartinsEdge, MartinsGraph, MartinsNode } from "./types";

export const STOP_SPACING_KM = 0.2;
/** A stop joins the road network if a road node is at most this far. */
export const ROAD_LINK_KM = 0.15;
/** Stops with no road node nearby link to other directions' stops at most this far. */
export const TRANSFER_LINK_KM = 0.3;
/**
 * Provincial jeepneys leaving the city fill up at their terminal and seldom
 * stop on the way out: they can only be boarded within this distance of the
 * start of that direction (assumption — tune with field data).
 */
export const PROVINCIAL_BOARD_WITHIN_KM = 0.4;

/** Straight-line link length × this ≈ the real walk. */
const LINK_DETOUR = 1.3;

const km = (a: number[], b: number[]) => getDistanceMeters(a, b) / 1000;

/** "Gordon Heights to SM Olongapo Downtown" → "SM Olongapo Downtown"; "PALENGKE - MABUYUAN" → "MABUYUAN". */
export const headingOf = (label: string) => label.split(/ to | - /i)[1]?.trim() || label;
/** "Castillejos to Olongapo" → "Castillejos". */
const startOf = (label: string) => label.split(/ to | - /i)[0].trim();

interface Direction {
  line: JeepLine;
  coords: [number, number][];
}

/** Both directions of a route, along the roads (domain/routeGeometry.ts). */
function directionsOf(route: JeepneyRoute): Direction[] {
  const base = { routeId: route.id, routeCode: route.routeCode, colorCode: route.colorCode, fare: route.baseFare, waitMinutes: typicalWaitMinutes(route) };
  const fwd = routePath(route, "fwd");
  const rev = routePath(route, "rev");
  const directions: Direction[] = [];
  if (fwd) directions.push({ line: { ...base, direction: "fwd", heading: headingOf(route.routeName), from: startOf(route.routeName) }, coords: fwd });
  if (rev) directions.push({ line: { ...base, direction: "rev", heading: headingOf(route.reversedName), from: startOf(route.reversedName) }, coords: rev });
  // Provincial routes: the direction that starts downtown and heads out of the city boards only at its terminal.
  if (PROVINCIAL_ROUTE_IDS.has(route.id)) {
    for (const d of directions) {
      const start = d.coords[0];
      const end = d.coords[d.coords.length - 1];
      if (km(start, DEFAULT_CITY_CENTER) < km(end, DEFAULT_CITY_CENTER)) {
        d.line.boardAtStart = d.line.from;
      }
    }
  }
  return directions;
}

/**
 * Cuts a path into pieces of about `spacingKm`. Returns the stop positions
 * (first and last point included) and, for each stop after the first, the
 * path geometry from the previous stop.
 */
export function sampleStops(path: [number, number][], spacingKm: number) {
  const stops: [number, number][] = [path[0]];
  const pieces: [number, number][][] = [];
  let piece: [number, number][] = [path[0]];
  let sinceStop = 0;

  for (let i = 1; i < path.length; i++) {
    let from = path[i - 1];
    const to = path[i];
    let segKm = km(from, to);
    while (sinceStop + segKm >= spacingKm && segKm > 0) {
      const t = (spacingKm - sinceStop) / segKm;
      const cut: [number, number] = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
      piece.push(cut);
      stops.push(cut);
      pieces.push(piece);
      piece = [cut];
      segKm -= spacingKm - sinceStop;
      from = cut;
      sinceStop = 0;
    }
    piece.push(to);
    sinceStop += segKm;
  }
  // The terminal itself is always a stop (merged into the last one if it's very close).
  if (sinceStop > spacingKm / 4 || stops.length === 1) {
    stops.push(path[path.length - 1]);
    pieces.push(piece);
  } else {
    pieces[pieces.length - 1].push(...piece.slice(1));
    stops[stops.length - 1] = path[path.length - 1];
  }
  return { stops, pieces };
}

function addWalkLink(graph: LoadedGraph, a: MartinsNode, b: MartinsNode, straightKm: number, along?: { km: number; coordinates: [number, number][] }) {
  const edge: MartinsEdge = {
    from: a.id,
    to: b.id,
    distanceKm: along ? along.km : straightKm * LINK_DETOUR,
    trikeMinutes: 0,
    isMainRoad: false,
    boardable: false,
    zoneId: null,
    walkable: true,
    walkOnly: true,
    coordinates: along?.coordinates ?? [
      [a.lon, a.lat],
      [b.lon, b.lat],
    ],
  };
  const reverse: MartinsEdge = { ...edge, from: b.id, to: a.id, coordinates: [...edge.coordinates].reverse() };
  for (const e of [edge, reverse]) {
    if (!graph.adjacency.has(e.from)) graph.adjacency.set(e.from, []);
    graph.adjacency.get(e.from)!.push(e);
  }
}

export interface JeepneyLayerStats {
  directions: number;
  stops: number;
  rideEdges: number;
  roadLinks: number;
  transferLinks: number;
  /** Footpaths along a jeepney's road between consecutive stops where the road graph doesn't reach. */
  alongLinks: number;
}

/** Adds every route direction's stops, rides and walk links to `graph` (mutates it). */
export function addJeepneyLayer(graph: LoadedGraph, routes: JeepneyRoute[]): JeepneyLayerStats {
  const roadGrid = new NodeGrid(graph.nodes.values());
  const jeepStops = (graph.jeepStops ??= new Map());
  const jeepRides = (graph.jeepRides ??= new Map());
  const stats: JeepneyLayerStats = { directions: 0, stops: 0, rideEdges: 0, roadLinks: 0, transferLinks: 0, alongLinks: 0 };
  const offRoad: MartinsNode[] = [];

  for (const route of routes) {
    for (const { line, coords } of directionsOf(route)) {
      stats.directions++;
      const { stops, pieces } = sampleStops(coords, STOP_SPACING_KM);
      const ids = stops.map((_, i) => `jeep:${route.id}:${line.direction}:${i}`);
      let alongKm = 0;
      let prevOnRoad = true;

      stops.forEach(([lon, lat], i) => {
        const node: MartinsNode = { id: ids[i], lon, lat, zoneId: null };
        graph.nodes.set(node.id, node);
        jeepStops.set(node.id, line);
        stats.stops++;

        const road = roadGrid.near([lon, lat], ROAD_LINK_KM)[0];
        if (road) {
          addWalkLink(graph, node, road.node, road.km);
          stats.roadLinks++;
        } else {
          offRoad.push(node);
        }

        const coordinates = i > 0 ? pieces[i - 1] : [];
        let distanceKm = 0;
        for (let j = 1; j < coordinates.length; j++) distanceKm += km(coordinates[j - 1], coordinates[j]);
        alongKm += distanceKm;

        // Beyond the mapped roads (e.g. New Cabalan), the jeepney's own road is the only way to walk on:
        // link this stop to the previous one along it. Where both stops reach the road graph, it covers the walk.
        const onRoad = !!road;
        if (i > 0 && !(onRoad && prevOnRoad)) {
          addWalkLink(graph, graph.nodes.get(ids[i - 1])!, node, 0, { km: distanceKm, coordinates });
          stats.alongLinks++;
        }
        prevOnRoad = onRoad;

        // Who can be boarded here: a local rule for the area wins (in Cabalan only the J-06 picks up, in
        // both directions); otherwise an outbound provincial jeepney only near its terminal.
        const localityName = nearestLocality(lat, lon)?.name ?? "";
        const local = LOCAL_BOARDING_RULES.find((rule) => rule.localities.test(localityName));
        const noBoard = local ? !local.onlyRoutes.includes(route.id) : !!line.boardAtStart && alongKm > PROVINCIAL_BOARD_WITHIN_KM;
        (graph.jeepStopAlongKm ??= new Map()).set(ids[i], alongKm);
        if (noBoard) (graph.jeepNoBoard ??= new Set()).add(ids[i]);
        else if (local) (graph.jeepStopNote ??= new Map()).set(ids[i], local.note);

        if (i === 0) return;
        const ride: JeepRideEdge = {
          from: ids[i - 1],
          to: ids[i],
          distanceKm,
          trikeMinutes: 0,
          isMainRoad: false,
          boardable: false,
          zoneId: null,
          walkable: false,
          coordinates,
          line,
          minutes: (distanceKm / JEEP_SPEED_KMH) * 60,
        };
        jeepRides.set(ride.from, ride);
        stats.rideEdges++;
      });
    }
  }

  // Waiting areas: a stop near one boards at the line's usual wait; anywhere else waits longer.
  // Skipped while no waiting areas are known — then every stop is treated alike.
  if (JEEPNEY_WAITING_AREAS.length > 0) {
    const stopWait = (graph.jeepStopWait ??= new Map());
    const stopArea = (graph.jeepStopArea ??= new Map());
    for (const [id, line] of jeepStops) {
      const node = graph.nodes.get(id)!;
      const area = JEEPNEY_WAITING_AREAS.find((a) => km([node.lon, node.lat], [a.lon, a.lat]) <= WAITING_AREA_RADIUS_KM);
      stopArea.set(id, area?.name ?? null);
      if (!area) stopWait.set(id, line.waitMinutes + OFF_WAITING_AREA_EXTRA_MINUTES);
    }
  }

  // Outside the mapped road area: walk straight to the closest stop of every other direction nearby.
  const stopGrid = new NodeGrid([...jeepStops.keys()].map((id) => graph.nodes.get(id)!));
  const linkedPairs = new Set<string>(); // two off-road stops would otherwise link each other twice
  for (const stop of offRoad) {
    const ownLine = jeepStops.get(stop.id)!;
    const linked = new Set<string>([`${ownLine.routeId}:${ownLine.direction}`]);
    for (const { node, km: d } of stopGrid.near([stop.lon, stop.lat], TRANSFER_LINK_KM)) {
      const other = jeepStops.get(node.id)!;
      const key = `${other.routeId}:${other.direction}`;
      if (linked.has(key)) continue;
      linked.add(key);
      const pair = stop.id < node.id ? `${stop.id}|${node.id}` : `${node.id}|${stop.id}`;
      if (linkedPairs.has(pair)) continue;
      linkedPairs.add(pair);
      addWalkLink(graph, stop, node, d);
      stats.transferLinks++;
    }
  }

  return stats;
}

/**
 * A fresh road graph with the jeepney layer on top. `walkStreets`: streets beyond the road graph,
 * added first as walk-only paths (walkStreets.ts) — the app passes them, the Chapter 3 scripts don't.
 */
export function buildMixedGraph(raw: MartinsGraph, routes: JeepneyRoute[], walkStreets?: WalkStreetsData) {
  const graph = loadGraph(raw);
  if (walkStreets) addWalkStreets(graph, walkStreets);
  const stats = addJeepneyLayer(graph, routes);
  return { graph, stats };
}
