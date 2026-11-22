// The city road graph (graph.json, built by scripts/build-martins-graph.ts),
// loaded once and shared: the tricycle search runs on it, and walking
// distances (../walking.ts) are measured along it.

import rawGraph from "./graph.json";
import { loadGraph } from "./neighbors";
import { NodeGrid } from "./nodeGrid";
import type { MartinsGraph } from "./types";

// Built once at module load — graph.json is several MB, no reason to re-parse
// it or rebuild the adjacency map on every request.
export const ROAD_GRAPH = loadGraph(rawGraph as unknown as MartinsGraph);
export const ROAD_NODES = [...ROAD_GRAPH.nodes.values()];
export const ROAD_GRID = new NodeGrid(ROAD_NODES);
