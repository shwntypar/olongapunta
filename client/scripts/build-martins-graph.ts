#!/usr/bin/env bun
// =====================================================
// 🧭 OFFLINE GRAPH BUILD — OSM → graph.json
// =====================================================
// Run with: bun run scripts/build-martins-graph.ts
// (or `bun run build:martins-graph` — see package.json)
//
// Fetches drivable roads around every zone in TricycleZoneData.ts from
// Overpass, tags each node/edge with the zone it falls in (or null if
// outside every mapped zone) and whether it's a main road, and writes the
// precomputed result to martins/graph.json. Per the thesis doc's design,
// nothing in the runtime search path (martins.ts / neighbors.ts) does
// network or Turf-heavy work — it's all done here, once, offline.
//
// Unlike the existing zoneRoadGraph.ts (which deliberately excludes
// trunk/primary roads — "roads a tricycle wouldn't use"), this graph
// *includes* main roads and tags them `isMainRoad`, so the Martins engine
// can apply the soft/hard main-road rules itself per zone.

import * as turf from "@turf/turf";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tricycleZones } from "../src/features/map/domain/TricycleZoneData";
import type { MartinsEdge, MartinsGraph, MartinsNode } from "../src/features/map/application/martins/types";

// import.meta.dir is Bun-only; import.meta.url is standard and works the
// same under both Bun and this project's own (Next.js/tsc) type-checking.
const __dirname = dirname(fileURLToPath(import.meta.url));

const OVERPASS_INTERPRETER_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

const OVERPASS_USER_AGENT = "Olongapunta/1.0 (martins graph build; +https://www.openstreetmap.org/copyright)";

// How far past the zones' combined bbox to pull in roads — enough for
// walk-in/walk-out legs and (eventually) inter-zone connectors, without
// pulling in the whole city for a single-zone graph.
const BBOX_PADDING_DEG = 0.006; // ≈ 650m at this latitude

const TRIKE_SPEED_KMH = 20; // placeholder — tune with field data
const MAIN_ROAD_HIGHWAY_CLASSES = ["trunk", "primary", "trunk_link", "primary_link"];
const INCLUDED_HIGHWAY_CLASSES = [
  ...MAIN_ROAD_HIGHWAY_CLASSES,
  "secondary",
  "secondary_link",
  "tertiary",
  "tertiary_link",
  "residential",
  "unclassified",
  "living_street",
  "service",
];

function computeBbox(): [number, number, number, number] {
  const features = tricycleZones.map((z) => turf.feature(z.polygon));
  const collection = turf.featureCollection(features);
  const [minLon, minLat, maxLon, maxLat] = turf.bbox(collection);
  return [minLon - BBOX_PADDING_DEG, minLat - BBOX_PADDING_DEG, maxLon + BBOX_PADDING_DEG, maxLat + BBOX_PADDING_DEG];
}

function buildQuery(bbox: [number, number, number, number]): string {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const highwayPattern = `^(${INCLUDED_HIGHWAY_CLASSES.join("|")})$`;
  // Overpass bbox order is (south, west, north, east)
  return `
[out:json][timeout:60];
(
  way["highway"~"${highwayPattern}"](${minLat}, ${minLon}, ${maxLat}, ${maxLon});
);
out body;
>;
out skel qt;
  `.trim();
}

async function fetchOverpass(query: string): Promise<any> {
  let lastErr = "";
  for (const url of OVERPASS_INTERPRETER_URLS) {
    try {
      console.log(`Fetching from ${url} ...`);
      const res = await fetch(url, {
        method: "POST",
        body: query,
        headers: { "Content-Type": "text/plain", Accept: "application/json", "User-Agent": OVERPASS_USER_AGENT },
        signal: AbortSignal.timeout(120_000),
      });
      const text = await res.text();
      if (!res.ok) {
        lastErr = `HTTP ${res.status}: ${text.slice(0, 300)}`;
        continue;
      }
      const data = JSON.parse(text);
      if (data.remark && (!Array.isArray(data.elements) || data.elements.length === 0)) {
        lastErr = data.remark;
        continue;
      }
      return data;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`All Overpass mirrors failed: ${lastErr}`);
}

function zoneIdForPoint(coords: number[]): string | null {
  const pt = turf.point(coords);
  for (const zone of tricycleZones) {
    try {
      if (turf.booleanPointInPolygon(pt, zone.polygon)) return zone.id;
    } catch {
      // malformed polygon — skip
    }
  }
  return null;
}

async function main() {
  const bbox = computeBbox();
  console.log("Zones:", tricycleZones.map((z) => z.code).join(", "));
  console.log("Bbox:", bbox);

  const query = buildQuery(bbox);
  const data = await fetchOverpass(query);
  const elements: any[] = data.elements || [];
  console.log(`Fetched ${elements.length} OSM elements.`);

  const nodeCoords = new Map<number, [number, number]>();
  for (const el of elements) {
    if (el.type === "node" && typeof el.lon === "number" && typeof el.lat === "number") {
      nodeCoords.set(el.id, [el.lon, el.lat]);
    }
  }

  // NOTE on zone-boundary precision: the thesis doc's own section 4.3 step 3
  // suggests splitting every edge at zone boundaries with turf.lineSplit, so
  // every piece lies in exactly one zone or none. This build instead tags
  // each node-to-node OSM segment by its *midpoint's* zone membership — the
  // same practical approximation the existing zoneRoadGraph.ts already uses
  // in production. OSM way segments between consecutive nodes are typically
  // short (tens of meters) in residential/urban data, so the error this
  // introduces at a boundary is small — but if boundary precision turns out
  // to matter for the thesis's evaluation, swap this for real lineSplit.
  const nodesById = new Map<string, MartinsNode>();
  const edges: MartinsEdge[] = [];
  let mainRoadEdgeCount = 0;

  for (const el of elements) {
    if (el.type !== "way" || !Array.isArray(el.nodes)) continue;
    const highway = el.tags?.highway as string | undefined;
    const isMainRoad = !!highway && MAIN_ROAD_HIGHWAY_CLASSES.includes(highway);

    const wayCoords: [number, number][] = el.nodes.map((id: number) => nodeCoords.get(id)).filter(Boolean);
    if (wayCoords.length < 2) continue;

    for (let i = 0; i < el.nodes.length - 1; i++) {
      const aId = String(el.nodes[i]);
      const bId = String(el.nodes[i + 1]);
      const aCoord = nodeCoords.get(el.nodes[i]);
      const bCoord = nodeCoords.get(el.nodes[i + 1]);
      if (!aCoord || !bCoord) continue;

      if (!nodesById.has(aId)) nodesById.set(aId, { id: aId, lon: aCoord[0], lat: aCoord[1], zoneId: zoneIdForPoint(aCoord) });
      if (!nodesById.has(bId)) nodesById.set(bId, { id: bId, lon: bCoord[0], lat: bCoord[1], zoneId: zoneIdForPoint(bCoord) });

      const midpoint = turf.midpoint(turf.point(aCoord), turf.point(bCoord)).geometry.coordinates;
      const zoneId = zoneIdForPoint(midpoint);
      const distanceKm = turf.distance(turf.point(aCoord), turf.point(bCoord));

      if (isMainRoad) mainRoadEdgeCount++;

      edges.push({
        from: aId,
        to: bId,
        distanceKm,
        trikeMinutes: (distanceKm / TRIKE_SPEED_KMH) * 60,
        isMainRoad,
        zoneId,
        walkable: true,
        coordinates: [aCoord, bCoord],
      });
    }
  }

  const graph: MartinsGraph = {
    generatedAt: new Date().toISOString(),
    bbox,
    nodes: [...nodesById.values()],
    edges,
  };

  console.log(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges (${mainRoadEdgeCount} main-road edges).`);
  const inZoneNodes = graph.nodes.filter((n) => n.zoneId).length;
  console.log(`Nodes inside a zone: ${inZoneNodes} / ${graph.nodes.length}`);

  const outPath = resolve(__dirname, "../src/features/map/application/martins/graph.json");
  writeFileSync(outPath, JSON.stringify(graph));
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error("build-martins-graph failed:", e);
  process.exit(1);
});
