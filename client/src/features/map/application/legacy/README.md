# Legacy tricycle engine (not used by the app)

`getTricycleRoute.ts` and `zoneRoadGraph.ts` are the original tricycle router:
a per-zone road graph searched with a single-criterion (distance) Dijkstra.

The live app routes tricycles with Martins' multi-criteria algorithm instead
(`../martins/`). Nothing imports these two files. They are kept only as a
reference for the thesis's before/after discussion; delete this folder (and
`src/app/api/tricycle-roads`, `src/lib/overpass/fetchOverpassRoads.ts`,
`src/lib/overpass/roadQuery.ts`, which only this engine uses) once that is no
longer needed.
