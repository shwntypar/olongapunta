/**
 * Application entry point
 * Starts the Kloudtrack IoT platform server with HTTP and WebSocket services
 */
import app from "./app";
import { config } from "./config/environment";
import { logger } from "./core/utils/logger";

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("UNHANDLED REJECTION:", reason);
  logger.error("Unhandled Promise Rejection:", {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
  });
  process.exit(1);
});

// Catch uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  logger.error("Uncaught Exception:", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Start the application with configured ports
app.start(config.port).catch((err) => {
  console.error("STARTUP ERROR:", err);
  logger.error("Failed to start application:", err);
  process.exit(1);
});
