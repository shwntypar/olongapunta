import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";
import type { AuthContainer } from "./modules/auth/container";
import { NodeContainer } from "./modules/node/container";
import { jwtOnly } from "./core/middleware/auth.middleware";

export class AppRoutes {
  private router: Router;
  private authContainer: AuthContainer;
  private nodeContainer: NodeContainer;

  constructor(
    prisma: PrismaClient,
    authContainer: AuthContainer,
    nodeContainer: NodeContainer,
  ) {
    this.router = Router();
    this.authContainer = authContainer;
    this.nodeContainer = nodeContainer;

    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get("/", (req, res) => {
      res.send("Hello, World!");
    });

    this.router.use("/auth", this.authContainer.routes.getRouter());
    this.router.use("/nodes", jwtOnly, this.nodeContainer.routes.getRouter());
  }

  public getRouter(): Router {
    return this.router;
  }
}
