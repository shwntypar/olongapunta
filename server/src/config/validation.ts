/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Environment variable validation and startup checks
 * Ensures all required configuration is present before application starts
 */

interface ValidationError {
  variable: string;
  message: string;
}

/**
 * Validates required environment variables
 * @returns Array of validation errors, empty if all valid
 */
export function validateEnvironment(): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required environment variables
  const requiredVars = [
    { name: "NODE_ENV", value: process.env.NODE_ENV },
    { name: "JWT_SECRET", value: process.env.JWT_SECRET },
    { name: "DATABASE_URL", value: process.env.DATABASE_URL },
  ];

  // Check for missing or empty variables
  for (const { name, value } of requiredVars) {
    if (!value || value.trim() === "") {
      errors.push({
        variable: name,
        message: `${name} is required but not set or empty`,
      });
    }
  }

  // Validate JWT secret strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push({
      variable: "JWT_SECRET",
      message: "JWT_SECRET must be at least 32 characters long for security",
    });
  }

  // Validate port
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push({
      variable: "PORT",
      message: "PORT must be a valid port number (1-65535)",
    });
  }

  return errors;
}

/**
 * Validates environment and exits process if critical errors found
 * Should be called before any other initialization
 */
export function validateAndExit(): void {
  const errors = validateEnvironment();

  if (errors.length > 0) {
    console.error("Environment validation failed:");
    errors.forEach((error) => {
      console.error(`- ${error.variable}: ${error.message}`);
    });

    console.error(
      "Application cannot start with invalid configuration. Please fix the above errors.",
    );
    process.exit(1);
  }

  console.info("Environment validation passed");
}

/**
 * Generates a secure random JWT secret for development
 * @returns Random 64-character hex string
 */
export function generateSecureJWTSecret(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}
