import * as cron from "node-cron";
import {
  cacheManager,
  CacheKeys,
  AMENITIES_CACHE_TTL,
} from "../cache/cache-manager";
import { logger } from "../utils/logger";
import { AmenitiesContainer } from "../../modules/node/amenities/container";
import { prisma } from "../prisma";

/**
 * Landmark Sync Job
 *
 * Scheduled background job that syncs landmarks from Overpass to database.
 * Uses node-cron for robust scheduling.
 *
 * Can be triggered:
 * - Scheduled: by cron.schedule()
 * - Manual: via API endpoint (/api/amenities/refresh)
 * - On-demand: via runLandmarkSync()
 */

export interface JobConfig {
  enabled: boolean;
  cronExpression: string;
}

export interface JobRunResult {
  timestamp: Date;
  status: "success" | "error";
  totalFetched: number;
  totalInserted: number;
  totalSkipped: number;
  durationMs: number;
  error?: string;
  cacheUpdated: boolean;
}

let syncJobTask: cron.ScheduledTask | null = null;
let lastRun: JobRunResult | null = null;

// ─── Job Management ──────────────────────────────────────

/**
 * Initialize and start the landmark sync job using node-cron
 * Cron format: "minute hour day-of-month month day-of-week"
 * Example: "0 2 * * *" = 2:00 AM every day
 */
export async function initializeSyncJob(config: JobConfig): Promise<void> {
  if (!config.enabled) {
    logger.info("Landmark sync job is disabled in config");
    return;
  }

  try {
    // Schedule the sync job using node-cron
    syncJobTask = cron.schedule(config.cronExpression, async () => {
      logger.info(
        `🕐 Landmark sync cron job triggered (${config.cronExpression})`,
      );
      const result = await runLandmarkSync();
      lastRun = result;
    });

    logger.info(
      `✅ Landmark sync job scheduled: ${config.cronExpression} (Daily Overpass sync)`,
    );
  } catch (err) {
    logger.error("Failed to initialize sync job:", err);
    throw err;
  }
}

/**
 * Stop the sync job scheduler
 */
export function stopSyncJob(): void {
  if (syncJobTask) {
    syncJobTask.stop();
    syncJobTask = null;
    logger.info("Landmark sync job stopped");
  }
}
export async function runLandmarkSync(): Promise<JobRunResult> {
  const startTime = Date.now();

  try {
    logger.info("═══════════════════════════════════════════");
    logger.info("📍 Landmark Sync Job Started");
    logger.info("═══════════════════════════════════════════");

    // Instantiate service with dependencies
    const container = new AmenitiesContainer(prisma);
    const amenitiesService = container["service"];

    // Run sync service (fetches from Overpass, parses, and saves to DB)
    const syncResult = await amenitiesService.syncLandmarks();

    if (!syncResult.ok) {
      logger.error(`Sync failed: ${syncResult.error}`);
      return {
        timestamp: new Date(),
        status: "error",
        totalFetched: syncResult.totalFetched,
        totalInserted: syncResult.totalInserted,
        totalSkipped: syncResult.totalSkipped,
        durationMs: syncResult.durationMs,
        error: syncResult.error,
        cacheUpdated: false,
      };
    }

    // Fetch latest data and cache it
    const latestData = await amenitiesService.fetchFromOverpass();
    await cacheManager.set(
      CacheKeys.amenitiesDefaultArea(),
      latestData,
      AMENITIES_CACHE_TTL.DEFAULT_AREA,
    );

    // Update sync timestamp cache
    await cacheManager.set(
      CacheKeys.amenitiesSyncTimestamp(),
      {
        timestamp: new Date().toISOString(),
        inserted: syncResult.totalInserted,
        skipped: syncResult.totalSkipped,
      },
      AMENITIES_CACHE_TTL.SYNC_TIMESTAMP,
    );

    const durationMs = Date.now() - startTime;

    logger.info("═══════════════════════════════════════════");
    logger.info("✅ Landmark Sync Completed Successfully");
    logger.info(`   Fetched: ${syncResult.totalFetched}`);
    logger.info(`   Inserted: ${syncResult.totalInserted}`);
    logger.info(`   Skipped: ${syncResult.totalSkipped}`);
    logger.info(
      `   Duration: ${durationMs}ms (${(durationMs / 1000).toFixed(1)}s)`,
    );
    logger.info("═══════════════════════════════════════════");

    return {
      timestamp: new Date(),
      status: "success",
      totalFetched: syncResult.totalFetched,
      totalInserted: syncResult.totalInserted,
      totalSkipped: syncResult.totalSkipped,
      durationMs,
      cacheUpdated: true,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    logger.error("═══════════════════════════════════════════");
    logger.error("❌ Landmark Sync Failed");
    logger.error(`   Error: ${errorMsg}`);
    logger.error(`   Duration: ${durationMs}ms`);
    logger.error("═══════════════════════════════════════════");

    return {
      timestamp: new Date(),
      status: "error",
      totalFetched: 0,
      totalInserted: 0,
      totalSkipped: 0,
      durationMs,
      error: errorMsg,
      cacheUpdated: false,
    };
  }
}

/**
 * Get last sync job execution result
 */
export function getLastSyncResult(): JobRunResult | null {
  return lastRun;
}

/**
 * Get sync job status
 */
export function getSyncJobStatus(): {
  running: boolean;
  lastRun: JobRunResult | null;
} {
  return {
    running: syncJobTask !== null,
    lastRun,
  };
}
