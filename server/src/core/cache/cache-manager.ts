import Redis from "ioredis";
import { redisClient } from "../../config/redis.config";
import { logger } from "../utils/logger";

interface CacheConfig {
  maxMemoryMB: number;
  defaultTTL: number;
  cleanupIntervalMs: number;
  maxEntries: number;
}

interface CacheStats {
  totalEntries: number;
  totalMemoryBytes: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  oldestEntry: number;
  newestEntry: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private redis: Redis;
  private stats = { hits: 0, misses: 0 };

  private config: CacheConfig = {
    maxMemoryMB: 256,
    defaultTTL: 300000,
    cleanupIntervalMs: 120000,
    maxEntries: 15000,
  };

  private constructor(config?: Partial<CacheConfig>) {
    if (config) this.config = { ...this.config, ...config };
    this.redis = redisClient;
    logger.info("CacheManager initialized (Redis backend)");
  }

  public static getInstance(config?: Partial<CacheConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  public async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const ttlSeconds = Math.ceil((ttl ?? this.config.defaultTTL) / 1000);
    await this.redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  }

  public async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) {
      this.stats.misses++;
      return null;
    }
    this.stats.hits++;
    return JSON.parse(raw) as T;
  }

  public async delete(key: string): Promise<boolean> {
    const count = await this.redis.del(key);
    return count > 0;
  }

  public async clear(): Promise<void> {
    await this.redis.flushdb();
    this.stats = { hits: 0, misses: 0 };
    logger.info("Cache cleared");
  }

  public async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  public async invalidatePattern(pattern: string): Promise<number> {
    let deletedCount = 0;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        "MATCH",
        `*${pattern}*`,
        "COUNT",
        "100",
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    if (deletedCount > 0) {
      logger.info("Cache invalidated by pattern", { pattern, deletedCount });
    }
    return deletedCount;
  }

  public getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      totalEntries: 0,
      totalMemoryBytes: 0,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      missRate: total > 0 ? (this.stats.misses / total) * 100 : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      oldestEntry: 0,
      newestEntry: 0,
    };
  }

  public stopCleanupTimer(): void {}

  public shutdown(): void {
    logger.info("CacheManager shutdown");
  }
}

/**
 * Cache key generators for different types of queries
 */
export class CacheKeys {
  // ─── Amenities Caching ───────────────────────────────────

  /**
   * Cache key for default Olongapo landmarks (Overpass response)
   * TTL: 24 hours (synced daily)
   */
  static amenitiesDefaultArea(): string {
    return "amenities:olongapo:default";
  }

  /**
   * Cache key for dynamic area landmarks search
   * TTL: 6 hours (on-demand queries)
   */
  static amenitiesDynamicArea(
    lat: number,
    lng: number,
    radiusKm: number,
  ): string {
    return `amenities:search:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}`;
  }

  /**
   * Cache key for synced timestamp (tracks last Overpass sync)
   */
  static amenitiesSyncTimestamp(): string {
    return "amenities:sync:timestamp";
  }
}

/**
 * Amenities cache configuration constants
 */
export const AMENITIES_CACHE_TTL = {
  DEFAULT_AREA: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  DYNAMIC_AREA: 6 * 60 * 60 * 1000, // 6 hours
  SYNC_TIMESTAMP: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Export singleton instance
export const cacheManager = CacheManager.getInstance({
  maxMemoryMB: 256, // 256MB cache limit
  defaultTTL: 300000, // 5 minutes
  cleanupIntervalMs: 120000, // 2 minutes
  maxEntries: 15000,
});
