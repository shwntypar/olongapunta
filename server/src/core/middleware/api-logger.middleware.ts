/**
 * Comprehensive API Logging Middleware
 * Tracks all API requests with detailed information including user context
 */
import type { Request, Response, NextFunction } from "express";
import { enhancedLogger } from "../utils/enhanced-logger";
import { v4 as uuidv4 } from "uuid";

// Extend Express Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Sanitize request headers to exclude sensitive information
 */
function sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
  const allowedHeaders = [
    "user-agent",
    "content-type",
    "accept",
    "origin",
    "referer",
    "x-forwarded-for",
    "x-real-ip",
  ];

  const sanitized: Record<string, string> = {};
  allowedHeaders.forEach((header) => {
    if (headers[header]) {
      sanitized[header] = String(headers[header]);
    }
  });

  return sanitized;
}

/**
 * Sanitize request body to exclude sensitive information
 */
function sanitizeRequestBody(body: any, path: string): any {
  if (!body || typeof body !== "object") {
    return body;
  }

  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "key",
    "authorization",
    "cookie",
    "session",
  ];

  // Don't log request bodies for auth endpoints (contains passwords)
  if (path.includes("/auth/login") || path.includes("/auth/register")) {
    return { "[REDACTED]": "Auth endpoint - body not logged for security" };
  }

  // For other endpoints, sanitize sensitive fields
  const sanitized = { ...body };

  function redactSensitiveFields(obj: any): any {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(redactSensitiveFields);
    }

    const result = { ...obj };
    Object.keys(result).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some((field) => lowerKey.includes(field))) {
        result[key] = "[REDACTED]";
      } else if (typeof result[key] === "object") {
        result[key] = redactSensitiveFields(result[key]);
      }
    });

    return result;
  }

  return redactSensitiveFields(sanitized);
}

/**
 * Sanitize response body to exclude sensitive information
 */
function sanitizeResponseBody(body: any, statusCode: number): any {
  // Don't log response bodies for errors (might contain sensitive stack traces)
  if (statusCode >= 400) {
    return { "[REDACTED]": "Error response - body not logged for security" };
  }

  // Don't log auth token responses
  if (
    body &&
    typeof body === "object" &&
    (body.token || body.accessToken || body.refreshToken)
  ) {
    return { "[REDACTED]": "Auth response - tokens not logged for security" };
  }

  // For large responses, only log a summary
  if (body && typeof body === "object") {
    const stringified = JSON.stringify(body);
    if (stringified.length > 5000) {
      return {
        "[TRUNCATED]": "Response too large to log",
        keys: Object.keys(body),
        length: stringified.length,
      };
    }
  }

  return body;
}

/**
 * Get client IP address with proxy support
 */
function getClientIP(req: Request): string {
  return (
    req.ip ||
    (req.headers["x-forwarded-for"] as string) ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

/**
 * Determine if request should be logged based on path
 */
function shouldLogRequest(path: string): boolean {
  // Always log API requests
  if (path.startsWith("/api/")) {
    return true;
  }

  // Log health checks but with minimal info
  if (path.includes("/health")) {
    return true;
  }

  // Skip static files, socket.io, and other non-API routes
  const skipPaths = [
    "/socket.io",
    "/favicon.ico",
    "/robots.txt",
    "/static/",
    "/public/",
    "/assets/",
  ];

  return !skipPaths.some((skipPath) => path.startsWith(skipPath));
}

/**
 * API Logging Middleware
 * Logs all incoming requests and outgoing responses with context
 */
export const apiLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Skip logging for certain paths
  if (!shouldLogRequest(req.path)) {
    return next();
  }

  // Generate unique request ID and start timing
  req.requestId = uuidv4();
  req.startTime = Date.now();

  const startTime = req.startTime;
  const clientIP = getClientIP(req);
  const userAgent = req.get("User-Agent") || "unknown";

  // Log request start (for debugging/monitoring)
  enhancedLogger.debug(`Request started: ${req.method} ${req.path}`, {
    requestId: req.requestId,
    ip: clientIP,
    userAgent: userAgent.substring(0, 200), // Limit length
  });

  // Capture original response methods
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  const originalEnd = res.end.bind(res);

  let responseBody: any;
  let responseSent = false;

  // Override response methods to capture body
  res.send = function (body: any) {
    if (!responseSent) {
      responseBody = body;
      responseSent = true;
      logResponse();
    }
    return originalSend(body);
  };

  res.json = function (body: any) {
    if (!responseSent) {
      responseBody = body;
      responseSent = true;
      logResponse();
    }
    return originalJson(body);
  };

  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    if (!responseSent) {
      if (chunk) {
        responseBody = chunk;
      }
      responseSent = true;
      logResponse();
    }
    return originalEnd(chunk, encoding, cb);
  };

  function logResponse() {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Prepare sanitized data
    const sanitizedHeaders = sanitizeHeaders(req.headers);
    const sanitizedRequestBody = sanitizeRequestBody(req.body, req.path);
    const sanitizedResponseBody = sanitizeResponseBody(
      responseBody,
      statusCode,
    );

    // Log to enhanced logger
    enhancedLogger.logApiRequest({
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      userId: req.user?.id,
      userEmail: req.user?.email,
      ip: clientIP,
      userAgent: userAgent.substring(0, 500), // Limit length
      duration,
      requestId: req.requestId,
      requestBody: req.method !== "GET" ? sanitizedRequestBody : undefined,
      responseBody: statusCode < 400 ? sanitizedResponseBody : undefined,
      requestHeaders: sanitizedHeaders,
    });

    // Log authentication events separately
    if (req.path.includes("/auth/")) {
      if (req.path.includes("/login") && statusCode === 200) {
        enhancedLogger.logAuthEvent("LOGIN", {
          userId: req.user?.id,
          userEmail: req.user?.email,
          ip: clientIP,
          userAgent,
        });
      } else if (req.path.includes("/login") && statusCode >= 400) {
        enhancedLogger.logAuthEvent("LOGIN_FAILED", {
          userEmail: req.body?.email,
          ip: clientIP,
          userAgent,
          reason: `HTTP ${statusCode}`,
        });
      } else if (req.path.includes("/logout")) {
        enhancedLogger.logAuthEvent("LOGOUT", {
          userId: req.user?.id,
          userEmail: req.user?.email,
          ip: clientIP,
          userAgent,
        });
      }
    }
  }

  next();
};

/**
 * Error logging enhancement
 * Works with existing error handler to provide additional context
 */
export const enhancedErrorLogger = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Log error with enhanced context
  enhancedLogger.error(err, {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: getClientIP(req),
    userAgent: req.get("User-Agent"),
    userId: req.user?.id,
    userEmail: req.user?.email,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    body:
      req.method !== "GET"
        ? sanitizeRequestBody(req.body, req.path)
        : undefined,
  });

  next(err);
};

/**
 * Daily log rotation middleware
 * Runs cleanup on application start and periodically
 */
export const initializeLogRotation = (): void => {
  // Clean up old logs on startup
  enhancedLogger.cleanupOldLogs(30); // Keep 30 days

  // Schedule daily cleanup at midnight
  const scheduleCleanup = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      enhancedLogger.cleanupOldLogs(30);
      scheduleCleanup(); // Schedule next cleanup
    }, msUntilMidnight);
  };

  scheduleCleanup();
  enhancedLogger.info(
    "Log rotation initialized - old logs will be cleaned up daily",
  );
};
