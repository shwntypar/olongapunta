import type { Application, NextFunction, Response, Request } from "express";
import express from "express";
import http from "http";
import { logger } from "./core/utils/logger";
import { enhancedLogger } from "./core/utils/enhanced-logger";
import { AppError } from "./core/utils/error";
import { errorHandler } from "./core/middleware/error-handler.middleware";
import { initializeLogRotation } from "./core/middleware/api-logger.middleware";
import { AppRoutes } from "./routes";
import type { PrismaClient } from "../generated/prisma/client";
import { prisma } from "./core/prisma";

export class App {
  public app: Application;
  public server: http.Server;
  private prisma: PrismaClient;
  private appRoutes: AppRoutes;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);

    this.prisma = prisma;
    this.initializeMiddleware();
    this.setupRoutes();
  }

  private initializeMiddleware() {}

  private setupRoutes(): void {
    this.appRoutes = new AppRoutes(this.prisma);
  }

  private configureErrorHandling(): void {
    this.app.use((_req: Request, _res: Response, next: NextFunction) => {
      next(new AppError("Not Found", 404));
    });

    // Enhanced error logging before standard error handler
    // this.app.use(enhancedErrorLogger);
    this.app.use(errorHandler);
  }

  private setupShutdownHandlers(): void {
    const shutdown = async () => {
      logger.info("Shutting down application...");
      await this.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  public async initialize(): Promise<void> {
    try {
      console.log("Connecting to database...");
      await this.prisma.$connect();
      console.log("Database connected successfully");
      // Initialize enhanced logging with daily rotation
      initializeLogRotation();

      logger.info("Connected to database successfully");
      enhancedLogger.info("Application initialized with enhanced logging");

      console.log("Seeding superadmin...");
      // await this.seedSuperAdmin();
      console.log("Superadmin seeding complete");
    } catch (error) {
      console.error("INITIALIZATION ERROR:", error);
      logger.error("Failed to initialize application:", error);
      enhancedLogger.error("Application initialization failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      await this.stop();
      throw error;
    }
  }

  public async start(port: number): Promise<void> {
    try {
      await this.initialize();

      this.server.listen(port, () => {
        logger.info(`Server running on http://localhost:${port}`);
      });
    } catch (error) {
      logger.error("Failed to start server:", error);
      await this.stop();
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      logger.info("Disconnected from database");
    } catch (error) {
      logger.error("Error during shutdown:", error);
    }
  }
}

export default new App();
