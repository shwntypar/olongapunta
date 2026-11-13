// Turns the labels Martins' search returns into itineraries the app can show.

import { Label, RouteLeg, RouteResult } from "./types";
import { LoadedGraph } from "./neighbors";
import { martins, type MartinsOptions } from "./martins";

/** Walks a label's .prev chain back to the start and turns it into per-leg deltas. */
export function rebuildLegs(goalLabel: Label): RouteLeg[] {
  const chain: Label[] = [];
  for (let cur: Label | null = goalLabel; cur; cur = cur.prev) chain.unshift(cur);

  const legs: RouteLeg[] = [];
  for (let i = 1; i < chain.length; i++) {
    const prevLabel = chain[i - 1];
    const curLabel = chain[i];
    legs.push({
      mode: curLabel.state.mode,
      minutes: curLabel.cost[0] - prevLabel.cost[0],
      pesos: curLabel.cost[1] - prevLabel.cost[1],
      transition: curLabel.transition,
      fromNode: prevLabel.state.node,
      toNode: curLabel.state.node,
      coordinates: curLabel.edge?.coordinates ?? [],
    });
  }
  return legs;
}

export function toRouteResult(label: Label): RouteResult {
  return { cost: label.cost, legs: rebuildLegs(label) };
}

/** Pareto set of routes, fastest first. */
export function findParetoRoutes(
  graph: LoadedGraph,
  startNode: string,
  goalNode: string,
  options?: MartinsOptions
): RouteResult[] {
  const labels = martins(graph, startNode, goalNode, options);
  return labels
    .map(toRouteResult)
    .sort((a, b) => (a.cost[0] !== b.cost[0] ? a.cost[0] - b.cost[0] : a.cost[1] - b.cost[1]));
}
