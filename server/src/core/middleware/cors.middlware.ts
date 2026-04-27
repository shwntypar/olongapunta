/**
 * Secure CORS middleware configuration with environment-based origins
 * Handles cross-origin requests with strict security controls
 */
import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import { config } from "../../config/environment";
import { logger } from "../utils/logger";

/**
 * Configuration interface for CORS settings
 */
interface CorsConfig {
  allowedOrigins: string[];
  isDevelopment: boolean;
  allowCredentials: boolean;
}

// Secure CORS configuration using environment variables
const corsConfig: CorsConfig = {
  allowedOrigins: config.security.corsOrigins,
  isDevelopment: config.env === "development",
  allowCredentials: true,
};

/**
 * Validates if an origin is allowed based on configuration
 * @param origin - The origin to validate
 * @returns True if origin is allowed, false otherwise
 */
const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) {
    // Allow requests without origin only in development (mobile apps, Postman, etc.)
    return corsConfig.isDevelopment;
  }

  // Check exact match against allowed origins
  return corsConfig.allowedOrigins.includes(origin);
};

/**
 * Secure CORS middleware with logging and strict origin validation
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next function
 */
export const customCors = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const userAgent = req.get("User-Agent") || "Unknown";

  if (isOriginAllowed(origin)) {
    // Set appropriate CORS headers for allowed origins
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    } else if (corsConfig.isDevelopment) {
      res.header("Access-Control-Allow-Origin", "*");
    }

    if (corsConfig.allowCredentials && origin) {
      res.header("Access-Control-Allow-Credentials", "true");
    }

    res.header("Vary", "Origin");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With",
    );
    res.header("Access-Control-Max-Age", "86400"); // 24 hours
  } else {
    // Log blocked CORS requests for security monitoring
    logger.warn("CORS request blocked", {
      origin,
      ip: req.ip || req.socket.remoteAddress,
      userAgent,
      path: req.path,
      method: req.method,
    });

    // Don't set CORS headers for disallowed origins
    if (req.method === "OPTIONS") {
      // For preflight requests, still need to respond but without CORS headers
      res.status(204).end();
      return;
    }
  }

  next();
};

/**
 * Standard CORS options for use with the cors middleware
 * Configured with strict origin validation and security logging
 */
export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      logger.warn("CORS origin rejected", { origin });
      callback(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: corsConfig.allowCredentials,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Cache-Control",
  ],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200, // For legacy browser support
};
