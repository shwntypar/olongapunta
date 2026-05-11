import {
  AMENITIES_CACHE_TTL,
  CacheKeys,
  cacheManager,
} from "../../../core/cache/cache-manager";
import { asyncHandler } from "../../../core/middleware/error-handler.middleware";
import { logger } from "../../../core/utils/logger";
import { sendResponse } from "../../../core/utils/response";
import { prisma } from "../../../core/prisma";
import type { AmenitiesService } from "./service";
import type { NextFunction, Request, Response } from "express";

export class AmenitiesController {
  private service: AmenitiesService;

  constructor(service: AmenitiesService) {
    this.service = service;
  }

  getAmenities = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const forceFresh = req.query.force === "true";

      try {
        let data: any;
        let source = "cache";

        if (forceFresh) {
          logger.debug("Force refresh requested, bypassing cache");
          data = await this.service.fetchFromOverpass();
          source = "overpass";

          await cacheManager.set(
            CacheKeys.amenitiesDefaultArea(),
            data,
            AMENITIES_CACHE_TTL.DEFAULT_AREA,
          );
        } else {
          const cached = await cacheManager.get(
            CacheKeys.amenitiesDefaultArea(),
          );
          if (cached) {
            data = cached;
            source = "cache";
          } else {
            logger.debug("Cache miss, fetching from Overpass");
            data = await this.service.fetchFromOverpass();
            source = "overpass";

            await cacheManager.set(
              CacheKeys.amenitiesDefaultArea(),
              data,
              AMENITIES_CACHE_TTL.DEFAULT_AREA,
            );
          }
        }

        return sendResponse(
          res,
          {
            data,
            source,
            cached: source === "cache",
            timestamp: new Date().toISOString(),
          },
          200,
          "Amenities fetched successfully",
        );
      } catch (err) {
        next(err);
      }
    },
  );

  searchAmenities = asyncHandler(
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

  monitorCache = asyncHandler(
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const cacheStats = cacheManager.getStats();

        const redisInfo = await cacheManager["redis"].info("memory");
        const redisMemoryLines = redisInfo.split("\r\n");
        const memoryUsed = redisMemoryLines.find((line) =>
          line.startsWith("used_memory_human:"),
        );
        const memoryPeak = redisMemoryLines.find((line) =>
          line.startsWith("used_memory_peak_human:"),
        );

        const defaultAreaKey = CacheKeys.amenitiesDefaultArea();
        const defaultAreaExists =
          await cacheManager["redis"].exists(defaultAreaKey);
        const defaultAreaTTL = await cacheManager["redis"].ttl(defaultAreaKey);
        const defaultAreaSize = defaultAreaExists
          ? await cacheManager["redis"].strlen(defaultAreaKey)
          : 0;

        return sendResponse(res, {
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
        next(err);
      }
    },
  );

  refreshAmenities = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        logger.info("Manual refresh requested: syncing landmarks to database");

        // Sync from Overpass to database
        const syncResult = await this.service.syncLandmarks();

        if (!syncResult.ok) {
          return sendResponse(
            res,
            {
              ok: false,
              error: syncResult.error,
              stats: {
                fetched: syncResult.totalFetched,
                inserted: syncResult.totalInserted,
                skipped: syncResult.totalSkipped,
                durationMs: syncResult.durationMs,
              },
            },
            500,
            "Sync failed",
          );
        }

        // Fetch latest data and update cache
        const latestData = await this.service.fetchFromOverpass();
        await cacheManager.set(
          CacheKeys.amenitiesDefaultArea(),
          latestData,
          AMENITIES_CACHE_TTL.DEFAULT_AREA,
        );

        logger.info(
          `Refresh complete: fetched ${syncResult.totalFetched}, inserted ${syncResult.totalInserted}, skipped ${syncResult.totalSkipped}`,
        );

        return sendResponse(
          res,
          {
            ok: true,
            message: "Amenities synced and cached successfully",
            stats: {
              fetched: syncResult.totalFetched,
              inserted: syncResult.totalInserted,
              skipped: syncResult.totalSkipped,
              durationMs: syncResult.durationMs,
            },
            cached: true,
            timestamp: new Date().toISOString(),
          },
          200,
          "Sync completed successfully",
        );
      } catch (err) {
        next(err);
      }
    },
  );
}
