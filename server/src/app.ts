import type { Application, NextFunction, Response, Request } from "express";
import express from "express";
import http from "http";
import { logger } from "./core/utils/logger";
import { enhancedLogger } from "./core/utils/enhanced-logger";
import { AppError } from "./core/utils/error";
import {
  errorHandler,
  requestLogger,
} from "./core/middleware/error-handler.middleware";
import {
  apiLoggerMiddleware,
  enhancedErrorLogger,
  initializeLogRotation,
} from "./core/middleware/api-logger.middleware";
import { AppRoutes } from "./routes";
import type { PrismaClient } from "../generated/prisma/client";
import { prisma } from "./core/prisma";
import { AuthContainer } from "./modules/auth/container";
import { corsOptions, customCors } from "./core/middleware/cors.middlware";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config/environment";
import { NodeContainer } from "./modules/node/container";

export class App {
  public app: Application;
  public server: http.Server;
  private prisma: PrismaClient;
  private appRoutes!: AppRoutes;

  // modules
  private authContainer: AuthContainer;
  private nodeContainer: NodeContainer;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.prisma = prisma;

    // modules
    this.authContainer = new AuthContainer(this.prisma);
    this.nodeContainer = new NodeContainer(this.prisma);

    this.configureMiddle();
    this.setupRoutes();
    this.configureErrorHandling();
    this.setupShutdownHandlers();
  }

  private configureMiddle() {
    this.app.use(requestLogger);

    this.app.use(apiLoggerMiddleware);

    this.app.use(customCors);
    this.app.options(/(.*)/, cors(corsOptions));

    this.app.use(cookieParser());
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    this.app.set("trust proxy", 1);
  }

  private setupRoutes(): void {
    this.appRoutes = new AppRoutes(
      this.prisma,
      this.authContainer,
      this.nodeContainer,
    );

    this.app.use("/api", this.appRoutes.getRouter());

    this.app.get("/health/quick", (_req: Request, res: Response) => {
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });
  }

  private configureErrorHandling(): void {
    this.app.use((_req: Request, _res: Response, next: NextFunction) => {
      next(new AppError("Not Found", 404));
    });

    this.app.use(enhancedErrorLogger);
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
      await this.seedSuperAdmin();
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

  private async seedSuperAdmin(): Promise<void> {
    try {
      const existingSuperAdmin = await this.prisma.user.findFirst({
        where: { role: "SUPERADMIN" },
      });

      if (existingSuperAdmin) {
        logger.info(
          `SUPERADMIN already exists with ID: ${existingSuperAdmin.id}`,
        );
        return;
      }

      const bcryptjs = await import("bcryptjs");
      const adminPassword =
        config.superAdmin?.password || "SuperSecurePassword123!";
      const adminEmail =
        config.superAdmin?.email || "superadmin@olongapunta.com";
      const adminUsername = config.superAdmin?.username || "superadmin";

      const hashedPassword = await bcryptjs.hash(adminPassword, 10);

      logger.info("Creating SUPERADMIN user...");
      const superAdmin = await this.prisma.user.create({
        data: {
          userName: adminUsername,
          firstName: "Super",
          lastName: "Admin",
          email: adminEmail,
          role: "SUPERADMIN",
          password: hashedPassword,
          createdAt: new Date(),
        },
      });

      logger.info(`Created SUPERADMIN with ID: ${superAdmin.id}`);
    } catch (error) {
      logger.error("Error during superadmin seeding:", error);
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
