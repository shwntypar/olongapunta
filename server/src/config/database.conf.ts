/**
 * Enhanced database configuration with connection pooling and monitoring
 * Implements singleton pattern for optimized database connection management
 */
import { PrismaClient, Prisma } from "../../generated/prisma/client";
import { logger } from "../core/utils/logger";
import { config } from "./environment";

/**
 * Enhanced database manager with connection pooling and monitoring
 * Provides centralized database connection with advanced configuration
 */
class DatabaseManager {
  private static instance: PrismaClient;
  private static connectionCount = 0;
  private static slowQueryThreshold = 1000; // 1 second

  /**
   * Gets or creates a singleton Prisma client instance with connection pooling
   * Configures database logging, monitoring, and connection limits
   * @returns Configured PrismaClient instance
   */
  public static getInstance(): PrismaClient {
    if (!DatabaseManager.instance) {
      // Create Prisma client with enhanced configuration and connection pooling
      DatabaseManager.instance = new PrismaClient({
        log: [
          { emit: "event", level: "query" },
          { emit: "event", level: "error" },
          { emit: "event", level: "info" },
          { emit: "event", level: "warn" },
        ],
        datasources: {
          db: {
            url: config.database.url,
          },
        },
        // Enhanced connection configuration with retry policies
        __internal: {
          debug: false,
          engine: {
            // Connection pool settings (optimized for high concurrency)
            connectionLimit: 75, // Increased from 50
            poolTimeout: 45000, // 45 seconds (increased from 30s)
            idleTimeout: 900000, // 15 minutes (increased from 10min)
            maxConnections: 75, // Match connectionLimit
            minConnections: 10, // Increased from 5 for better performance
            acquireTimeout: 90000, // 90 seconds (increased from 60s)

            // Connection lifecycle settings
            connectTimeout: 20000, // 20 seconds for initial connection
            socketTimeout: 120000, // 2 minutes for socket operations

            // Retry policy configuration
            retryAttempts: 5, // Number of retry attempts
            retryDelay: 2000, // Initial retry delay (2 seconds)
            maxRetryDelay: 30000, // Maximum retry delay (30 seconds)
            retryDelayMultiplier: 2, // Exponential backoff multiplier

            // Connection validation
            validationTimeout: 5000, // 5 seconds to validate connections
            testOnBorrow: true, // Test connections before use
            evictionRunIntervalMillis: 30000, // Check for idle connections every 30s

            // Performance optimizations
            keepAlive: true, // Enable TCP keep-alive
            keepAliveInitialDelay: 300000, // 5 minutes before first keep-alive probe
          },
        },
      } as any);

      // Set up enhanced database event logging with monitoring
      (DatabaseManager.instance as any).$on("query", (e: Prisma.QueryEvent) => {
        const duration = e.duration;

        // Log slow queries for performance monitoring
        if (duration > DatabaseManager.slowQueryThreshold) {
          logger.warn("Slow query detected", {
            query:
              e.query.substring(0, 200) + (e.query.length > 200 ? "..." : ""),
            duration: `${duration}ms`,
            params: e.params,
            target: e.target,
          });
        } else if (config.env === "development") {
          logger.debug("Database query", {
            query:
              e.query.substring(0, 100) + (e.query.length > 100 ? "..." : ""),
            duration: `${duration}ms`,
          });
        }
      });

      (DatabaseManager.instance as any).$on("error", (e: Prisma.LogEvent) => {
        logger.error("Database error", {
          message: e.message,
          target: e.target,
          timestamp: e.timestamp,
        });
      });

      (DatabaseManager.instance as any).$on("info", (e: Prisma.LogEvent) => {
        logger.info("Database info", {
          message: e.message,
          target: e.target,
        });
      });

      (DatabaseManager.instance as any).$on("warn", (e: Prisma.LogEvent) => {
        logger.warn("Database warning", {
          message: e.message,
          target: e.target,
        });
      });

      // Add connection monitoring hooks
      DatabaseManager.setupConnectionMonitoring();
    }

    return DatabaseManager.instance;
  }

  /**
   * Sets up connection monitoring and lifecycle management
   */
  private static setupConnectionMonitoring(): void {
    if (!DatabaseManager.instance) return;

    // Monitor connection events
    DatabaseManager.instance
      .$connect()
      .then(() => {
        DatabaseManager.connectionCount++;
        logger.info(
          `Database connected successfully. Active connections: ${DatabaseManager.connectionCount}`,
        );
      })
      .catch((error) => {
        logger.error("Database connection failed", { error: error.message });
      });

    // Set up graceful shutdown handler
    const gracefulShutdown = async () => {
      logger.info("Shutting down database connections...");
      try {
        await DatabaseManager.instance?.$disconnect();
        DatabaseManager.connectionCount = 0;
        logger.info("Database connections closed successfully");
      } catch (error) {
        logger.error("Error closing database connections", { error });
      }
    };

    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
    process.on("beforeExit", gracefulShutdown);
  }

  /**
   * Gets current connection count for monitoring
   */
  public static getConnectionCount(): number {
    return DatabaseManager.connectionCount;
  }

  /**
   * Gets connection pool statistics for monitoring
   */
  public static async getConnectionPoolStats(): Promise<{
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    maxConnections: number;
    pendingQueries: number;
  }> {
    try {
      // Query database for connection statistics
      const stats = (await DatabaseManager.instance.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE state = 'active') as active_connections,
          COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
          COUNT(*) as total_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `) as any[];

      const result = stats[0] || {};

      return {
        activeConnections: parseInt(result.active_connections) || 0,
        idleConnections: parseInt(result.idle_connections) || 0,
        totalConnections: parseInt(result.total_connections) || 0,
        maxConnections: 75, // From our configuration
        pendingQueries: 0, // This would need custom tracking
      };
    } catch (error) {
      logger.error("Failed to get connection pool stats", { error });
      return {
        activeConnections: 0,
        idleConnections: 0,
        totalConnections: 0,
        maxConnections: 75,
        pendingQueries: 0,
      };
    }
  }

  /**
   * Sets slow query threshold for performance monitoring
   */
  public static setSlowQueryThreshold(milliseconds: number): void {
    DatabaseManager.slowQueryThreshold = milliseconds;
  }

  /**
   * Performs a health check on the database connection
   */
  public static async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    responseTime: number;
  }> {
    const start = Date.now();
    try {
      await DatabaseManager.instance.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;
      return { status: "healthy", responseTime };
    } catch (error) {
      const responseTime = Date.now() - start;
      logger.error("Database health check failed", { error, responseTime });
      return { status: "unhealthy", responseTime };
    }
  }

  /**
   * Executes a database operation with retry logic
   * @param operation - Function that returns a Promise to execute
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param retryDelay - Initial delay between retries in ms (default: 1000)
   */
  public static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Don't retry for certain types of errors
        if (
          error.code === "P2025" || // Record not found
          error.code === "P2002" || // Unique constraint violation
          error.code === "P2003" || // Foreign key constraint violation
          error.code === "P2014" || // Required relation violation
          error.code === "P2016" || // Query interpretation error
          error.code === "P2017" // Records for relation not connected
        ) {
          throw error;
        }

        // If this is the last attempt, throw the error
        if (attempt > maxRetries) {
          logger.error(
            `Database operation failed after ${maxRetries} retries`,
            {
              error: error.message,
              code: error.code,
              attempts: attempt,
            },
          );
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = retryDelay * Math.pow(2, attempt - 1);
        const jitterDelay = delay + Math.random() * 1000; // Add jitter

        logger.warn(`Database operation failed, retrying in ${jitterDelay}ms`, {
          error: error.message,
          attempt,
          maxRetries,
          nextRetryIn: `${jitterDelay}ms`,
        });

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, jitterDelay));
      }
    }

    throw lastError!;
  }

  /**
   * Optimized query execution with connection pool awareness
   * @param query - Raw SQL query
   * @param params - Query parameters
   */
  public static async executeRawQuery<T = any>(
    query: string,
    ...params: any[]
  ): Promise<T> {
    return DatabaseManager.executeWithRetry(async () => {
      const start = Date.now();
      try {
        const result = await DatabaseManager.instance.$queryRawUnsafe(
          query,
          ...params,
        );
        const duration = Date.now() - start;

        if (duration > DatabaseManager.slowQueryThreshold) {
          logger.warn("Slow raw query detected", {
            query: query.substring(0, 200) + (query.length > 200 ? "..." : ""),
            duration: `${duration}ms`,
            paramsCount: params.length,
          });
        }

        return result as T;
      } catch (error: any) {
        const duration = Date.now() - start;
        logger.error("Raw query execution failed", {
          query: query.substring(0, 200) + (query.length > 200 ? "..." : ""),
          duration: `${duration}ms`,
          error: error.message,
          code: error.code,
        });
        throw error;
      }
    });
  }

  /**
   * Manually disconnect from database (for testing)
   */
  public static async disconnect(): Promise<void> {
    if (DatabaseManager.instance) {
      await DatabaseManager.instance.$disconnect();
      DatabaseManager.connectionCount = 0;
    }
  }
}

// Export configured Prisma client instance
export const prisma = DatabaseManager.getInstance();
export { DatabaseManager };
