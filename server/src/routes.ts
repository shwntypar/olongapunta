import { Router } from "express";
import type { PrismaClient } from "../generated/prisma/client";

export class AppRoutes {
  private router: Router;

  constructor(_prisma: PrismaClient) {
    this.router = Router();

    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get("/", (req, res) => {
      res.send("Hello, World!");
    });
  }

  public getRouter(): Router {
    return this.router;
  }
}
