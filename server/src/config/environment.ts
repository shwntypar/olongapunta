/**
 * Environment configuration with security-first approach
 * All critical values must be provided via environment variables
 */
import dotenv from "dotenv";
import { validateAndExit } from "./validation";

// Load environment variables from .env file
dotenv.config();

// Validate environment before creating config
validateAndExit();

/**
 * Application configuration object with validated environment variables
 * All critical values are required and validated at startup
 */
export const config = {
  // Application environment settings
  env: process.env.NODE_ENV!,
  port: Number(process.env.PORT) || 3000,

  // Authentication configuration
  cookie: process.env.COOKIE_NAME || "OLONGAPUNTA_COOKIE",

  jwt: {
    secret: process.env.JWT_SECRET!,
  },

  database: {
    url: process.env.DATABASE_URL!, // Required, no fallback
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS) || 10,
    connectionTimeout: Number(process.env.DB_CONNECTION_TIMEOUT) || 60000,
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};
