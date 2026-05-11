import { Router } from "express";
import type { AmenitiesController } from "./controller";

export class AmenitiesRoutes {
  private controller: AmenitiesController;
  private router: Router;

  constructor(controller: AmenitiesController) {
    this.router = Router();
    this.controller = controller;

    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get("/", this.controller.getAmenities.bind(this.controller));
    this.router.get(
      "/monitor",
      this.controller.monitorCache.bind(this.controller),
    );
    this.router.post(
      "/refresh",
      this.controller.refreshAmenities.bind(this.controller),
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}
