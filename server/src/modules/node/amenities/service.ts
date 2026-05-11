import { logger } from "../../../core/utils/logger";
import { NodeRepository } from "../repository";
import type { AmenitiesRepository } from "./repository";
import type {
  OverpassElement,
  OverpassResponse,
  ParsedLandmark,
  SyncResult,
} from "./types";
import * as cron from "node-cron";

const OVERPASS_QUERY = `
[out:json][timeout:90];
(
  node["amenity"](14.80,120.25,14.85,120.30);
  way["amenity"](14.80,120.25,14.85,120.30);
  node["shop"](14.80,120.25,14.85,120.30);
  way["shop"](14.80,120.25,14.85,120.30);
);
out body;
>;
out skel qt;
`.trim();

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

const OVERPASS_USER_AGENT =
  "Olongapunta/1.0 (map amenities; +https://www.openstreetmap.org/copyright)";

const BATCH_SIZE = 500;
const CATEGORIES_TO_SYNC = [
  "restaurant",
  "cafe",
  "hospital",
  "pharmacy",
  "bank",
  "school",
  "market",
  "supermarket",
  "convenience_store",
  "bus_stop",
];

export class AmenitiesService {
  private repository: AmenitiesRepository;
  private nodeRepository: NodeRepository;

  constructor(repository: AmenitiesRepository, nodeRepository: NodeRepository) {
    this.repository = repository;
    this.nodeRepository = nodeRepository;
  }

  /**
   * Fetch amenities from Overpass with fallback mirrors.
   * Tries each mirror in sequence until one succeeds.
   */
  async fetchFromOverpass(): Promise<OverpassResponse> {
    let lastError: Error | null = null;

    for (const url of OVERPASS_MIRRORS) {
      try {
        logger.debug(`Fetching from Overpass mirror: ${url}`);

        const response = await fetch(url, {
          method: "POST",
          body: OVERPASS_QUERY,
          headers: {
            "Content-Type": "text/plain",
            Accept: "application/json",
            "User-Agent": OVERPASS_USER_AGENT,
          },
          signal: AbortSignal.timeout(120_000),
        });

        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status} from ${url}`);
          logger.warn(`Overpass mirror failed (${url}): ${response.status}`);
          continue;
        }

        const data = (await response.json()) as OverpassResponse;

        if (
          data.remark &&
          (!Array.isArray(data.elements) || data.elements.length === 0)
        ) {
          lastError = new Error(`Overpass error: ${data.remark}`);
          logger.warn(`Overpass error from ${url}: ${data.remark}`);
          continue;
        }

        logger.info(
          `✓ Overpass fetch successful: ${data.elements?.length || 0} elements from ${url}`,
        );
        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(`Overpass fetch error (${url}): ${lastError.message}`);
      }
    }

    throw lastError || new Error("All Overpass mirrors failed");
  }

  /**
   * Parse Overpass elements into landmark format.
   * Filters by category, extracts coordinates and tags.
   */
  parseElements(elements: OverpassElement[]): ParsedLandmark[] {
    const parsed: ParsedLandmark[] = [];

    for (const element of elements) {
      try {
        // Get coordinates
        const lat = element.lat ?? element.center?.lat;
        const lng = element.lon ?? element.center?.lon;

        if (lat === undefined || lng === undefined) {
          logger.debug(`Skipping element ${element.id}: no coordinates`);
          continue;
        }

        const tags = element.tags || {};
        const category = AmenitiesService.getCategory(tags);

        // Filter by configured categories
        if (!CATEGORIES_TO_SYNC.some((cat) => category.includes(cat))) {
          logger.debug(
            `Skipping element ${element.id}: category "${category}" not in sync list`,
          );
          continue;
        }

        const name = tags.name || `${element.type}/${element.id}`;
        const osmId = `${element.type}/${element.id}`;

        parsed.push({
          osmId,
          osmType: element.type,
          lat,
          lng,
          name,
          category,
          tags,
        });
      } catch (err) {
        logger.error(`Error parsing element ${element.id}:`, err);
      }
    }

    logger.info(
      `Parsed ${parsed.length} landmarks from ${elements.length} elements`,
    );
    return parsed;
  }

  /**
   * Batch insert landmarks with deduplication.
   * Uses parallel node creation + bulk landmark insert for efficiency.
   * Skips if osmId already exists (cheaper than upsert).
   * Processes in configurable batch size to prevent DB lock.
   */
  async batchInsertLandmarks(
    landmarks: ParsedLandmark[],
    batchSize: number = BATCH_SIZE,
  ): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;

    // Check which landmarks already exist
    const existingOsmIds = new Set(
      (
        await this.repository.existingLandmarks(landmarks.map((l) => l.osmId))
      ).map((l) => l.osmId),
    );

    // Process in batches
    for (let i = 0; i < landmarks.length; i += batchSize) {
      const batch = landmarks.slice(i, i + batchSize);

      // Separate new from existing
      const newLandmarks = batch.filter((l) => !existingOsmIds.has(l.osmId));

      if (newLandmarks.length === 0) {
        skipped += batch.length;
        logger.debug(
          `Batch ${i / batchSize + 1}: all ${batch.length} landmarks already exist, skipping`,
        );
        continue;
      }

      try {
        // ✅ EFFICIENT: Create all nodes in parallel (Promise.all)
        // This is much faster than awaiting each node creation sequentially
        const nodeCreationPromises = newLandmarks
          .filter(
            (landmark, idx, arr) =>
              arr.findIndex((l) => l.osmId === landmark.osmId) === idx, // Deduplicate by osmId
          )
          .map((landmark) =>
            this.nodeRepository
              .create({
                id: landmark.osmId,
                name: landmark.name,
                lat: landmark.lat.toString(),
                lng: landmark.lng.toString(),
                type: "LANDMARK",
                description: `${landmark.category} from OSM`,
              })
              .catch((err) => {
                logger.error(
                  `Failed to create node for ${landmark.osmId}:`,
                  err,
                );
                return null;
              }),
          );

        const createdNodes = await Promise.all(nodeCreationPromises);
        const nodeIds = new Map(
          createdNodes
            .filter((node) => node !== null)
            .map((node) => [node!.id, node!.id]),
        );

        // ✅ EFFICIENT: Bulk insert landmarks (single DB call instead of O(n))
        // Filter landmarks that have valid nodeIds
        const landmarksToInsert = newLandmarks
          .filter((l) => nodeIds.has(l.osmId))
          .map((landmark) => ({
            osmId: landmark.osmId,
            osmType: landmark.osmType,
            name: landmark.name,
            category: landmark.category,
            tags: landmark.tags as any,
            nodeId: nodeIds.get(landmark.osmId)!,
            syncedAt: new Date(),
          }));

        if (landmarksToInsert.length > 0) {
          // Use createMany if available, otherwise fall back to individual inserts
          if (this.repository.createMany) {
            await this.repository.createMany(landmarksToInsert);
            inserted += landmarksToInsert.length;
          } else {
            // Fallback: create individually
            for (const landmarkData of landmarksToInsert) {
              await this.repository.createLandmark({
                osmId: landmarkData.osmId,
                osmType: landmarkData.osmType,
                name: landmarkData.name,
                category: landmarkData.category,
                tags: landmarkData.tags,
                node: {
                  connect: { id: landmarkData.nodeId },
                },
                syncedAt: landmarkData.syncedAt,
              });
              inserted++;
            }
          }
        }

        skipped += batch.length - newLandmarks.length;

        logger.info(
          `Batch ${Math.floor(i / batchSize) + 1}: inserted ${inserted - (inserted - landmarksToInsert.length)}, skipped ${batch.length - newLandmarks.length}`,
        );
      } catch (err) {
        logger.error(
          `Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
          err,
        );
        // Continue with next batch on error
      }
    }

    logger.info(
      `Batch insert complete: ${inserted} inserted, ${skipped} skipped`,
    );
    return { inserted, skipped };
  }

  /**
   * Main orchestration: Fetch → Parse → Batch Insert
   * Returns sync result with statistics.
   */
  async syncLandmarks(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      logger.info("🚀 Starting landmark sync from Overpass...");

      // Fetch
      const overpassData = await this.fetchFromOverpass();
      const fetchedCount = overpassData.elements?.length || 0;

      // Parse (filter by category)
      const parsedLandmarks = this.parseElements(overpassData.elements || []);

      // Batch insert
      const { inserted, skipped } =
        await this.batchInsertLandmarks(parsedLandmarks);

      const durationMs = Date.now() - startTime;

      logger.info(
        `✅ Sync complete: fetched ${fetchedCount}, parsed ${parsedLandmarks.length}, inserted ${inserted}, skipped ${skipped} (${durationMs}ms)`,
      );

      return {
        ok: true,
        totalFetched: fetchedCount,
        totalInserted: inserted,
        totalSkipped: skipped,
        durationMs,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      logger.error(`❌ Sync failed after ${durationMs}ms: ${errorMsg}`);

      return {
        ok: false,
        totalFetched: 0,
        totalInserted: 0,
        totalSkipped: 0,
        durationMs,
        error: errorMsg,
      };
    }
  }

  /**
   * Get landmark count from database.
   */
  async getLandmarkCount(category?: string): Promise<number> {
    return await this.repository.landMarksCount(category);
  }

  // ─── Helpers ───

  private static getCategory(tags: Record<string, string>): string {
    // Priority: amenity > shop > other
    if (tags.amenity) {
      return tags.amenity;
    }
    if (tags.shop) {
      return `shop:${tags.shop}`;
    }
    return tags.building || "unknown";
  }
}
