import Redis from "ioredis";
import { logger } from "../core/utils/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Shared ioredis client.
 * Used by: CacheManager, rate limiters, Redlock.
 * Do NOT pass this directly to BullMQ — use createBullMQConnection() instead.
 * BullMQ requires its own dedicated connections per Queue and per Worker.
 */
export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("ready", () => logger.info("Redis ready"));
redisClient.on("error", (err) => logger.error("Redis error:", err));
redisClient.on("close", () => logger.warn("Redis connection closed"));
redisClient.on("reconnecting", () => logger.info("Redis reconnecting..."));

/**
 * Factory for BullMQ connections.
 * BullMQ requires a dedicated ioredis connection per Queue and per Worker.
 * Never share redisClient with BullMQ directly.
 */
export function createBullMQConnection(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function connectRedis(): Promise<void> {
  // Module-level code (rate limiters, Redlock) may auto-connect the shared client
  // before this is called. Only connect if still in the initial 'wait' state.
  if (redisClient.status === "wait") {
    await redisClient.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  await redisClient.quit();
  logger.info("Redis disconnected");
}
