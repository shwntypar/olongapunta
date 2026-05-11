import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import { getRoute } from "./data/navigation.controller";
import type { AuthContainer } from "./modules/auth/container";
import { NodeContainer } from "./modules/node/container";
import type { AmenitiesContainer } from "./modules/node/amenities/container";

export class AppRoutes {
  private router: Router;
  private authContainer: AuthContainer;
  private nodeContainer: NodeContainer;
  private amenitiesContainer: AmenitiesContainer;

  constructor(
    prisma: PrismaClient,
    authContainer: AuthContainer,
    nodeContainer: NodeContainer,
    amenitiesContainer: AmenitiesContainer,
  ) {
    this.router = Router();
    this.authContainer = authContainer;
    this.nodeContainer = nodeContainer;
    this.amenitiesContainer = amenitiesContainer;

    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get("/", (req, res) => {
      res.send("Hello, World!");
    });

    this.router.use("/auth", this.authContainer.routes.getRouter());
    this.router.use("/amenities", this.amenitiesContainer.routes.getRouter());
    this.router.use("/nodes", this.nodeContainer.routes.getRouter());
  }

  public getRouter(): Router {
    return this.router;
  }
}
