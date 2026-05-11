/**
 * Cache decorator for automatic method result caching
 * Provides transparent caching with configurable TTL and invalidation patterns
 */

import { cacheManager, CacheKeys } from './cache-manager';
import { logger } from '../utils/logger';

interface CacheOptions {
  /** Time to live in milliseconds */
  ttl?: number;
  /** Custom cache key generator */
  keyGenerator?: (...args: any[]) => string;
  /** Cache invalidation patterns when data changes */
  invalidatePatterns?: readonly string[];
  /** Skip caching for certain conditions */
  skipCondition?: (...args: any[]) => boolean;
}

/**
 * Method decorator for automatic caching
 */
export function Cached(options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Check if we should skip caching
      if (options.skipCondition && options.skipCondition(...args)) {
        return await originalMethod.apply(this, args);
      }

      // Generate cache key
      const cacheKey = options.keyGenerator
        ? options.keyGenerator(...args)
        : generateDefaultKey(target.constructor.name, propertyKey, args);

      try {
        // Try to get from cache
        const cached = await cacheManager.get(cacheKey);
        if (cached !== null) {
          logger.debug('Cache hit', {
            method: `${target.constructor.name}.${propertyKey}`,
            key: cacheKey.substring(0, 50) + '...'
          });
          return cached;
        }

        // Cache miss - execute original method
        logger.debug('Cache miss', {
          method: `${target.constructor.name}.${propertyKey}`,
          key: cacheKey.substring(0, 50) + '...'
        });

        const result = await originalMethod.apply(this, args);

        // Store in cache
        await cacheManager.set(cacheKey, result, options.ttl);

        return result;
      } catch (error: any) {
        logger.error('Cache operation failed', {
          method: `${target.constructor.name}.${propertyKey}`,
          error: error?.message || 'Unknown error',
        });
        // Fallback to original method if cache fails
        return await originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator to add cache invalidation methods
 */
export function CacheInvalidation(patterns: string[]) {
  return function<T extends new(...args: any[]) => any>(constructor: T) {
    return class extends constructor {
      protected async invalidateCache(pattern?: string): Promise<void> {
        if (pattern) {
          await cacheManager.invalidatePattern(pattern);
        } else {
          await Promise.all(patterns.map(p => cacheManager.invalidatePattern(p)));
        }
      }

      protected async clearAllCache(): Promise<void> {
        await cacheManager.clear();
      }
    };
  };
}

/**
 * Generate default cache key from method name and arguments
 */
function generateDefaultKey(className: string, methodName: string, args: any[]): string {
  const argsHash = Buffer.from(JSON.stringify(args)).toString('base64');
  return `${className}:${methodName}:${argsHash}`;
}

/**
 * Predefined cache configurations for common use cases
 */
export const CacheConfigs = {
  /** Real-time data - short TTL */
  REAL_TIME: {
    ttl: 30000, // 30 seconds
  },

  /** Dashboard data - medium TTL */
  DASHBOARD: {
    ttl: 120000, // 2 minutes
  },

  /** Analytics data - longer TTL */
  ANALYTICS: {
    ttl: 300000, // 5 minutes
  },

  /** Reports - long TTL */
  REPORTS: {
    ttl: 900000, // 15 minutes
  },

  /** Station data - medium TTL with station-specific invalidation */
  STATION_DATA: {
    ttl: 180000, // 3 minutes
    invalidatePatterns: ['telemetry:station:*'],
  },

  /** Trend analysis - long TTL with metric-specific keys */
  TREND_ANALYSIS: {
    ttl: 600000, // 10 minutes
    keyGenerator: (metric: string, params: any) => CacheKeys.trendAnalysis(metric, params),
    invalidatePatterns: ['telemetry:trends:*'],
  },

  /** Statistical summary - medium TTL */
  STATISTICAL_SUMMARY: {
    ttl: 240000, // 4 minutes
    keyGenerator: (params: any) => CacheKeys.telemetryStats(params),
    invalidatePatterns: ['telemetry:stats:*'],
  },

  /** Extreme weather events - short TTL for alerts */
  EXTREME_EVENTS: {
    ttl: 60000, // 1 minute
    keyGenerator: (params: any) => CacheKeys.extremeEvents(params),
    invalidatePatterns: ['telemetry:extreme:*'],
  },

  /** Data quality reports - very long TTL */
  DATA_QUALITY: {
    ttl: 1800000, // 30 minutes
    keyGenerator: (params: any) => CacheKeys.dataQuality(params),
    invalidatePatterns: ['telemetry:quality:*'],
  },
} as const;

/**
 * Utility function to manually cache a value
 */
export async function cacheValue<T>(key: string, value: T, ttl?: number): Promise<void> {
  await cacheManager.set(key, value, ttl);
}

/**
 * Utility function to get cached value
 */
export async function getCachedValue<T>(key: string): Promise<T | null> {
  return await cacheManager.get<T>(key);
}

/**
 * Utility function to invalidate cache by pattern
 */
export async function invalidateCache(pattern: string): Promise<number> {
  return await cacheManager.invalidatePattern(pattern);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cacheManager.getStats();
}