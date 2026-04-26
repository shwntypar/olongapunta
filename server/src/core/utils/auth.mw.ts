import type { Request } from "express";

export const API_KEY_HEADER = "x-olongapunta-key";

export const AUTH_TYPES = {
  API_KEY: "api_key",
  JWT: "jwt",
  NONE: "none",
} as const;

export const AUTH_SOURCES = {
  HEADER: "header",
  COOKIE: "cookie",
  UNKNOWN: "unknown",
} as const;

export type AuthType = (typeof AUTH_TYPES)[keyof typeof AUTH_TYPES];
export type AuthSource = (typeof AUTH_SOURCES)[keyof typeof AUTH_SOURCES];

/**
 * Extract API key from request headers
 * Checks both lowercase and uppercase variants
 */
export function getApiKeyHeader(req: Request): string | null {
  const header =
    req.get(API_KEY_HEADER) ?? req.get(API_KEY_HEADER.toUpperCase());
  return header?.trim() || null;
}

/**
 * Extract client IP from request
 */
export function getClientIP(req: Request): string {
  return (req.ip ||
    req.get("x-forwarded-for") ||
    req.get("x-real-ip") ||
    req.socket?.remoteAddress ||
    "unknown") as string;
}

/**
 * Extract user agent from request
 */
export function getUserAgent(req: Request): string {
  return (req.get("User-Agent") ||
    req.get("user-agent") ||
    "unknown") as string;
}

/**
 * Safely parse a value to number for API key ID
 */
export function parseApiKeyId(value: any): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}
