/**
 * Enhanced error handling middleware with security logging
 * Provides different error handling for operational vs programming errors
 */
import type { Request, Response, NextFunction } from "express";
import { config } from "../../config/environment";
import { Client } from "pg";
import type { AppError } from "../utils/error";
import { logger } from "../utils/logger";

/**
 * Enhanced global error handler middleware
 * Logs server errors with security context and sends appropriate responses
 * @param err - Error object (AppError or generic Error)
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next function (unused but required for error middleware)
 */

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode = "statusCode" in err ? err.statusCode : 500;
  const message = err.message || "Internal Server Error";

  // Create error context for logging
  const errorContext = {
    method: req.method,
    url: req.url,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
    stack: err.stack,
  };

  // Log different types of errors with appropriate levels
  if (statusCode >= 500) {
    // Server errors - always log with full context
    logger.error(
      `Server Error [${req.method}] ${req.path} >> ${statusCode}: ${message}`,
      errorContext,
    );
  } else if (statusCode === 401 || statusCode === 403) {
    // Security-related errors - log for monitoring
    logger.warn(
      `Security Event [${req.method}] ${req.path} >> ${statusCode}: ${message}`,
      {
        ...errorContext,
        stack: undefined, // Don't log stack for auth errors
      },
    );
  } else if (statusCode >= 400) {
    // Client errors - log with minimal context
    logger.info(
      `Client Error [${req.method}] ${req.path} >> ${statusCode}: ${message}`,
      {
        method: req.method,
        url: req.url,
        ip: errorContext.ip,
        statusCode,
      },
    );
  }

  // Sanitize error message for client response
  let clientMessage = message;
  if (statusCode === 500 && config.env === "production") {
    clientMessage = "Internal Server Error";
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    error: {
      code: statusCode,
      timestamp: errorContext.timestamp,
      // Only include stack trace in development
      ...(config.env === "development" && { stack: err.stack }),
    },
  });
};

/**
 * Enhanced async handler wrapper with error context
 * @param fn - Async function to wrap
 * @returns Express middleware function with enhanced error handling
 */
export const asyncHandler = (fn: any) => {
  return function (req: Request, res: Response, next: NextFunction) {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Add request context to error for better debugging
      if (error instanceof Error) {
        error.message = `${error.message} [Route: ${req.method} ${req.path}]`;
      }
      next(error);
    });
  };
};

/**
 * Middleware to log successful requests for security monitoring
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startTime = Date.now();

  // Log request start for sensitive operations
  if (req.path.includes("/auth/") || req.path.includes("/admin/")) {
    logger.info(`Security Request [${req.method}] ${req.path}`, {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get("User-Agent"),
      userId: req.user?.id,
    });
  }

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime;

    // Log completed requests with timing
    if (res.statusCode >= 400) {
      logger.warn(
        `Request completed [${req.method}] ${req.path} >> ${res.statusCode} (${duration}ms)`,
      );
    } else if (req.path.includes("/auth/") || req.path.includes("/admin/")) {
      logger.info(
        `Security Request completed [${req.method}] ${req.path} >> ${res.statusCode} (${duration}ms)`,
      );
    }

    return originalEnd(chunk, encoding, cb);
  };

  next();
};
