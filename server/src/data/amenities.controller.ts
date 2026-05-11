import type { Request, Response } from "express";
import { asyncHandler } from "../core/middleware/error-handler.middleware";
import { AmenitiesService } from "./amenities.service";
import {
  cacheManager,
  CacheKeys,
  AMENITIES_CACHE_TTL,
} from "../core/cache/cache-manager";
import {
  runLandmarkSync,
  getLastSyncResult,
} from "../core/jobs/sync-landmarks.job";
import { prisma } from "../core/prisma";
import { logger } from "../core/utils/logger";

/**
 * GET /api/amenities
 * Fetch landmarks for default Olongapo area with caching.
 * Uses cache-aside pattern: Redis (24h) → DB fallback
 *
 * Query params:
 * - ?force=true : bypass cache, fetch fresh from Overpass
 */
export const getAmenities = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const forceFresh = req.query.force === "true";

    try {
      let data: any;
      let source = "cache";

      if (forceFresh) {
        logger.debug("Force refresh requested, bypassing cache");
        data = await AmenitiesService.fetchFromOverpass();
        source = "overpass";

        // Update cache with fresh data
        await cacheManager.set(
          CacheKeys.amenitiesDefaultArea(),
          data,
          AMENITIES_CACHE_TTL.DEFAULT_AREA,
        );
      } else {
        // Try cache first
        const cached = await cacheManager.get(CacheKeys.amenitiesDefaultArea());
        if (cached) {
          data = cached;
          source = "cache";
        } else {
          // Cache miss, fetch from Overpass
          logger.debug("Cache miss, fetching from Overpass");
          data = await AmenitiesService.fetchFromOverpass();
          source = "overpass";

          // Cache the result
          await cacheManager.set(
            CacheKeys.amenitiesDefaultArea(),
            data,
            AMENITIES_CACHE_TTL.DEFAULT_AREA,
          );
        }
      }

      res.json({
        ok: true,
        data,
        source,
        cached: source === "cache",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error("Amenities fetch error:", err);

      res.status(503).json({
        ok: false,
        error: "Failed to fetch amenities",
        message: errorMsg,
      });
    }
  },
);

/**
 * GET /api/amenities/search
 * Query landmarks from database with dynamic area and filters.
 * Supports geospatial search with radius.
 *
 * Query params:
 * - lat: latitude (required)
 * - lng: longitude (required)
 * - radiusKm: search radius in kilometers (default: 1)
 * - category: filter by category (optional)
 * - limit: max results (default: 50, max: 200)
 */
export const searchAmenities = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = Math.max(
      0.1,
      Math.min(parseFloat(req.query.radiusKm as string) || 1, 10),
    );
    const category = req.query.category as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      res.status(400).json({
        ok: false,
        error: "Invalid coordinates",
        message: "Latitude must be -90 to 90, longitude must be -180 to 180",
      });
      return;
    }

    try {
      // Use spatial index on lat/lng for efficient range query
      const latDelta = radiusKm / 111; // ~111km per degree latitude
      const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180)); // Adjust for longitude compression

      const landmarks = await prisma.landmark.findMany({
        where: {
          node: {
            lat: {
              gte: (lat - latDelta).toString(),
              lte: (lat + latDelta).toString(),
            },
            lng: {
              gte: (lng - lngDelta).toString(),
              lte: (lng + lngDelta).toString(),
            },
          },
          ...(category ? { category } : {}),
        },
        include: {
          node: true,
        },
        take: limit,
        orderBy: {
          node: {
            createdAt: "desc",
          },
        },
      });

      res.json({
        ok: true,
        data: landmarks,
        search: {
          center: { lat, lng },
          radiusKm,
          category: category || "all",
        },
        count: landmarks.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Amenities search error:", err);
      res.status(500).json({
        ok: false,
        error: "Search failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

/**
 * POST /api/amenities/refresh
 * Manually trigger landmark sync from Overpass.
 * Requires admin role.
 */
export const refreshAmenities = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info("Manual amenities refresh triggered");

      const result = await runLandmarkSync();

      if (result.status === "error") {
        res.status(503).json({
          ok: false,
          error: "Sync failed",
          message: result.error,
          durationMs: result.durationMs,
        });
        return;
      }

      res.json({
        ok: true,
        message: "Landmarks refreshed successfully",
        result: {
          fetched: result.totalFetched,
          inserted: result.totalInserted,
          skipped: result.totalSkipped,
          durationMs: result.durationMs,
          timestamp: result.timestamp,
        },
      });
    } catch (err) {
      logger.error("Amenities refresh error:", err);
      res.status(500).json({
        ok: false,
        error: "Refresh failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

/**
 * GET /api/amenities/status
 * Get sync job status and statistics.
 */
export const getAmenitiesStatus = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const lastSync = getLastSyncResult();
      const totalCount = await AmenitiesService.getLandmarkCount();
      const restaurantCount =
        await AmenitiesService.getLandmarkCount("restaurant");

      res.json({
        ok: true,
        status: {
          totalLandmarks: totalCount,
          byCategory: {
            restaurants: restaurantCount,
          },
        },
        lastSync: lastSync
          ? {
              timestamp: lastSync.timestamp,
              status: lastSync.status,
              inserted: lastSync.totalInserted,
              skipped: lastSync.totalSkipped,
              durationMs: lastSync.durationMs,
            }
          : null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Amenities status error:", err);
      res.status(500).json({
        ok: false,
        error: "Status retrieval failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

/**
 * GET /api/amenities/cache/monitor
 * Monitor cache hit/miss rates and Redis memory usage.
 * Useful for debugging cache behavior.
 */
export const monitorCache = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Get cache statistics from CacheManager
      const cacheStats = cacheManager.getStats();

      // Get Redis info for memory usage
      const redisInfo = await cacheManager["redis"].info("memory");
      const redisMemoryLines = redisInfo.split("\r\n");
      const memoryUsed = redisMemoryLines.find((line) =>
        line.startsWith("used_memory_human:"),
      );
      const memoryPeak = redisMemoryLines.find((line) =>
        line.startsWith("used_memory_peak_human:"),
      );

      // Get all cache keys
      const defaultAreaKey = CacheKeys.amenitiesDefaultArea();
      const defaultAreaExists =
        await cacheManager["redis"].exists(defaultAreaKey);
      const defaultAreaTTL = await cacheManager["redis"].ttl(defaultAreaKey);
      const defaultAreaSize = defaultAreaExists
        ? await cacheManager["redis"].strlen(defaultAreaKey)
        : 0;

      res.json({
        ok: true,
        cache: {
          stats: {
            totalHits: cacheStats.totalHits,
            totalMisses: cacheStats.totalMisses,
            hitRate: `${cacheStats.hitRate.toFixed(2)}%`,
            missRate: `${cacheStats.missRate.toFixed(2)}%`,
          },
          redis: {
            memory: memoryUsed?.split(":")[1] || "unknown",
            peakMemory: memoryPeak?.split(":")[1] || "unknown",
          },
          amenities: {
            defaultArea: {
              key: defaultAreaKey,
              exists: defaultAreaExists === 1,
              ttlSeconds: defaultAreaTTL,
              ttlFormatted:
                defaultAreaTTL > 0
                  ? `${Math.floor(defaultAreaTTL / 3600)}h ${Math.floor((defaultAreaTTL % 3600) / 60)}m`
                  : "expired",
              sizeBytes: defaultAreaSize,
              sizeMB: (defaultAreaSize / 1024 / 1024).toFixed(2),
            },
          },
        },
        hint: {
          cacheHit: "If hitRate > 80%, cache is working well",
          defaultAreaTTL: `Cache expires in ${Math.floor(defaultAreaTTL / 3600)}h ${Math.floor((defaultAreaTTL % 3600) / 60)}m`,
          refresh: "Use POST /api/amenities/refresh to force cache update",
          bypass: "Use GET /api/amenities?force=true to bypass cache",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error("Cache monitor error:", err);
      res.status(500).json({
        ok: false,
        error: "Cache monitoring failed",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
);
